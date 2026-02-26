// src/lib/scheduler/engine.ts
// Cron-based job scheduler engine backed by SQLite
// Uses 'croner' for cron expression parsing and scheduling

import { Cron } from 'croner'

import { getDb } from '@/lib/db/sqlite'

// ============================================
// Types
// ============================================

export type JobType = 'snapshot' | 'power_action' | 'backup' | 'custom'
export type JobStatus = 'active' | 'paused' | 'deleted'
export type RunStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped'

export interface ScheduledJob {
  id: string
  name: string
  description: string | null
  type: JobType
  cron_expression: string
  timezone: string
  enabled: boolean
  // JSON-encoded parameters specific to the job type
  params: string
  // Retention / limits
  max_history: number
  // Tracking
  last_run_at: string | null
  next_run_at: string | null
  last_status: RunStatus | null
  run_count: number
  fail_count: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface JobRun {
  id: string
  job_id: string
  status: RunStatus
  started_at: string
  finished_at: string | null
  duration_ms: number | null
  result: string | null
  error: string | null
  created_at: string
}

// Parameters for snapshot jobs
export interface SnapshotJobParams {
  targets: SnapshotTarget[]
  include_ram: boolean
  name_prefix: string
  retention: {
    keep_last: number      // Keep N most recent snapshots (0 = unlimited)
    keep_days: number      // Delete snapshots older than N days (0 = unlimited)
  }
}

export interface SnapshotTarget {
  connection_id: string
  type: string    // 'qemu' | 'lxc'
  node: string
  vmid: string
  vm_name?: string
}

// Parameters for power action jobs
export interface PowerActionJobParams {
  targets: PowerActionTarget[]
  action: 'start' | 'shutdown' | 'stop' | 'reboot' | 'suspend' | 'resume'
  force: boolean
}

export interface PowerActionTarget {
  connection_id: string
  type: string
  node: string
  vmid: string
  vm_name?: string
}

// ============================================
// Job handler registry
// ============================================

type JobHandler = (job: ScheduledJob, params: any) => Promise<{ success: boolean; message: string; details?: any }>

const handlers: Map<JobType, JobHandler> = new Map()

export function registerJobHandler(type: JobType, handler: JobHandler) {
  handlers.set(type, handler)
}

// ============================================
// Database initialization
// ============================================

let initialized = false

export function initSchedulerTables() {
  if (initialized) return

  const db = getDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      cron_expression TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'UTC',
      enabled INTEGER NOT NULL DEFAULT 1,
      params TEXT NOT NULL DEFAULT '{}',
      max_history INTEGER NOT NULL DEFAULT 50,
      last_run_at TEXT,
      next_run_at TEXT,
      last_status TEXT,
      run_count INTEGER NOT NULL DEFAULT 0,
      fail_count INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_type ON scheduled_jobs(type);
    CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_enabled ON scheduled_jobs(enabled);
    CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_next_run ON scheduled_jobs(next_run_at);

    CREATE TABLE IF NOT EXISTS job_runs (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      started_at TEXT NOT NULL,
      finished_at TEXT,
      duration_ms INTEGER,
      result TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES scheduled_jobs(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_job_runs_job_id ON job_runs(job_id);
    CREATE INDEX IF NOT EXISTS idx_job_runs_started_at ON job_runs(started_at);
    CREATE INDEX IF NOT EXISTS idx_job_runs_status ON job_runs(status);
  `)

  initialized = true
}

// ============================================
// In-memory cron instances
// ============================================

const cronJobs: Map<string, Cron> = new Map()

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
}

// ============================================
// CRUD operations
// ============================================

export function createJob(input: {
  name: string
  description?: string
  type: JobType
  cron_expression: string
  timezone?: string
  params: any
  max_history?: number
  created_by?: string
}): ScheduledJob {
  initSchedulerTables()
  const db = getDb()
  const now = new Date().toISOString()
  const id = `job_${generateId()}`

  // Validate cron expression
  try {
    const nextRun = new Cron(input.cron_expression).nextRun()

    const job: ScheduledJob = {
      id,
      name: input.name,
      description: input.description || null,
      type: input.type,
      cron_expression: input.cron_expression,
      timezone: input.timezone || 'UTC',
      enabled: true,
      params: JSON.stringify(input.params),
      max_history: input.max_history || 50,
      last_run_at: null,
      next_run_at: nextRun ? nextRun.toISOString() : null,
      last_status: null,
      run_count: 0,
      fail_count: 0,
      created_by: input.created_by || null,
      created_at: now,
      updated_at: now,
    }

    db.prepare(`
      INSERT INTO scheduled_jobs (id, name, description, type, cron_expression, timezone, enabled, params, max_history, next_run_at, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?)
    `).run(id, job.name, job.description, job.type, job.cron_expression, job.timezone, job.params, job.max_history, job.next_run_at, job.created_by, now, now)

    // Schedule it
    scheduleJob(job)

    return job
  } catch (err: any) {
    throw new Error(`Invalid cron expression: ${err.message}`)
  }
}

export function updateJob(id: string, updates: {
  name?: string
  description?: string
  cron_expression?: string
  timezone?: string
  enabled?: boolean
  params?: any
  max_history?: number
}): ScheduledJob | null {
  initSchedulerTables()
  const db = getDb()
  const existing = getJob(id)

  if (!existing) return null

  const now = new Date().toISOString()
  const fields: string[] = ['updated_at = ?']
  const values: any[] = [now]

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name) }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description) }
  if (updates.timezone !== undefined) { fields.push('timezone = ?'); values.push(updates.timezone) }
  if (updates.enabled !== undefined) { fields.push('enabled = ?'); values.push(updates.enabled ? 1 : 0) }
  if (updates.params !== undefined) { fields.push('params = ?'); values.push(JSON.stringify(updates.params)) }
  if (updates.max_history !== undefined) { fields.push('max_history = ?'); values.push(updates.max_history) }

  if (updates.cron_expression !== undefined) {
    // Validate new cron
    try {
      const nextRun = new Cron(updates.cron_expression).nextRun()

      fields.push('cron_expression = ?')
      values.push(updates.cron_expression)
      fields.push('next_run_at = ?')
      values.push(nextRun ? nextRun.toISOString() : null)
    } catch (err: any) {
      throw new Error(`Invalid cron expression: ${err.message}`)
    }
  }

  values.push(id)
  db.prepare(`UPDATE scheduled_jobs SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  // Reschedule
  unscheduleJob(id)
  const updated = getJob(id)

  if (updated && updated.enabled) {
    scheduleJob(updated)
  }

  return updated
}

export function deleteJob(id: string): boolean {
  initSchedulerTables()
  const db = getDb()

  unscheduleJob(id)
  db.prepare('DELETE FROM job_runs WHERE job_id = ?').run(id)
  const result = db.prepare('DELETE FROM scheduled_jobs WHERE id = ?').run(id)

  return result.changes > 0
}

export function getJob(id: string): ScheduledJob | null {
  initSchedulerTables()
  const db = getDb()
  const row = db.prepare('SELECT * FROM scheduled_jobs WHERE id = ?').get(id) as any

  if (!row) return null

  return { ...row, enabled: !!row.enabled }
}

export function listJobs(filters?: { type?: JobType; enabled?: boolean }): ScheduledJob[] {
  initSchedulerTables()
  const db = getDb()
  let sql = 'SELECT * FROM scheduled_jobs WHERE 1=1'
  const params: any[] = []

  if (filters?.type) { sql += ' AND type = ?'; params.push(filters.type) }
  if (filters?.enabled !== undefined) { sql += ' AND enabled = ?'; params.push(filters.enabled ? 1 : 0) }

  sql += ' ORDER BY created_at DESC'

  return (db.prepare(sql).all(...params) as any[]).map(r => ({ ...r, enabled: !!r.enabled }))
}

// ============================================
// Job runs
// ============================================

export function getJobRuns(jobId: string, limit = 20): JobRun[] {
  initSchedulerTables()
  const db = getDb()

  return db.prepare(
    'SELECT * FROM job_runs WHERE job_id = ? ORDER BY started_at DESC LIMIT ?'
  ).all(jobId, limit) as JobRun[]
}

export function getRecentRuns(limit = 50): JobRun[] {
  initSchedulerTables()
  const db = getDb()

  return db.prepare(
    'SELECT * FROM job_runs ORDER BY started_at DESC LIMIT ?'
  ).all(limit) as JobRun[]
}

function recordRun(jobId: string, status: RunStatus, result?: string, error?: string, durationMs?: number): string {
  const db = getDb()
  const id = `run_${generateId()}`
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO job_runs (id, job_id, status, started_at, finished_at, duration_ms, result, error, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, jobId, status, now, status !== 'running' ? now : null, durationMs || null, result || null, error || null, now)

  return id
}

function updateRun(runId: string, status: RunStatus, result?: string, error?: string, durationMs?: number) {
  const db = getDb()
  const now = new Date().toISOString()

  db.prepare(`
    UPDATE job_runs SET status = ?, finished_at = ?, duration_ms = ?, result = ?, error = ? WHERE id = ?
  `).run(status, now, durationMs || null, result || null, error || null, runId)
}

function pruneOldRuns(jobId: string, maxHistory: number) {
  if (maxHistory <= 0) return

  const db = getDb()

  db.prepare(`
    DELETE FROM job_runs WHERE job_id = ? AND id NOT IN (
      SELECT id FROM job_runs WHERE job_id = ? ORDER BY started_at DESC LIMIT ?
    )
  `).run(jobId, jobId, maxHistory)
}

// ============================================
// Scheduling logic
// ============================================

async function executeJob(job: ScheduledJob) {
  const handler = handlers.get(job.type)

  if (!handler) {
    console.warn(`[scheduler] No handler registered for job type: ${job.type}`)
    return
  }

  const startTime = Date.now()
  const runId = recordRun(job.id, 'running')
  const db = getDb()

  try {
    const params = JSON.parse(job.params)
    const result = await handler(job, params)
    const durationMs = Date.now() - startTime

    if (result.success) {
      updateRun(runId, 'success', JSON.stringify(result), undefined, durationMs)
      db.prepare(`
        UPDATE scheduled_jobs SET last_run_at = ?, last_status = 'success', run_count = run_count + 1, updated_at = ? WHERE id = ?
      `).run(new Date().toISOString(), new Date().toISOString(), job.id)
    } else {
      updateRun(runId, 'failed', JSON.stringify(result), result.message, durationMs)
      db.prepare(`
        UPDATE scheduled_jobs SET last_run_at = ?, last_status = 'failed', run_count = run_count + 1, fail_count = fail_count + 1, updated_at = ? WHERE id = ?
      `).run(new Date().toISOString(), new Date().toISOString(), job.id)
    }
  } catch (err: any) {
    const durationMs = Date.now() - startTime

    updateRun(runId, 'failed', undefined, err.message, durationMs)
    db.prepare(`
      UPDATE scheduled_jobs SET last_run_at = ?, last_status = 'failed', run_count = run_count + 1, fail_count = fail_count + 1, updated_at = ? WHERE id = ?
    `).run(new Date().toISOString(), new Date().toISOString(), job.id)
    console.error(`[scheduler] Job ${job.id} (${job.name}) failed:`, err.message)
  }

  // Update next_run_at
  const cronInstance = cronJobs.get(job.id)

  if (cronInstance) {
    const nextRun = cronInstance.nextRun()

    db.prepare('UPDATE scheduled_jobs SET next_run_at = ? WHERE id = ?')
      .run(nextRun ? nextRun.toISOString() : null, job.id)
  }

  // Prune old runs
  pruneOldRuns(job.id, job.max_history)
}

function scheduleJob(job: ScheduledJob) {
  if (!job.enabled) return

  // Stop existing cron if any
  unscheduleJob(job.id)

  try {
    const cronInstance = new Cron(job.cron_expression, {
      timezone: job.timezone || 'UTC',
      protect: true, // Prevent overlapping runs
    }, () => {
      // Re-fetch job to check if still enabled
      const current = getJob(job.id)

      if (current && current.enabled) {
        executeJob(current).catch(err => {
          console.error(`[scheduler] Unhandled error in job ${job.id}:`, err)
        })
      }
    })

    cronJobs.set(job.id, cronInstance)
  } catch (err: any) {
    console.error(`[scheduler] Failed to schedule job ${job.id}:`, err.message)
  }
}

function unscheduleJob(id: string) {
  const existing = cronJobs.get(id)

  if (existing) {
    existing.stop()
    cronJobs.delete(id)
  }
}

// ============================================
// Startup: load all enabled jobs
// ============================================

let started = false

export function startScheduler() {
  if (started) return

  initSchedulerTables()
  const jobs = listJobs({ enabled: true })

  console.log(`[scheduler] Starting scheduler with ${jobs.length} active job(s)`)

  for (const job of jobs) {
    scheduleJob(job)
  }

  started = true
}

export function stopScheduler() {
  for (const [id, cron] of cronJobs) {
    cron.stop()
  }

  cronJobs.clear()
  started = false
  console.log('[scheduler] Scheduler stopped')
}

// ============================================
// Manual trigger
// ============================================

export async function triggerJob(id: string): Promise<{ success: boolean; message: string }> {
  const job = getJob(id)

  if (!job) return { success: false, message: 'Job not found' }

  await executeJob(job)
  const updated = getJob(id)

  return {
    success: updated?.last_status === 'success',
    message: updated?.last_status === 'success' ? 'Job executed successfully' : 'Job execution failed',
  }
}
