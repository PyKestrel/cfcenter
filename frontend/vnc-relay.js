#!/usr/bin/env node
/**
 * VNC TCP Relay for Guacamole / CFCenter
 *
 * Proxmox exposes VM consoles via a WebSocket VNC endpoint
 * (POST vncproxy with websocket=1, then GET vncwebsocket).
 * guacd only speaks native VNC over TCP.
 *
 * This module bridges the gap by:
 *   1. Opening a local TCP server on a dynamic port
 *   2. When guacd connects, opening a WebSocket to Proxmox's vncwebsocket
 *   3. Relaying raw VNC data between the TCP socket and WebSocket
 *
 * Each relay is single-use: one TCP connection per relay, then the server closes.
 * Relays auto-expire after 30s if no connection is made.
 */

const net = require('net')
const { WebSocket } = require('ws')

// Track active relays for cleanup
const activeRelays = new Map()

/**
 * Create a VNC relay that bridges a local TCP port to a Proxmox WebSocket VNC endpoint.
 *
 * @param {object} params
 * @param {string} params.baseUrl    - Proxmox base URL (e.g. "https://pve.example.com:8006")
 * @param {string} params.node       - Proxmox node name
 * @param {string} params.type       - Guest type (qemu or lxc)
 * @param {string} params.vmid       - VM/CT ID
 * @param {number} params.port       - VNC port from vncproxy response
 * @param {string} params.ticket     - VNC ticket from vncproxy response
 * @param {string} [params.apiToken] - Optional PVE API token for auth
 * @param {number} [params.timeout]  - Auto-expire timeout in ms (default: 30000)
 *
 * @returns {Promise<{ relayPort: number, relayId: string, close: () => void }>}
 */
function createVncRelay({ baseUrl, node, type, vmid, port, ticket, apiToken, timeout = 30000 }) {
  return new Promise((resolve, reject) => {
    const relayId = `relay-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

    const tcpServer = net.createServer({ allowHalfOpen: false })
    tcpServer.maxConnections = 1 // Single-use relay

    let connected = false
    let cleaned = false

    function cleanup() {
      if (cleaned) return
      cleaned = true
      activeRelays.delete(relayId)
      try { tcpServer.close() } catch {}
      console.log(`[vnc-relay] ${relayId} cleaned up`)
    }

    // Auto-expire if no connection within timeout
    const expireTimer = setTimeout(() => {
      if (!connected) {
        console.log(`[vnc-relay] ${relayId} expired (no connection within ${timeout}ms)`)
        cleanup()
      }
    }, timeout)

    tcpServer.on('connection', (tcpSocket) => {
      connected = true
      clearTimeout(expireTimer)
      console.log(`[vnc-relay] ${relayId} guacd connected, bridging to Proxmox WebSocket VNC`)

      // No more connections accepted
      tcpServer.close()

      // Buffer TCP data from guacd until the Proxmox WebSocket is open.
      // guacd sends VNC handshake immediately on connect; if that data is
      // lost the handshake breaks and guacd drops the connection.
      let wsReady = false
      let tcpBuffer = []

      // Pause the TCP socket until the WebSocket is ready
      tcpSocket.pause()

      // Build Proxmox WebSocket VNC URL
      const pveUrl = new URL(baseUrl)
      const wsProtocol = pveUrl.protocol === 'https:' ? 'wss:' : 'ws:'
      const pveWsUrl = `${wsProtocol}//${pveUrl.host}/api2/json/nodes/${encodeURIComponent(node)}/${encodeURIComponent(type)}/${encodeURIComponent(vmid)}/vncwebsocket?port=${port}&vncticket=${encodeURIComponent(ticket)}`

      console.log(`[vnc-relay] ${relayId} connecting to Proxmox: ${pveWsUrl.replace(/vncticket=[^&]+/, 'vncticket=***')}`)

      const wsHeaders = { 'Origin': baseUrl }
      if (apiToken) {
        wsHeaders['Authorization'] = `PVEAPIToken=${apiToken}`
      }

      const pveWs = new WebSocket(pveWsUrl, ['binary'], {
        rejectUnauthorized: false,
        headers: wsHeaders,
      })

      pveWs.on('open', () => {
        console.log(`[vnc-relay] ${relayId} Proxmox WebSocket connected`)
        wsReady = true

        // Flush any buffered data from guacd
        if (tcpBuffer.length > 0) {
          console.log(`[vnc-relay] ${relayId} flushing ${tcpBuffer.length} buffered chunks (${tcpBuffer.reduce((a,b) => a + b.length, 0)} bytes) to Proxmox`)
          for (const chunk of tcpBuffer) {
            pveWs.send(chunk)
          }
          tcpBuffer = []
        }

        // Resume the TCP socket now that WS is ready
        tcpSocket.resume()
      })

      // Proxmox WS → TCP (guacd)
      let wsToTcpBytes = 0
      pveWs.on('message', (data) => {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)
        wsToTcpBytes += buf.length
        if (wsToTcpBytes <= 200) {
          console.log(`[vnc-relay] ${relayId} WS→TCP: ${buf.length}B first=${buf.toString('utf8', 0, Math.min(buf.length, 40)).replace(/[^\x20-\x7e]/g, '.')}`)
        }
        if (!tcpSocket.destroyed) {
          tcpSocket.write(buf)
        }
      })

      // TCP (guacd) → Proxmox WS
      let tcpToWsBytes = 0
      tcpSocket.on('data', (data) => {
        tcpToWsBytes += data.length
        if (tcpToWsBytes <= 200) {
          console.log(`[vnc-relay] ${relayId} TCP→WS: ${data.length}B first=${data.toString('utf8', 0, Math.min(data.length, 40)).replace(/[^\x20-\x7e]/g, '.')}`)
        }
        if (wsReady && pveWs.readyState === WebSocket.OPEN) {
          pveWs.send(data)
        } else {
          tcpBuffer.push(data)
        }
      })

      // Cleanup on close from either side
      tcpSocket.on('close', (hadError) => {
        console.log(`[vnc-relay] ${relayId} TCP socket closed (hadError=${hadError}, wsToTcp=${wsToTcpBytes}B, tcpToWs=${tcpToWsBytes}B)`)
        if (pveWs.readyState === WebSocket.OPEN) pveWs.close()
        cleanup()
      })

      tcpSocket.on('error', (err) => {
        console.error(`[vnc-relay] ${relayId} TCP error:`, err.message)
        if (pveWs.readyState === WebSocket.OPEN) pveWs.close()
        cleanup()
      })

      pveWs.on('close', (code, reason) => {
        console.log(`[vnc-relay] ${relayId} Proxmox WebSocket closed (code=${code}, reason=${reason || ''})`)
        if (!tcpSocket.destroyed) tcpSocket.destroy()
        cleanup()
      })

      pveWs.on('error', (err) => {
        console.error(`[vnc-relay] ${relayId} Proxmox WebSocket error:`, err.message)
        if (!tcpSocket.destroyed) tcpSocket.destroy()
        cleanup()
      })
    })

    tcpServer.on('error', (err) => {
      clearTimeout(expireTimer)
      console.error(`[vnc-relay] ${relayId} TCP server error:`, err.message)
      cleanup()
      reject(err)
    })

    // Listen on all interfaces so guacd (in a separate Docker container
    // on the same network) can reach this relay
    tcpServer.listen(0, '0.0.0.0', () => {
      const relayPort = tcpServer.address().port
      console.log(`[vnc-relay] ${relayId} listening on 0.0.0.0:${relayPort}`)
      activeRelays.set(relayId, { tcpServer, cleanup })
      resolve({ relayPort, relayId, close: cleanup })
    })
  })
}

/**
 * Close all active relays (for graceful shutdown).
 */
function closeAllRelays() {
  for (const [id, relay] of activeRelays) {
    relay.cleanup()
  }
}

module.exports = { createVncRelay, closeAllRelays }
