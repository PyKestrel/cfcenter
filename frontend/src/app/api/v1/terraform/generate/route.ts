// src/app/api/v1/terraform/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'

import { generateHclFromTemplate, generateManagementHcl } from '@/lib/terraform'
import { getTemplate, initTemplateTables } from '@/lib/templates'
import { getCredentialConfig } from '@/lib/terraform/credentials'

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
      credential_id,
    } = body

    // Resolve credential config if provided
    let resolvedEndpoint = connection_endpoint || 'https://pve.example.com:8006'
    let resolvedInsecure = insecure !== false

    if (credential_id) {
      const credConfig = getCredentialConfig(credential_id)

      if (credConfig) {
        if (credConfig.endpoint) resolvedEndpoint = String(credConfig.endpoint).trim()
        if (credConfig.insecure !== undefined) resolvedInsecure = Boolean(credConfig.insecure)
      }
    }

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
        resolvedEndpoint,
        resolvedInsecure,
      )

      return NextResponse.json({ data: { hcl, source: 'template', template_name: tpl.name } })
    }

    if (resource_type) {
      // Generate management HCL
      const hcl = generateManagementHcl(
        resolvedEndpoint,
        resolvedInsecure,
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
