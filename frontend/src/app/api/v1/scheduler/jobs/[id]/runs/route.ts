// src/app/api/v1/scheduler/jobs/[id]/runs/route.ts
// Get run history for a specific job

import { NextRequest, NextResponse } from 'next/server'

import { checkPermission, PERMISSIONS } from '@/lib/rbac'
import { initScheduler, getJobRuns } from '@/lib/scheduler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { id: string }

// GET /api/v1/scheduler/jobs/[id]/runs
export async function GET(
  request: NextRequest,
  ctx: { params: Promise<Params> }
) {
  try {
    const denied = await checkPermission(PERMISSIONS.AUTOMATION_VIEW, 'global', '*')

    if (denied) return denied

    initScheduler()
    const { id } = await ctx.params
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20', 10)
    const runs = getJobRuns(id, limit)

    return NextResponse.json({ data: runs, total: runs.length })
  } catch (e: any) {
    console.error('[scheduler/jobs/id/runs] GET error:', e)

    return NextResponse.json({ error: e?.message || 'Failed to get runs' }, { status: 500 })
  }
}
