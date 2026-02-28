// src/app/api/v1/terraform/workspaces/[id]/action/route.ts
import { NextRequest, NextResponse } from 'next/server'

import {
  getWorkspace,
  runTerraformAction,
  getOperationLogs,
  isTerraformInstalled,
} from '@/lib/terraform'
import type { TerraformAction } from '@/lib/terraform'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/v1/terraform/workspaces/[id]/action — run terraform action (init/plan/apply/destroy)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { action, api_token } = body as { action: TerraformAction; api_token?: string }

    if (!action || !['init', 'plan', 'apply', 'destroy', 'validate'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be: init, plan, apply, destroy, or validate' }, { status: 400 })
    }

    if (!isTerraformInstalled()) {
      return NextResponse.json({
        error: 'Terraform is not installed on this server. Install from: https://developer.hashicorp.com/terraform/install',
      }, { status: 503 })
    }

    const ws = getWorkspace(id)

    if (!ws) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }

    if (ws.status !== 'idle' && ws.status !== 'error') {
      return NextResponse.json({ error: `Workspace is busy (status: ${ws.status})` }, { status: 409 })
    }

    if (!ws.hcl_content.trim()) {
      return NextResponse.json({ error: 'Workspace has no HCL content' }, { status: 400 })
    }

    // Run terraform action (async — returns when complete)
    const operation = await runTerraformAction(id, action, api_token)

    return NextResponse.json({ data: operation })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET /api/v1/terraform/workspaces/[id]/action?op_id=xxx — get live logs for an operation
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url)
    const opId = searchParams.get('op_id')

    if (!opId) {
      return NextResponse.json({ error: 'op_id query parameter is required' }, { status: 400 })
    }

    const logs = getOperationLogs(opId)

    return NextResponse.json({ logs })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
