// src/lib/scheduler/handlers/power-handler.ts
// Handler for scheduled power action jobs (start, shutdown, stop, reboot, suspend, resume)

import { prisma } from '@/lib/db/prisma'
import { pveFetch } from '@/lib/proxmox/client'
import { decryptSecret } from '@/lib/crypto/secret'
import type { ScheduledJob, PowerActionJobParams, PowerActionTarget } from '../engine'

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

// Map action names to Proxmox API endpoints
const ACTION_MAP: Record<string, { endpoint: string; method: string }> = {
  start: { endpoint: 'status/start', method: 'POST' },
  shutdown: { endpoint: 'status/shutdown', method: 'POST' },
  stop: { endpoint: 'status/stop', method: 'POST' },
  reboot: { endpoint: 'status/reboot', method: 'POST' },
  suspend: { endpoint: 'status/suspend', method: 'POST' },
  resume: { endpoint: 'status/resume', method: 'POST' },
}

async function executeAction(
  conn: any,
  target: PowerActionTarget,
  action: string,
  force: boolean
): Promise<{ success: boolean; upid?: string; error?: string }> {
  const actionDef = ACTION_MAP[action]

  if (!actionDef) {
    return { success: false, error: `Unknown action: ${action}` }
  }

  try {
    const apiPath = `/nodes/${encodeURIComponent(target.node)}/${target.type}/${target.vmid}/${actionDef.endpoint}`

    const formData = new URLSearchParams()

    // For shutdown/stop, optionally force
    if (force && (action === 'shutdown' || action === 'stop')) {
      formData.append('forceStop', '1')
    }

    const body = formData.toString() || undefined
    const headers: Record<string, string> = {}

    if (body) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded'
    }

    const result = await pveFetch<string>(conn, apiPath, {
      method: actionDef.method,
      body,
      headers,
    })

    return { success: true, upid: String(result) }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function handlePowerActionJob(
  job: ScheduledJob,
  params: PowerActionJobParams
): Promise<{ success: boolean; message: string; details?: any }> {
  const results: any[] = []
  let successCount = 0
  let failCount = 0

  // Group targets by connection
  const byConnection: Map<string, PowerActionTarget[]> = new Map()

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
      const result = await executeAction(conn, target, params.action, params.force)

      results.push({
        vmid: target.vmid,
        node: target.node,
        vm_name: target.vm_name,
        action: params.action,
        success: result.success,
        upid: result.upid,
        error: result.error,
      })

      if (result.success) {
        successCount++
      } else {
        failCount++
      }
    }
  }

  const total = params.targets.length

  return {
    success: failCount === 0,
    message: `Power action '${params.action}': ${successCount}/${total} succeeded${failCount > 0 ? `, ${failCount} failed` : ''}`,
    details: { results, successCount, failCount, total, action: params.action },
  }
}
