// src/lib/scheduler/index.ts
// Scheduler initialization — registers all job handlers and starts the cron engine

import { startScheduler, registerJobHandler } from './engine'
import { handleSnapshotJob } from './handlers/snapshot-handler'
import { handlePowerActionJob } from './handlers/power-handler'

let initialized = false

export function initScheduler() {
  if (initialized) return

  // Register job type handlers
  registerJobHandler('snapshot', handleSnapshotJob)
  registerJobHandler('power_action', handlePowerActionJob)

  // Start the cron engine (loads active jobs from DB)
  startScheduler()

  initialized = true
  console.log('[scheduler] Initialized with snapshot + power_action handlers')
}

// Re-export everything from engine for convenience
export {
  createJob,
  updateJob,
  deleteJob,
  getJob,
  listJobs,
  getJobRuns,
  getRecentRuns,
  triggerJob,
  stopScheduler,
} from './engine'

export type {
  ScheduledJob,
  JobRun,
  JobType,
  JobStatus,
  RunStatus,
  SnapshotJobParams,
  SnapshotTarget,
  PowerActionJobParams,
  PowerActionTarget,
} from './engine'
