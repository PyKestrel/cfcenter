// src/app/api/v1/scheduler/jobs/[id]/route.ts
// Get, update, delete a specific scheduled job

import { NextRequest, NextResponse } from 'next/server'

import { checkPermission, PERMISSIONS } from '@/lib/rbac'
import {
  initScheduler,
  getJob,
  updateJob,
  deleteJob,
} from '@/lib/scheduler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { id: string }

// GET /api/v1/scheduler/jobs/[id]
export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<Params> }
) {
  try {
    const denied = await checkPermission(PERMISSIONS.AUTOMATION_VIEW, 'global', '*')

    if (denied) return denied

    initScheduler()
    const { id } = await ctx.params
    const job = getJob(id)

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json({ data: job })
  } catch (e: any) {
    console.error('[scheduler/jobs/id] GET error:', e)

    return NextResponse.json({ error: e?.message || 'Failed to get job' }, { status: 500 })
  }
}

// PUT /api/v1/scheduler/jobs/[id]
export async function PUT(
  request: NextRequest,
  ctx: { params: Promise<Params> }
) {
  try {
    const denied = await checkPermission(PERMISSIONS.AUTOMATION_MANAGE, 'global', '*')

    if (denied) return denied

    initScheduler()
    const { id } = await ctx.params
    const body = await request.json()

    const updated = updateJob(id, {
      name: body.name,
      description: body.description,
      cron_expression: body.cron_expression,
      timezone: body.timezone,
      enabled: body.enabled,
      params: body.params,
      max_history: body.max_history,
    })

    if (!updated) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json({ data: updated })
  } catch (e: any) {
    console.error('[scheduler/jobs/id] PUT error:', e)

    return NextResponse.json({ error: e?.message || 'Failed to update job' }, { status: 500 })
  }
}

// DELETE /api/v1/scheduler/jobs/[id]
export async function DELETE(
  _request: NextRequest,
  ctx: { params: Promise<Params> }
) {
  try {
    const denied = await checkPermission(PERMISSIONS.AUTOMATION_MANAGE, 'global', '*')

    if (denied) return denied

    initScheduler()
    const { id } = await ctx.params
    const deleted = deleteJob(id)

    if (!deleted) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    return NextResponse.json({ data: { success: true } })
  } catch (e: any) {
    console.error('[scheduler/jobs/id] DELETE error:', e)

    return NextResponse.json({ error: e?.message || 'Failed to delete job' }, { status: 500 })
  }
}
