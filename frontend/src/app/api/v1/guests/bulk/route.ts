// src/app/api/v1/guests/bulk/route.ts
// Bulk operations on multiple VMs — start, stop, shutdown, reboot, suspend, snapshot

import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/db/prisma'
import { pveFetch } from '@/lib/proxmox/client'
import { decryptSecret } from '@/lib/crypto/secret'
import { checkPermission, buildVmResourceId, PERMISSIONS } from '@/lib/rbac'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface BulkTarget {
  connection_id: string
  type: string
  node: string
  vmid: string
  vm_name?: string
}

interface BulkRequest {
  action: 'start' | 'shutdown' | 'stop' | 'reboot' | 'suspend' | 'resume' | 'snapshot'
  targets: BulkTarget[]
  params?: {
    force?: boolean
    snapshot_name?: string
    snapshot_description?: string
    include_ram?: boolean
  }
}

const ACTION_ENDPOINTS: Record<string, { path: string; method: string }> = {
  start:    { path: 'status/start', method: 'POST' },
  shutdown: { path: 'status/shutdown', method: 'POST' },
  stop:     { path: 'status/stop', method: 'POST' },
  reboot:   { path: 'status/reboot', method: 'POST' },
  suspend:  { path: 'status/suspend', method: 'POST' },
  resume:   { path: 'status/resume', method: 'POST' },
}

const ACTION_PERMISSIONS: Record<string, string> = {
  start:    PERMISSIONS.VM_START,
  shutdown: PERMISSIONS.VM_STOP,
  stop:     PERMISSIONS.VM_STOP,
  reboot:   PERMISSIONS.VM_RESTART,
  suspend:  PERMISSIONS.VM_SUSPEND,
  resume:   PERMISSIONS.VM_SUSPEND,
  snapshot: PERMISSIONS.VM_SNAPSHOT,
}

async function getConnection(id: string) {
  const connection = await prisma.connection.findUnique({
    where: { id },
    select: { id: true, name: true, baseUrl: true, insecureTLS: true, apiTokenEnc: true }
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

// POST /api/v1/guests/bulk
export async function POST(request: NextRequest) {
  try {
    const body: BulkRequest = await request.json()
    const { action, targets, params: actionParams } = body

    if (!action || !targets || !Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: action, targets (non-empty array)' },
        { status: 400 }
      )
    }

    if (!ACTION_ENDPOINTS[action] && action !== 'snapshot') {
      return NextResponse.json(
        { error: `Invalid action: ${action}. Valid: start, shutdown, stop, reboot, suspend, resume, snapshot` },
        { status: 400 }
      )
    }

    if (targets.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 targets per bulk operation' },
        { status: 400 }
      )
    }

    // Check permissions for each target
    const requiredPerm = ACTION_PERMISSIONS[action]

    if (requiredPerm) {
      for (const target of targets) {
        const resourceId = buildVmResourceId(target.connection_id, target.node, target.type, target.vmid)
        const denied = await checkPermission(requiredPerm, 'vm', resourceId)

        if (denied) return denied
      }
    }

    // Group by connection for efficiency
    const byConnection: Map<string, BulkTarget[]> = new Map()

    for (const target of targets) {
      const existing = byConnection.get(target.connection_id) || []

      existing.push(target)
      byConnection.set(target.connection_id, existing)
    }

    const results: any[] = []
    let successCount = 0
    let failCount = 0

    for (const [connId, connTargets] of byConnection) {
      const conn = await getConnection(connId)

      if (!conn) {
        for (const t of connTargets) {
          results.push({ vmid: t.vmid, node: t.node, success: false, error: 'Connection not found' })
          failCount++
        }

        continue
      }

      // Execute actions concurrently per connection (max 5 at a time)
      const chunks = chunkArray(connTargets, 5)

      for (const chunk of chunks) {
        const chunkResults = await Promise.allSettled(
          chunk.map(async (target) => {
            try {
              if (action === 'snapshot') {
                return await executeSnapshot(conn, target, actionParams)
              } else {
                return await executePowerAction(conn, target, action, actionParams?.force)
              }
            } catch (err: any) {
              return { success: false, error: err.message, vmid: target.vmid, node: target.node }
            }
          })
        )

        for (let i = 0; i < chunkResults.length; i++) {
          const r = chunkResults[i]
          const target = chunk[i]

          if (r.status === 'fulfilled') {
            results.push({ ...r.value, vmid: target.vmid, node: target.node, vm_name: target.vm_name })

            if (r.value.success) successCount++
            else failCount++
          } else {
            results.push({ vmid: target.vmid, node: target.node, success: false, error: r.reason?.message || 'Unknown error' })
            failCount++
          }
        }
      }
    }

    return NextResponse.json({
      data: {
        action,
        total: targets.length,
        success: successCount,
        failed: failCount,
        results,
      }
    })
  } catch (e: any) {
    console.error('[guests/bulk] POST error:', e)

    return NextResponse.json({ error: e?.message || 'Bulk operation failed' }, { status: 500 })
  }
}

async function executePowerAction(
  conn: any,
  target: BulkTarget,
  action: string,
  force?: boolean
): Promise<{ success: boolean; upid?: string; error?: string }> {
  const endpoint = ACTION_ENDPOINTS[action]
  const apiPath = `/nodes/${encodeURIComponent(target.node)}/${target.type}/${target.vmid}/${endpoint.path}`

  const formData = new URLSearchParams()

  if (force && (action === 'shutdown' || action === 'stop')) {
    formData.append('forceStop', '1')
  }

  const body = formData.toString() || undefined
  const headers: Record<string, string> = {}

  if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded'

  const result = await pveFetch<string>(conn, apiPath, { method: endpoint.method, body, headers })

  return { success: true, upid: String(result) }
}

async function executeSnapshot(
  conn: any,
  target: BulkTarget,
  params?: { snapshot_name?: string; snapshot_description?: string; include_ram?: boolean }
): Promise<{ success: boolean; upid?: string; error?: string }> {
  const apiPath = `/nodes/${encodeURIComponent(target.node)}/${target.type}/${target.vmid}/snapshot`
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)
  const snapName = params?.snapshot_name || `bulk_${timestamp}`

  const formData = new URLSearchParams()

  formData.append('snapname', snapName)

  if (params?.snapshot_description) {
    formData.append('description', params.snapshot_description)
  } else {
    formData.append('description', 'Bulk snapshot by CFCenter')
  }

  if (params?.include_ram && target.type === 'qemu') {
    formData.append('vmstate', '1')
  }

  const result = await pveFetch<string>(conn, apiPath, {
    method: 'POST',
    body: formData.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })

  return { success: true, upid: String(result) }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []

  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }

  return chunks
}
