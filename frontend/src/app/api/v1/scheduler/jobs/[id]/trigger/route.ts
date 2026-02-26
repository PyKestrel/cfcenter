// src/app/api/v1/scheduler/jobs/[id]/trigger/route.ts
// Manually trigger a scheduled job

import { NextRequest, NextResponse } from 'next/server'

import { checkPermission, PERMISSIONS } from '@/lib/rbac'
import { initScheduler, triggerJob } from '@/lib/scheduler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { id: string }

// POST /api/v1/scheduler/jobs/[id]/trigger
export async function POST(
  _request: NextRequest,
  ctx: { params: Promise<Params> }
) {
  try {
    const denied = await checkPermission(PERMISSIONS.AUTOMATION_EXECUTE, 'global', '*')

    if (denied) return denied

    initScheduler()
    const { id } = await ctx.params
    const result = await triggerJob(id)

    return NextResponse.json({ data: result })
  } catch (e: any) {
    console.error('[scheduler/jobs/id/trigger] POST error:', e)

    return NextResponse.json({ error: e?.message || 'Failed to trigger job' }, { status: 500 })
  }
}
