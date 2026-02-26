// src/app/api/v1/runbooks/route.ts
// CRUD API for runbooks / playbooks

import { NextRequest, NextResponse } from 'next/server'

import { checkPermission, PERMISSIONS } from '@/lib/rbac'
import { listRunbooks, createRunbook } from '@/lib/runbooks'
import type { RunbookStatus } from '@/lib/runbooks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/v1/runbooks
export async function GET(request: NextRequest) {
  try {
    const denied = await checkPermission(PERMISSIONS.AUTOMATION_VIEW, 'global', '*')

    if (denied) return denied

    const status = request.nextUrl.searchParams.get('status') as RunbookStatus | null
    const category = request.nextUrl.searchParams.get('category') || undefined

    const runbooks = listRunbooks({ status: status || undefined, category })

    return NextResponse.json({ data: runbooks, total: runbooks.length })
  } catch (e: any) {
    console.error('[runbooks] GET error:', e)

    return NextResponse.json({ error: e?.message || 'Failed to list runbooks' }, { status: 500 })
  }
}

// POST /api/v1/runbooks
export async function POST(request: NextRequest) {
  try {
    const denied = await checkPermission(PERMISSIONS.AUTOMATION_MANAGE, 'global', '*')

    if (denied) return denied

    const body = await request.json()
    const { name, description, category, icon, steps, variables } = body

    if (!name || !steps || !Array.isArray(steps)) {
      return NextResponse.json({ error: 'Missing required fields: name, steps (array)' }, { status: 400 })
    }

    const runbook = createRunbook({ name, description, category, icon, steps, variables })

    return NextResponse.json({ data: runbook }, { status: 201 })
  } catch (e: any) {
    console.error('[runbooks] POST error:', e)

    return NextResponse.json({ error: e?.message || 'Failed to create runbook' }, { status: 500 })
  }
}
