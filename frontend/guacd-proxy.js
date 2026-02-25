#!/usr/bin/env node
/**
 * Guacamole Proxy for CFCenter
 *
 * Bridges WebSocket connections from guacamole-common-js (browser)
 * to guacd (Apache Guacamole daemon) via guacamole-lite.
 *
 * guacd must be running and accessible (default: guacd:4822 in Docker,
 * or localhost:4822 for local dev). Set GUACD_HOST / GUACD_PORT env vars.
 *
 * Token encryption uses AES-256-CBC with a key derived from APP_SECRET.
 *
 * IMPORTANT: Uses noServer mode so it doesn't conflict with other WebSocket
 * handlers on the same HTTP server. The caller (start.js) must route
 * /ws/guac/ upgrade requests to handleGuacUpgrade().
 */

const crypto = require('crypto')
const GuacamoleLite = require('guacamole-lite')

// ─── Configuration ───────────────────────────────────────────────
const GUACD_HOST = process.env.GUACD_HOST || 'guacd'
const GUACD_PORT = parseInt(process.env.GUACD_PORT, 10) || 4822

// Derive a 32-byte encryption key from APP_SECRET (or use a default for dev)
// Uses raw Buffer to stay consistent between guacd-proxy.js and route.ts
const APP_SECRET = process.env.APP_SECRET || process.env.NEXTAUTH_SECRET || 'cfcenter-dev-secret-key-change-me'
const ENCRYPTION_KEY = crypto
  .createHash('sha256')
  .update(APP_SECRET)
  .digest()
  .subarray(0, 32)

const CIPHER = 'AES-256-CBC'

// ─── Token helpers ───────────────────────────────────────────────

/**
 * Encrypt a connection token for guacamole-lite.
 * Must match the decryption logic in guacamole-lite's Server.decryptToken().
 * @param {object} tokenObject - { connection: { type, settings } }
 * @returns {string} Base64-encoded encrypted token
 */
function encryptToken(tokenObject) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(CIPHER, ENCRYPTION_KEY, iv)
  let encrypted = cipher.update(JSON.stringify(tokenObject), 'utf8', 'base64')
  encrypted += cipher.final('base64')
  const data = {
    iv: iv.toString('base64'),
    value: encrypted,
  }
  return Buffer.from(JSON.stringify(data)).toString('base64')
}

// ─── guacamole-lite instance ─────────────────────────────────────
let guacServer = null

/**
 * Initialize guacamole-lite in noServer mode.
 * Returns the guacamole-lite instance. The caller must route WebSocket
 * upgrade requests to guacServer.webSocketServer via handleGuacUpgrade().
 * @returns {GuacamoleLite} The guacamole-lite instance
 */
function initGuacamoleLite() {
  const guacdOptions = {
    host: GUACD_HOST,
    port: GUACD_PORT,
  }

  const clientOptions = {
    crypt: {
      cypher: CIPHER,
      key: ENCRYPTION_KEY,
    },
    log: {
      level: process.env.NODE_ENV === 'production' ? 'ERRORS' : 'VERBOSE',
    },
    // Default VNC settings (can be overridden per-connection via token)
    connectionDefaultSettings: {
      vnc: {
        'cursor': 'remote',
        'enable-audio': false,
        'color-depth': 24,
      },
      rdp: {
        'security': 'any',
        'ignore-cert': true,
        'enable-wallpaper': false,
        'color-depth': 24,
      },
    },
    // Allow these settings to be passed as unencrypted query params
    // (e.g. screen size from browser)
    allowedUnencryptedConnectionSettings: {
      vnc: ['width', 'height', 'dpi'],
      rdp: ['width', 'height', 'dpi'],
      ssh: ['width', 'height'],
    },
  }

  // Use noServer mode so we control upgrade routing in start.js
  // This prevents guacamole-lite from adding its own upgrade listener
  // to the HTTP server, which would conflict with noVNC/xterm.js routing.
  guacServer = new GuacamoleLite(
    { noServer: true },
    guacdOptions,
    clientOptions
  )

  console.log(`[guacd-proxy] Guacamole proxy initialized (guacd: ${GUACD_HOST}:${GUACD_PORT})`)

  guacServer.on('open', (clientConnection) => {
    console.log(`[guacd-proxy] Client connected: ${clientConnection.connectionId}`)
  })

  guacServer.on('close', (clientConnection) => {
    console.log(`[guacd-proxy] Client disconnected: ${clientConnection.connectionId}`)
  })

  guacServer.on('error', (clientConnection, error) => {
    console.error(`[guacd-proxy] Error:`, error.message || error)
  })

  return guacServer
}

/**
 * Handle a WebSocket upgrade for /ws/guac/ paths.
 * Must be called from start.js's server.on('upgrade') handler.
 * @param {import('http').IncomingMessage} req
 * @param {import('net').Socket} socket
 * @param {Buffer} head
 */
function handleGuacUpgrade(req, socket, head) {
  if (!guacServer || !guacServer.webSocketServer) {
    console.error('[guacd-proxy] Guacamole server not initialized')
    socket.destroy()
    return
  }
  guacServer.webSocketServer.handleUpgrade(req, socket, head, (ws) => {
    guacServer.webSocketServer.emit('connection', ws, req)
  })
}

/**
 * Check if guacd is reachable.
 * @returns {Promise<boolean>}
 */
async function checkGuacdHealth() {
  return new Promise((resolve) => {
    const net = require('net')
    const socket = new net.Socket()
    socket.setTimeout(3000)

    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })

    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })

    socket.on('error', () => {
      socket.destroy()
      resolve(false)
    })

    socket.connect(GUACD_PORT, GUACD_HOST)
  })
}

/**
 * Create an encrypted token for a VNC connection via guacamole-lite.
 * @param {object} params
 * @param {string} params.hostname - VNC server hostname (Proxmox host)
 * @param {number} params.port - VNC port from Proxmox vncproxy
 * @param {string} params.password - VNC ticket/password
 * @returns {string} Encrypted token for guacamole-lite WebSocket URL
 */
function createVncToken({ hostname, port, password }) {
  const tokenObject = {
    connection: {
      type: 'vnc',
      settings: {
        hostname: hostname,
        port: String(port),
        password: password,
        'enable-audio': false,
        'cursor': 'remote',
        'color-depth': 24,
      },
    },
  }
  return encryptToken(tokenObject)
}

module.exports = {
  initGuacamoleLite,
  handleGuacUpgrade,
  checkGuacdHealth,
  createVncToken,
  encryptToken,
  GUACD_HOST,
  GUACD_PORT,
}
