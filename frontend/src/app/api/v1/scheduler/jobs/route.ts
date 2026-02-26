// src/app/api/v1/scheduler/jobs/route.ts
// CRUD API for scheduled jobs

import { NextRequest, NextResponse } from 'next/server'

import { checkPermission, PERMISSIONS } from '@/lib/rbac'
import {
  initScheduler,
  createJob,
  listJobs,
} from '@/lib/scheduler'
import type { JobType } from '@/lib/scheduler'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/v1/scheduler/jobs — List all scheduled jobs
export async function GET(request: NextRequest) {
  try {
    const denied = await checkPermission(PERMISSIONS.AUTOMATION_VIEW, 'global', '*')

    if (denied) return denied

    initScheduler()

    const type = request.nextUrl.searchParams.get('type') as JobType | null
    const enabledParam = request.nextUrl.searchParams.get('enabled')
    const enabled = enabledParam === null ? undefined : enabledParam === 'true'

    const jobs = listJobs({ type: type || undefined, enabled })

    return NextResponse.json({ data: jobs, total: jobs.length })
  } catch (e: any) {
    console.error('[scheduler/jobs] GET error:', e)

    return NextResponse.json({ error: e?.message || 'Failed to list jobs' }, { status: 500 })
  }
}

// POST /api/v1/scheduler/jobs — Create a new scheduled job
export async function POST(request: NextRequest) {
  try {
    const denied = await checkPermission(PERMISSIONS.AUTOMATION_MANAGE, 'global', '*')

    if (denied) return denied

    initScheduler()

    const body = await request.json()

    const { name, description, type, cron_expression, timezone, params, max_history } = body

    if (!name || !type || !cron_expression || !params) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type, cron_expression, params' },
        { status: 400 }
      )
    }

    if (!['snapshot', 'power_action', 'backup', 'custom'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid job type. Must be: snapshot, power_action, backup, custom' },
        { status: 400 }
      )
    }

    const job = createJob({
      name,
      description,
      type,
      cron_expression,
      timezone,
      params,
      max_history,
    })

    return NextResponse.json({ data: job }, { status: 201 })
  } catch (e: any) {
    console.error('[scheduler/jobs] POST error:', e)

    return NextResponse.json({ error: e?.message || 'Failed to create job' }, { status: 500 })
  }
}
