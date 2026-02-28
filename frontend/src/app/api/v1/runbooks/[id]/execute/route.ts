// src/app/api/v1/runbooks/[id]/execute/route.ts
// Execute a runbook

import { NextRequest, NextResponse } from 'next/server'

import { checkPermission, PERMISSIONS } from '@/lib/rbac'
import { executeRunbook, listExecutions } from '@/lib/runbooks'
import { proxmoxStepExecutor } from '@/lib/runbooks/executor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { id: string }

// POST /api/v1/runbooks/[id]/execute — Run a runbook
export async function POST(request: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const denied = await checkPermission(PERMISSIONS.AUTOMATION_EXECUTE, 'global', '*')

    if (denied) return denied

    const { id } = await ctx.params
    const body = await request.json().catch(() => ({}))

    const execution = await executeRunbook(id, body.variables || {}, undefined, proxmoxStepExecutor)

    return NextResponse.json({ data: execution })
  } catch (e: any) {
    console.error('[runbooks/execute] POST error:', e)

    return NextResponse.json({ error: e?.message || 'Execution failed' }, { status: 500 })
  }
}

// GET /api/v1/runbooks/[id]/execute — List executions for a runbook
export async function GET(request: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const denied = await checkPermission(PERMISSIONS.AUTOMATION_VIEW, 'global', '*')

    if (denied) return denied

    const { id } = await ctx.params
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20', 10)
    const executions = listExecutions(id, limit)

    return NextResponse.json({ data: executions, total: executions.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
