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
const APP_SECRET = process.env.APP_SECRET || process.env.NEXTAUTH_SECRET || 'cfcenter-dev-secret-key-change-me'
const ENCRYPTION_KEY = crypto
  .createHash('sha256')
  .update(APP_SECRET)
  .digest()
  .subarray(0, 32)

const CIPHER = 'AES-256-CBC'

// ─── Token helpers ───────────────────────────────────────────────
// guacamole-lite has TWO decryption paths:
//   1. Server.js.decryptToken() — Buffer-based (for guacd routing)
//   2. ClientConnection.js.decryptToken() — uses Crypt.js (for connection settings)
// The original Crypt.js uses binary/ascii encoding which corrupts certain byte patterns.
// We replace Crypt.js at Docker build time (see guacamole-crypt-patch.js + Dockerfile)
// so both paths now use pure Buffer operations.

/**
 * Encrypt a connection token for guacamole-lite.
 * Uses pure Buffer operations — matches both Server.js and patched Crypt.js decryption.
 * @param {object} tokenObject - { connection: { type, settings } }
 * @returns {string} Base64-encoded encrypted token
 */
function encryptToken(tokenObject) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(CIPHER, ENCRYPTION_KEY, iv)
  const jsonStr = JSON.stringify(tokenObject)
  const encrypted = Buffer.concat([cipher.update(jsonStr, 'utf8'), cipher.final()])
  const tokenData = {
    iv: iv.toString('base64'),
    value: encrypted.toString('base64'),
  }
  return Buffer.from(JSON.stringify(tokenData)).toString('base64')
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
  // NOTE: We must include `server: null` because guacamole-lite's constructor
  // adds `port: 8080` as default when wsOptions lacks a `server` property,
  // and ws throws if both `port` and `noServer` are specified.
  guacServer = new GuacamoleLite(
    { server: null, noServer: true },
    guacdOptions,
    clientOptions
  )

  console.log(`[guacd-proxy] Guacamole proxy initialized (guacd: ${GUACD_HOST}:${GUACD_PORT})`)

  // Self-test: verify encrypt/decrypt roundtrip works through BOTH decryption paths
  const testPayload = { connection: { type: 'vnc', settings: { hostname: 'selftest', port: '5900' } } }
  const testToken = encryptToken(testPayload)

  // Test 1: Server.js decryptToken (Buffer-based)
  try {
    const dec1 = guacServer.decryptToken(testToken)
    if (dec1 && dec1.connection && dec1.connection.settings.hostname === 'selftest') {
      console.log('[guacd-proxy] Self-test Server.js decryptToken: PASSED')
    } else {
      console.error('[guacd-proxy] Self-test Server.js decryptToken: FAILED - mismatch:', JSON.stringify(dec1))
    }
  } catch (err) {
    console.error('[guacd-proxy] Self-test Server.js decryptToken: FAILED -', err.message)
  }

  // Test 2: Crypt.js decrypt (used by ClientConnection — patched at build time)
  try {
    const Crypt = require('guacamole-lite/lib/Crypt')
    const crypt = new Crypt(CIPHER, ENCRYPTION_KEY)
    const dec2 = crypt.decrypt(testToken)
    if (dec2 && dec2.connection && dec2.connection.settings.hostname === 'selftest') {
      console.log('[guacd-proxy] Self-test Crypt.js decrypt: PASSED')
    } else {
      console.error('[guacd-proxy] Self-test Crypt.js decrypt: FAILED - mismatch:', JSON.stringify(dec2))
    }
    // Log whether the patch is active
    const cryptSrc = Crypt.prototype.decrypt.toString()
    const isPatched = cryptSrc.includes('null') && !cryptSrc.includes('binary')
    console.log('[guacd-proxy] Crypt.js patched:', isPatched)
  } catch (err) {
    console.error('[guacd-proxy] Self-test Crypt.js decrypt: FAILED -', err.message)
  }

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
