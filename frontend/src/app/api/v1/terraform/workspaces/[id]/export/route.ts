// src/app/api/v1/terraform/workspaces/[id]/export/route.ts
import { NextRequest, NextResponse } from 'next/server'

import { getWorkspace } from '@/lib/terraform'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/v1/terraform/workspaces/[id]/export — export workspace as JSON
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const ws = getWorkspace(id)

    if (!ws) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    const exported = {
      _format: 'cfcenter-terraform-workspace',
      _version: 1,
      name: ws.name,
      description: ws.description,
      hcl_content: ws.hcl_content,
      state_json: ws.state_json,
      exported_at: new Date().toISOString(),
    }

    const filename = `${ws.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.tfworkspace.json`

    return new NextResponse(JSON.stringify(exported, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
