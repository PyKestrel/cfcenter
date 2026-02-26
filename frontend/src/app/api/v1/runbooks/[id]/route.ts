// src/app/api/v1/runbooks/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'

import { checkPermission, PERMISSIONS } from '@/lib/rbac'
import { getRunbook, updateRunbook, deleteRunbook } from '@/lib/runbooks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { id: string }

// GET /api/v1/runbooks/[id]
export async function GET(_request: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const denied = await checkPermission(PERMISSIONS.AUTOMATION_VIEW, 'global', '*')

    if (denied) return denied

    const { id } = await ctx.params
    const rb = getRunbook(id)

    if (!rb) return NextResponse.json({ error: 'Runbook not found' }, { status: 404 })

    return NextResponse.json({ data: rb })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

// PUT /api/v1/runbooks/[id]
export async function PUT(request: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const denied = await checkPermission(PERMISSIONS.AUTOMATION_MANAGE, 'global', '*')

    if (denied) return denied

    const { id } = await ctx.params
    const body = await request.json()
    const updated = updateRunbook(id, body)

    if (!updated) return NextResponse.json({ error: 'Runbook not found' }, { status: 404 })

    return NextResponse.json({ data: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

// DELETE /api/v1/runbooks/[id]
export async function DELETE(_request: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const denied = await checkPermission(PERMISSIONS.AUTOMATION_MANAGE, 'global', '*')

    if (denied) return denied

    const { id } = await ctx.params
    const deleted = deleteRunbook(id)

    if (!deleted) return NextResponse.json({ error: 'Runbook not found' }, { status: 404 })

    return NextResponse.json({ data: { success: true } })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
