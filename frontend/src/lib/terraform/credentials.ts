// src/lib/terraform/credentials.ts
// Terraform Credential Store — encrypted storage for provider credentials
// These are SEPARATE from PVE connections and used exclusively by Terraform workspaces.

import { getDb } from '@/lib/db/sqlite'
import { encryptSecret, decryptSecret } from '@/lib/crypto/secret'

// ============================================
// Types
// ============================================

export type TerraformProvider = 'proxmox' | 'aws' | 'azure' | 'gcp' | 'vsphere' | 'custom'

export interface TerraformCredential {
  id: string
  name: string
  provider: TerraformProvider
  description: string | null
  // Stored encrypted — the shape depends on provider
  // proxmox: { endpoint, api_token, insecure }
  // aws: { access_key, secret_key, region }
  // etc.
  config_encrypted: string
  created_by: string | null
  created_at: string
  updated_at: string
}

/** What the UI sends / receives (plaintext config, no encrypted blob) */
export interface TerraformCredentialInput {
  name: string
  provider: TerraformProvider
  description?: string
  config: Record<string, string | boolean>
  created_by?: string
}

/** Returned to the UI — config values are masked except specific safe fields */
export interface TerraformCredentialSafe {
  id: string
  name: string
  provider: TerraformProvider
  description: string | null
  config_preview: Record<string, string>
  created_by: string | null
  created_at: string
  updated_at: string
}

// ============================================
// Provider Schemas — defines what fields each provider needs
// ============================================

export interface ProviderField {
  key: string
  label: string
  type: 'text' | 'password' | 'url' | 'boolean' | 'select'
  required: boolean
  placeholder?: string
  options?: string[]
  safe?: boolean // if true, shown unmasked in previews
}

export const PROVIDER_SCHEMAS: Record<TerraformProvider, { label: string; icon: string; fields: ProviderField[] }> = {
  proxmox: {
    label: 'Proxmox VE',
    icon: 'ri-server-line',
    fields: [
      { key: 'endpoint', label: 'API Endpoint', type: 'url', required: true, placeholder: 'https://pve.example.com:8006', safe: true },
      { key: 'api_token', label: 'API Token', type: 'password', required: true, placeholder: 'user@pam!tokenid=uuid-secret' },
      { key: 'insecure', label: 'Skip TLS Verification', type: 'boolean', required: false },
    ],
  },
  aws: {
    label: 'AWS',
    icon: 'ri-cloud-line',
    fields: [
      { key: 'access_key', label: 'Access Key ID', type: 'text', required: true, placeholder: 'AKIAIOSFODNN7EXAMPLE' },
      { key: 'secret_key', label: 'Secret Access Key', type: 'password', required: true },
      { key: 'region', label: 'Region', type: 'text', required: true, placeholder: 'us-east-1', safe: true },
    ],
  },
  azure: {
    label: 'Azure',
    icon: 'ri-cloud-line',
    fields: [
      { key: 'subscription_id', label: 'Subscription ID', type: 'text', required: true, safe: true },
      { key: 'tenant_id', label: 'Tenant ID', type: 'text', required: true, safe: true },
      { key: 'client_id', label: 'Client ID', type: 'text', required: true },
      { key: 'client_secret', label: 'Client Secret', type: 'password', required: true },
    ],
  },
  gcp: {
    label: 'Google Cloud',
    icon: 'ri-cloud-line',
    fields: [
      { key: 'project', label: 'Project ID', type: 'text', required: true, placeholder: 'my-project-123', safe: true },
      { key: 'region', label: 'Region', type: 'text', required: true, placeholder: 'us-central1', safe: true },
      { key: 'credentials_json', label: 'Service Account JSON', type: 'password', required: true, placeholder: '{"type":"service_account",...}' },
    ],
  },
  vsphere: {
    label: 'VMware vSphere',
    icon: 'ri-server-line',
    fields: [
      { key: 'server', label: 'vCenter Server', type: 'url', required: true, placeholder: 'vcenter.example.com', safe: true },
      { key: 'user', label: 'Username', type: 'text', required: true, placeholder: 'administrator@vsphere.local' },
      { key: 'password', label: 'Password', type: 'password', required: true },
      { key: 'allow_unverified_ssl', label: 'Skip TLS Verification', type: 'boolean', required: false },
    ],
  },
  custom: {
    label: 'Custom',
    icon: 'ri-settings-3-line',
    fields: [
      { key: 'env_vars', label: 'Environment Variables (KEY=VALUE, one per line)', type: 'text', required: false, placeholder: 'TF_VAR_my_var=value' },
    ],
  },
}

// ============================================
// DB Initialization
// ============================================

let tableCreated = false

function generateId(): string {
  return `tfc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

function ensureTable() {
  if (tableCreated) return

  const db = getDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS terraform_credentials (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT NOT NULL DEFAULT 'proxmox',
      description TEXT,
      config_encrypted TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tf_creds_provider ON terraform_credentials(provider);
  `)

  tableCreated = true
}

// ============================================
// CRUD
// ============================================

export function createCredential(input: TerraformCredentialInput): TerraformCredentialSafe {
  ensureTable()
  const db = getDb()
  const now = new Date().toISOString()
  const id = generateId()

  const configStr = JSON.stringify(input.config)
  const encrypted = encryptSecret(configStr)

  db.prepare(`
    INSERT INTO terraform_credentials (id, name, provider, description, config_encrypted, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, input.name.trim(), input.provider, input.description || null, encrypted, input.created_by || null, now, now)

  return getCredentialSafe(id)!
}

export function getCredentialSafe(id: string): TerraformCredentialSafe | null {
  ensureTable()
  const db = getDb()
  const row = db.prepare('SELECT * FROM terraform_credentials WHERE id = ?').get(id) as TerraformCredential | undefined

  if (!row) return null

  return toSafe(row)
}

export function listCredentials(): TerraformCredentialSafe[] {
  ensureTable()
  const db = getDb()
  const rows = db.prepare('SELECT * FROM terraform_credentials ORDER BY updated_at DESC').all() as TerraformCredential[]

  return rows.map(toSafe)
}

export function updateCredential(id: string, updates: {
  name?: string
  description?: string
  provider?: TerraformProvider
  config?: Record<string, string | boolean>
}): TerraformCredentialSafe | null {
  ensureTable()
  const db = getDb()
  const existing = db.prepare('SELECT * FROM terraform_credentials WHERE id = ?').get(id) as TerraformCredential | undefined

  if (!existing) return null

  const now = new Date().toISOString()
  const fields: string[] = ['updated_at = ?']
  const values: unknown[] = [now]

  if (updates.name !== undefined) {
    fields.push('name = ?')
    values.push(updates.name.trim())
  }

  if (updates.description !== undefined) {
    fields.push('description = ?')
    values.push(updates.description)
  }

  if (updates.provider !== undefined) {
    fields.push('provider = ?')
    values.push(updates.provider)
  }

  if (updates.config !== undefined) {
    fields.push('config_encrypted = ?')
    values.push(encryptSecret(JSON.stringify(updates.config)))
  }

  values.push(id)
  db.prepare(`UPDATE terraform_credentials SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  return getCredentialSafe(id)
}

export function deleteCredential(id: string): boolean {
  ensureTable()
  const db = getDb()
  const result = db.prepare('DELETE FROM terraform_credentials WHERE id = ?').run(id)

  return result.changes > 0
}

/** Decrypt and return the raw config (only used server-side when running terraform) */
export function getCredentialConfig(id: string): Record<string, string | boolean> | null {
  ensureTable()
  const db = getDb()
  const row = db.prepare('SELECT config_encrypted FROM terraform_credentials WHERE id = ?').get(id) as { config_encrypted: string } | undefined

  if (!row) return null

  try {
    const decrypted = decryptSecret(row.config_encrypted)

    return JSON.parse(decrypted)
  } catch {
    return null
  }
}

// ============================================
// Helpers
// ============================================

function toSafe(row: TerraformCredential): TerraformCredentialSafe {
  const schema = PROVIDER_SCHEMAS[row.provider] || PROVIDER_SCHEMAS.custom
  let configPreview: Record<string, string> = {}

  try {
    const decrypted = decryptSecret(row.config_encrypted)
    const config = JSON.parse(decrypted) as Record<string, string | boolean>

    for (const field of schema.fields) {
      const val = config[field.key]

      if (val === undefined || val === '') continue

      if (field.safe) {
        configPreview[field.key] = String(val)
      } else if (field.type === 'boolean') {
        configPreview[field.key] = String(val)
      } else {
        // Mask sensitive values
        const s = String(val)
        configPreview[field.key] = s.length > 8 ? s.substring(0, 4) + '••••' + s.substring(s.length - 4) : '••••••••'
      }
    }
  } catch {
    configPreview = { error: 'Failed to decrypt' }
  }

  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    description: row.description,
    config_preview: configPreview,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}
