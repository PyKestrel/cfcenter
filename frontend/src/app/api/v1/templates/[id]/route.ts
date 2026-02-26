// src/app/api/v1/templates/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server'

import { checkPermission, PERMISSIONS } from '@/lib/rbac'
import { getTemplate, updateTemplate, deleteTemplate } from '@/lib/templates'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { id: string }

// GET /api/v1/templates/[id]
export async function GET(_request: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const denied = await checkPermission(PERMISSIONS.VM_VIEW, 'global', '*')

    if (denied) return denied

    const { id } = await ctx.params
    const tpl = getTemplate(id)

    if (!tpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 })

    return NextResponse.json({ data: tpl })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

// PUT /api/v1/templates/[id]
export async function PUT(request: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const denied = await checkPermission(PERMISSIONS.VM_CONFIG, 'global', '*')

    if (denied) return denied

    const { id } = await ctx.params
    const body = await request.json()
    const updated = updateTemplate(id, body)

    if (!updated) return NextResponse.json({ error: 'Template not found or is built-in' }, { status: 404 })

    return NextResponse.json({ data: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}

// DELETE /api/v1/templates/[id]
export async function DELETE(_request: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const denied = await checkPermission(PERMISSIONS.VM_CONFIG, 'global', '*')

    if (denied) return denied

    const { id } = await ctx.params
    const deleted = deleteTemplate(id)

    if (!deleted) return NextResponse.json({ error: 'Template not found or is built-in' }, { status: 404 })

    return NextResponse.json({ data: { success: true } })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 })
  }
}
