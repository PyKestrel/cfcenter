// src/lib/scheduler/handlers/snapshot-handler.ts
// Handler for automated snapshot jobs

import { prisma } from '@/lib/db/prisma'
import { pveFetch } from '@/lib/proxmox/client'
import { decryptSecret } from '@/lib/crypto/secret'
import type { ScheduledJob, SnapshotJobParams, SnapshotTarget } from '../engine'

async function getConnection(id: string) {
  const connection = await prisma.connection.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      baseUrl: true,
      insecureTLS: true,
      apiTokenEnc: true,
    }
  })

  if (!connection || !connection.apiTokenEnc) return null

  return {
    id: connection.id,
    name: connection.name,
    baseUrl: connection.baseUrl,
    apiToken: decryptSecret(connection.apiTokenEnc),
    insecureDev: !!connection.insecureTLS,
  }
}

async function createSnapshot(
  conn: any,
  target: SnapshotTarget,
  snapName: string,
  includeRam: boolean
): Promise<{ success: boolean; upid?: string; error?: string }> {
  try {
    const apiPath = `/nodes/${encodeURIComponent(target.node)}/${target.type}/${target.vmid}/snapshot`

    const formData = new URLSearchParams()

    formData.append('snapname', snapName)
    formData.append('description', `Auto-snapshot by CFCenter scheduler`)

    if (includeRam && target.type === 'qemu') {
      formData.append('vmstate', '1')
    }

    const result = await pveFetch<string>(conn, apiPath, {
      method: 'POST',
      body: formData.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    })

    return { success: true, upid: String(result) }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

async function listSnapshots(conn: any, target: SnapshotTarget): Promise<any[]> {
  try {
    const apiPath = `/nodes/${encodeURIComponent(target.node)}/${target.type}/${target.vmid}/snapshot`
    const snapshots = await pveFetch<any[]>(conn, apiPath)

    return (snapshots || []).filter((s: any) => s.name !== 'current')
  } catch {
    return []
  }
}

async function deleteSnapshot(conn: any, target: SnapshotTarget, snapName: string): Promise<boolean> {
  try {
    const apiPath = `/nodes/${encodeURIComponent(target.node)}/${target.type}/${target.vmid}/snapshot/${encodeURIComponent(snapName)}`

    await pveFetch<string>(conn, apiPath, { method: 'DELETE' })

    return true
  } catch {
    return false
  }
}

async function pruneSnapshots(
  conn: any,
  target: SnapshotTarget,
  prefix: string,
  retention: { keep_last: number; keep_days: number }
): Promise<{ pruned: number; errors: number }> {
  const snapshots = await listSnapshots(conn, target)

  // Only prune auto-snapshots matching the prefix
  const autoSnaps = snapshots
    .filter((s: any) => s.name.startsWith(prefix))
    .sort((a: any, b: any) => (b.snaptime || 0) - (a.snaptime || 0))

  let pruned = 0
  let errors = 0
  const toDelete: string[] = []

  // Keep last N
  if (retention.keep_last > 0 && autoSnaps.length > retention.keep_last) {
    const excess = autoSnaps.slice(retention.keep_last)

    for (const snap of excess) {
      if (!toDelete.includes(snap.name)) toDelete.push(snap.name)
    }
  }

  // Keep only snapshots newer than N days
  if (retention.keep_days > 0) {
    const cutoff = Date.now() / 1000 - retention.keep_days * 86400

    for (const snap of autoSnaps) {
      if (snap.snaptime && snap.snaptime < cutoff && !toDelete.includes(snap.name)) {
        toDelete.push(snap.name)
      }
    }
  }

  for (const name of toDelete) {
    const ok = await deleteSnapshot(conn, target, name)

    if (ok) pruned++
    else errors++
  }

  return { pruned, errors }
}

export async function handleSnapshotJob(
  job: ScheduledJob,
  params: SnapshotJobParams
): Promise<{ success: boolean; message: string; details?: any }> {
  const results: any[] = []
  let successCount = 0
  let failCount = 0

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)
  const prefix = params.name_prefix || 'auto'

  // Group targets by connection for efficiency
  const byConnection: Map<string, SnapshotTarget[]> = new Map()

  for (const target of params.targets) {
    const existing = byConnection.get(target.connection_id) || []

    existing.push(target)
    byConnection.set(target.connection_id, existing)
  }

  for (const [connId, targets] of byConnection) {
    const conn = await getConnection(connId)

    if (!conn) {
      for (const t of targets) {
        results.push({ vmid: t.vmid, node: t.node, success: false, error: 'Connection not found' })
        failCount++
      }

      continue
    }

    for (const target of targets) {
      const snapName = `${prefix}_${timestamp}`

      // Create snapshot
      const snapResult = await createSnapshot(conn, target, snapName, params.include_ram)

      results.push({
        vmid: target.vmid,
        node: target.node,
        vm_name: target.vm_name,
        success: snapResult.success,
        upid: snapResult.upid,
        error: snapResult.error,
      })

      if (snapResult.success) {
        successCount++
      } else {
        failCount++
      }

      // Prune old snapshots based on retention policy
      if (params.retention && (params.retention.keep_last > 0 || params.retention.keep_days > 0)) {
        const pruneResult = await pruneSnapshots(conn, target, prefix, params.retention)

        results[results.length - 1].pruned = pruneResult.pruned
        results[results.length - 1].prune_errors = pruneResult.errors
      }
    }
  }

  const total = params.targets.length

  return {
    success: failCount === 0,
    message: `Snapshots: ${successCount}/${total} succeeded${failCount > 0 ? `, ${failCount} failed` : ''}`,
    details: { results, successCount, failCount, total },
  }
}
