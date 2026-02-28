// src/lib/runbooks/executor.ts
// Proxmox step executor for runbooks — wires step types to real PVE API calls

import { prisma } from '@/lib/db/prisma'
import { pveFetch } from '@/lib/proxmox/client'
import { decryptSecret } from '@/lib/crypto/secret'
import type { RunbookStep } from './index'

// ============================================
// Connection helper
// ============================================

async function getConnection(id: string) {
  const connection = await prisma.connection.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      baseUrl: true,
      insecureTLS: true,
      apiTokenEnc: true,
    },
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

async function getFirstConnection() {
  const connection = await prisma.connection.findFirst({
    where: { type: 'pve' },
    select: {
      id: true,
      name: true,
      baseUrl: true,
      insecureTLS: true,
      apiTokenEnc: true,
    },
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

// ============================================
// Step handlers
// ============================================

async function handleCloneTemplate(
  step: RunbookStep,
  vars: Record<string, any>
): Promise<{ success: boolean; output?: any; error?: string }> {
  const { connection_id, source_vmid, target_node, new_name, full_clone, pool, storage } = step.params

  const conn = connection_id
    ? await getConnection(connection_id)
    : await getFirstConnection()

  if (!conn) {
    return { success: false, error: 'No PVE connection available' }
  }

  if (!source_vmid) {
    return { success: false, error: 'source_vmid is required for clone_template step' }
  }

  const sourceNode = step.params.source_node || target_node || 'pve'
  const vmType = step.params.vm_type || 'qemu'

  try {
    // Get next available VMID
    const nextId = await pveFetch<number>(conn, '/cluster/nextid')

    const formData = new URLSearchParams()
    formData.append('newid', String(nextId))

    if (new_name) formData.append('name', String(new_name))
    if (target_node) formData.append('target', String(target_node))
    if (full_clone !== false) formData.append('full', '1')
    if (pool) formData.append('pool', String(pool))
    if (storage) formData.append('storage', String(storage))

    const apiPath = `/nodes/${encodeURIComponent(sourceNode)}/${vmType}/${source_vmid}/clone`

    const upid = await pveFetch<string>(conn, apiPath, {
      method: 'POST',
      body: formData.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })

    return {
      success: true,
      output: {
        vmid: nextId,
        upid: String(upid),
        name: new_name || `clone-${source_vmid}`,
        node: target_node || sourceNode,
        connection_id: conn.id,
      },
    }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

async function handleApplyConfig(
  step: RunbookStep,
  vars: Record<string, any>
): Promise<{ success: boolean; output?: any; error?: string }> {
  const { connection_id, vmid, node, vm_type } = step.params

  const conn = connection_id
    ? await getConnection(connection_id)
    : await getFirstConnection()

  if (!conn) {
    return { success: false, error: 'No PVE connection available' }
  }

  // Try to get vmid from previous step output or params
  const targetVmid = vmid || vars.step_0_vmid || vars.vmid
  const targetNode = node || vars.step_0_node || vars.node || 'pve'
  const targetType = vm_type || vars.step_0_type || 'qemu'

  if (!targetVmid) {
    return { success: false, error: 'vmid is required (set in params or available from a previous clone step)' }
  }

  // Build config update — extract known config keys from params
  const configKeys = ['cores', 'sockets', 'memory', 'balloon', 'cpu', 'name', 'description',
    'onboot', 'agent', 'ostype', 'bios', 'machine', 'tags', 'protection',
    'net0', 'net1', 'net2', 'net3',
    'scsi0', 'scsi1', 'virtio0', 'virtio1', 'ide0', 'ide2',
    'boot', 'scsihw', 'ciuser', 'cipassword', 'ipconfig0', 'ipconfig1',
    'nameserver', 'searchdomain', 'sshkeys']

  const formData = new URLSearchParams()
  const appliedFields: string[] = []

  for (const key of configKeys) {
    if (step.params[key] !== undefined && step.params[key] !== '') {
      formData.append(key, String(step.params[key]))
      appliedFields.push(key)
    }
  }

  if (appliedFields.length === 0) {
    return { success: true, output: { message: 'No config changes to apply', vmid: targetVmid } }
  }

  try {
    const apiPath = `/nodes/${encodeURIComponent(targetNode)}/${targetType}/${targetVmid}/config`

    await pveFetch<any>(conn, apiPath, {
      method: 'PUT',
      body: formData.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })

    return {
      success: true,
      output: {
        vmid: targetVmid,
        node: targetNode,
        applied_fields: appliedFields,
      },
    }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

async function handlePowerAction(
  step: RunbookStep,
  vars: Record<string, any>
): Promise<{ success: boolean; output?: any; error?: string }> {
  const { connection_id, vmid, node, vm_type, action, force } = step.params

  const conn = connection_id
    ? await getConnection(connection_id)
    : await getFirstConnection()

  if (!conn) {
    return { success: false, error: 'No PVE connection available' }
  }

  const targetVmid = vmid || vars.step_0_vmid || vars.vmid
  const targetNode = node || vars.step_0_node || vars.node || 'pve'
  const targetType = vm_type || vars.step_0_type || 'qemu'
  const powerAction = action || 'start'

  if (!targetVmid) {
    return { success: false, error: 'vmid is required (set in params or available from a previous step)' }
  }

  const ACTION_MAP: Record<string, string> = {
    start: 'status/start',
    shutdown: 'status/shutdown',
    stop: 'status/stop',
    reboot: 'status/reboot',
    suspend: 'status/suspend',
    resume: 'status/resume',
  }

  const endpoint = ACTION_MAP[powerAction]
  if (!endpoint) {
    return { success: false, error: `Unknown power action: ${powerAction}` }
  }

  try {
    const apiPath = `/nodes/${encodeURIComponent(targetNode)}/${targetType}/${targetVmid}/${endpoint}`

    const formData = new URLSearchParams()
    if (force && (powerAction === 'shutdown' || powerAction === 'stop')) {
      formData.append('forceStop', '1')
    }

    const body = formData.toString() || undefined
    const headers: Record<string, string> = {}
    if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded'

    const upid = await pveFetch<string>(conn, apiPath, {
      method: 'POST',
      body,
      headers,
    })

    return {
      success: true,
      output: {
        vmid: targetVmid,
        node: targetNode,
        action: powerAction,
        upid: String(upid),
      },
    }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

async function handleSnapshot(
  step: RunbookStep,
  vars: Record<string, any>
): Promise<{ success: boolean; output?: any; error?: string }> {
  const { connection_id, vmid, node, vm_type, name, description, vmstate } = step.params

  const conn = connection_id
    ? await getConnection(connection_id)
    : await getFirstConnection()

  if (!conn) {
    return { success: false, error: 'No PVE connection available' }
  }

  const targetVmid = vmid || vars.step_0_vmid || vars.vmid
  const targetNode = node || vars.step_0_node || vars.node || 'pve'
  const targetType = vm_type || vars.step_0_type || 'qemu'

  if (!targetVmid) {
    return { success: false, error: 'vmid is required (set in params or available from a previous step)' }
  }

  const snapName = name || `runbook-${Date.now()}`

  try {
    const apiPath = `/nodes/${encodeURIComponent(targetNode)}/${targetType}/${targetVmid}/snapshot`

    const formData = new URLSearchParams()
    formData.append('snapname', snapName)
    if (description) formData.append('description', String(description))
    if (vmstate && targetType === 'qemu') formData.append('vmstate', '1')

    const upid = await pveFetch<string>(conn, apiPath, {
      method: 'POST',
      body: formData.toString(),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })

    return {
      success: true,
      output: {
        vmid: targetVmid,
        node: targetNode,
        snapshot_name: snapName,
        upid: String(upid),
      },
    }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

async function handleHttpWebhook(
  step: RunbookStep,
): Promise<{ success: boolean; output?: any; error?: string }> {
  const { url, method, body, headers: customHeaders, timeout } = step.params

  if (!url) {
    return { success: false, error: 'url is required for http_webhook step' }
  }

  try {
    const fetchHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(customHeaders || {}),
    }

    const controller = new AbortController()
    const timeoutMs = (timeout || 30) * 1000
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(url, {
      method: method || 'POST',
      headers: fetchHeaders,
      body: body ? String(body) : undefined,
      signal: controller.signal,
    })

    clearTimeout(timer)

    const responseText = await response.text().catch(() => '')
    let responseJson: any = null
    try { responseJson = JSON.parse(responseText) } catch { /* not JSON */ }

    return {
      success: response.ok,
      output: {
        status_code: response.status,
        status_text: response.statusText,
        response: responseJson || responseText.substring(0, 1000),
      },
      error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
    }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// ============================================
// Main executor — dispatches step types
// ============================================

export async function proxmoxStepExecutor(
  step: RunbookStep,
  vars: Record<string, any>
): Promise<{ success: boolean; output?: any; error?: string }> {
  switch (step.type) {
    case 'clone_template':
      return handleCloneTemplate(step, vars)

    case 'apply_config':
      return handleApplyConfig(step, vars)

    case 'power_action':
      return handlePowerAction(step, vars)

    case 'snapshot':
      return handleSnapshot(step, vars)

    case 'http_webhook':
      return handleHttpWebhook(step)

    // 'wait' and 'note' are handled directly in executeRunbook()
    default:
      return { success: false, error: `Unknown step type: ${step.type}` }
  }
}
