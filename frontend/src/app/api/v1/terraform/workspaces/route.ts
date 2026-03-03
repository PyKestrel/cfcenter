// src/app/api/v1/terraform/workspaces/route.ts
import { NextRequest, NextResponse } from 'next/server'
import {
  listWorkspaces,
  createWorkspace,
  isTerraformInstalled,
  getTerraformVersion,
  RESOURCE_TEMPLATES,
} from '@/lib/terraform'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/v1/terraform/workspaces — list all workspaces + terraform status
export async function GET() {
  try {
    const workspaces = listWorkspaces()
    const installed = isTerraformInstalled()
    const version = installed ? getTerraformVersion() : null

    return NextResponse.json({
      data: workspaces,
      terraform: { installed, version },
      templates: RESOURCE_TEMPLATES,
    })
  } catch (error: any) {
    console.error('Error listing terraform workspaces:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/v1/terraform/workspaces — create a new workspace
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, hcl_content, connection_id, credential_id } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const ws = createWorkspace({
      name: name.trim(),
      description: description || undefined,
      hcl_content: hcl_content || '',
      connection_id: connection_id || undefined,
      credential_id: credential_id || undefined,
    })

    return NextResponse.json({ data: ws }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating terraform workspace:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
