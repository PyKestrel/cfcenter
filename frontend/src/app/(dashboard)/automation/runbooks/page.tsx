'use client'

import { useState, useEffect, useCallback } from 'react'

import {
  Box, Typography, Button, Card, CardContent, Chip, IconButton,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Alert, Tabs, Tab, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Collapse, Select, InputLabel, FormControl, LinearProgress,
} from '@mui/material'
import useSWR, { mutate as globalMutate } from 'swr'
import { useTranslations } from 'next-intl'

import { usePageTitle } from '@/contexts/PageTitleContext'

// ============================================
// Types
// ============================================

type StepType = 'clone_template' | 'apply_config' | 'power_action' | 'snapshot' | 'wait' | 'http_webhook' | 'note'
type RunbookStatus = 'draft' | 'published' | 'archived'
type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled'

interface RunbookStep {
  id: string
  type: StepType
  name: string
  description?: string
  params: Record<string, any>
  condition?: { variable: string; operator: 'eq' | 'neq' | 'exists'; value?: string }
  on_error: 'stop' | 'continue' | 'skip_remaining'
  timeout_seconds: number
}

interface Runbook {
  id: string
  name: string
  description: string | null
  category: string
  icon: string | null
  status: RunbookStatus
  steps: string
  variables: string
  created_by: string | null
  created_at: string
  updated_at: string
}

interface StepResult {
  step_id: string
  step_name: string
  status: ExecutionStatus
  started_at: string
  finished_at: string | null
  duration_ms: number | null
  output: any
  error: string | null
}

interface RunbookExecution {
  id: string
  runbook_id: string
  status: ExecutionStatus
  variables: string
  step_results: string
  current_step: number
  started_at: string
  finished_at: string | null
  duration_ms: number | null
  triggered_by: string | null
  error: string | null
}

// ============================================
// Helpers
// ============================================

const fetcher = (url: string) => fetch(url).then(r => r.json())

const STEP_TYPES: { value: StepType; label: string; icon: string }[] = [
  { value: 'clone_template', label: 'Clone Template', icon: 'ri-file-copy-line' },
  { value: 'apply_config', label: 'Apply Config', icon: 'ri-settings-3-line' },
  { value: 'power_action', label: 'Power Action', icon: 'ri-shut-down-line' },
  { value: 'snapshot', label: 'Snapshot', icon: 'ri-camera-line' },
  { value: 'wait', label: 'Wait', icon: 'ri-time-line' },
  { value: 'http_webhook', label: 'HTTP Webhook', icon: 'ri-link' },
  { value: 'note', label: 'Note', icon: 'ri-sticky-note-line' },
]

const STATUS_COLORS: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary'> = {
  draft: 'default',
  published: 'success',
  archived: 'warning',
  pending: 'default',
  running: 'info',
  success: 'success',
  failed: 'error',
  cancelled: 'warning',
}

function parseJSON(raw: string): any {
  try { return JSON.parse(raw) } catch { return raw.startsWith('[') ? [] : {} }
}

function formatDuration(ms: number | null): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`

  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

function generateStepId(): string {
  return `s_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
}

// ============================================
// Main Page
// ============================================

export default function RunbooksPage() {
  const t = useTranslations()
  const { setPageInfo } = usePageTitle()

  useEffect(() => {
    setPageInfo('Runbooks', 'Multi-step automation playbooks', 'ri-play-list-add-line')

    return () => setPageInfo('', '', '')
  }, [setPageInfo])

  const [activeTab, setActiveTab] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editRunbook, setEditRunbook] = useState<Runbook | null>(null)
  const [executeDialogRunbook, setExecuteDialogRunbook] = useState<Runbook | null>(null)
  const [historyRunbook, setHistoryRunbook] = useState<Runbook | null>(null)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Runbook | null>(null)

  const { data: runbooksRes, isLoading } = useSWR('/api/v1/runbooks', fetcher, { refreshInterval: 15000 })
  const runbooks: Runbook[] = Array.isArray(runbooksRes?.data) ? runbooksRes.data : []

  const tabStatuses: (RunbookStatus | 'all')[] = ['all', 'published', 'draft', 'archived']
  const tabStatus = tabStatuses[activeTab] || 'all'
  const filtered = tabStatus === 'all' ? runbooks : runbooks.filter(rb => rb.status === tabStatus)

  const handleDelete = useCallback(async (rb: Runbook) => {
    try {
      const res = await fetch(`/api/v1/runbooks/${rb.id}`, { method: 'DELETE' })

      if (!res.ok) throw new Error((await res.json()).error || 'Delete failed')
      setSuccess(`Runbook "${rb.name}" deleted`)
      setDeleteConfirm(null)
      globalMutate('/api/v1/runbooks')
    } catch (e: any) {
      setError(e.message)
    }
  }, [])

  const handleDuplicate = useCallback(async (rb: Runbook) => {
    try {
      const steps = parseJSON(rb.steps)
      const variables = parseJSON(rb.variables)

      const res = await fetch('/api/v1/runbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${rb.name} (copy)`, description: rb.description, category: rb.category, icon: rb.icon, steps, variables }),
      })

      if (!res.ok) throw new Error((await res.json()).error || 'Duplicate failed')
      setSuccess(`Runbook duplicated`)
      globalMutate('/api/v1/runbooks')
    } catch (e: any) {
      setError(e.message)
    }
  }, [])

  // Stats
  const publishedCount = runbooks.filter(r => r.status === 'published').length
  const draftCount = runbooks.filter(r => r.status === 'draft').length

  return (
    <Box sx={{ p: 3 }}>
      {/* Alerts */}
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>{error}</Alert>
      )}
      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>{success}</Alert>
      )}

      {/* Stats Row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 2, mb: 3 }}>
        {[
          { label: 'Total Runbooks', value: runbooks.length, icon: 'ri-play-list-add-line', color: '#7c4dff' },
          { label: 'Published', value: publishedCount, icon: 'ri-check-double-line', color: '#00c853' },
          { label: 'Drafts', value: draftCount, icon: 'ri-draft-line', color: '#ff6d00' },
          { label: 'Categories', value: new Set(runbooks.map(r => r.category)).size, icon: 'ri-folder-line', color: '#2979ff' },
        ].map((stat, i) => (
          <Card variant="outlined" key={i}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
              <Box sx={{ width: 44, height: 44, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${stat.color}18` }}>
                <i className={stat.icon} style={{ fontSize: 22, color: stat.color }} />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={700}>{stat.value}</Typography>
                <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          {tabStatuses.map(s => (
            <Tab key={s} label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                <Chip label={s === 'all' ? runbooks.length : runbooks.filter(r => r.status === s).length} size="small" sx={{ height: 20, fontSize: 11 }} />
              </Box>
            } />
          ))}
        </Tabs>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<i className="ri-add-line" />} onClick={() => { setEditRunbook(null); setEditorOpen(true) }}>
          New Runbook
        </Button>
      </Box>

      {/* Runbooks Table */}
      {isLoading ? (
        <LinearProgress sx={{ mb: 2 }} />
      ) : filtered.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <i className="ri-play-list-add-line" style={{ fontSize: 48, opacity: 0.3 }} />
          <Typography color="text.secondary" sx={{ mt: 1 }}>No runbooks found</Typography>
          <Button sx={{ mt: 2 }} variant="outlined" onClick={() => { setEditRunbook(null); setEditorOpen(true) }}>Create your first runbook</Button>
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={40} />
                <TableCell>Name</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Steps</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((rb) => {
                const steps: RunbookStep[] = parseJSON(rb.steps)
                const isExpanded = expandedRow === rb.id

                return (
                  <RunbookRow
                    key={rb.id}
                    runbook={rb}
                    steps={steps}
                    isExpanded={isExpanded}
                    onToggleExpand={() => setExpandedRow(isExpanded ? null : rb.id)}
                    onEdit={() => { setEditRunbook(rb); setEditorOpen(true) }}
                    onDuplicate={() => handleDuplicate(rb)}
                    onDelete={() => setDeleteConfirm(rb)}
                    onExecute={() => setExecuteDialogRunbook(rb)}
                    onViewHistory={() => setHistoryRunbook(rb)}
                  />
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Runbook Editor Dialog */}
      <RunbookEditorDialog
        open={editorOpen}
        runbook={editRunbook}
        onClose={() => { setEditorOpen(false); setEditRunbook(null) }}
        onSuccess={(msg) => { setSuccess(msg); globalMutate('/api/v1/runbooks') }}
        onError={setError}
      />

      {/* Execute Dialog */}
      <ExecuteDialog
        runbook={executeDialogRunbook}
        onClose={() => setExecuteDialogRunbook(null)}
        onSuccess={(msg) => { setSuccess(msg); globalMutate('/api/v1/runbooks') }}
        onError={setError}
      />

      {/* Execution History Dialog */}
      <HistoryDialog runbook={historyRunbook} onClose={() => setHistoryRunbook(null)} />

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>Delete Runbook</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>? All execution history will also be removed.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

// ============================================
// Runbook Table Row
// ============================================

function RunbookRow({ runbook, steps, isExpanded, onToggleExpand, onEdit, onDuplicate, onDelete, onExecute, onViewHistory }: {
  runbook: Runbook
  steps: RunbookStep[]
  isExpanded: boolean
  onToggleExpand: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onExecute: () => void
  onViewHistory: () => void
}) {
  return (
    <>
      <TableRow hover sx={{ '& > td': { borderBottom: isExpanded ? 'none' : undefined } }}>
        <TableCell>
          <IconButton size="small" onClick={onToggleExpand}>
            <i className={isExpanded ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'} style={{ fontSize: 18 }} />
          </IconButton>
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <i className={runbook.icon || 'ri-play-list-add-line'} style={{ fontSize: 18, opacity: 0.6 }} />
            <Box>
              <Typography variant="body2" fontWeight={600}>{runbook.name}</Typography>
              {runbook.description && <Typography variant="caption" color="text.secondary">{runbook.description}</Typography>}
            </Box>
          </Box>
        </TableCell>
        <TableCell>
          <Chip label={runbook.category} size="small" variant="outlined" sx={{ height: 22, fontSize: 11 }} />
        </TableCell>
        <TableCell>
          <Chip label={runbook.status} size="small" color={STATUS_COLORS[runbook.status] || 'default'} sx={{ height: 22, fontSize: 11, fontWeight: 600 }} />
        </TableCell>
        <TableCell align="center">{steps.length}</TableCell>
        <TableCell>
          <Typography variant="caption" color="text.secondary">
            {new Date(runbook.updated_at).toLocaleDateString()}
          </Typography>
        </TableCell>
        <TableCell align="right">
          <Tooltip title="Execute"><IconButton size="small" color="primary" onClick={onExecute} disabled={runbook.status !== 'published'}><i className="ri-play-line" style={{ fontSize: 16 }} /></IconButton></Tooltip>
          <Tooltip title="History"><IconButton size="small" onClick={onViewHistory}><i className="ri-history-line" style={{ fontSize: 16 }} /></IconButton></Tooltip>
          <Tooltip title="Edit"><IconButton size="small" onClick={onEdit}><i className="ri-edit-line" style={{ fontSize: 16 }} /></IconButton></Tooltip>
          <Tooltip title="Duplicate"><IconButton size="small" onClick={onDuplicate}><i className="ri-file-copy-line" style={{ fontSize: 16 }} /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={onDelete}><i className="ri-delete-bin-line" style={{ fontSize: 16 }} /></IconButton></Tooltip>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={7} sx={{ py: 0, px: 0 }}>
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Steps</Typography>
              {steps.map((step, i) => {
                const stepType = STEP_TYPES.find(st => st.value === step.type)

                return (
                  <Box key={step.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.75 }}>
                    <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                      {i + 1}
                    </Box>
                    <i className={stepType?.icon || 'ri-question-line'} style={{ fontSize: 16, opacity: 0.6 }} />
                    <Typography variant="body2" fontWeight={500}>{step.name}</Typography>
                    <Chip label={step.type.replace('_', ' ')} size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
                    {step.on_error !== 'stop' && <Chip label={`on error: ${step.on_error}`} size="small" sx={{ height: 18, fontSize: 10 }} color="warning" variant="outlined" />}
                  </Box>
                )
              })}
              {steps.length === 0 && <Typography variant="body2" color="text.secondary">No steps defined</Typography>}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

// ============================================
// Runbook Editor Dialog
// ============================================

function RunbookEditorDialog({ open, runbook, onClose, onSuccess, onError }: {
  open: boolean
  runbook: Runbook | null
  onClose: () => void
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('general')
  const [icon, setIcon] = useState('ri-play-list-add-line')
  const [status, setStatus] = useState<RunbookStatus>('draft')
  const [steps, setSteps] = useState<RunbookStep[]>([])
  const [variables, setVariables] = useState<Record<string, any>>({})
  const [varsText, setVarsText] = useState('{}')
  const [loading, setLoading] = useState(false)
  const [activeSection, setActiveSection] = useState(0)

  useEffect(() => {
    if (open && runbook) {
      setName(runbook.name)
      setDescription(runbook.description || '')
      setCategory(runbook.category)
      setIcon(runbook.icon || 'ri-play-list-add-line')
      setStatus(runbook.status)
      setSteps(parseJSON(runbook.steps))
      const vars = parseJSON(runbook.variables)

      setVariables(vars)
      setVarsText(JSON.stringify(vars, null, 2))
    } else if (open) {
      setName('')
      setDescription('')
      setCategory('general')
      setIcon('ri-play-list-add-line')
      setStatus('draft')
      setSteps([])
      setVariables({})
      setVarsText('{}')
    }
    setActiveSection(0)
  }, [open, runbook])

  const addStep = () => {
    setSteps(prev => [...prev, {
      id: generateStepId(),
      type: 'note',
      name: `Step ${prev.length + 1}`,
      params: {},
      on_error: 'stop',
      timeout_seconds: 300,
    }])
  }

  const updateStep = (index: number, updates: Partial<RunbookStep>) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s))
  }

  const removeStep = (index: number) => {
    setSteps(prev => prev.filter((_, i) => i !== index))
  }

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1

    if (newIdx < 0 || newIdx >= steps.length) return

    setSteps(prev => {
      const copy = [...prev]
      const tmp = copy[index]

      copy[index] = copy[newIdx]
      copy[newIdx] = tmp

      return copy
    })
  }

  const handleSave = async () => {
    try {
      setLoading(true)

      let parsedVars = variables

      try { parsedVars = JSON.parse(varsText) } catch { throw new Error('Variables must be valid JSON') }

      const body = { name, description, category, icon, status, steps, variables: parsedVars }

      let res: Response

      if (runbook) {
        res = await fetch(`/api/v1/runbooks/${runbook.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch('/api/v1/runbooks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }

      if (!res.ok) throw new Error((await res.json()).error || 'Save failed')
      onSuccess(runbook ? `Runbook "${name}" updated` : `Runbook "${name}" created`)
      onClose()
    } catch (e: any) {
      onError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{runbook ? 'Edit Runbook' : 'New Runbook'}</DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <Tabs value={activeSection} onChange={(_, v) => setActiveSection(v)} sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Details" />
          <Tab label={`Steps (${steps.length})`} />
          <Tab label="Variables" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {/* Details section */}
          {activeSection === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField label="Name" value={name} onChange={e => setName(e.target.value)} fullWidth size="small" required />
              <TextField label="Description" value={description} onChange={e => setDescription(e.target.value)} fullWidth size="small" multiline rows={2} />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  select label="Category" value={category} onChange={e => setCategory(e.target.value)} size="small" sx={{ minWidth: 160 }}
                >
                  <MenuItem value="general">General</MenuItem>
                  <MenuItem value="scaling">Scaling</MenuItem>
                  <MenuItem value="maintenance">Maintenance</MenuItem>
                  <MenuItem value="provisioning">Provisioning</MenuItem>
                  <MenuItem value="disaster-recovery">Disaster Recovery</MenuItem>
                  <MenuItem value="monitoring">Monitoring</MenuItem>
                </TextField>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel>Status</InputLabel>
                  <Select label="Status" value={status} onChange={e => setStatus(e.target.value as RunbookStatus)}>
                    <MenuItem value="draft">Draft</MenuItem>
                    <MenuItem value="published">Published</MenuItem>
                    <MenuItem value="archived">Archived</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            </Box>
          )}

          {/* Steps section */}
          {activeSection === 1 && (
            <Box>
              {steps.map((step, i) => (
                <Card key={step.id} variant="outlined" sx={{ mb: 1.5, p: 0 }}>
                  <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: 'primary.main', color: 'primary.contrastText', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                        {i + 1}
                      </Box>
                      <TextField size="small" value={step.name} onChange={e => updateStep(i, { name: e.target.value })} placeholder="Step name" sx={{ flex: 1 }} variant="standard" />
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton size="small" onClick={() => moveStep(i, 'up')} disabled={i === 0}><i className="ri-arrow-up-s-line" style={{ fontSize: 16 }} /></IconButton>
                        <IconButton size="small" onClick={() => moveStep(i, 'down')} disabled={i === steps.length - 1}><i className="ri-arrow-down-s-line" style={{ fontSize: 16 }} /></IconButton>
                        <IconButton size="small" color="error" onClick={() => removeStep(i)}><i className="ri-close-line" style={{ fontSize: 16 }} /></IconButton>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                      <TextField select size="small" label="Type" value={step.type} onChange={e => updateStep(i, { type: e.target.value as StepType, params: {} })} sx={{ minWidth: 160 }}>
                        {STEP_TYPES.map(st => (
                          <MenuItem key={st.value} value={st.value}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <i className={st.icon} style={{ fontSize: 14 }} /> {st.label}
                            </Box>
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField select size="small" label="On Error" value={step.on_error} onChange={e => updateStep(i, { on_error: e.target.value as any })} sx={{ minWidth: 140 }}>
                        <MenuItem value="stop">Stop</MenuItem>
                        <MenuItem value="continue">Continue</MenuItem>
                        <MenuItem value="skip_remaining">Skip Remaining</MenuItem>
                      </TextField>
                      <TextField size="small" label="Timeout (s)" type="number" value={step.timeout_seconds} onChange={e => updateStep(i, { timeout_seconds: parseInt(e.target.value) || 300 })} sx={{ width: 110 }} />
                    </Box>

                    {/* Type-specific params */}
                    <StepParamsEditor step={step} onUpdate={(params) => updateStep(i, { params })} />
                  </CardContent>
                </Card>
              ))}
              <Button variant="outlined" startIcon={<i className="ri-add-line" />} onClick={addStep} fullWidth sx={{ mt: 1 }}>
                Add Step
              </Button>
            </Box>
          )}

          {/* Variables section */}
          {activeSection === 2 && (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Define default variables as JSON. Use {"{{variable_name}}"} in step params to reference them.
              </Typography>
              <TextField
                multiline
                rows={10}
                fullWidth
                value={varsText}
                onChange={e => setVarsText(e.target.value)}
                sx={{ fontFamily: 'monospace', fontSize: 12 }}
              />
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading || !name.trim()}>
          {loading ? 'Saving...' : runbook ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ============================================
// Step Params Editor
// ============================================

function StepParamsEditor({ step, onUpdate }: { step: RunbookStep; onUpdate: (params: Record<string, any>) => void }) {
  const p = step.params

  const set = (key: string, value: any) => onUpdate({ ...p, [key]: value })

  switch (step.type) {
    case 'clone_template':
      return (
        <Box sx={{ display: 'flex', gap: 1.5, mt: 1, flexWrap: 'wrap' }}>
          <TextField size="small" label="Template ID" value={p.template_id || ''} onChange={e => set('template_id', e.target.value)} sx={{ flex: 1, minWidth: 150 }} placeholder="tpl_builtin_..." />
          <TextField size="small" label="New VM Name" value={p.new_name || ''} onChange={e => set('new_name', e.target.value)} sx={{ flex: 1, minWidth: 150 }} placeholder="{{hostname}}" />
          <TextField size="small" label="Target Node" value={p.target_node || ''} onChange={e => set('target_node', e.target.value)} sx={{ width: 140 }} placeholder="{{target_node}}" />
        </Box>
      )
    case 'apply_config':
      return (
        <Box sx={{ display: 'flex', gap: 1.5, mt: 1, flexWrap: 'wrap' }}>
          <TextField size="small" label="Cores" type="number" value={p.cores || ''} onChange={e => set('cores', e.target.value)} sx={{ width: 90 }} />
          <TextField size="small" label="Memory (MB)" type="number" value={p.memory || ''} onChange={e => set('memory', e.target.value)} sx={{ width: 120 }} />
          <TextField size="small" label="Extra (JSON)" value={p.extra || ''} onChange={e => set('extra', e.target.value)} sx={{ flex: 1, minWidth: 150 }} placeholder='{"tags":"web"}' />
        </Box>
      )
    case 'power_action':
      return (
        <Box sx={{ mt: 1 }}>
          <TextField select size="small" label="Action" value={p.action || ''} onChange={e => set('action', e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="start">Start</MenuItem>
            <MenuItem value="shutdown">Shutdown</MenuItem>
            <MenuItem value="stop">Stop (Force)</MenuItem>
            <MenuItem value="reboot">Reboot</MenuItem>
            <MenuItem value="suspend">Suspend</MenuItem>
            <MenuItem value="resume">Resume</MenuItem>
          </TextField>
        </Box>
      )
    case 'snapshot':
      return (
        <Box sx={{ display: 'flex', gap: 1.5, mt: 1, flexWrap: 'wrap' }}>
          <TextField size="small" label="Snapshot Name" value={p.name || ''} onChange={e => set('name', e.target.value)} sx={{ flex: 1, minWidth: 200 }} placeholder="pre-deploy-{{date}}" />
          <TextField size="small" label="Description" value={p.description || ''} onChange={e => set('description', e.target.value)} sx={{ flex: 1, minWidth: 200 }} />
        </Box>
      )
    case 'wait':
      return (
        <Box sx={{ mt: 1 }}>
          <TextField size="small" label="Seconds" type="number" value={p.seconds || ''} onChange={e => set('seconds', parseInt(e.target.value) || 5)} sx={{ width: 120 }} />
        </Box>
      )
    case 'http_webhook':
      return (
        <Box sx={{ display: 'flex', gap: 1.5, mt: 1, flexWrap: 'wrap' }}>
          <TextField select size="small" label="Method" value={p.method || 'POST'} onChange={e => set('method', e.target.value)} sx={{ width: 100 }}>
            <MenuItem value="GET">GET</MenuItem>
            <MenuItem value="POST">POST</MenuItem>
            <MenuItem value="PUT">PUT</MenuItem>
          </TextField>
          <TextField size="small" label="URL" value={p.url || ''} onChange={e => set('url', e.target.value)} sx={{ flex: 1, minWidth: 200 }} placeholder="https://hooks.slack.com/..." />
          <TextField size="small" label="Body (JSON)" value={p.body || ''} onChange={e => set('body', e.target.value)} sx={{ flex: 1, minWidth: 200 }} placeholder='{"text":"deploy done"}' />
        </Box>
      )
    case 'note':
      return (
        <Box sx={{ mt: 1 }}>
          <TextField size="small" label="Note text" value={p.text || ''} onChange={e => set('text', e.target.value)} fullWidth multiline rows={2} />
        </Box>
      )
    default:
      return null
  }
}

// ============================================
// Execute Dialog
// ============================================

function ExecuteDialog({ runbook, onClose, onSuccess, onError }: {
  runbook: Runbook | null
  onClose: () => void
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}) {
  const [varsText, setVarsText] = useState('{}')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (runbook) {
      setVarsText(JSON.stringify(parseJSON(runbook.variables), null, 2))
    }
  }, [runbook])

  const handleExecute = async () => {
    if (!runbook) return

    try {
      setLoading(true)
      let vars: Record<string, any>

      try { vars = JSON.parse(varsText) } catch { throw new Error('Variables must be valid JSON') }

      const res = await fetch(`/api/v1/runbooks/${runbook.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variables: vars }),
      })

      if (!res.ok) throw new Error((await res.json()).error || 'Execution failed')

      const data = await res.json()

      onSuccess(`Runbook "${runbook.name}" executed — Status: ${data.data?.status || 'unknown'}`)
      onClose()
    } catch (e: any) {
      onError(e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!runbook) return null

  const steps: RunbookStep[] = parseJSON(runbook.steps)

  return (
    <Dialog open={!!runbook} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <i className="ri-play-line" style={{ fontSize: 20 }} />
        Execute: {runbook.name}
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          This will run {steps.length} step{steps.length !== 1 ? 's' : ''} sequentially. Edit the variables below to override defaults.
        </Typography>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Variables</Typography>
        <TextField
          multiline
          rows={8}
          fullWidth
          value={varsText}
          onChange={e => setVarsText(e.target.value)}
          sx={{ fontFamily: 'monospace', fontSize: 12 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="primary" onClick={handleExecute} disabled={loading}>
          {loading ? 'Running...' : 'Execute'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ============================================
// Execution History Dialog
// ============================================

function HistoryDialog({ runbook, onClose }: { runbook: Runbook | null; onClose: () => void }) {
  const { data: historyRes } = useSWR(
    runbook ? `/api/v1/runbooks/${runbook.id}/execute?limit=20` : null,
    fetcher
  )

  const executions: RunbookExecution[] = historyRes?.data || []

  const [expandedExec, setExpandedExec] = useState<string | null>(null)

  if (!runbook) return null

  return (
    <Dialog open={!!runbook} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <i className="ri-history-line" style={{ fontSize: 20 }} />
        Execution History: {runbook.name}
      </DialogTitle>
      <DialogContent dividers>
        {executions.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No execution history</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={40} />
                <TableCell>Started</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Duration</TableCell>
                <TableCell>Steps</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {executions.map(exec => {
                const stepResults: StepResult[] = parseJSON(exec.step_results)
                const isExp = expandedExec === exec.id

                return (
                  <>
                    <TableRow key={exec.id} hover sx={{ '& > td': { borderBottom: isExp ? 'none' : undefined } }}>
                      <TableCell>
                        <IconButton size="small" onClick={() => setExpandedExec(isExp ? null : exec.id)}>
                          <i className={isExp ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'} style={{ fontSize: 16 }} />
                        </IconButton>
                      </TableCell>
                      <TableCell><Typography variant="caption">{new Date(exec.started_at).toLocaleString()}</Typography></TableCell>
                      <TableCell><Chip label={exec.status} size="small" color={STATUS_COLORS[exec.status] || 'default'} sx={{ height: 20, fontSize: 10, fontWeight: 600 }} /></TableCell>
                      <TableCell><Typography variant="caption">{formatDuration(exec.duration_ms)}</Typography></TableCell>
                      <TableCell><Typography variant="caption">{stepResults.filter(s => s.status === 'success').length}/{stepResults.length}</Typography></TableCell>
                    </TableRow>
                    <TableRow key={`${exec.id}-detail`}>
                      <TableCell colSpan={5} sx={{ py: 0, px: 0 }}>
                        <Collapse in={isExp} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
                            {stepResults.map((sr, i) => (
                              <Box key={sr.step_id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
                                <Box sx={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, bgcolor: sr.status === 'success' ? '#00c85320' : sr.status === 'failed' ? '#ff174420' : '#9e9e9e20', color: sr.status === 'success' ? '#00c853' : sr.status === 'failed' ? '#ff1744' : '#9e9e9e' }}>
                                  {sr.status === 'success' ? '✓' : sr.status === 'failed' ? '✗' : i + 1}
                                </Box>
                                <Typography variant="body2" sx={{ flex: 1 }}>{sr.step_name}</Typography>
                                <Typography variant="caption" color="text.secondary">{formatDuration(sr.duration_ms)}</Typography>
                                {sr.error && <Typography variant="caption" color="error">{sr.error}</Typography>}
                              </Box>
                            ))}
                            {exec.error && (
                              <Alert severity="error" sx={{ mt: 1 }}>{exec.error}</Alert>
                            )}
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </>
                )
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
