// src/app/api/v1/terraform/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'

import { generateHclFromTemplate, generateManagementHcl } from '@/lib/terraform'
import { getTemplate, initTemplateTables } from '@/lib/templates'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/v1/terraform/generate — generate HCL from a template or resource type
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      template_id,
      resource_type,
      vm_name,
      target_node,
      connection_endpoint,
      insecure,
    } = body

    if (template_id) {
      // Generate from VM template
      initTemplateTables()
      const tpl = getTemplate(template_id)

      if (!tpl) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 })
      }

      const config = JSON.parse(tpl.config)
      const hcl = generateHclFromTemplate(
        config,
        tpl.type as 'qemu' | 'lxc',
        vm_name || tpl.name || 'vm',
        target_node || 'pve',
        connection_endpoint || 'https://pve.example.com:8006',
        insecure !== false,
      )

      return NextResponse.json({ data: { hcl, source: 'template', template_name: tpl.name } })
    }

    if (resource_type) {
      // Generate management HCL
      const hcl = generateManagementHcl(
        connection_endpoint || 'https://pve.example.com:8006',
        insecure !== false,
        resource_type,
      )

      return NextResponse.json({ data: { hcl, source: 'resource_template', resource_type } })
    }

    return NextResponse.json({ error: 'Either template_id or resource_type is required' }, { status: 400 })
  } catch (error: any) {
    console.error('Error generating terraform HCL:', error)

    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
