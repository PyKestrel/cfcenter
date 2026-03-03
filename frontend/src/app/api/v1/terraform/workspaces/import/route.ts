// src/app/api/v1/terraform/workspaces/import/route.ts
import { NextRequest, NextResponse } from 'next/server'

import { createWorkspace, updateWorkspace } from '@/lib/terraform'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/v1/terraform/workspaces/import — import workspace from JSON
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate format
    if (!body._format || body._format !== 'cfcenter-terraform-workspace') {
      return NextResponse.json(
        { error: 'Invalid format. Expected a CFCenter Terraform workspace export file.' },
        { status: 400 }
      )
    }

    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'Exported workspace is missing a name' }, { status: 400 })
    }

    if (!body.hcl_content && !body.state_json) {
      return NextResponse.json(
        { error: 'Exported workspace has no HCL content or state to import' },
        { status: 400 }
      )
    }

    // Create workspace from exported data
    const ws = createWorkspace({
      name: body.name.trim(),
      description: body.description || undefined,
      hcl_content: body.hcl_content || '',
    })

    // If the export included Terraform state, attach it
    if (body.state_json) {
      updateWorkspace(ws.id, { state_json: body.state_json })
    }

    return NextResponse.json({ data: ws }, { status: 201 })
  } catch (error: any) {
    console.error('Error importing terraform workspace:', error)

    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
