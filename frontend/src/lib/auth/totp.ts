// src/lib/auth/totp.ts
// TOTP (Time-based One-Time Password) support for 2FA
// Uses 'otpauth' library for TOTP generation/verification

import { TOTP, Secret } from 'otpauth'
import crypto from 'crypto'

import { getDb } from '@/lib/db/sqlite'

const ISSUER = 'CFCenter'
const RECOVERY_CODE_COUNT = 8

// ============================================
// DB initialization
// ============================================

let tablesCreated = false

export function initTotpTables() {
  if (tablesCreated) return

  const db = getDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_totp (
      user_id TEXT PRIMARY KEY,
      secret_enc TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      enabled_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_recovery_codes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      used_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_recovery_codes_user ON user_recovery_codes(user_id);
  `)

  tablesCreated = true
}

// ============================================
// TOTP helpers
// ============================================

function createTotpInstance(secret: Secret, userEmail: string): TOTP {
  return new TOTP({
    issuer: ISSUER,
    label: userEmail,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  })
}

// Simple encryption for storing TOTP secrets (uses APP_SECRET)
function encryptTotpSecret(plainSecret: string): string {
  const key = crypto.createHash('sha256').update(process.env.APP_SECRET || 'default-secret').digest()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  const encrypted = Buffer.concat([cipher.update(plainSecret, 'utf8'), cipher.final()])

  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

function decryptTotpSecret(encryptedSecret: string): string {
  const key = crypto.createHash('sha256').update(process.env.APP_SECRET || 'default-secret').digest()
  const [ivHex, encHex] = encryptedSecret.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const encrypted = Buffer.from(encHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])

  return decrypted.toString('utf8')
}

function hashRecoveryCode(code: string): string {
  return crypto.createHash('sha256').update(code.toLowerCase().trim()).digest('hex')
}

function generateRecoveryCode(): string {
  const bytes = crypto.randomBytes(4)

  return bytes.toString('hex').toUpperCase().match(/.{4}/g)!.join('-')
}

// ============================================
// Public API
// ============================================

/**
 * Begin TOTP enrollment — generates a new secret and returns
 * the provisioning URI (for QR code) and the base32 secret.
 * Does NOT enable 2FA yet — user must verify a code first.
 */
export function beginEnrollment(userId: string, userEmail: string): {
  secret: string
  uri: string
  qr_data: string
} {
  initTotpTables()
  const db = getDb()

  // Generate a new random secret
  const secret = new Secret({ size: 20 })
  const totp = createTotpInstance(secret, userEmail)
  const uri = totp.toString()

  // Store the encrypted secret (not yet enabled)
  const now = new Date().toISOString()
  const secretEnc = encryptTotpSecret(secret.base32)

  db.prepare(`
    INSERT OR REPLACE INTO user_totp (user_id, secret_enc, enabled, verified, created_at)
    VALUES (?, ?, 0, 0, ?)
  `).run(userId, secretEnc, now)

  return {
    secret: secret.base32,
    uri,
    qr_data: uri,
  }
}

/**
 * Verify a TOTP code during enrollment — if valid, enables 2FA
 * and generates recovery codes.
 */
export function verifyEnrollment(userId: string, code: string): {
  success: boolean
  recovery_codes?: string[]
  error?: string
} {
  initTotpTables()
  const db = getDb()

  const row = db.prepare('SELECT secret_enc, enabled FROM user_totp WHERE user_id = ?').get(userId) as any

  if (!row) {
    return { success: false, error: 'No TOTP enrollment found. Start enrollment first.' }
  }

  if (row.enabled) {
    return { success: false, error: '2FA is already enabled.' }
  }

  // Decrypt and verify
  const secretBase32 = decryptTotpSecret(row.secret_enc)
  const secret = Secret.fromBase32(secretBase32)
  const totp = createTotpInstance(secret, '')

  const delta = totp.validate({ token: code, window: 1 })

  if (delta === null) {
    return { success: false, error: 'Invalid code. Please try again.' }
  }

  // Enable 2FA
  const now = new Date().toISOString()

  db.prepare('UPDATE user_totp SET enabled = 1, verified = 1, enabled_at = ? WHERE user_id = ?').run(now, userId)

  // Generate recovery codes
  const recoveryCodes = generateRecoveryCodes(userId)

  return { success: true, recovery_codes: recoveryCodes }
}

/**
 * Verify a TOTP code during login.
 */
export function verifyTotpCode(userId: string, code: string): boolean {
  initTotpTables()
  const db = getDb()

  const row = db.prepare('SELECT secret_enc, enabled FROM user_totp WHERE user_id = ? AND enabled = 1').get(userId) as any

  if (!row) return false

  const secretBase32 = decryptTotpSecret(row.secret_enc)
  const secret = Secret.fromBase32(secretBase32)
  const totp = createTotpInstance(secret, '')

  const delta = totp.validate({ token: code, window: 1 })

  return delta !== null
}

/**
 * Verify a recovery code during login (single-use).
 */
export function verifyRecoveryCode(userId: string, code: string): boolean {
  initTotpTables()
  const db = getDb()

  const codeHash = hashRecoveryCode(code)
  const row = db.prepare(
    'SELECT id FROM user_recovery_codes WHERE user_id = ? AND code_hash = ? AND used = 0'
  ).get(userId, codeHash) as any

  if (!row) return false

  // Mark as used
  db.prepare('UPDATE user_recovery_codes SET used = 1, used_at = ? WHERE id = ?')
    .run(new Date().toISOString(), row.id)

  return true
}

/**
 * Check if a user has 2FA enabled.
 */
export function isTotpEnabled(userId: string): boolean {
  initTotpTables()
  const db = getDb()

  const row = db.prepare('SELECT enabled FROM user_totp WHERE user_id = ? AND enabled = 1').get(userId) as any

  return !!row
}

/**
 * Disable 2FA for a user.
 */
export function disableTotp(userId: string): boolean {
  initTotpTables()
  const db = getDb()

  db.prepare('DELETE FROM user_totp WHERE user_id = ?').run(userId)
  db.prepare('DELETE FROM user_recovery_codes WHERE user_id = ?').run(userId)

  return true
}

/**
 * Regenerate recovery codes for a user.
 */
export function regenerateRecoveryCodes(userId: string): string[] {
  initTotpTables()
  const db = getDb()

  // Check 2FA is enabled
  const row = db.prepare('SELECT enabled FROM user_totp WHERE user_id = ? AND enabled = 1').get(userId) as any

  if (!row) return []

  return generateRecoveryCodes(userId)
}

/**
 * Get 2FA status for a user.
 */
export function getTotpStatus(userId: string): {
  enabled: boolean
  verified: boolean
  enabled_at: string | null
  recovery_codes_remaining: number
} {
  initTotpTables()
  const db = getDb()

  const row = db.prepare('SELECT enabled, verified, enabled_at FROM user_totp WHERE user_id = ?').get(userId) as any
  const codesRemaining = (db.prepare(
    'SELECT COUNT(*) as count FROM user_recovery_codes WHERE user_id = ? AND used = 0'
  ).get(userId) as any)?.count || 0

  return {
    enabled: !!row?.enabled,
    verified: !!row?.verified,
    enabled_at: row?.enabled_at || null,
    recovery_codes_remaining: codesRemaining,
  }
}

// ============================================
// Internal helpers
// ============================================

function generateRecoveryCodes(userId: string): string[] {
  const db = getDb()

  // Delete old codes
  db.prepare('DELETE FROM user_recovery_codes WHERE user_id = ?').run(userId)

  const codes: string[] = []
  const now = new Date().toISOString()

  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const code = generateRecoveryCode()
    const codeHash = hashRecoveryCode(code)
    const id = `rc_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`

    db.prepare(
      'INSERT INTO user_recovery_codes (id, user_id, code_hash, used, created_at) VALUES (?, ?, ?, 0, ?)'
    ).run(id, userId, codeHash, now)

    codes.push(code)
  }

  return codes
}
