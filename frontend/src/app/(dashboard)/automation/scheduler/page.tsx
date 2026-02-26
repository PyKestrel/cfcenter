'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'

import {
  Box, Typography, Button, Card, CardContent, Chip, IconButton,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Switch, FormControlLabel, Alert,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Tabs, Tab, Collapse, LinearProgress, Select, InputLabel,
  FormControl, Checkbox, ListItemText, OutlinedInput,
} from '@mui/material'
import useSWR, { mutate as globalMutate } from 'swr'
import { useTranslations } from 'next-intl'

import { usePageTitle } from '@/contexts/PageTitleContext'

// ============================================
// Types
// ============================================

interface ScheduledJob {
  id: string
  name: string
  description: string | null
  type: 'snapshot' | 'power_action' | 'backup' | 'custom'
  cron_expression: string
  timezone: string
  enabled: boolean
  params: string
  max_history: number
  last_run_at: string | null
  next_run_at: string | null
  last_status: string | null
  run_count: number
  fail_count: number
  created_by: string | null
  created_at: string
  updated_at: string
}

interface JobRun {
  id: string
  job_id: string
  status: string
  started_at: string
  finished_at: string | null
  duration_ms: number | null
  result: string | null
  error: string | null
}

interface VmOption {
  key: string
  label: string
  connection_id: string
  type: string
  node: string
  vmid: string
  name: string
  status: string
}

// ============================================
// Fetcher
// ============================================

const fetcher = (url: string) => fetch(url).then(r => r.json())

// ============================================
// Cron presets
// ============================================

const CRON_PRESETS = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Daily at 2 AM', value: '0 2 * * *' },
  { label: 'Daily at 6 AM', value: '0 6 * * *' },
  { label: 'Weekdays at 8 AM', value: '0 8 * * 1-5' },
  { label: 'Weekly (Sunday midnight)', value: '0 0 * * 0' },
  { label: 'Monthly (1st at midnight)', value: '0 0 1 * *' },
  { label: 'Custom', value: 'custom' },
]

const POWER_ACTIONS = [
  { label: 'Start', value: 'start' },
  { label: 'Shutdown (graceful)', value: 'shutdown' },
  { label: 'Stop (force)', value: 'stop' },
  { label: 'Reboot', value: 'reboot' },
  { label: 'Suspend', value: 'suspend' },
  { label: 'Resume', value: 'resume' },
]

// ============================================
// Main Page Component
// ============================================

export default function SchedulerPage() {
  const t = useTranslations()
  const { setPageInfo } = usePageTitle()

  useEffect(() => {
    setPageInfo('Scheduler', 'Automated snapshots & power actions', 'ri-calendar-schedule-line')

    return () => setPageInfo('', '', '')
  }, [setPageInfo])

  const [activeTab, setActiveTab] = useState(0)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createType, setCreateType] = useState<'snapshot' | 'power_action'>('snapshot')
  const [expandedJob, setExpandedJob] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Fetch jobs
  const { data: jobsRes, isLoading } = useSWR('/api/v1/scheduler/jobs', fetcher, {
    refreshInterval: 15000,
  })

  const jobs: ScheduledJob[] = jobsRes?.data || []

  const snapshotJobs = jobs.filter(j => j.type === 'snapshot')
  const powerJobs = jobs.filter(j => j.type === 'power_action')

  const handleToggleJob = useCallback(async (jobId: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/v1/scheduler/jobs/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })

      if (!res.ok) throw new Error('Failed to update job')
      globalMutate('/api/v1/scheduler/jobs')
    } catch (e: any) {
      setError(e.message)
    }
  }, [])

  const handleDeleteJob = useCallback(async (jobId: string) => {
    if (!confirm('Delete this scheduled job?')) return

    try {
      const res = await fetch(`/api/v1/scheduler/jobs/${jobId}`, { method: 'DELETE' })

      if (!res.ok) throw new Error('Failed to delete job')
      setSuccess('Job deleted')
      globalMutate('/api/v1/scheduler/jobs')
    } catch (e: any) {
      setError(e.message)
    }
  }, [])

  const handleTriggerJob = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/v1/scheduler/jobs/${jobId}/trigger`, { method: 'POST' })

      if (!res.ok) throw new Error('Failed to trigger job')
      setSuccess('Job triggered')
      globalMutate('/api/v1/scheduler/jobs')
    } catch (e: any) {
      setError(e.message)
    }
  }, [])

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: 'auto' }}>
      {error && <Alert severity='error' sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity='success' sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant='h5' fontWeight={700}>
            <i className='ri-calendar-schedule-line' style={{ marginRight: 8 }} />
            Scheduler
          </Typography>
          <Typography variant='body2' sx={{ opacity: 0.6, mt: 0.5 }}>
            Automate snapshots, power actions, and more with cron-based scheduling
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant='outlined'
            startIcon={<i className='ri-camera-line' />}
            onClick={() => { setCreateType('snapshot'); setCreateDialogOpen(true) }}
          >
            New Snapshot Job
          </Button>
          <Button
            variant='contained'
            startIcon={<i className='ri-flashlight-line' />}
            onClick={() => { setCreateType('power_action'); setCreateDialogOpen(true) }}
          >
            New Power Action
          </Button>
        </Box>
      </Box>

      {/* Stats cards */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2, mb: 3 }}>
        <StatCard icon='ri-calendar-check-line' label='Active Jobs' value={jobs.filter(j => j.enabled).length} color='#3b82f6' />
        <StatCard icon='ri-camera-line' label='Snapshot Jobs' value={snapshotJobs.length} color='#8b5cf6' />
        <StatCard icon='ri-flashlight-line' label='Power Jobs' value={powerJobs.length} color='#f59e0b' />
        <StatCard icon='ri-error-warning-line' label='Failed (last)' value={jobs.filter(j => j.last_status === 'failed').length} color='#ef4444' />
      </Box>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
        <Tab label={`All Jobs (${jobs.length})`} />
        <Tab label={`Snapshots (${snapshotJobs.length})`} />
        <Tab label={`Power Actions (${powerJobs.length})`} />
      </Tabs>

      {isLoading ? (
        <LinearProgress sx={{ mb: 2 }} />
      ) : (
        <JobsTable
          jobs={activeTab === 0 ? jobs : activeTab === 1 ? snapshotJobs : powerJobs}
          expandedJob={expandedJob}
          onExpand={id => setExpandedJob(expandedJob === id ? null : id)}
          onToggle={handleToggleJob}
          onDelete={handleDeleteJob}
          onTrigger={handleTriggerJob}
        />
      )}

      {/* Create dialog */}
      <CreateJobDialog
        open={createDialogOpen}
        type={createType}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={() => {
          setCreateDialogOpen(false)
          setSuccess('Job created')
          globalMutate('/api/v1/scheduler/jobs')
        }}
        onError={setError}
      />
    </Box>
  )
}

// ============================================
// Stat Card
// ============================================

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <Card variant='outlined'>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{
          width: 44, height: 44, borderRadius: 1.5,
          background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i className={icon} style={{ fontSize: 22, color }} />
        </Box>
        <Box>
          <Typography variant='h5' fontWeight={700}>{value}</Typography>
          <Typography variant='caption' sx={{ opacity: 0.6 }}>{label}</Typography>
        </Box>
      </CardContent>
    </Card>
  )
}

// ============================================
// Jobs Table
// ============================================

function JobsTable({
  jobs, expandedJob, onExpand, onToggle, onDelete, onTrigger
}: {
  jobs: ScheduledJob[]
  expandedJob: string | null
  onExpand: (id: string) => void
  onToggle: (id: string, enabled: boolean) => void
  onDelete: (id: string) => void
  onTrigger: (id: string) => void
}) {
  if (jobs.length === 0) {
    return (
      <Card variant='outlined'>
        <CardContent sx={{ textAlign: 'center', py: 6 }}>
          <i className='ri-calendar-line' style={{ fontSize: 48, opacity: 0.3 }} />
          <Typography variant='h6' sx={{ mt: 2, opacity: 0.5 }}>No scheduled jobs</Typography>
          <Typography variant='body2' sx={{ opacity: 0.4 }}>Create a snapshot or power action schedule to get started</Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <TableContainer component={Paper} variant='outlined'>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell width={40} />
            <TableCell>Name</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Schedule</TableCell>
            <TableCell>Last Run</TableCell>
            <TableCell>Next Run</TableCell>
            <TableCell>Stats</TableCell>
            <TableCell align='center'>Status</TableCell>
            <TableCell align='right'>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {jobs.map(job => (
            <JobRow
              key={job.id}
              job={job}
              expanded={expandedJob === job.id}
              onExpand={() => onExpand(job.id)}
              onToggle={(enabled) => onToggle(job.id, enabled)}
              onDelete={() => onDelete(job.id)}
              onTrigger={() => onTrigger(job.id)}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

// ============================================
// Job Row with expandable runs
// ============================================

function JobRow({
  job, expanded, onExpand, onToggle, onDelete, onTrigger
}: {
  job: ScheduledJob
  expanded: boolean
  onExpand: () => void
  onToggle: (enabled: boolean) => void
  onDelete: () => void
  onTrigger: () => void
}) {
  const statusColor = job.last_status === 'success' ? 'success'
    : job.last_status === 'failed' ? 'error'
    : job.last_status === 'running' ? 'info'
    : 'default'

  const typeIcon = job.type === 'snapshot' ? 'ri-camera-line' : 'ri-flashlight-line'
  const typeColor = job.type === 'snapshot' ? '#8b5cf6' : '#f59e0b'

  let params: any = {}

  try { params = JSON.parse(job.params) } catch {}

  const targetCount = params.targets?.length || 0

  return (
    <>
      <TableRow
        hover
        sx={{ cursor: 'pointer', '& > *': { borderBottom: expanded ? 'none' : undefined } }}
        onClick={onExpand}
      >
        <TableCell>
          <i className={expanded ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'} style={{ opacity: 0.5 }} />
        </TableCell>
        <TableCell>
          <Typography variant='body2' fontWeight={600}>{job.name}</Typography>
          {job.description && (
            <Typography variant='caption' sx={{ opacity: 0.5, display: 'block' }}>{job.description}</Typography>
          )}
        </TableCell>
        <TableCell>
          <Chip
            size='small'
            icon={<i className={typeIcon} style={{ fontSize: 14 }} />}
            label={job.type === 'snapshot' ? 'Snapshot' : 'Power Action'}
            sx={{ bgcolor: `${typeColor}15`, color: typeColor, fontWeight: 600, fontSize: '0.7rem' }}
          />
          {targetCount > 0 && (
            <Typography variant='caption' sx={{ ml: 1, opacity: 0.5 }}>
              {targetCount} VM{targetCount > 1 ? 's' : ''}
            </Typography>
          )}
        </TableCell>
        <TableCell>
          <Typography variant='body2' fontFamily='JetBrains Mono, monospace' fontSize='0.75rem'>
            {job.cron_expression}
          </Typography>
          <Typography variant='caption' sx={{ opacity: 0.4 }}>{job.timezone}</Typography>
        </TableCell>
        <TableCell>
          {job.last_run_at ? (
            <Typography variant='caption'>{new Date(job.last_run_at).toLocaleString()}</Typography>
          ) : (
            <Typography variant='caption' sx={{ opacity: 0.4 }}>Never</Typography>
          )}
        </TableCell>
        <TableCell>
          {job.next_run_at ? (
            <Typography variant='caption'>{new Date(job.next_run_at).toLocaleString()}</Typography>
          ) : (
            <Typography variant='caption' sx={{ opacity: 0.4 }}>—</Typography>
          )}
        </TableCell>
        <TableCell>
          <Typography variant='caption'>
            {job.run_count} runs{job.fail_count > 0 && <span style={{ color: '#ef4444' }}> ({job.fail_count} failed)</span>}
          </Typography>
        </TableCell>
        <TableCell align='center'>
          {job.last_status && <Chip size='small' label={job.last_status} color={statusColor as any} sx={{ fontSize: '0.65rem' }} />}
          {!job.enabled && <Chip size='small' label='Paused' sx={{ ml: 0.5, fontSize: '0.65rem' }} />}
        </TableCell>
        <TableCell align='right' onClick={e => e.stopPropagation()}>
          <Tooltip title={job.enabled ? 'Pause' : 'Resume'}>
            <Switch size='small' checked={job.enabled} onChange={(_, v) => onToggle(v)} />
          </Tooltip>
          <Tooltip title='Run now'>
            <IconButton size='small' onClick={onTrigger}>
              <i className='ri-play-line' style={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title='Delete'>
            <IconButton size='small' color='error' onClick={onDelete}>
              <i className='ri-delete-bin-line' style={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={9} sx={{ p: 0 }}>
          <Collapse in={expanded} timeout='auto' unmountOnExit>
            <JobRunsPanel jobId={job.id} params={params} type={job.type} />
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  )
}

// ============================================
// Job Runs Panel (expanded view)
// ============================================

function JobRunsPanel({ jobId, params, type }: { jobId: string; params: any; type: string }) {
  const { data: runsRes } = useSWR(`/api/v1/scheduler/jobs/${jobId}/runs?limit=10`, fetcher)
  const runs: JobRun[] = runsRes?.data || []

  return (
    <Box sx={{ p: 2, bgcolor: 'action.hover' }}>
      {/* Params summary */}
      <Box sx={{ mb: 2 }}>
        <Typography variant='subtitle2' fontWeight={600} sx={{ mb: 1 }}>Configuration</Typography>
        {type === 'snapshot' && (
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip size='small' label={`Prefix: ${params.name_prefix || 'auto'}`} variant='outlined' />
            <Chip size='small' label={`RAM: ${params.include_ram ? 'Yes' : 'No'}`} variant='outlined' />
            {params.retention?.keep_last > 0 && <Chip size='small' label={`Keep last ${params.retention.keep_last}`} variant='outlined' />}
            {params.retention?.keep_days > 0 && <Chip size='small' label={`Keep ${params.retention.keep_days} days`} variant='outlined' />}
          </Box>
        )}
        {type === 'power_action' && (
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip size='small' label={`Action: ${params.action}`} variant='outlined' />
            <Chip size='small' label={`Force: ${params.force ? 'Yes' : 'No'}`} variant='outlined' />
          </Box>
        )}
        {params.targets?.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant='caption' sx={{ opacity: 0.6 }}>
              Targets: {params.targets.map((t: any) => t.vm_name || `VMID ${t.vmid}`).join(', ')}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Recent runs */}
      <Typography variant='subtitle2' fontWeight={600} sx={{ mb: 1 }}>Recent Runs</Typography>
      {runs.length === 0 ? (
        <Typography variant='caption' sx={{ opacity: 0.5 }}>No runs yet</Typography>
      ) : (
        <Table size='small'>
          <TableHead>
            <TableRow>
              <TableCell>Started</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Result</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {runs.map(run => {
              let resultSummary = ''

              try {
                const r = JSON.parse(run.result || '{}')

                resultSummary = r.message || ''
              } catch {
                resultSummary = run.error || ''
              }

              return (
                <TableRow key={run.id}>
                  <TableCell>
                    <Typography variant='caption'>{new Date(run.started_at).toLocaleString()}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size='small'
                      label={run.status}
                      color={run.status === 'success' ? 'success' : run.status === 'failed' ? 'error' : run.status === 'running' ? 'info' : 'default'}
                      sx={{ fontSize: '0.65rem' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant='caption'>
                      {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant='caption' sx={{ maxWidth: 300, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {resultSummary}
                    </Typography>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </Box>
  )
}

// ============================================
// Create Job Dialog
// ============================================

function CreateJobDialog({
  open, type, onClose, onSuccess, onError
}: {
  open: boolean
  type: 'snapshot' | 'power_action'
  onClose: () => void
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [cronPreset, setCronPreset] = useState('0 2 * * *')
  const [customCron, setCustomCron] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [loading, setLoading] = useState(false)

  // Snapshot params
  const [namePrefix, setNamePrefix] = useState('auto')
  const [includeRam, setIncludeRam] = useState(false)
  const [keepLast, setKeepLast] = useState(5)
  const [keepDays, setKeepDays] = useState(30)

  // Power action params
  const [action, setAction] = useState('shutdown')
  const [force, setForce] = useState(false)

  // VM selection
  const [selectedVms, setSelectedVms] = useState<string[]>([])

  // Fetch VMs for selection
  const { data: inventoryRes } = useSWR(open ? '/api/v1/inventory' : null, fetcher)
  const allVms: VmOption[] = useMemo(() => {
    if (!inventoryRes?.data) return []

    const vms: VmOption[] = []

    for (const conn of (inventoryRes.data || [])) {
      for (const node of (conn.nodes || [])) {
        for (const guest of [...(node.qemu || []), ...(node.lxc || [])]) {
          vms.push({
            key: `${conn.id}:${guest.type || 'qemu'}:${node.node}:${guest.vmid}`,
            label: `${guest.name || `VM ${guest.vmid}`} (${node.node})`,
            connection_id: conn.id,
            type: guest.type || 'qemu',
            node: node.node,
            vmid: String(guest.vmid),
            name: guest.name || `VM ${guest.vmid}`,
            status: guest.status || 'unknown',
          })
        }
      }
    }

    return vms.sort((a, b) => a.label.localeCompare(b.label))
  }, [inventoryRes])

  const cronValue = cronPreset === 'custom' ? customCron : cronPreset

  const handleCreate = async () => {
    if (!name.trim()) { onError('Name is required'); return }
    if (!cronValue.trim()) { onError('Cron expression is required'); return }
    if (selectedVms.length === 0) { onError('Select at least one VM'); return }

    setLoading(true)

    try {
      const targets = selectedVms.map(key => {
        const vm = allVms.find(v => v.key === key)

        return {
          connection_id: vm?.connection_id || '',
          type: vm?.type || 'qemu',
          node: vm?.node || '',
          vmid: vm?.vmid || '',
          vm_name: vm?.name || '',
        }
      })

      const params = type === 'snapshot' ? {
        targets,
        include_ram: includeRam,
        name_prefix: namePrefix || 'auto',
        retention: { keep_last: keepLast, keep_days: keepDays },
      } : {
        targets,
        action,
        force,
      }

      const res = await fetch('/api/v1/scheduler/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || undefined,
          type,
          cron_expression: cronValue,
          timezone,
          params,
        }),
      })

      if (!res.ok) {
        const data = await res.json()

        throw new Error(data.error || 'Failed to create job')
      }

      // Reset form
      setName('')
      setDescription('')
      setSelectedVms([])
      onSuccess()
    } catch (e: any) {
      onError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth='md' fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <i className={type === 'snapshot' ? 'ri-camera-line' : 'ri-flashlight-line'} />
        {type === 'snapshot' ? 'New Snapshot Schedule' : 'New Power Action Schedule'}
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 1 }}>
          {/* Basic info */}
          <TextField
            label='Job Name'
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={type === 'snapshot' ? 'Nightly snapshots' : 'Shutdown dev VMs'}
            required
            fullWidth
            size='small'
          />
          <TextField
            label='Description (optional)'
            value={description}
            onChange={e => setDescription(e.target.value)}
            fullWidth
            size='small'
            multiline
            rows={2}
          />

          {/* Schedule */}
          <Typography variant='subtitle2' fontWeight={600}>Schedule</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl fullWidth size='small'>
              <InputLabel>Frequency</InputLabel>
              <Select value={cronPreset} onChange={e => setCronPreset(e.target.value)} label='Frequency'>
                {CRON_PRESETS.map(p => (
                  <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {cronPreset === 'custom' && (
              <TextField
                label='Cron Expression'
                value={customCron}
                onChange={e => setCustomCron(e.target.value)}
                placeholder='0 2 * * *'
                size='small'
                sx={{ minWidth: 200 }}
              />
            )}
            <TextField
              label='Timezone'
              value={timezone}
              onChange={e => setTimezone(e.target.value)}
              size='small'
              sx={{ minWidth: 150 }}
            />
          </Box>

          {/* VM Selection */}
          <Typography variant='subtitle2' fontWeight={600}>Target VMs</Typography>
          <FormControl fullWidth size='small'>
            <InputLabel>Select VMs</InputLabel>
            <Select
              multiple
              value={selectedVms}
              onChange={e => setSelectedVms(e.target.value as string[])}
              input={<OutlinedInput label='Select VMs' />}
              renderValue={(selected) => `${selected.length} VM(s) selected`}
            >
              {allVms.map(vm => (
                <MenuItem key={vm.key} value={vm.key}>
                  <Checkbox checked={selectedVms.includes(vm.key)} />
                  <ListItemText
                    primary={vm.label}
                    secondary={`VMID ${vm.vmid} • ${vm.status}`}
                  />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedVms.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {selectedVms.map(key => {
                const vm = allVms.find(v => v.key === key)

                return (
                  <Chip
                    key={key}
                    size='small'
                    label={vm?.label || key}
                    onDelete={() => setSelectedVms(prev => prev.filter(k => k !== key))}
                  />
                )
              })}
            </Box>
          )}

          {/* Type-specific params */}
          {type === 'snapshot' ? (
            <>
              <Typography variant='subtitle2' fontWeight={600}>Snapshot Options</Typography>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField
                  label='Name Prefix'
                  value={namePrefix}
                  onChange={e => setNamePrefix(e.target.value)}
                  size='small'
                  sx={{ flex: 1 }}
                  helperText='Snapshots will be named: prefix_2025-01-15T02-00-00'
                />
                <FormControlLabel
                  control={<Switch checked={includeRam} onChange={(_, v) => setIncludeRam(v)} />}
                  label='Include RAM'
                />
              </Box>

              <Typography variant='subtitle2' fontWeight={600}>Retention Policy</Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label='Keep Last N'
                  type='number'
                  value={keepLast}
                  onChange={e => setKeepLast(Number(e.target.value))}
                  size='small'
                  InputProps={{ inputProps: { min: 0 } }}
                  helperText='0 = keep all'
                  sx={{ flex: 1 }}
                />
                <TextField
                  label='Keep Days'
                  type='number'
                  value={keepDays}
                  onChange={e => setKeepDays(Number(e.target.value))}
                  size='small'
                  InputProps={{ inputProps: { min: 0 } }}
                  helperText='0 = no age limit'
                  sx={{ flex: 1 }}
                />
              </Box>
            </>
          ) : (
            <>
              <Typography variant='subtitle2' fontWeight={600}>Power Action</Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl fullWidth size='small'>
                  <InputLabel>Action</InputLabel>
                  <Select value={action} onChange={e => setAction(e.target.value)} label='Action'>
                    {POWER_ACTIONS.map(a => (
                      <MenuItem key={a.value} value={a.value}>{a.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControlLabel
                  control={<Switch checked={force} onChange={(_, v) => setForce(v)} />}
                  label='Force'
                />
              </Box>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant='contained' onClick={handleCreate} disabled={loading}>
          {loading ? 'Creating...' : 'Create Job'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
