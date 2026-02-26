// src/app/api/v1/templates/export/route.ts
// Export a live VM's configuration as a reusable template

import { NextRequest, NextResponse } from 'next/server'

import { pveFetch } from '@/lib/proxmox/client'
import { getConnectionById } from '@/lib/connections/getConnection'
import { checkPermission, buildVmResourceId, PERMISSIONS } from '@/lib/rbac'
import { createTemplate, exportConfigAsTemplate } from '@/lib/templates'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/v1/templates/export
// Body: { connection_id, type, node, vmid, template_name, template_description?, category? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { connection_id, type, node, vmid, template_name, template_description, category } = body

    if (!connection_id || !type || !node || !vmid || !template_name) {
      return NextResponse.json(
        { error: 'Missing required fields: connection_id, type, node, vmid, template_name' },
        { status: 400 }
      )
    }

    // RBAC
    const resourceId = buildVmResourceId(connection_id, node, type, vmid)
    const denied = await checkPermission(PERMISSIONS.VM_VIEW, 'vm', resourceId)

    if (denied) return denied

    const conn = await getConnectionById(connection_id)

    // Fetch current VM config from Proxmox
    const vmConfig = await pveFetch<Record<string, any>>(
      conn,
      `/nodes/${encodeURIComponent(node)}/${type}/${encodeURIComponent(vmid)}/config`
    )

    // Convert to template format
    const { config, metadata } = exportConfigAsTemplate(
      vmConfig,
      type as 'qemu' | 'lxc',
      vmConfig.name || `VM ${vmid}`,
      { vmid, node, connection_id }
    )

    // Save as template
    const template = createTemplate({
      name: template_name,
      description: template_description || `Exported from ${vmConfig.name || `VM ${vmid}`} on ${node}`,
      category: category || 'custom',
      type: type as 'qemu' | 'lxc',
      config,
      metadata,
    })

    return NextResponse.json({ data: template }, { status: 201 })
  } catch (e: any) {
    console.error('[templates/export] POST error:', e)

    return NextResponse.json({ error: e?.message || 'Failed to export template' }, { status: 500 })
  }
}
