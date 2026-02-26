// src/lib/templates/index.ts
// VM Templates — Infrastructure as Code engine
// Export/import VM configurations as JSON templates with marketplace presets

import { getDb } from '@/lib/db/sqlite'

// ============================================
// Types
// ============================================

export interface VmTemplate {
  id: string
  name: string
  description: string | null
  category: string
  icon: string | null
  type: 'qemu' | 'lxc'
  // JSON-encoded VM configuration (Proxmox config format)
  config: string
  // JSON-encoded metadata (author, version, tags, os info, etc.)
  metadata: string
  is_builtin: boolean
  is_public: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface TemplateConfig {
  // QEMU fields
  name?: string
  cores?: number
  sockets?: number
  memory?: number
  balloon?: number
  cpu?: string
  ostype?: string
  bios?: string
  machine?: string
  scsihw?: string
  boot?: string
  agent?: string
  onboot?: boolean
  protection?: boolean
  tags?: string
  description?: string
  // Network interfaces (net0, net1, etc.)
  [key: `net${number}`]: string
  // Disks (scsi0, virtio0, etc.)
  [key: string]: any
}

export interface TemplateMetadata {
  version?: string
  author?: string
  tags?: string[]
  os?: string
  os_version?: string
  min_disk_gb?: number
  min_memory_mb?: number
  recommended_cores?: number
  notes?: string
  source_vmid?: string
  source_node?: string
  source_connection?: string
  exported_at?: string
}

// ============================================
// DB initialization
// ============================================

let tablesCreated = false

function generateId(): string {
  return `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
}

export function initTemplateTables() {
  if (tablesCreated) return

  const db = getDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS vm_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'custom',
      icon TEXT,
      type TEXT NOT NULL DEFAULT 'qemu',
      config TEXT NOT NULL DEFAULT '{}',
      metadata TEXT NOT NULL DEFAULT '{}',
      is_builtin INTEGER NOT NULL DEFAULT 0,
      is_public INTEGER NOT NULL DEFAULT 1,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_vm_templates_category ON vm_templates(category);
    CREATE INDEX IF NOT EXISTS idx_vm_templates_type ON vm_templates(type);
    CREATE INDEX IF NOT EXISTS idx_vm_templates_builtin ON vm_templates(is_builtin);
  `)

  // Seed built-in marketplace templates
  seedBuiltinTemplates(db)

  tablesCreated = true
}

// ============================================
// CRUD
// ============================================

export function createTemplate(input: {
  name: string
  description?: string
  category?: string
  icon?: string
  type: 'qemu' | 'lxc'
  config: TemplateConfig
  metadata?: TemplateMetadata
  created_by?: string
}): VmTemplate {
  initTemplateTables()
  const db = getDb()
  const now = new Date().toISOString()
  const id = generateId()

  const tpl: VmTemplate = {
    id,
    name: input.name,
    description: input.description || null,
    category: input.category || 'custom',
    icon: input.icon || null,
    type: input.type,
    config: JSON.stringify(input.config),
    metadata: JSON.stringify(input.metadata || {}),
    is_builtin: false,
    is_public: true,
    created_by: input.created_by || null,
    created_at: now,
    updated_at: now,
  }

  db.prepare(`
    INSERT INTO vm_templates (id, name, description, category, icon, type, config, metadata, is_builtin, is_public, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?, ?)
  `).run(id, tpl.name, tpl.description, tpl.category, tpl.icon, tpl.type, tpl.config, tpl.metadata, tpl.created_by, now, now)

  return tpl
}

export function updateTemplate(id: string, updates: {
  name?: string
  description?: string
  category?: string
  icon?: string
  config?: TemplateConfig
  metadata?: TemplateMetadata
}): VmTemplate | null {
  initTemplateTables()
  const db = getDb()
  const existing = getTemplate(id)

  if (!existing) return null
  if (existing.is_builtin) return null // Cannot modify built-in templates

  const now = new Date().toISOString()
  const fields: string[] = ['updated_at = ?']
  const values: any[] = [now]

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name) }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description) }
  if (updates.category !== undefined) { fields.push('category = ?'); values.push(updates.category) }
  if (updates.icon !== undefined) { fields.push('icon = ?'); values.push(updates.icon) }
  if (updates.config !== undefined) { fields.push('config = ?'); values.push(JSON.stringify(updates.config)) }
  if (updates.metadata !== undefined) { fields.push('metadata = ?'); values.push(JSON.stringify(updates.metadata)) }

  values.push(id)
  db.prepare(`UPDATE vm_templates SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  return getTemplate(id)
}

export function deleteTemplate(id: string): boolean {
  initTemplateTables()
  const db = getDb()
  const existing = getTemplate(id)

  if (!existing) return false
  if (existing.is_builtin) return false

  const result = db.prepare('DELETE FROM vm_templates WHERE id = ? AND is_builtin = 0').run(id)

  return result.changes > 0
}

export function getTemplate(id: string): VmTemplate | null {
  initTemplateTables()
  const db = getDb()
  const row = db.prepare('SELECT * FROM vm_templates WHERE id = ?').get(id) as any

  if (!row) return null

  return { ...row, is_builtin: !!row.is_builtin, is_public: !!row.is_public }
}

export function listTemplates(filters?: {
  category?: string
  type?: string
  is_builtin?: boolean
}): VmTemplate[] {
  initTemplateTables()
  const db = getDb()
  let sql = 'SELECT * FROM vm_templates WHERE 1=1'
  const params: any[] = []

  if (filters?.category) { sql += ' AND category = ?'; params.push(filters.category) }
  if (filters?.type) { sql += ' AND type = ?'; params.push(filters.type) }
  if (filters?.is_builtin !== undefined) { sql += ' AND is_builtin = ?'; params.push(filters.is_builtin ? 1 : 0) }

  sql += ' ORDER BY is_builtin DESC, category, name'

  return (db.prepare(sql).all(...params) as any[]).map(r => ({
    ...r,
    is_builtin: !!r.is_builtin,
    is_public: !!r.is_public,
  }))
}

// ============================================
// Export VM config as template
// ============================================

export function exportConfigAsTemplate(
  vmConfig: Record<string, any>,
  vmType: 'qemu' | 'lxc',
  vmName: string,
  sourceInfo: { vmid: string; node: string; connection_id: string }
): { config: TemplateConfig; metadata: TemplateMetadata } {
  // Strip runtime-specific and volatile fields
  const skipFields = new Set([
    'digest', 'pending', 'lock', 'vmgenid', 'smbios1',
    'balloon', 'shares', 'status', 'uptime', 'pid', 'qmpstatus',
    'template', // Will be set separately
  ])

  const config: TemplateConfig = {}

  for (const [key, value] of Object.entries(vmConfig)) {
    if (skipFields.has(key)) continue
    if (value === undefined || value === null) continue

    // Sanitize disk references — replace specific storage paths with placeholders
    if (/^(scsi|virtio|ide|sata|efidisk|tpmstate)\d*$/.test(key)) {
      // Keep disk config but mark storage as variable
      config[key] = String(value)
    } else {
      config[key] = value
    }
  }

  const metadata: TemplateMetadata = {
    version: '1.0',
    author: 'CFCenter Export',
    exported_at: new Date().toISOString(),
    source_vmid: sourceInfo.vmid,
    source_node: sourceInfo.node,
    source_connection: sourceInfo.connection_id,
    os: vmConfig.ostype || undefined,
    min_memory_mb: vmConfig.memory ? Number(vmConfig.memory) : undefined,
    recommended_cores: vmConfig.cores ? Number(vmConfig.cores) : undefined,
    tags: vmConfig.tags ? String(vmConfig.tags).split(/[;,]/).map((t: string) => t.trim()) : [],
  }

  return { config, metadata }
}

// ============================================
// Built-in marketplace templates
// ============================================

function seedBuiltinTemplates(db: any) {
  const count = (db.prepare('SELECT COUNT(*) as count FROM vm_templates WHERE is_builtin = 1').get() as any).count

  if (count > 0) return

  const now = new Date().toISOString()

  const builtins = [
    {
      id: 'tpl_builtin_ubuntu2404',
      name: 'Ubuntu 24.04 LTS Server',
      description: 'Clean Ubuntu 24.04 LTS server template with cloud-init support. Ideal for general-purpose workloads.',
      category: 'linux',
      icon: 'ubuntu',
      type: 'qemu',
      config: {
        cores: 2, sockets: 1, memory: 2048, cpu: 'host',
        ostype: 'l26', bios: 'ovmf', machine: 'q35', scsihw: 'virtio-scsi-single',
        agent: 'enabled=1', boot: 'order=scsi0;ide2;net0',
        net0: 'virtio,bridge=vmbr0,firewall=1',
        onboot: 1,
        tags: 'ubuntu;linux;template',
      },
      metadata: { version: '1.0', os: 'l26', os_version: '24.04', min_disk_gb: 20, min_memory_mb: 1024, recommended_cores: 2, tags: ['ubuntu', 'linux', 'cloud-init', 'lts'] },
    },
    {
      id: 'tpl_builtin_ubuntu2204',
      name: 'Ubuntu 22.04 LTS Server',
      description: 'Ubuntu 22.04 LTS (Jammy Jellyfish) with cloud-init. Battle-tested LTS release.',
      category: 'linux',
      icon: 'ubuntu',
      type: 'qemu',
      config: {
        cores: 2, sockets: 1, memory: 2048, cpu: 'host',
        ostype: 'l26', bios: 'ovmf', machine: 'q35', scsihw: 'virtio-scsi-single',
        agent: 'enabled=1', boot: 'order=scsi0;ide2;net0',
        net0: 'virtio,bridge=vmbr0,firewall=1',
        onboot: 1,
        tags: 'ubuntu;linux;template',
      },
      metadata: { version: '1.0', os: 'l26', os_version: '22.04', min_disk_gb: 20, min_memory_mb: 1024, recommended_cores: 2, tags: ['ubuntu', 'linux', 'cloud-init', 'lts'] },
    },
    {
      id: 'tpl_builtin_debian12',
      name: 'Debian 12 (Bookworm)',
      description: 'Minimal Debian 12 server. Stable, lightweight, and widely supported.',
      category: 'linux',
      icon: 'debian',
      type: 'qemu',
      config: {
        cores: 2, sockets: 1, memory: 1024, cpu: 'host',
        ostype: 'l26', bios: 'seabios', machine: 'q35', scsihw: 'virtio-scsi-single',
        agent: 'enabled=1', boot: 'order=scsi0;ide2;net0',
        net0: 'virtio,bridge=vmbr0,firewall=1',
        onboot: 1,
        tags: 'debian;linux;template',
      },
      metadata: { version: '1.0', os: 'l26', os_version: '12', min_disk_gb: 10, min_memory_mb: 512, recommended_cores: 1, tags: ['debian', 'linux', 'stable'] },
    },
    {
      id: 'tpl_builtin_rocky9',
      name: 'Rocky Linux 9',
      description: 'Enterprise-grade RHEL-compatible OS. Ideal for production workloads requiring long-term support.',
      category: 'linux',
      icon: 'rocky',
      type: 'qemu',
      config: {
        cores: 2, sockets: 1, memory: 2048, cpu: 'host',
        ostype: 'l26', bios: 'ovmf', machine: 'q35', scsihw: 'virtio-scsi-single',
        agent: 'enabled=1', boot: 'order=scsi0;ide2;net0',
        net0: 'virtio,bridge=vmbr0,firewall=1',
        onboot: 1,
        tags: 'rocky;linux;rhel;template',
      },
      metadata: { version: '1.0', os: 'l26', os_version: '9', min_disk_gb: 20, min_memory_mb: 1024, recommended_cores: 2, tags: ['rocky', 'rhel', 'enterprise'] },
    },
    {
      id: 'tpl_builtin_win2022',
      name: 'Windows Server 2022',
      description: 'Windows Server 2022 with VirtIO drivers. Best-practice Proxmox configuration for Windows.',
      category: 'windows',
      icon: 'windows',
      type: 'qemu',
      config: {
        cores: 4, sockets: 1, memory: 4096, cpu: 'host',
        ostype: 'win11', bios: 'ovmf', machine: 'q35', scsihw: 'virtio-scsi-single',
        agent: 'enabled=1', boot: 'order=scsi0;ide2;net0',
        net0: 'virtio,bridge=vmbr0,firewall=1',
        onboot: 1, tablet: 1,
        tags: 'windows;server;template',
      },
      metadata: { version: '1.0', os: 'win11', os_version: '2022', min_disk_gb: 40, min_memory_mb: 2048, recommended_cores: 4, tags: ['windows', 'server', 'enterprise'] },
    },
    {
      id: 'tpl_builtin_win11',
      name: 'Windows 11 Desktop',
      description: 'Windows 11 with TPM 2.0, Secure Boot, and VirtIO. Ready for desktop virtualization.',
      category: 'windows',
      icon: 'windows',
      type: 'qemu',
      config: {
        cores: 4, sockets: 1, memory: 8192, cpu: 'host',
        ostype: 'win11', bios: 'ovmf', machine: 'q35', scsihw: 'virtio-scsi-single',
        agent: 'enabled=1', boot: 'order=scsi0;ide2;net0',
        net0: 'virtio,bridge=vmbr0,firewall=1',
        onboot: 0, tablet: 1,
        tags: 'windows;desktop;template',
      },
      metadata: { version: '1.0', os: 'win11', os_version: '11', min_disk_gb: 64, min_memory_mb: 4096, recommended_cores: 4, tags: ['windows', 'desktop', 'tpm'] },
    },
    {
      id: 'tpl_builtin_docker',
      name: 'Docker Host',
      description: 'Optimized Ubuntu-based Docker host with recommended CPU/memory settings for container workloads.',
      category: 'container',
      icon: 'docker',
      type: 'qemu',
      config: {
        cores: 4, sockets: 1, memory: 4096, cpu: 'host',
        ostype: 'l26', bios: 'ovmf', machine: 'q35', scsihw: 'virtio-scsi-single',
        agent: 'enabled=1', boot: 'order=scsi0;ide2;net0',
        net0: 'virtio,bridge=vmbr0,firewall=1',
        onboot: 1,
        tags: 'docker;container;linux;template',
      },
      metadata: { version: '1.0', os: 'l26', min_disk_gb: 50, min_memory_mb: 2048, recommended_cores: 4, tags: ['docker', 'containers', 'devops'], notes: 'Install Docker post-deploy: curl -fsSL https://get.docker.com | sh' },
    },
    {
      id: 'tpl_builtin_k8s_node',
      name: 'Kubernetes Node',
      description: 'Pre-sized VM template for Kubernetes worker nodes. 4 cores, 8GB RAM, optimized for K8s.',
      category: 'container',
      icon: 'kubernetes',
      type: 'qemu',
      config: {
        cores: 4, sockets: 1, memory: 8192, cpu: 'host',
        ostype: 'l26', bios: 'ovmf', machine: 'q35', scsihw: 'virtio-scsi-single',
        agent: 'enabled=1', boot: 'order=scsi0;ide2;net0',
        net0: 'virtio,bridge=vmbr0,firewall=1',
        onboot: 1, numa: 1,
        tags: 'kubernetes;k8s;linux;template',
      },
      metadata: { version: '1.0', os: 'l26', min_disk_gb: 50, min_memory_mb: 4096, recommended_cores: 4, tags: ['kubernetes', 'k8s', 'worker', 'orchestration'] },
    },
    {
      id: 'tpl_builtin_lxc_alpine',
      name: 'Alpine LXC Container',
      description: 'Minimal Alpine Linux container. Ultra-lightweight for microservices and utilities.',
      category: 'linux',
      icon: 'alpine',
      type: 'lxc',
      config: {
        cores: 1, memory: 256, swap: 256,
        hostname: 'alpine',
        unprivileged: 1,
        onboot: 1,
        tags: 'alpine;lxc;minimal;template',
      },
      metadata: { version: '1.0', os: 'alpine', min_disk_gb: 1, min_memory_mb: 128, recommended_cores: 1, tags: ['alpine', 'lxc', 'minimal'] },
    },
    {
      id: 'tpl_builtin_lxc_ubuntu',
      name: 'Ubuntu LXC Container',
      description: 'Ubuntu 24.04 LXC container. Lighter than a full VM, ideal for services and dev environments.',
      category: 'linux',
      icon: 'ubuntu',
      type: 'lxc',
      config: {
        cores: 2, memory: 1024, swap: 512,
        hostname: 'ubuntu',
        unprivileged: 1,
        onboot: 1,
        tags: 'ubuntu;lxc;template',
      },
      metadata: { version: '1.0', os: 'ubuntu', os_version: '24.04', min_disk_gb: 4, min_memory_mb: 512, recommended_cores: 1, tags: ['ubuntu', 'lxc'] },
    },
    {
      id: 'tpl_builtin_database',
      name: 'Database Server',
      description: 'Optimized for database workloads (PostgreSQL, MySQL, MongoDB). High memory, moderate CPU.',
      category: 'application',
      icon: 'database',
      type: 'qemu',
      config: {
        cores: 4, sockets: 1, memory: 8192, cpu: 'host',
        ostype: 'l26', bios: 'ovmf', machine: 'q35', scsihw: 'virtio-scsi-single',
        agent: 'enabled=1', boot: 'order=scsi0;ide2;net0',
        net0: 'virtio,bridge=vmbr0,firewall=1',
        onboot: 1, numa: 1,
        tags: 'database;linux;template',
      },
      metadata: { version: '1.0', os: 'l26', min_disk_gb: 100, min_memory_mb: 4096, recommended_cores: 4, tags: ['database', 'postgresql', 'mysql', 'high-memory'] },
    },
    {
      id: 'tpl_builtin_webserver',
      name: 'Web Server (Nginx)',
      description: 'Lightweight web server template. Pre-sized for Nginx/Apache + PHP or static sites.',
      category: 'application',
      icon: 'web',
      type: 'qemu',
      config: {
        cores: 2, sockets: 1, memory: 2048, cpu: 'host',
        ostype: 'l26', bios: 'ovmf', machine: 'q35', scsihw: 'virtio-scsi-single',
        agent: 'enabled=1', boot: 'order=scsi0;ide2;net0',
        net0: 'virtio,bridge=vmbr0,firewall=1',
        onboot: 1,
        tags: 'web;nginx;linux;template',
      },
      metadata: { version: '1.0', os: 'l26', min_disk_gb: 20, min_memory_mb: 1024, recommended_cores: 2, tags: ['web', 'nginx', 'apache', 'php'] },
    },
  ]

  const insert = db.prepare(`
    INSERT OR IGNORE INTO vm_templates (id, name, description, category, icon, type, config, metadata, is_builtin, is_public, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)
  `)

  for (const t of builtins) {
    insert.run(t.id, t.name, t.description, t.category, t.icon, t.type, JSON.stringify(t.config), JSON.stringify(t.metadata), now, now)
  }
}
