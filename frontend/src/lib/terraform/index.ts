// src/lib/terraform/index.ts
// Terraform Integration Engine
// Generates HCL configs for Proxmox VE, manages workspaces, wraps plan/apply/destroy

import { getDb } from '@/lib/db/sqlite'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'

// ============================================
// Types
// ============================================

export interface TerraformWorkspace {
  id: string
  name: string
  description: string | null
  status: 'idle' | 'planning' | 'applying' | 'destroying' | 'error'
  hcl_content: string
  plan_output: string | null
  apply_output: string | null
  state_json: string | null
  last_action: string | null
  last_action_at: string | null
  connection_id: string | null
  credential_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type TerraformAction = 'init' | 'plan' | 'apply' | 'destroy' | 'validate'

export interface TerraformOperation {
  id: string
  workspace_id: string
  action: TerraformAction
  status: 'running' | 'success' | 'failed'
  output: string
  started_at: string
  finished_at: string | null
  duration_ms: number | null
}

export interface HclGeneratorInput {
  connection: {
    endpoint: string
    api_token: string
    insecure: boolean
  }
  resources: HclResource[]
}

export interface HclResource {
  type: 'vm' | 'lxc' | 'pool' | 'network' | 'storage' | 'dns' | 'firewall_rules'
  name: string
  params: Record<string, any>
}

// ============================================
// DB Initialization
// ============================================

let tablesCreated = false

function generateId(prefix: string = 'tf'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

export function initTerraformTables() {
  if (tablesCreated) return

  const db = getDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS terraform_workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'idle',
      hcl_content TEXT NOT NULL DEFAULT '',
      plan_output TEXT,
      apply_output TEXT,
      state_json TEXT,
      last_action TEXT,
      last_action_at TEXT,
      connection_id TEXT,
      credential_id TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tf_workspaces_status ON terraform_workspaces(status);
    CREATE INDEX IF NOT EXISTS idx_tf_workspaces_conn ON terraform_workspaces(connection_id);

    CREATE TABLE IF NOT EXISTS terraform_operations (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      output TEXT NOT NULL DEFAULT '',
      started_at TEXT NOT NULL,
      finished_at TEXT,
      duration_ms INTEGER,
      FOREIGN KEY (workspace_id) REFERENCES terraform_workspaces(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_tf_ops_workspace ON terraform_operations(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_tf_ops_started ON terraform_operations(started_at);
  `)

  // Migration: add credential_id column if table existed before it was introduced
  try {
    const cols = db.prepare("PRAGMA table_info(terraform_workspaces)").all() as { name: string }[]

    if (!cols.some(c => c.name === 'credential_id')) {
      db.exec("ALTER TABLE terraform_workspaces ADD COLUMN credential_id TEXT")
    }
  } catch { /* ignore — column already exists */ }

  tablesCreated = true
}

// ============================================
// Workspace CRUD
// ============================================

export function createWorkspace(input: {
  name: string
  description?: string
  hcl_content?: string
  connection_id?: string
  credential_id?: string
  created_by?: string
}): TerraformWorkspace {
  initTerraformTables()
  const db = getDb()
  const now = new Date().toISOString()
  const id = generateId('tfw')

  const ws: TerraformWorkspace = {
    id,
    name: input.name,
    description: input.description || null,
    status: 'idle',
    hcl_content: input.hcl_content || '',
    plan_output: null,
    apply_output: null,
    state_json: null,
    last_action: null,
    last_action_at: null,
    connection_id: input.connection_id || null,
    credential_id: input.credential_id || null,
    created_by: input.created_by || null,
    created_at: now,
    updated_at: now,
  }

  db.prepare(`
    INSERT INTO terraform_workspaces (id, name, description, status, hcl_content, plan_output, apply_output, state_json, last_action, last_action_at, connection_id, credential_id, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, ws.name, ws.description, ws.status, ws.hcl_content, ws.plan_output, ws.apply_output, ws.state_json, ws.last_action, ws.last_action_at, ws.connection_id, ws.credential_id, ws.created_by, now, now)

  return ws
}

export function getWorkspace(id: string): TerraformWorkspace | null {
  initTerraformTables()
  const db = getDb()
  return db.prepare('SELECT * FROM terraform_workspaces WHERE id = ?').get(id) as TerraformWorkspace | null
}

export function listWorkspaces(): TerraformWorkspace[] {
  initTerraformTables()
  const db = getDb()
  return db.prepare('SELECT * FROM terraform_workspaces ORDER BY updated_at DESC').all() as TerraformWorkspace[]
}

export function updateWorkspace(id: string, updates: Partial<Pick<TerraformWorkspace, 'name' | 'description' | 'status' | 'hcl_content' | 'plan_output' | 'apply_output' | 'state_json' | 'last_action' | 'last_action_at' | 'connection_id' | 'credential_id'>>): TerraformWorkspace | null {
  initTerraformTables()
  const db = getDb()
  const existing = getWorkspace(id)
  if (!existing) return null

  const now = new Date().toISOString()
  const fields: string[] = ['updated_at = ?']
  const values: any[] = [now]

  for (const [key, val] of Object.entries(updates)) {
    if (val !== undefined) {
      fields.push(`${key} = ?`)
      values.push(val)
    }
  }

  values.push(id)
  db.prepare(`UPDATE terraform_workspaces SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  return getWorkspace(id)
}

export function deleteWorkspace(id: string): boolean {
  initTerraformTables()
  const db = getDb()
  const result = db.prepare('DELETE FROM terraform_workspaces WHERE id = ?').run(id)
  return result.changes > 0
}

// ============================================
// Operations (history)
// ============================================

export function createOperation(workspaceId: string, action: TerraformAction): TerraformOperation {
  initTerraformTables()
  const db = getDb()
  const now = new Date().toISOString()
  const id = generateId('tfo')

  const op: TerraformOperation = {
    id,
    workspace_id: workspaceId,
    action,
    status: 'running',
    output: '',
    started_at: now,
    finished_at: null,
    duration_ms: null,
  }

  db.prepare(`
    INSERT INTO terraform_operations (id, workspace_id, action, status, output, started_at, finished_at, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, workspaceId, action, 'running', '', now, null, null)

  return op
}

export function updateOperation(id: string, updates: Partial<Pick<TerraformOperation, 'status' | 'output' | 'finished_at' | 'duration_ms'>>): void {
  initTerraformTables()
  const db = getDb()
  const fields: string[] = []
  const values: any[] = []

  for (const [key, val] of Object.entries(updates)) {
    if (val !== undefined) {
      fields.push(`${key} = ?`)
      values.push(val)
    }
  }

  if (fields.length === 0) return
  values.push(id)
  db.prepare(`UPDATE terraform_operations SET ${fields.join(', ')} WHERE id = ?`).run(...values)
}

export function listOperations(workspaceId: string, limit: number = 20): TerraformOperation[] {
  initTerraformTables()
  const db = getDb()
  return db.prepare('SELECT * FROM terraform_operations WHERE workspace_id = ? ORDER BY started_at DESC LIMIT ?').all(workspaceId, limit) as TerraformOperation[]
}

// ============================================
// HCL Generator
// ============================================

export function generateHclFromTemplate(
  templateConfig: Record<string, any>,
  templateType: 'qemu' | 'lxc',
  vmName: string,
  targetNode: string,
  connectionEndpoint: string,
  insecure: boolean = true,
): string {
  const lines: string[] = []

  // Terraform block
  lines.push('terraform {')
  lines.push('  required_providers {')
  lines.push('    proxmox = {')
  lines.push('      source  = "bpg/proxmox"')
  lines.push('      version = ">= 0.66.0"')
  lines.push('    }')
  lines.push('  }')
  lines.push('}')
  lines.push('')

  // Provider block
  lines.push('provider "proxmox" {')
  lines.push(`  endpoint = "${connectionEndpoint.trim()}"`)
  lines.push('  api_token = var.proxmox_api_token')
  lines.push(`  insecure = ${insecure}`)
  lines.push('}')
  lines.push('')

  // Variables
  lines.push('variable "proxmox_api_token" {')
  lines.push('  description = "Proxmox API token (user@realm!tokenid=secret)"')
  lines.push('  type        = string')
  lines.push('  sensitive   = true')
  lines.push('}')
  lines.push('')

  if (templateType === 'qemu') {
    lines.push(...generateQemuResource(templateConfig, vmName, targetNode))
  } else {
    lines.push(...generateLxcResource(templateConfig, vmName, targetNode))
  }

  // Outputs
  lines.push('')
  lines.push(`output "vm_id" {`)
  lines.push(`  value = ${templateType === 'qemu' ? 'proxmox_virtual_environment_vm' : 'proxmox_virtual_environment_container'}.${sanitizeName(vmName)}.id`)
  lines.push('}')

  return lines.join('\n')
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_$&')
}

function generateQemuResource(config: Record<string, any>, vmName: string, targetNode: string): string[] {
  const resName = sanitizeName(vmName)
  const lines: string[] = []

  lines.push(`resource "proxmox_virtual_environment_vm" "${resName}" {`)
  lines.push(`  name      = "${vmName}"`)
  lines.push(`  node_name = "${targetNode}"`)
  lines.push('')

  // CPU
  const cores = config.cores || 2
  const sockets = config.sockets || 1
  const cpuType = config.cpu || 'x86-64-v2-AES'
  lines.push('  cpu {')
  lines.push(`    cores   = ${cores}`)
  lines.push(`    sockets = ${sockets}`)
  lines.push(`    type    = "${cpuType}"`)
  lines.push('  }')
  lines.push('')

  // Memory
  const memory = config.memory || 2048
  lines.push('  memory {')
  lines.push(`    dedicated = ${memory}`)
  lines.push('  }')
  lines.push('')

  // Agent
  if (config.agent) {
    lines.push('  agent {')
    lines.push('    enabled = true')
    lines.push('  }')
    lines.push('')
  }

  // Network interfaces
  for (const [key, value] of Object.entries(config)) {
    if (/^net\d+$/.test(key) && typeof value === 'string') {
      const bridge = value.match(/bridge=(\S+)/)?.[1] || 'vmbr0'
      const model = value.match(/^(virtio|e1000|rtl8139)/)?.[1] || 'virtio'
      lines.push('  network_device {')
      lines.push(`    bridge = "${bridge}"`)
      lines.push(`    model  = "${model}"`)
      lines.push('  }')
      lines.push('')
    }
  }

  // Disks
  for (const [key, value] of Object.entries(config)) {
    if (/^(scsi|virtio|ide|sata)\d+$/.test(key) && typeof value === 'string') {
      const sizeMatch = value.match(/size=(\d+)([GMT]?)/)
      let sizeGB = 32
      if (sizeMatch) {
        sizeGB = parseInt(sizeMatch[1])
        if (sizeMatch[2] === 'T') sizeGB *= 1024
        if (sizeMatch[2] === 'M') sizeGB = Math.ceil(sizeGB / 1024)
      }
      const storage = value.match(/^([^:,]+):/)?.[1] || 'local-lvm'
      const iface = key.replace(/\d+/, '')

      lines.push('  disk {')
      lines.push(`    datastore_id = "${storage}"`)
      lines.push(`    size         = ${sizeGB}`)
      lines.push(`    interface    = "${key}"`)
      if (iface === 'scsi') {
        lines.push(`    file_format  = "raw"`)
      }
      lines.push('  }')
      lines.push('')
    }
  }

  // OS type
  if (config.ostype) {
    lines.push('  operating_system {')
    lines.push(`    type = "${config.ostype}"`)
    lines.push('  }')
    lines.push('')
  }

  // BIOS
  if (config.bios === 'ovmf') {
    lines.push('  bios = "ovmf"')
    lines.push('')
    lines.push('  efi_disk {')
    lines.push('    datastore_id = "local-lvm"')
    lines.push('    type         = "4m"')
    lines.push('  }')
    lines.push('')
  }

  // Boot on start
  if (config.onboot) {
    lines.push('  on_boot = true')
  }

  // Tags
  if (config.tags) {
    const tags = config.tags.split(';').map((t: string) => `"${t.trim()}"`).join(', ')
    lines.push(`  tags = [${tags}]`)
  }

  // Description
  if (config.description) {
    lines.push(`  description = "${config.description.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`)
  }

  lines.push('}')
  return lines
}

function generateLxcResource(config: Record<string, any>, vmName: string, targetNode: string): string[] {
  const resName = sanitizeName(vmName)
  const lines: string[] = []

  lines.push(`resource "proxmox_virtual_environment_container" "${resName}" {`)
  lines.push(`  node_name = "${targetNode}"`)
  lines.push('')

  // Initialization
  lines.push('  initialization {')
  lines.push(`    hostname = "${vmName}"`)
  lines.push('  }')
  lines.push('')

  // CPU
  const cores = config.cores || 1
  lines.push('  cpu {')
  lines.push(`    cores = ${cores}`)
  lines.push('  }')
  lines.push('')

  // Memory
  const memory = config.memory || 512
  lines.push('  memory {')
  lines.push(`    dedicated = ${memory}`)
  lines.push('  }')
  lines.push('')

  // Network
  if (config.net0 && typeof config.net0 === 'string') {
    const bridge = config.net0.match(/bridge=(\S+)/)?.[1] || 'vmbr0'
    lines.push('  network_interface {')
    lines.push('    name   = "eth0"')
    lines.push(`    bridge = "${bridge}"`)
    lines.push('  }')
    lines.push('')
  }

  // Root disk
  const rootfs = config.rootfs || ''
  const sizeMatch = rootfs.match && rootfs.match(/size=(\d+)([GMT]?)/)
  let rootSize = 8
  if (sizeMatch) {
    rootSize = parseInt(sizeMatch[1])
    if (sizeMatch[2] === 'T') rootSize *= 1024
    if (sizeMatch[2] === 'M') rootSize = Math.ceil(rootSize / 1024)
  }
  const rootStorage = (typeof rootfs === 'string' && rootfs.match(/^([^:,]+):/)?.[1]) || 'local-lvm'

  lines.push('  disk {')
  lines.push(`    datastore_id = "${rootStorage}"`)
  lines.push(`    size         = ${rootSize}`)
  lines.push('  }')
  lines.push('')

  // OS template
  lines.push('  operating_system {')
  lines.push('    template_file_id = "local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst"')
  lines.push('    type             = "debian"')
  lines.push('  }')
  lines.push('')

  if (config.onboot) {
    lines.push('  start_on_boot = true')
  }

  if (config.unprivileged !== undefined) {
    lines.push(`  unprivileged = ${config.unprivileged ? 'true' : 'false'}`)
  }

  if (config.tags) {
    const tags = config.tags.split(';').map((t: string) => `"${t.trim()}"`).join(', ')
    lines.push(`  tags = [${tags}]`)
  }

  lines.push('}')
  return lines
}

// Generate generic HCL for common PVE management tasks
export function generateManagementHcl(
  connectionEndpoint: string,
  insecure: boolean,
  resourceType: string,
): string {
  const lines: string[] = []

  lines.push('terraform {')
  lines.push('  required_providers {')
  lines.push('    proxmox = {')
  lines.push('      source  = "bpg/proxmox"')
  lines.push('      version = ">= 0.66.0"')
  lines.push('    }')
  lines.push('  }')
  lines.push('}')
  lines.push('')
  lines.push('provider "proxmox" {')
  lines.push(`  endpoint = "${connectionEndpoint.trim()}"`)
  lines.push('  api_token = var.proxmox_api_token')
  lines.push(`  insecure = ${insecure}`)
  lines.push('}')
  lines.push('')
  lines.push('variable "proxmox_api_token" {')
  lines.push('  description = "Proxmox API token (user@realm!tokenid=secret)"')
  lines.push('  type        = string')
  lines.push('  sensitive   = true')
  lines.push('}')
  lines.push('')

  switch (resourceType) {
    case 'pool':
      lines.push('resource "proxmox_virtual_environment_pool" "example" {')
      lines.push('  pool_id = "production"')
      lines.push('  comment = "Production VMs"')
      lines.push('}')
      break

    case 'dns':
      lines.push('resource "proxmox_virtual_environment_dns" "example" {')
      lines.push('  node_name = "pve"')
      lines.push('  domain    = "example.local"')
      lines.push('  servers   = ["8.8.8.8", "8.8.4.4"]')
      lines.push('}')
      break

    case 'firewall_rules':
      lines.push('resource "proxmox_virtual_environment_cluster_firewall_security_group" "example" {')
      lines.push('  name    = "webserver"')
      lines.push('  comment = "Rules for web servers"')
      lines.push('')
      lines.push('  rule {')
      lines.push('    type    = "in"')
      lines.push('    action  = "ACCEPT"')
      lines.push('    comment = "Allow HTTP"')
      lines.push('    dest    = ""')
      lines.push('    dport   = "80"')
      lines.push('    proto   = "tcp"')
      lines.push('    log     = "nolog"')
      lines.push('  }')
      lines.push('')
      lines.push('  rule {')
      lines.push('    type    = "in"')
      lines.push('    action  = "ACCEPT"')
      lines.push('    comment = "Allow HTTPS"')
      lines.push('    dest    = ""')
      lines.push('    dport   = "443"')
      lines.push('    proto   = "tcp"')
      lines.push('    log     = "nolog"')
      lines.push('  }')
      lines.push('}')
      break

    case 'network':
      lines.push('resource "proxmox_virtual_environment_network_linux_bridge" "example" {')
      lines.push('  node_name = "pve"')
      lines.push('  name      = "vmbr1"')
      lines.push('  comment   = "Internal network"')
      lines.push('  address   = "10.0.1.1/24"')
      lines.push('  autostart = true')
      lines.push('}')
      break

    default:
      lines.push(`# Add your Proxmox resources here`)
      lines.push(`# See: https://registry.terraform.io/providers/bpg/proxmox/latest/docs`)
      break
  }

  return lines.join('\n')
}

// ============================================
// Terraform CLI Execution
// ============================================

// In-memory operation logs for streaming
const operationLogs: Map<string, string[]> = new Map()

export function getOperationLogs(opId: string): string[] {
  return operationLogs.get(opId) || []
}

function getWorkspaceDir(workspaceId: string): string {
  const dir = path.join(process.cwd(), 'data', 'terraform', workspaceId)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function writeHclToWorkspace(workspaceId: string, hcl: string): boolean {
  const dir = getWorkspaceDir(workspaceId)
  const mainTf = path.join(dir, 'main.tf')

  // Check if HCL content changed
  let changed = true

  if (fs.existsSync(mainTf)) {
    const existing = fs.readFileSync(mainTf, 'utf-8')
    changed = existing !== hcl
  }

  fs.writeFileSync(mainTf, hcl, 'utf-8')

  // If HCL changed, remove lock file + .terraform so init re-runs cleanly
  if (changed) {
    const lockFile = path.join(dir, '.terraform.lock.hcl')

    if (fs.existsSync(lockFile)) fs.unlinkSync(lockFile)

    const tfDir = path.join(dir, '.terraform')

    if (fs.existsSync(tfDir)) fs.rmSync(tfDir, { recursive: true, force: true })
  }

  return changed
}

export function isTerraformInstalled(): boolean {
  try {
    const { execSync } = require('child_process')
    execSync('terraform version', { stdio: 'pipe', timeout: 5000 })
    return true
  } catch {
    return false
  }
}

export function getTerraformVersion(): string | null {
  try {
    const { execSync } = require('child_process')
    const output = execSync('terraform version -json', { stdio: 'pipe', timeout: 5000 })
    const data = JSON.parse(output.toString())
    return data.terraform_version || null
  } catch {
    return null
  }
}

export async function runTerraformAction(
  workspaceId: string,
  action: TerraformAction,
  envOverrides?: Record<string, string>,
): Promise<TerraformOperation> {
  const ws = getWorkspace(workspaceId)
  if (!ws) throw new Error('Workspace not found')

  // Write HCL to disk
  writeHclToWorkspace(workspaceId, ws.hcl_content)

  const dir = getWorkspaceDir(workspaceId)
  const env = { ...process.env } as NodeJS.ProcessEnv

  // Apply env overrides (from stored credentials or manual input)
  if (envOverrides) {
    Object.assign(env, envOverrides)
  }

  // Auto-run 'terraform init' before plan/apply/destroy if not yet initialized
  const needsInit = ['plan', 'apply', 'destroy'].includes(action)
  const tfDir = path.join(dir, '.terraform')

  if (needsInit && !fs.existsSync(tfDir)) {
    const { execSync } = require('child_process')

    try {
      execSync('terraform init -no-color -input=false', { cwd: dir, env, timeout: 120_000, stdio: 'pipe' })
    } catch (initErr: any) {
      // If init fails, record the error and bail
      const op = createOperation(workspaceId, action)
      const initOutput = initErr.stdout?.toString() || '' + (initErr.stderr?.toString() || '')
      const errorMsg = `Auto-init failed:\n${initOutput}\n${initErr.message}`

      updateOperation(op.id, { status: 'failed', output: errorMsg, finished_at: new Date().toISOString(), duration_ms: 0 })
      updateWorkspace(workspaceId, { status: 'error' })

      return { ...op, status: 'failed' as const, output: errorMsg, finished_at: new Date().toISOString(), duration_ms: 0 }
    }
  }

  // Create operation record
  const op = createOperation(workspaceId, action)
  operationLogs.set(op.id, [])

  // Update workspace status
  updateWorkspace(workspaceId, {
    status: action === 'destroy' ? 'destroying' : action === 'apply' ? 'applying' : 'planning',
    last_action: action,
    last_action_at: new Date().toISOString(),
  })

  const startTime = Date.now()

  // Build terraform command args
  let args: string[]

  switch (action) {
    case 'init':
      args = ['init', '-no-color', '-input=false']
      break
    case 'validate':
      args = ['validate', '-no-color']
      break
    case 'plan':
      args = ['plan', '-no-color', '-input=false', '-out=tfplan']
      break
    case 'apply':
      // Check if plan file exists, otherwise auto-approve
      if (fs.existsSync(path.join(dir, 'tfplan'))) {
        args = ['apply', '-no-color', '-input=false', 'tfplan']
      } else {
        args = ['apply', '-no-color', '-input=false', '-auto-approve']
      }
      break
    case 'destroy':
      args = ['destroy', '-no-color', '-input=false', '-auto-approve']
      break
    default:
      throw new Error(`Unknown action: ${action}`)
  }

  // Spawn terraform process
  return new Promise<TerraformOperation>((resolve) => {
    const child = spawn('terraform', args, {
      cwd: dir,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const logs = operationLogs.get(op.id)!
    let output = ''

    const handleData = (data: Buffer) => {
      const text = data.toString()
      output += text
      logs.push(text)
    }

    child.stdout?.on('data', handleData)
    child.stderr?.on('data', handleData)

    child.on('close', (code) => {
      const duration = Date.now() - startTime
      const success = code === 0
      const now = new Date().toISOString()

      updateOperation(op.id, {
        status: success ? 'success' : 'failed',
        output,
        finished_at: now,
        duration_ms: duration,
      })

      // Update workspace
      const wsUpdates: any = {
        status: success ? 'idle' : 'error',
      }

      if (action === 'plan') {
        wsUpdates.plan_output = output
      } else if (action === 'apply' || action === 'destroy') {
        wsUpdates.apply_output = output

        // Try to read state
        const stateFile = path.join(dir, 'terraform.tfstate')
        if (fs.existsSync(stateFile)) {
          try {
            wsUpdates.state_json = fs.readFileSync(stateFile, 'utf-8')
          } catch { /* ignore */ }
        }

        if (action === 'destroy' && success) {
          wsUpdates.state_json = null
        }
      }

      updateWorkspace(workspaceId, wsUpdates)

      // Clean up logs after 10 minutes
      setTimeout(() => operationLogs.delete(op.id), 600_000)

      resolve({
        ...op,
        status: success ? 'success' : 'failed',
        output,
        finished_at: now,
        duration_ms: duration,
      })
    })

    child.on('error', (err) => {
      const duration = Date.now() - startTime
      const now = new Date().toISOString()
      const errorMsg = `Failed to execute terraform: ${err.message}\n\nIs Terraform installed? Install from: https://developer.hashicorp.com/terraform/install`

      updateOperation(op.id, {
        status: 'failed',
        output: errorMsg,
        finished_at: now,
        duration_ms: duration,
      })

      updateWorkspace(workspaceId, { status: 'error' })

      resolve({
        ...op,
        status: 'failed',
        output: errorMsg,
        finished_at: now,
        duration_ms: duration,
      })
    })
  })
}

// ============================================
// Resource Templates (quick-start snippets)
// ============================================

export const RESOURCE_TEMPLATES: {
  id: string
  name: string
  description: string
  category: string
  icon: string
  type: string
}[] = [
  { id: 'vm_basic', name: 'Basic VM', description: 'Create a simple QEMU virtual machine', category: 'Compute', icon: 'ri-computer-line', type: 'vm' },
  { id: 'vm_cloud_init', name: 'Cloud-Init VM', description: 'VM with cloud-init for automated provisioning', category: 'Compute', icon: 'ri-cloud-line', type: 'vm' },
  { id: 'lxc_basic', name: 'LXC Container', description: 'Lightweight Linux container', category: 'Compute', icon: 'ri-instance-line', type: 'lxc' },
  { id: 'pool', name: 'Resource Pool', description: 'Logical group for VMs and resources', category: 'Management', icon: 'ri-folder-line', type: 'pool' },
  { id: 'dns', name: 'DNS Settings', description: 'Configure node DNS servers', category: 'Network', icon: 'ri-global-line', type: 'dns' },
  { id: 'firewall', name: 'Firewall Rules', description: 'Cluster-level firewall security groups', category: 'Security', icon: 'ri-shield-check-line', type: 'firewall_rules' },
  { id: 'network_bridge', name: 'Network Bridge', description: 'Linux network bridge on a node', category: 'Network', icon: 'ri-share-line', type: 'network' },
]
