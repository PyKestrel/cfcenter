// src/app/api/v1/templates/deploy/route.ts
// Deploy a VM from a template — creates a real VM on a Proxmox node

import { NextRequest, NextResponse } from 'next/server'

import { getTemplate, initTemplateTables } from '@/lib/templates'
import { getConnectionById } from '@/lib/connections/getConnection'
import { pveFetch } from '@/lib/proxmox/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/v1/templates/deploy — deploy a VM from template config
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      template_id,
      connection_id,
      target_node,
      vm_name,
      storage,
      pool,
      start_after_create,
      overrides,
    } = body

    if (!template_id) {
      return NextResponse.json({ error: 'template_id is required' }, { status: 400 })
    }

    if (!connection_id) {
      return NextResponse.json({ error: 'connection_id is required' }, { status: 400 })
    }

    if (!target_node) {
      return NextResponse.json({ error: 'target_node is required' }, { status: 400 })
    }

    initTemplateTables()
    const tpl = getTemplate(template_id)

    if (!tpl) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 })
    }

    const conn = await getConnectionById(connection_id)
    const config = JSON.parse(tpl.config)

    // Get next available VMID
    const nextId = await pveFetch<number>(conn, '/cluster/nextid')

    if (tpl.type === 'qemu') {
      // Create QEMU VM
      const formData = new URLSearchParams()
      formData.append('vmid', String(nextId))
      formData.append('name', vm_name || config.name || `tpl-${tpl.name}`)

      // Apply template config
      const skipKeys = new Set(['name', 'digest', 'pending', 'vmgenid', 'status', 'uptime', 'pid', 'qmpstatus'])

      for (const [key, value] of Object.entries(config)) {
        if (skipKeys.has(key)) continue
        if (value === undefined || value === null) continue

        // Handle disk references — replace storage if user specified one
        if (/^(scsi|virtio|ide|sata)\d+$/.test(key) && storage && typeof value === 'string') {
          const replaced = value.replace(/^[^:]+:/, `${storage}:`)

          formData.append(key, replaced)
        } else {
          formData.append(key, String(value))
        }
      }

      // Apply user overrides
      if (overrides && typeof overrides === 'object') {
        for (const [key, value] of Object.entries(overrides)) {
          if (value !== undefined && value !== null && value !== '') {
            formData.set(key, String(value))
          }
        }
      }

      if (pool) formData.append('pool', pool)

      const apiPath = `/nodes/${encodeURIComponent(target_node)}/qemu`

      const upid = await pveFetch<string>(conn, apiPath, {
        method: 'POST',
        body: formData.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })

      // Optionally start the VM after creation
      let startUpid: string | null = null

      if (start_after_create) {
        try {
          // Wait a moment for the VM to be created
          await new Promise(resolve => setTimeout(resolve, 2000))

          startUpid = await pveFetch<string>(conn, `/nodes/${encodeURIComponent(target_node)}/qemu/${nextId}/status/start`, {
            method: 'POST',
          })
        } catch (startErr: any) {
          // Non-fatal — VM was created but start failed
          console.warn(`VM ${nextId} created but failed to start:`, startErr.message)
        }
      }

      return NextResponse.json({
        data: {
          vmid: nextId,
          node: target_node,
          name: vm_name || config.name || `tpl-${tpl.name}`,
          type: 'qemu',
          template: tpl.name,
          upid: String(upid),
          start_upid: startUpid ? String(startUpid) : null,
          connection_id,
        },
      }, { status: 201 })
    } else {
      // Create LXC container
      const formData = new URLSearchParams()
      formData.append('vmid', String(nextId))
      formData.append('hostname', vm_name || config.hostname || `tpl-${tpl.name}`)

      // OS template is required for LXC
      const ostemplate = config.ostemplate || overrides?.ostemplate
      if (ostemplate) {
        formData.append('ostemplate', String(ostemplate))
      } else {
        formData.append('ostemplate', 'local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst')
      }

      // Apply config
      const lxcKeys = ['cores', 'memory', 'swap', 'rootfs', 'net0', 'net1', 'nameserver',
        'searchdomain', 'onboot', 'unprivileged', 'features', 'mp0', 'mp1']

      for (const key of lxcKeys) {
        if (config[key] !== undefined && config[key] !== null) {
          if (key === 'rootfs' && storage && typeof config[key] === 'string') {
            formData.append(key, config[key].replace(/^[^:]+:/, `${storage}:`))
          } else {
            formData.append(key, String(config[key]))
          }
        }
      }

      // Apply user overrides
      if (overrides && typeof overrides === 'object') {
        for (const [key, value] of Object.entries(overrides)) {
          if (value !== undefined && value !== null && value !== '') {
            formData.set(key, String(value))
          }
        }
      }

      if (pool) formData.append('pool', pool)
      if (storage && !formData.has('rootfs')) {
        formData.append('rootfs', `${storage}:8`)
      }

      const apiPath = `/nodes/${encodeURIComponent(target_node)}/lxc`

      const upid = await pveFetch<string>(conn, apiPath, {
        method: 'POST',
        body: formData.toString(),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })

      let startUpid: string | null = null

      if (start_after_create) {
        try {
          await new Promise(resolve => setTimeout(resolve, 2000))

          startUpid = await pveFetch<string>(conn, `/nodes/${encodeURIComponent(target_node)}/lxc/${nextId}/status/start`, {
            method: 'POST',
          })
        } catch (startErr: any) {
          console.warn(`CT ${nextId} created but failed to start:`, startErr.message)
        }
      }

      return NextResponse.json({
        data: {
          vmid: nextId,
          node: target_node,
          name: vm_name || config.hostname || `tpl-${tpl.name}`,
          type: 'lxc',
          template: tpl.name,
          upid: String(upid),
          start_upid: startUpid ? String(startUpid) : null,
          connection_id,
        },
      }, { status: 201 })
    }
  } catch (error: any) {
    console.error('Error deploying from template:', error)

    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
