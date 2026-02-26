// src/lib/runbooks/index.ts
// Runbooks / Playbooks — multi-step automation sequences

import { getDb } from '@/lib/db/sqlite'

// ============================================
// Types
// ============================================

export type StepType =
  | 'clone_template'     // Clone a VM from template or existing VM
  | 'apply_config'       // Apply config overrides (CPU, RAM, network, etc.)
  | 'power_action'       // Start / stop / reboot
  | 'snapshot'           // Create a snapshot
  | 'wait'              // Wait N seconds
  | 'http_webhook'      // Call an external HTTP endpoint
  | 'note'              // Documentation / comment step (no-op)

export type RunbookStatus = 'draft' | 'published' | 'archived'
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled'

export interface Runbook {
  id: string
  name: string
  description: string | null
  category: string
  icon: string | null
  status: RunbookStatus
  // JSON-encoded array of RunbookStep
  steps: string
  // JSON-encoded default variables
  variables: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface RunbookStep {
  id: string
  type: StepType
  name: string
  description?: string
  // Type-specific params
  params: Record<string, any>
  // Condition: skip step if variable equals value
  condition?: { variable: string; operator: 'eq' | 'neq' | 'exists'; value?: string }
  // Error handling
  on_error: 'stop' | 'continue' | 'skip_remaining'
  timeout_seconds: number
}

export interface RunbookExecution {
  id: string
  runbook_id: string
  status: ExecutionStatus
  // JSON-encoded runtime variables (merged defaults + user overrides)
  variables: string
  // JSON-encoded array of StepResult
  step_results: string
  current_step: number
  started_at: string
  finished_at: string | null
  duration_ms: number | null
  triggered_by: string | null
  error: string | null
  created_at: string
}

export interface StepResult {
  step_id: string
  step_name: string
  status: ExecutionStatus
  started_at: string
  finished_at: string | null
  duration_ms: number | null
  output: any
  error: string | null
}

// ============================================
// DB initialization
// ============================================

let tablesCreated = false

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
}

export function initRunbookTables() {
  if (tablesCreated) return

  const db = getDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS runbooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'general',
      icon TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      steps TEXT NOT NULL DEFAULT '[]',
      variables TEXT NOT NULL DEFAULT '{}',
      created_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_runbooks_status ON runbooks(status);
    CREATE INDEX IF NOT EXISTS idx_runbooks_category ON runbooks(category);

    CREATE TABLE IF NOT EXISTS runbook_executions (
      id TEXT PRIMARY KEY,
      runbook_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      variables TEXT NOT NULL DEFAULT '{}',
      step_results TEXT NOT NULL DEFAULT '[]',
      current_step INTEGER NOT NULL DEFAULT 0,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      duration_ms INTEGER,
      triggered_by TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (runbook_id) REFERENCES runbooks(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_runbook_executions_runbook ON runbook_executions(runbook_id);
    CREATE INDEX IF NOT EXISTS idx_runbook_executions_status ON runbook_executions(status);
    CREATE INDEX IF NOT EXISTS idx_runbook_executions_started ON runbook_executions(started_at);
  `)

  // Seed example runbooks
  seedExampleRunbooks(db)

  tablesCreated = true
}

// ============================================
// Runbook CRUD
// ============================================

export function createRunbook(input: {
  name: string
  description?: string
  category?: string
  icon?: string
  steps: RunbookStep[]
  variables?: Record<string, any>
  created_by?: string
}): Runbook {
  initRunbookTables()
  const db = getDb()
  const now = new Date().toISOString()
  const id = generateId('rb')

  db.prepare(`
    INSERT INTO runbooks (id, name, description, category, icon, status, steps, variables, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)
  `).run(id, input.name, input.description || null, input.category || 'general', input.icon || null, JSON.stringify(input.steps), JSON.stringify(input.variables || {}), input.created_by || null, now, now)

  return getRunbook(id)!
}

export function updateRunbook(id: string, updates: {
  name?: string
  description?: string
  category?: string
  icon?: string
  status?: RunbookStatus
  steps?: RunbookStep[]
  variables?: Record<string, any>
}): Runbook | null {
  initRunbookTables()
  const db = getDb()
  const existing = getRunbook(id)

  if (!existing) return null

  const now = new Date().toISOString()
  const fields: string[] = ['updated_at = ?']
  const values: any[] = [now]

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name) }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description) }
  if (updates.category !== undefined) { fields.push('category = ?'); values.push(updates.category) }
  if (updates.icon !== undefined) { fields.push('icon = ?'); values.push(updates.icon) }
  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status) }
  if (updates.steps !== undefined) { fields.push('steps = ?'); values.push(JSON.stringify(updates.steps)) }
  if (updates.variables !== undefined) { fields.push('variables = ?'); values.push(JSON.stringify(updates.variables)) }

  values.push(id)
  db.prepare(`UPDATE runbooks SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  return getRunbook(id)
}

export function deleteRunbook(id: string): boolean {
  initRunbookTables()
  const db = getDb()

  db.prepare('DELETE FROM runbook_executions WHERE runbook_id = ?').run(id)
  const result = db.prepare('DELETE FROM runbooks WHERE id = ?').run(id)

  return result.changes > 0
}

export function getRunbook(id: string): Runbook | null {
  initRunbookTables()
  const db = getDb()
  const row = db.prepare('SELECT * FROM runbooks WHERE id = ?').get(id) as any

  return row || null
}

export function listRunbooks(filters?: {
  status?: RunbookStatus
  category?: string
}): Runbook[] {
  initRunbookTables()
  const db = getDb()
  let sql = 'SELECT * FROM runbooks WHERE 1=1'
  const params: any[] = []

  if (filters?.status) { sql += ' AND status = ?'; params.push(filters.status) }
  if (filters?.category) { sql += ' AND category = ?'; params.push(filters.category) }

  sql += ' ORDER BY updated_at DESC'

  return db.prepare(sql).all(...params) as Runbook[]
}

// ============================================
// Execution CRUD
// ============================================

export function createExecution(runbookId: string, variables: Record<string, any>, triggeredBy?: string): RunbookExecution {
  initRunbookTables()
  const db = getDb()
  const now = new Date().toISOString()
  const id = generateId('exec')

  db.prepare(`
    INSERT INTO runbook_executions (id, runbook_id, status, variables, step_results, current_step, started_at, triggered_by, created_at)
    VALUES (?, ?, 'pending', ?, '[]', 0, ?, ?, ?)
  `).run(id, runbookId, JSON.stringify(variables), now, triggeredBy || null, now)

  return getExecution(id)!
}

export function getExecution(id: string): RunbookExecution | null {
  initRunbookTables()
  const db = getDb()

  return db.prepare('SELECT * FROM runbook_executions WHERE id = ?').get(id) as RunbookExecution | null
}

export function listExecutions(runbookId?: string, limit = 20): RunbookExecution[] {
  initRunbookTables()
  const db = getDb()

  if (runbookId) {
    return db.prepare('SELECT * FROM runbook_executions WHERE runbook_id = ? ORDER BY started_at DESC LIMIT ?').all(runbookId, limit) as RunbookExecution[]
  }

  return db.prepare('SELECT * FROM runbook_executions ORDER BY started_at DESC LIMIT ?').all(limit) as RunbookExecution[]
}

export function updateExecution(id: string, updates: {
  status?: ExecutionStatus
  step_results?: StepResult[]
  current_step?: number
  finished_at?: string
  duration_ms?: number
  error?: string
}): void {
  const db = getDb()
  const fields: string[] = []
  const values: any[] = []

  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status) }
  if (updates.step_results !== undefined) { fields.push('step_results = ?'); values.push(JSON.stringify(updates.step_results)) }
  if (updates.current_step !== undefined) { fields.push('current_step = ?'); values.push(updates.current_step) }
  if (updates.finished_at !== undefined) { fields.push('finished_at = ?'); values.push(updates.finished_at) }
  if (updates.duration_ms !== undefined) { fields.push('duration_ms = ?'); values.push(updates.duration_ms) }
  if (updates.error !== undefined) { fields.push('error = ?'); values.push(updates.error) }

  if (fields.length === 0) return

  values.push(id)
  db.prepare(`UPDATE runbook_executions SET ${fields.join(', ')} WHERE id = ?`).run(...values)
}

// ============================================
// Execution engine
// ============================================

export async function executeRunbook(
  runbookId: string,
  variableOverrides: Record<string, any> = {},
  triggeredBy?: string,
  stepExecutor?: (step: RunbookStep, vars: Record<string, any>) => Promise<{ success: boolean; output?: any; error?: string }>
): Promise<RunbookExecution> {
  const runbook = getRunbook(runbookId)

  if (!runbook) throw new Error('Runbook not found')
  if (runbook.status !== 'published') throw new Error('Runbook must be published to execute')

  const steps: RunbookStep[] = JSON.parse(runbook.steps)
  const defaultVars = JSON.parse(runbook.variables)
  const mergedVars = { ...defaultVars, ...variableOverrides }

  const exec = createExecution(runbookId, mergedVars, triggeredBy)
  const startTime = Date.now()
  const stepResults: StepResult[] = []

  updateExecution(exec.id, { status: 'running' })

  let finalStatus: ExecutionStatus = 'success'

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]

    // Check condition
    if (step.condition) {
      const varValue = mergedVars[step.condition.variable]
      let condMet = false

      switch (step.condition.operator) {
        case 'eq': condMet = String(varValue) === String(step.condition.value); break
        case 'neq': condMet = String(varValue) !== String(step.condition.value); break
        case 'exists': condMet = varValue !== undefined && varValue !== null; break
      }

      if (!condMet) {
        stepResults.push({
          step_id: step.id, step_name: step.name, status: 'cancelled',
          started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
          duration_ms: 0, output: { skipped: true, reason: 'Condition not met' }, error: null,
        })
        updateExecution(exec.id, { step_results: stepResults, current_step: i + 1 })

        continue
      }
    }

    const stepStart = Date.now()
    const stepResult: StepResult = {
      step_id: step.id, step_name: step.name, status: 'running',
      started_at: new Date().toISOString(), finished_at: null, duration_ms: null, output: null, error: null,
    }

    stepResults.push(stepResult)
    updateExecution(exec.id, { step_results: stepResults, current_step: i })

    try {
      // Handle built-in step types
      let result: { success: boolean; output?: any; error?: string }

      if (step.type === 'wait') {
        const waitMs = (step.params.seconds || 5) * 1000

        await new Promise(resolve => setTimeout(resolve, Math.min(waitMs, 300000)))
        result = { success: true, output: { waited_seconds: step.params.seconds } }
      } else if (step.type === 'note') {
        result = { success: true, output: { note: step.params.text || step.description } }
      } else if (stepExecutor) {
        result = await Promise.race([
          stepExecutor(step, mergedVars),
          new Promise<{ success: boolean; error: string }>((_, reject) =>
            setTimeout(() => reject({ success: false, error: `Step timeout (${step.timeout_seconds}s)` }), (step.timeout_seconds || 300) * 1000)
          ),
        ])
      } else {
        result = { success: false, error: `No executor for step type: ${step.type}` }
      }

      stepResult.status = result.success ? 'success' : 'failed'
      stepResult.output = result.output
      stepResult.error = result.error || null

      // Store output variables for later steps
      if (result.output && typeof result.output === 'object') {
        for (const [k, v] of Object.entries(result.output)) {
          mergedVars[`step_${i}_${k}`] = v
        }
      }

      if (!result.success) {
        if (step.on_error === 'stop') {
          finalStatus = 'failed'
          stepResult.finished_at = new Date().toISOString()
          stepResult.duration_ms = Date.now() - stepStart
          updateExecution(exec.id, { step_results: stepResults })

          break
        } else if (step.on_error === 'skip_remaining') {
          finalStatus = 'failed'
          stepResult.finished_at = new Date().toISOString()
          stepResult.duration_ms = Date.now() - stepStart
          updateExecution(exec.id, { step_results: stepResults })

          break
        }
        // 'continue' — keep going
      }
    } catch (err: any) {
      stepResult.status = 'failed'
      stepResult.error = err?.message || String(err)

      if (step.on_error === 'stop' || step.on_error === 'skip_remaining') {
        finalStatus = 'failed'
        stepResult.finished_at = new Date().toISOString()
        stepResult.duration_ms = Date.now() - stepStart
        updateExecution(exec.id, { step_results: stepResults })

        break
      }
    }

    stepResult.finished_at = new Date().toISOString()
    stepResult.duration_ms = Date.now() - stepStart
    updateExecution(exec.id, { step_results: stepResults, current_step: i + 1 })
  }

  const totalDuration = Date.now() - startTime

  updateExecution(exec.id, {
    status: finalStatus,
    step_results: stepResults,
    finished_at: new Date().toISOString(),
    duration_ms: totalDuration,
    error: finalStatus === 'failed' ? stepResults.find(r => r.status === 'failed')?.error || 'Execution failed' : undefined,
  })

  return getExecution(exec.id)!
}

// ============================================
// Seed example runbooks
// ============================================

function seedExampleRunbooks(db: any) {
  const count = (db.prepare('SELECT COUNT(*) as count FROM runbooks').get() as any).count

  if (count > 0) return

  const now = new Date().toISOString()

  const examples = [
    {
      id: 'rb_example_scale_web',
      name: 'Scale Web Tier',
      description: 'Clone a web server template, configure it, then start it. Use variables to set the hostname and IP.',
      category: 'scaling',
      icon: 'ri-stack-line',
      status: 'published',
      steps: [
        { id: 's1', type: 'note', name: 'Pre-flight check', description: 'Ensure the target node has enough resources', params: { text: 'Verify node capacity before proceeding' }, on_error: 'continue', timeout_seconds: 10 },
        { id: 's2', type: 'clone_template', name: 'Clone web server template', params: { template_id: '', new_name: '{{hostname}}', target_node: '{{target_node}}' }, on_error: 'stop', timeout_seconds: 300 },
        { id: 's3', type: 'apply_config', name: 'Configure resources', params: { cores: '{{cores}}', memory: '{{memory}}' }, on_error: 'stop', timeout_seconds: 60 },
        { id: 's4', type: 'power_action', name: 'Start the VM', params: { action: 'start' }, on_error: 'stop', timeout_seconds: 120 },
        { id: 's5', type: 'wait', name: 'Wait for boot', params: { seconds: 30 }, on_error: 'continue', timeout_seconds: 60 },
        { id: 's6', type: 'snapshot', name: 'Create baseline snapshot', params: { name: 'baseline', description: 'Initial deployment snapshot' }, on_error: 'continue', timeout_seconds: 120 },
      ],
      variables: { hostname: 'web-03', target_node: 'pve1', cores: 2, memory: 2048 },
    },
    {
      id: 'rb_example_nightly_maint',
      name: 'Nightly Maintenance',
      description: 'Snapshot VMs, then reboot them for updates. Designed for scheduled execution.',
      category: 'maintenance',
      icon: 'ri-moon-line',
      status: 'published',
      steps: [
        { id: 's1', type: 'snapshot', name: 'Pre-maintenance snapshot', params: { name: 'pre-maint-{{date}}', description: 'Before nightly maintenance' }, on_error: 'continue', timeout_seconds: 300 },
        { id: 's2', type: 'power_action', name: 'Graceful shutdown', params: { action: 'shutdown' }, on_error: 'stop', timeout_seconds: 120 },
        { id: 's3', type: 'wait', name: 'Wait for shutdown', params: { seconds: 60 }, on_error: 'continue', timeout_seconds: 90 },
        { id: 's4', type: 'power_action', name: 'Start VM', params: { action: 'start' }, on_error: 'stop', timeout_seconds: 120 },
      ],
      variables: { date: new Date().toISOString().split('T')[0] },
    },
    {
      id: 'rb_example_dev_env',
      name: 'Provision Dev Environment',
      description: 'Spin up a complete development environment: app server + database + reverse proxy.',
      category: 'provisioning',
      icon: 'ri-code-box-line',
      status: 'draft',
      steps: [
        { id: 's1', type: 'clone_template', name: 'Clone app server', params: { template_id: '', new_name: '{{project}}-app' }, on_error: 'stop', timeout_seconds: 300 },
        { id: 's2', type: 'clone_template', name: 'Clone database server', params: { template_id: '', new_name: '{{project}}-db' }, on_error: 'stop', timeout_seconds: 300 },
        { id: 's3', type: 'apply_config', name: 'Configure DB resources', params: { cores: 4, memory: 8192 }, on_error: 'stop', timeout_seconds: 60 },
        { id: 's4', type: 'power_action', name: 'Start all VMs', params: { action: 'start' }, on_error: 'continue', timeout_seconds: 120 },
        { id: 's5', type: 'wait', name: 'Wait for services', params: { seconds: 45 }, on_error: 'continue', timeout_seconds: 60 },
        { id: 's6', type: 'http_webhook', name: 'Notify Slack', params: { url: '{{slack_webhook_url}}', method: 'POST', body: '{"text": "Dev env {{project}} is ready!"}' }, condition: { variable: 'slack_webhook_url', operator: 'exists' }, on_error: 'continue', timeout_seconds: 30 },
      ],
      variables: { project: 'my-project', slack_webhook_url: '' },
    },
  ]

  const insert = db.prepare(`
    INSERT OR IGNORE INTO runbooks (id, name, description, category, icon, status, steps, variables, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const rb of examples) {
    insert.run(rb.id, rb.name, rb.description, rb.category, rb.icon, rb.status, JSON.stringify(rb.steps), JSON.stringify(rb.variables), now, now)
  }
}
