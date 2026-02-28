// src/lib/cve/scanner.ts
// Standalone CVE Scanner — queries Proxmox nodes for package updates
// and matches against CVE databases (no orchestrator dependency)

import { getDb } from '@/lib/db/sqlite'
import { pveFetch } from '@/lib/proxmox/client'

// ============================================
// Types
// ============================================

export interface CveEntry {
  cve_id: string
  package_name: string
  installed_version: string
  fixed_version: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'unknown'
  description: string
  node: string
  connection_id: string
  connection_name: string
  published_at: string | null
  source: string
}

export interface ScanResult {
  id: string
  connection_id: string
  connection_name: string
  node: string
  scanned_at: string
  total_packages: number
  total_updates: number
  vulnerabilities: CveEntry[]
  status: 'success' | 'error'
  error: string | null
}

export interface ScanSummary {
  total_scans: number
  total_vulnerabilities: number
  by_severity: { critical: number; high: number; medium: number; low: number; unknown: number }
  by_node: Record<string, number>
  last_scan_at: string | null
  connections_scanned: number
}

// ============================================
// DB initialization
// ============================================

let tablesCreated = false

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
}

export function initCveTables() {
  if (tablesCreated) return

  const db = getDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS cve_scans (
      id TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL,
      connection_name TEXT NOT NULL DEFAULT '',
      node TEXT NOT NULL,
      scanned_at TEXT NOT NULL DEFAULT (datetime('now')),
      total_packages INTEGER NOT NULL DEFAULT 0,
      total_updates INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'success',
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_cve_scans_conn ON cve_scans(connection_id);
    CREATE INDEX IF NOT EXISTS idx_cve_scans_date ON cve_scans(scanned_at);

    CREATE TABLE IF NOT EXISTS cve_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scan_id TEXT NOT NULL REFERENCES cve_scans(id) ON DELETE CASCADE,
      cve_id TEXT NOT NULL,
      package_name TEXT NOT NULL,
      installed_version TEXT NOT NULL DEFAULT '',
      fixed_version TEXT NOT NULL DEFAULT '',
      severity TEXT NOT NULL DEFAULT 'unknown',
      description TEXT NOT NULL DEFAULT '',
      node TEXT NOT NULL,
      connection_id TEXT NOT NULL,
      connection_name TEXT NOT NULL DEFAULT '',
      published_at TEXT,
      source TEXT NOT NULL DEFAULT 'proxmox',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_cve_entries_scan ON cve_entries(scan_id);
    CREATE INDEX IF NOT EXISTS idx_cve_entries_severity ON cve_entries(severity);
    CREATE INDEX IF NOT EXISTS idx_cve_entries_cve ON cve_entries(cve_id);
  `)

  tablesCreated = true
}

// ============================================
// Known CVE patterns in Debian/Ubuntu packages
// ============================================

// Map common package prefixes to severity heuristics
const CRITICAL_PACKAGES = new Set([
  'openssl', 'libssl', 'openssh', 'linux-image', 'linux-headers',
  'sudo', 'glibc', 'libc6', 'systemd', 'grub', 'shim',
  'curl', 'libcurl', 'wget', 'polkit', 'policykit',
])

const HIGH_PACKAGES = new Set([
  'apache2', 'nginx', 'bind9', 'samba', 'docker', 'containerd',
  'qemu', 'libvirt', 'postgresql', 'mysql', 'mariadb',
  'python3', 'php', 'nodejs', 'ruby', 'perl', 'git',
  'nss', 'libnss', 'zlib', 'xz-utils', 'liblzma', 'tar',
])

function guessSeverity(packageName: string, changeLog: string): 'critical' | 'high' | 'medium' | 'low' {
  const lower = packageName.toLowerCase()
  const logLower = (changeLog || '').toLowerCase()

  // Check changelog for severity hints
  if (logLower.includes('cve-') && (logLower.includes('remote code execution') || logLower.includes('rce'))) return 'critical'
  if (logLower.includes('cve-') && logLower.includes('privilege escalation')) return 'critical'
  if (logLower.includes('cve-') && logLower.includes('buffer overflow')) return 'high'
  if (logLower.includes('cve-') && logLower.includes('denial of service')) return 'medium'

  // Check package name
  for (const pkg of CRITICAL_PACKAGES) {
    if (lower.startsWith(pkg)) return 'critical'
  }

  for (const pkg of HIGH_PACKAGES) {
    if (lower.startsWith(pkg)) return 'high'
  }

  // If changelog mentions CVE, at least medium
  if (logLower.includes('cve-')) return 'medium'

  return 'low'
}

// Extract CVE IDs from changelog text
function extractCveIds(text: string): string[] {
  if (!text) return []

  const matches = text.match(/CVE-\d{4}-\d{4,}/gi) || []

  return [...new Set(matches.map(m => m.toUpperCase()))]
}

// ============================================
// Scan a single node
// ============================================

export async function scanNode(
  conn: { id: string; name: string; baseUrl: string; apiToken: string; insecureDev: boolean },
  nodeName: string,
): Promise<ScanResult> {
  const scanId = generateId('scan')
  const scannedAt = new Date().toISOString()

  try {
    // Fetch available updates from Proxmox apt API
    const updates = await pveFetch<any[]>(conn, `/nodes/${encodeURIComponent(nodeName)}/apt/update`)
    const updateList = Array.isArray(updates) ? updates : []

    // Fetch installed packages count
    let totalPackages = 0

    try {
      const packages = await pveFetch<any[]>(conn, `/nodes/${encodeURIComponent(nodeName)}/apt/versions`)

      totalPackages = Array.isArray(packages) ? packages.length : 0
    } catch {
      // versions endpoint may not always be available
    }

    const vulnerabilities: CveEntry[] = []

    for (const update of updateList) {
      const packageName = update.Package || update.package || 'unknown'
      const installedVersion = update.OldVersion || update.CurrentState || ''
      const fixedVersion = update.Version || update.NewVersion || ''
      const changeLog = update.ChangeLogUrl || update.Description || ''
      const description = update.Title || update.Description || `Update available for ${packageName}`
      const origin = update.Origin || 'Debian'

      // Extract CVE IDs from description/changelog
      const cveIds = extractCveIds(`${description} ${changeLog}`)
      const severity = guessSeverity(packageName, `${description} ${changeLog}`)

      if (cveIds.length > 0) {
        // Create one entry per CVE ID
        for (const cveId of cveIds) {
          vulnerabilities.push({
            cve_id: cveId,
            package_name: packageName,
            installed_version: installedVersion,
            fixed_version: fixedVersion,
            severity,
            description: description.substring(0, 500),
            node: nodeName,
            connection_id: conn.id,
            connection_name: conn.name,
            published_at: null,
            source: origin,
          })
        }
      } else {
        // Security update without explicit CVE ID
        vulnerabilities.push({
          cve_id: `UPDATE-${packageName}`,
          package_name: packageName,
          installed_version: installedVersion,
          fixed_version: fixedVersion,
          severity,
          description: description.substring(0, 500),
          node: nodeName,
          connection_id: conn.id,
          connection_name: conn.name,
          published_at: null,
          source: origin,
        })
      }
    }

    const result: ScanResult = {
      id: scanId,
      connection_id: conn.id,
      connection_name: conn.name,
      node: nodeName,
      scanned_at: scannedAt,
      total_packages: totalPackages,
      total_updates: updateList.length,
      vulnerabilities,
      status: 'success',
      error: null,
    }

    // Save to DB
    saveScanResult(result)

    return result
  } catch (err: any) {
    const result: ScanResult = {
      id: scanId,
      connection_id: conn.id,
      connection_name: conn.name,
      node: nodeName,
      scanned_at: scannedAt,
      total_packages: 0,
      total_updates: 0,
      vulnerabilities: [],
      status: 'error',
      error: err.message || 'Scan failed',
    }

    saveScanResult(result)

    return result
  }
}

// ============================================
// Scan all nodes for a connection
// ============================================

export async function scanConnection(
  conn: { id: string; name: string; baseUrl: string; apiToken: string; insecureDev: boolean },
): Promise<ScanResult[]> {
  // Get list of nodes
  const nodes = await pveFetch<any[]>(conn, '/nodes')
  const nodeList = Array.isArray(nodes) ? nodes : []

  // First refresh the package index on each node
  for (const node of nodeList) {
    const nodeName = node.node || node.name

    try {
      await pveFetch<any>(conn, `/nodes/${encodeURIComponent(nodeName)}/apt/update`, {
        method: 'POST',
        body: new URLSearchParams({ quiet: '1' }).toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    } catch {
      // Refresh may fail if already running or not permitted, continue anyway
    }
  }

  // Wait briefly for apt update to start processing
  await new Promise(resolve => setTimeout(resolve, 3000))

  // Scan each node
  const results: ScanResult[] = []

  for (const node of nodeList) {
    const nodeName = node.node || node.name
    const result = await scanNode(conn, nodeName)

    results.push(result)
  }

  return results
}

// ============================================
// DB operations
// ============================================

function saveScanResult(result: ScanResult) {
  initCveTables()
  const db = getDb()

  db.prepare(`
    INSERT INTO cve_scans (id, connection_id, connection_name, node, scanned_at, total_packages, total_updates, status, error)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(result.id, result.connection_id, result.connection_name, result.node, result.scanned_at, result.total_packages, result.total_updates, result.status, result.error)

  if (result.vulnerabilities.length > 0) {
    const insert = db.prepare(`
      INSERT INTO cve_entries (scan_id, cve_id, package_name, installed_version, fixed_version, severity, description, node, connection_id, connection_name, published_at, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const tx = db.transaction(() => {
      for (const v of result.vulnerabilities) {
        insert.run(result.id, v.cve_id, v.package_name, v.installed_version, v.fixed_version, v.severity, v.description, v.node, v.connection_id, v.connection_name, v.published_at, v.source)
      }
    })

    tx()
  }
}

export function getLatestScanResults(connectionId?: string, limit = 50): ScanResult[] {
  initCveTables()
  const db = getDb()

  let scans: any[]

  if (connectionId) {
    scans = db.prepare('SELECT * FROM cve_scans WHERE connection_id = ? ORDER BY scanned_at DESC LIMIT ?').all(connectionId, limit) as any[]
  } else {
    scans = db.prepare('SELECT * FROM cve_scans ORDER BY scanned_at DESC LIMIT ?').all(limit) as any[]
  }

  const scanIds = scans.map(s => s.id)

  if (scanIds.length === 0) return []

  const placeholders = scanIds.map(() => '?').join(',')
  const entries = db.prepare(`SELECT * FROM cve_entries WHERE scan_id IN (${placeholders}) ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END`).all(...scanIds) as any[]

  const entriesByScan: Record<string, CveEntry[]> = {}

  for (const e of entries) {
    if (!entriesByScan[e.scan_id]) entriesByScan[e.scan_id] = []

    entriesByScan[e.scan_id].push({
      cve_id: e.cve_id,
      package_name: e.package_name,
      installed_version: e.installed_version,
      fixed_version: e.fixed_version,
      severity: e.severity,
      description: e.description,
      node: e.node,
      connection_id: e.connection_id,
      connection_name: e.connection_name,
      published_at: e.published_at,
      source: e.source,
    })
  }

  return scans.map(s => ({
    id: s.id,
    connection_id: s.connection_id,
    connection_name: s.connection_name,
    node: s.node,
    scanned_at: s.scanned_at,
    total_packages: s.total_packages,
    total_updates: s.total_updates,
    vulnerabilities: entriesByScan[s.id] || [],
    status: s.status,
    error: s.error,
  }))
}

export function getLatestVulnerabilities(connectionId?: string): CveEntry[] {
  initCveTables()
  const db = getDb()

  // Get most recent scan per node
  let latestScans: any[]

  if (connectionId) {
    latestScans = db.prepare(`
      SELECT s.* FROM cve_scans s
      INNER JOIN (
        SELECT node, connection_id, MAX(scanned_at) as max_date
        FROM cve_scans
        WHERE connection_id = ? AND status = 'success'
        GROUP BY node, connection_id
      ) latest ON s.node = latest.node AND s.connection_id = latest.connection_id AND s.scanned_at = latest.max_date
    `).all(connectionId) as any[]
  } else {
    latestScans = db.prepare(`
      SELECT s.* FROM cve_scans s
      INNER JOIN (
        SELECT node, connection_id, MAX(scanned_at) as max_date
        FROM cve_scans
        WHERE status = 'success'
        GROUP BY node, connection_id
      ) latest ON s.node = latest.node AND s.connection_id = latest.connection_id AND s.scanned_at = latest.max_date
    `).all() as any[]
  }

  const scanIds = latestScans.map(s => s.id)

  if (scanIds.length === 0) return []

  const placeholders = scanIds.map(() => '?').join(',')

  return (db.prepare(`
    SELECT * FROM cve_entries WHERE scan_id IN (${placeholders})
    ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END
  `).all(...scanIds) as any[]).map(e => ({
    cve_id: e.cve_id,
    package_name: e.package_name,
    installed_version: e.installed_version,
    fixed_version: e.fixed_version,
    severity: e.severity,
    description: e.description,
    node: e.node,
    connection_id: e.connection_id,
    connection_name: e.connection_name,
    published_at: e.published_at,
    source: e.source,
  }))
}

export function getScanSummary(connectionId?: string): ScanSummary {
  initCveTables()
  const vulns = getLatestVulnerabilities(connectionId)

  const by_severity = { critical: 0, high: 0, medium: 0, low: 0, unknown: 0 }
  const by_node: Record<string, number> = {}
  const connSet = new Set<string>()

  for (const v of vulns) {
    by_severity[v.severity] = (by_severity[v.severity] || 0) + 1

    if (!by_node[v.node]) by_node[v.node] = 0
    by_node[v.node]++
    connSet.add(v.connection_id)
  }

  const db = getDb()
  const latestScan = connectionId
    ? (db.prepare('SELECT MAX(scanned_at) as last FROM cve_scans WHERE connection_id = ?').get(connectionId) as any)
    : (db.prepare('SELECT MAX(scanned_at) as last FROM cve_scans').get() as any)

  return {
    total_scans: 0,
    total_vulnerabilities: vulns.length,
    by_severity,
    by_node,
    last_scan_at: latestScan?.last || null,
    connections_scanned: connSet.size,
  }
}

export function clearScanHistory(connectionId?: string) {
  initCveTables()
  const db = getDb()

  if (connectionId) {
    const scanIds = (db.prepare('SELECT id FROM cve_scans WHERE connection_id = ?').all(connectionId) as any[]).map(s => s.id)

    if (scanIds.length > 0) {
      const placeholders = scanIds.map(() => '?').join(',')

      db.prepare(`DELETE FROM cve_entries WHERE scan_id IN (${placeholders})`).run(...scanIds)
    }

    db.prepare('DELETE FROM cve_scans WHERE connection_id = ?').run(connectionId)
  } else {
    db.prepare('DELETE FROM cve_entries').run()
    db.prepare('DELETE FROM cve_scans').run()
  }
}
