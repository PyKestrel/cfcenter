'use client'

import { useState, useEffect, useCallback } from 'react'

import {
  Box, Typography, Button, Card, CardContent, Chip, IconButton,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Alert, Tabs, Tab, Divider, Switch, FormControlLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, LinearProgress, CircularProgress, Select, InputLabel, FormControl,
} from '@mui/material'
import useSWR, { mutate as globalMutate } from 'swr'
import { useTranslations } from 'next-intl'

import { usePageTitle } from '@/contexts/PageTitleContext'

// ============================================
// Types
// ============================================

interface TerraformWorkspace {
  id: string
  name: string
  description: string | null
  status: 'idle' | 'planning' | 'applying' | 'destroying' | 'error'
  hcl_content: string
  plan_output: string | null
  apply_output: string | null
  state_json: string | null
  last_action: string | null
  last_action_at: string | null
  connection_id: string | null
  credential_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

interface TerraformOperation {
  id: string
  workspace_id: string
  action: string
  status: 'running' | 'success' | 'failed'
  output: string
  started_at: string
  finished_at: string | null
  duration_ms: number | null
}

interface ResourceTemplate {
  id: string
  name: string
  description: string
  category: string
  icon: string
  type: string
}

interface TerraformCredential {
  id: string
  name: string
  provider: string
  description: string | null
  config_preview: Record<string, string>
  created_by: string | null
  created_at: string
  updated_at: string
}

interface ProviderField {
  key: string
  label: string
  type: 'text' | 'password' | 'url' | 'boolean' | 'select'
  required: boolean
  placeholder?: string
  options?: string[]
  safe?: boolean
}

interface ProviderSchema {
  id: string
  label: string
  icon: string
  fields: ProviderField[]
}

// ============================================
// Helpers
// ============================================

const fetcher = (url: string) => fetch(url).then(r => r.json())

const STATUS_COLORS: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info' | 'primary'> = {
  idle: 'default',
  planning: 'info',
  applying: 'primary',
  destroying: 'warning',
  error: 'error',
  running: 'info',
  success: 'success',
  failed: 'error',
}

function formatDuration(ms: number | null): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`

  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`

  return `${Math.floor(diff / 86400000)}d ago`
}

// ============================================
// Main Page
// ============================================

export default function TerraformPage() {
  const t = useTranslations()
  const { setPageInfo } = usePageTitle()

  useEffect(() => {
    setPageInfo('Terraform', 'Infrastructure as Code for Proxmox VE', 'ri-terminal-box-line')

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [pageTab, setPageTab] = useState(0)

  const { data: wsData, isLoading } = useSWR('/api/v1/terraform/workspaces', fetcher, { refreshInterval: 5000 })
  const workspaces: TerraformWorkspace[] = Array.isArray(wsData?.data) ? wsData.data : []
  const tfStatus = wsData?.terraform || { installed: false, version: null }
  const resourceTemplates: ResourceTemplate[] = Array.isArray(wsData?.templates) ? wsData.templates : []

  const { data: credData } = useSWR('/api/v1/terraform/credentials', fetcher, { refreshInterval: 10000 })
  const credentials: TerraformCredential[] = Array.isArray(credData?.data) ? credData.data : []
  const providerSchemas: ProviderSchema[] = Array.isArray(credData?.providers) ? credData.providers : []

  const [createOpen, setCreateOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [selectedWs, setSelectedWs] = useState<TerraformWorkspace | null>(null)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [credDialogOpen, setCredDialogOpen] = useState(false)
  const [editingCred, setEditingCred] = useState<TerraformCredential | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const openEditor = (ws: TerraformWorkspace) => {
    setSelectedWs(ws)
    setEditorOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this workspace? This cannot be undone.')) return
    await fetch(`/api/v1/terraform/workspaces/${id}`, { method: 'DELETE' })
    globalMutate('/api/v1/terraform/workspaces')
  }

  const handleDeleteCred = async (id: string) => {
    if (!confirm('Delete this credential? Workspaces using it will lose access.')) return
    await fetch(`/api/v1/terraform/credentials/${id}`, { method: 'DELETE' })
    globalMutate('/api/v1/terraform/credentials')
  }

  const handleExport = (ws: TerraformWorkspace) => {
    window.open(`/api/v1/terraform/workspaces/${ws.id}/export`, '_blank')
  }

  // Stats
  const totalWs = workspaces.length
  const activeWs = workspaces.filter(w => w.state_json).length
  const errorWs = workspaces.filter(w => w.status === 'error').length
  const busyWs = workspaces.filter(w => ['planning', 'applying', 'destroying'].includes(w.status)).length

  return (
    <Box>
      {/* Terraform not installed warning */}
      {!isLoading && !tfStatus.installed && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <strong>Terraform is not installed</strong> on this server. Install it from{' '}
          <a href="https://developer.hashicorp.com/terraform/install" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
            developer.hashicorp.com/terraform/install
          </a>
          {' '}to enable plan/apply/destroy actions. You can still create workspaces and edit HCL configurations.
        </Alert>
      )}

      {/* Stats row */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 2, mb: 3 }}>
        {[
          { label: 'Workspaces', value: totalWs, icon: 'ri-stack-line', color: '#6366f1' },
          { label: 'Credentials', value: credentials.length, icon: 'ri-key-2-line', color: '#f59e0b' },
          { label: 'Deployed', value: activeWs, icon: 'ri-checkbox-circle-line', color: '#10b981' },
          { label: 'In Progress', value: busyWs, icon: 'ri-loader-4-line', color: '#3b82f6' },
          { label: 'Terraform', value: tfStatus.version || 'Not Installed', icon: 'ri-terminal-box-line', color: tfStatus.installed ? '#10b981' : '#9ca3af' },
        ].map((s, i) => (
          <Card key={i} variant="outlined">
            <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 32, height: 32, borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${s.color}18` }}>
                  <i className={s.icon} style={{ fontSize: 18, color: s.color }} />
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                  <Typography variant="body1" fontWeight={700}>{s.value}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Top-level tabs */}
      <Tabs value={pageTab} onChange={(_, v) => setPageTab(v)} sx={{ mb: 2 }}>
        <Tab label="Workspaces" icon={<i className="ri-stack-line" />} iconPosition="start" />
        <Tab label="Credentials" icon={<i className="ri-key-2-line" />} iconPosition="start" />
      </Tabs>

      {/* Workspaces tab */}
      {pageTab === 0 && (
        <>
          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button variant="contained" startIcon={<i className="ri-add-line" />} onClick={() => setCreateOpen(true)}>
              New Workspace
            </Button>
            <Button variant="outlined" startIcon={<i className="ri-magic-line" />} onClick={() => setGenerateOpen(true)}>
              Generate from Template
            </Button>
            <Button variant="outlined" startIcon={<i className="ri-upload-2-line" />} onClick={() => setImportOpen(true)}>
              Import
            </Button>
          </Box>

          {/* Workspace list */}
          {isLoading ? (
            <LinearProgress />
          ) : workspaces.length === 0 ? (
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <i className="ri-terminal-box-line" style={{ fontSize: 48, opacity: 0.3 }} />
                <Typography variant="h6" color="text.secondary" sx={{ mt: 1 }}>No workspaces yet</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Create a workspace to start managing infrastructure with Terraform</Typography>
                <Button variant="contained" onClick={() => setCreateOpen(true)}>Create Workspace</Button>
              </CardContent>
            </Card>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Credential</TableCell>
                    <TableCell>Last Action</TableCell>
                    <TableCell>State</TableCell>
                    <TableCell>Updated</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {workspaces.map(ws => {
                    const cred = credentials.find(c => c.id === ws.credential_id)

                    return (
                      <TableRow key={ws.id} hover sx={{ cursor: 'pointer' }} onClick={() => openEditor(ws)}>
                        <TableCell>
                          <Box>
                            <Typography variant="body2" fontWeight={600}>{ws.name}</Typography>
                            {ws.description && (
                              <Typography variant="caption" color="text.secondary">{ws.description}</Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip label={ws.status} size="small" color={STATUS_COLORS[ws.status] || 'default'} />
                        </TableCell>
                        <TableCell>
                          {cred ? (
                            <Chip label={cred.name} size="small" variant="outlined" icon={<i className="ri-key-2-line" style={{ fontSize: 14 }} />} />
                          ) : (
                            <Typography variant="caption" color="text.secondary">None</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {ws.last_action ? (
                            <Box>
                              <Typography variant="body2">{ws.last_action}</Typography>
                              <Typography variant="caption" color="text.secondary">{timeAgo(ws.last_action_at)}</Typography>
                            </Box>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          {ws.state_json ? (
                            <Chip label="Has State" size="small" color="success" variant="outlined" />
                          ) : (
                            <Typography variant="caption" color="text.secondary">No state</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption">{timeAgo(ws.updated_at)}</Typography>
                        </TableCell>
                        <TableCell align="right" onClick={e => e.stopPropagation()}>
                          <Tooltip title="Edit"><IconButton size="small" onClick={() => openEditor(ws)}><i className="ri-edit-line" /></IconButton></Tooltip>
                          <Tooltip title="Export"><IconButton size="small" onClick={() => handleExport(ws)}><i className="ri-download-2-line" /></IconButton></Tooltip>
                          <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => handleDelete(ws.id)}><i className="ri-delete-bin-line" /></IconButton></Tooltip>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {/* Credentials tab */}
      {pageTab === 1 && (
        <>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button variant="contained" startIcon={<i className="ri-add-line" />} onClick={() => { setEditingCred(null); setCredDialogOpen(true) }}>
              Add Credential
            </Button>
          </Box>

          {credentials.length === 0 ? (
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 6 }}>
                <i className="ri-key-2-line" style={{ fontSize: 48, opacity: 0.3 }} />
                <Typography variant="h6" color="text.secondary" sx={{ mt: 1 }}>No credentials yet</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Add provider credentials to use with Terraform workspaces. Credentials are encrypted at rest.
                </Typography>
                <Button variant="contained" onClick={() => { setEditingCred(null); setCredDialogOpen(true) }}>Add Credential</Button>
              </CardContent>
            </Card>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 2 }}>
              {credentials.map(cred => {
                const schema = providerSchemas.find(p => p.id === cred.provider)

                return (
                  <Card key={cred.id} variant="outlined">
                    <CardContent sx={{ pb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <i className={schema?.icon || 'ri-key-2-line'} style={{ fontSize: 20, opacity: 0.7 }} />
                          <Box>
                            <Typography variant="body1" fontWeight={600}>{cred.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{schema?.label || cred.provider}</Typography>
                          </Box>
                        </Box>
                        <Box>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => { setEditingCred(cred); setCredDialogOpen(true) }}>
                              <i className="ri-edit-line" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => handleDeleteCred(cred.id)}>
                              <i className="ri-delete-bin-line" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>
                      {cred.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: 12 }}>{cred.description}</Typography>
                      )}
                      <Divider sx={{ my: 1 }} />
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {Object.entries(cred.config_preview).map(([key, val]) => (
                          <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</Typography>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: 11 }}>{val}</Typography>
                          </Box>
                        ))}
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontSize: 10 }}>
                        Created {timeAgo(cred.created_at)}
                      </Typography>
                    </CardContent>
                  </Card>
                )
              })}
            </Box>
          )}
        </>
      )}

      {/* Dialogs */}
      <CreateWorkspaceDialog open={createOpen} onClose={() => setCreateOpen(false)} credentials={credentials} />
      {selectedWs && (
        <WorkspaceEditorDialog
          open={editorOpen}
          onClose={() => { setEditorOpen(false); setSelectedWs(null) }}
          workspace={selectedWs}
          tfInstalled={tfStatus.installed}
          credentials={credentials}
        />
      )}
      <GenerateDialog open={generateOpen} onClose={() => setGenerateOpen(false)} templates={resourceTemplates} credentials={credentials} />
      <CredentialDialog
        open={credDialogOpen}
        onClose={() => { setCredDialogOpen(false); setEditingCred(null) }}
        providers={providerSchemas}
        editing={editingCred}
      />
      <ImportWorkspaceDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </Box>
  )
}

// ============================================
// Create Workspace Dialog
// ============================================

function CreateWorkspaceDialog({ open, onClose, credentials }: { open: boolean; onClose: () => void; credentials: TerraformCredential[] }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [credentialId, setCredentialId] = useState('')
  const [loading, setLoading] = useState(false)

  const handleCreate = async () => {
    setLoading(true)
    try {
      await fetch('/api/v1/terraform/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, credential_id: credentialId || undefined }),
      })
      globalMutate('/api/v1/terraform/workspaces')
      setName('')
      setDescription('')
      setCredentialId('')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>New Terraform Workspace</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField label="Workspace Name" value={name} onChange={e => setName(e.target.value)} fullWidth placeholder="production-vms" autoFocus />
          <TextField label="Description" value={description} onChange={e => setDescription(e.target.value)} fullWidth multiline rows={2} placeholder="Production VM infrastructure" />
          <TextField
            select
            label="Credential"
            value={credentialId}
            onChange={e => setCredentialId(e.target.value)}
            fullWidth
            helperText="Select stored credentials for this workspace (optional)"
          >
            <MenuItem value="">
              <em>None — use manual token</em>
            </MenuItem>
            {credentials.map(c => (
              <MenuItem key={c.id} value={c.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <i className="ri-key-2-line" style={{ fontSize: 14, opacity: 0.6 }} />
                  {c.name}
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>({c.provider})</Typography>
                </Box>
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleCreate} disabled={loading || !name.trim()}>
          {loading ? 'Creating...' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ============================================
// Generate from Template Dialog
// ============================================

function GenerateDialog({ open, onClose, templates, credentials }: { open: boolean; onClose: () => void; templates: ResourceTemplate[]; credentials: TerraformCredential[] }) {
  const [selectedType, setSelectedType] = useState('')
  const [vmName, setVmName] = useState('my-vm')
  const [targetNode, setTargetNode] = useState('pve')
  const [endpoint, setEndpoint] = useState('https://pve.example.com:8006')
  const [credentialId, setCredentialId] = useState('')
  const [loading, setLoading] = useState(false)
  const [generatedHcl, setGeneratedHcl] = useState('')

  const handleGenerate = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/terraform/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource_type: selectedType,
          vm_name: vmName,
          target_node: targetNode,
          connection_endpoint: endpoint,
        }),
      })
      const data = await res.json()

      if (data.data?.hcl) {
        setGeneratedHcl(data.data.hcl)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCreateWorkspace = async () => {
    if (!generatedHcl) return

    setLoading(true)
    try {
      await fetch('/api/v1/terraform/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${selectedType}-${Date.now().toString(36)}`,
          description: `Generated from ${selectedType} template`,
          hcl_content: generatedHcl,
          credential_id: credentialId || undefined,
        }),
      })
      globalMutate('/api/v1/terraform/workspaces')
      setGeneratedHcl('')
      setSelectedType('')
      onClose()
    } finally {
      setLoading(false)
    }
  }

  const categories = [...new Set(templates.map(t => t.category))]

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Generate Terraform Configuration</DialogTitle>
      <DialogContent>
        {!generatedHcl ? (
          <Box sx={{ mt: 1 }}>
            {/* Resource type selection */}
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Select Resource Type</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 2, mb: 2 }}>
              {categories.map(cat => (
                <Box key={cat} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', fontSize: 10, display: 'block' }}>
                    {cat}
                  </Typography>
                  {templates.filter(t => t.category === cat).map(t => (
                    <Card
                      key={t.id}
                      variant="outlined"
                      onClick={(e: React.MouseEvent) => { e.stopPropagation(); setSelectedType(t.type) }}
                      sx={{
                        cursor: 'pointer',
                        borderColor: selectedType === t.type ? 'primary.main' : 'divider',
                        bgcolor: selectedType === t.type ? 'action.selected' : 'transparent',
                        '&:hover': { bgcolor: 'action.hover' },
                        transition: 'border-color 0.15s, background-color 0.15s',
                      }}
                    >
                      <CardContent sx={{ py: 1.5, px: 1.5, '&:last-child': { pb: 1.5 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <i className={t.icon} style={{ fontSize: 16, opacity: 0.6 }} />
                          <Box>
                            <Typography variant="body2" fontWeight={600} sx={{ fontSize: 12 }}>{t.name}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{t.description}</Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              ))}
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Parameters */}
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Parameters</Typography>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
              <TextField size="small" label="VM/Resource Name" value={vmName} onChange={e => setVmName(e.target.value)} sx={{ flex: 1, minWidth: 150 }} />
              <TextField size="small" label="Target Node" value={targetNode} onChange={e => setTargetNode(e.target.value)} sx={{ width: 120 }} />
              <TextField size="small" label="PVE Endpoint" value={endpoint} onChange={e => setEndpoint(e.target.value)} sx={{ flex: 1, minWidth: 200 }} />
            </Box>

            {/* Credential */}
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Credential</Typography>
            <TextField
              select
              size="small"
              label="Stored Credential"
              value={credentialId}
              onChange={e => setCredentialId(e.target.value)}
              fullWidth
              helperText={credentialId ? 'This credential will be linked to the new workspace' : 'Optional — you can also set credentials later in the workspace editor'}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {credentials.map(c => (
                <MenuItem key={c.id} value={c.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <i className="ri-key-2-line" style={{ fontSize: 14, opacity: 0.6 }} />
                    {c.name}
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>({c.provider})</Typography>
                  </Box>
                </MenuItem>
              ))}
            </TextField>
          </Box>
        ) : (
          <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Generated HCL Configuration</Typography>
            <TextField
              multiline
              rows={20}
              fullWidth
              value={generatedHcl}
              onChange={e => setGeneratedHcl(e.target.value)}
              sx={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { setGeneratedHcl(''); onClose() }}>Cancel</Button>
        {!generatedHcl ? (
          <Button variant="contained" onClick={handleGenerate} disabled={loading || !selectedType}>
            {loading ? 'Generating...' : 'Generate HCL'}
          </Button>
        ) : (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => setGeneratedHcl('')}>Back</Button>
            <Button variant="contained" onClick={handleCreateWorkspace} disabled={loading}>
              {loading ? 'Creating...' : 'Create Workspace'}
            </Button>
          </Box>
        )}
      </DialogActions>
    </Dialog>
  )
}

// ============================================
// Workspace Editor Dialog
// ============================================

function WorkspaceEditorDialog({
  open, onClose, workspace, tfInstalled, credentials,
}: {
  open: boolean
  onClose: () => void
  workspace: TerraformWorkspace
  tfInstalled: boolean
  credentials: TerraformCredential[]
}) {
  const [activeTab, setActiveTab] = useState(0)
  const [hcl, setHcl] = useState(workspace.hcl_content || '')
  const [name, setName] = useState(workspace.name)
  const [description, setDescription] = useState(workspace.description || '')
  const [credentialId, setCredentialId] = useState(workspace.credential_id || '')
  const [apiToken, setApiToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [output, setOutput] = useState<string | null>(null)
  const [outputStatus, setOutputStatus] = useState<'success' | 'failed' | null>(null)
  const [liveWs, setLiveWs] = useState<TerraformWorkspace>(workspace)
  const [operations, setOperations] = useState<TerraformOperation[]>([])

  // Fetch workspace details
  const fetchDetails = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/terraform/workspaces/${workspace.id}`)
      const data = await res.json()

      if (data.data) setLiveWs(data.data)
      if (Array.isArray(data.operations)) setOperations(data.operations)
    } catch { /* ignore */ }
  }, [workspace.id])

  useEffect(() => {
    fetchDetails()
  }, [fetchDetails])

  // Poll while workspace is busy
  useEffect(() => {
    if (!['planning', 'applying', 'destroying'].includes(liveWs.status)) return
    const interval = setInterval(fetchDetails, 2000)

    return () => clearInterval(interval)
  }, [liveWs.status, fetchDetails])

  const handleSave = async () => {
    setSaving(true)
    try {
      await fetch(`/api/v1/terraform/workspaces/${workspace.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, hcl_content: hcl, credential_id: credentialId || null }),
      })
      globalMutate('/api/v1/terraform/workspaces')
      await fetchDetails()
    } finally {
      setSaving(false)
    }
  }

  const runAction = async (action: string) => {
    // Save first
    await handleSave()

    setRunning(true)
    setOutput(null)
    setOutputStatus(null)
    setActiveTab(2) // Switch to output tab
    try {
      const res = await fetch(`/api/v1/terraform/workspaces/${workspace.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, api_token: !credentialId ? (apiToken || undefined) : undefined }),
      })
      const data = await res.json()

      if (data.data) {
        setOutput(data.data.output)
        setOutputStatus(data.data.status)
      } else if (data.error) {
        setOutput(data.error)
        setOutputStatus('failed')
      }
      await fetchDetails()
      globalMutate('/api/v1/terraform/workspaces')
    } catch (err: any) {
      setOutput(err.message)
      setOutputStatus('failed')
    } finally {
      setRunning(false)
    }
  }

  const isBusy = running || ['planning', 'applying', 'destroying'].includes(liveWs.status)

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <i className="ri-terminal-box-line" style={{ fontSize: 20 }} />
          <span>{name || 'Workspace'}</span>
          <Chip label={liveWs.status} size="small" color={STATUS_COLORS[liveWs.status] || 'default'} />
        </Box>
        {isBusy && <CircularProgress size={20} />}
      </DialogTitle>
      <DialogContent>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 2 }}>
          <Tab label="Configuration" />
          <Tab label="Code (HCL)" />
          <Tab label="Output" />
          <Tab label={`History (${operations.length})`} />
          {liveWs.state_json && <Tab label="State" />}
        </Tabs>

        {/* Config tab */}
        {activeTab === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Workspace Name" value={name} onChange={e => setName(e.target.value)} fullWidth />
            <TextField label="Description" value={description} onChange={e => setDescription(e.target.value)} fullWidth multiline rows={2} />
            <Divider />
            <Typography variant="subtitle2">Credentials</Typography>
            <Typography variant="caption" color="text.secondary">
              Select a stored credential to use with this workspace, or enter a manual API token below.
            </Typography>
            <TextField
              select
              label="Stored Credential"
              value={credentialId}
              onChange={e => setCredentialId(e.target.value)}
              fullWidth
              helperText={credentialId ? 'Stored credentials will be used for plan/apply/destroy' : 'No credential selected — provide a manual token below'}
            >
              <MenuItem value="">
                <em>None — use manual token</em>
              </MenuItem>
              {credentials.map(c => (
                <MenuItem key={c.id} value={c.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <i className="ri-key-2-line" style={{ fontSize: 14, opacity: 0.6 }} />
                    {c.name}
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>({c.provider})</Typography>
                  </Box>
                </MenuItem>
              ))}
            </TextField>
            {!credentialId && (
              <>
                <Divider />
                <Typography variant="subtitle2">Manual API Token</Typography>
                <Typography variant="caption" color="text.secondary">
                  Format: <code>user@realm!tokenid=uuid-secret</code>. This is NOT stored — it&apos;s only used for the current session.
                </Typography>
                <TextField
                  label="API Token"
                  value={apiToken}
                  onChange={e => setApiToken(e.target.value)}
                  fullWidth
                  type="password"
                  placeholder="user@pam!terraform=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  helperText="Passed as TF_VAR_proxmox_api_token to Terraform"
                />
              </>
            )}
          </Box>
        )}

        {/* HCL Editor tab */}
        {activeTab === 1 && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2">main.tf</Typography>
              <Typography variant="caption" color="text.secondary">{hcl.split('\n').length} lines</Typography>
            </Box>
            <TextField
              multiline
              rows={24}
              fullWidth
              value={hcl}
              onChange={e => setHcl(e.target.value)}
              placeholder={`terraform {\n  required_providers {\n    proxmox = {\n      source = "bpg/proxmox"\n    }\n  }\n}\n\n# Add your resources here...`}
              sx={{
                fontFamily: 'monospace',
                fontSize: 13,
                '& .MuiInputBase-input': { fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", monospace', fontSize: 13, lineHeight: 1.6 },
              }}
            />
          </Box>
        )}

        {/* Output tab */}
        {activeTab === 2 && (
          <Box>
            {output ? (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Chip
                    label={outputStatus === 'success' ? 'Success' : 'Failed'}
                    size="small"
                    color={outputStatus === 'success' ? 'success' : 'error'}
                  />
                </Box>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2, maxHeight: 500, overflow: 'auto',
                    bgcolor: '#1a1a2e', color: '#e0e0e0',
                    fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6,
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}
                >
                  {output}
                </Paper>
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 6, opacity: 0.5 }}>
                <i className="ri-terminal-line" style={{ fontSize: 40 }} />
                <Typography variant="body2" sx={{ mt: 1 }}>Run an action to see output here</Typography>
              </Box>
            )}
          </Box>
        )}

        {/* History tab */}
        {activeTab === 3 && (
          <Box>
            {operations.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>No operations yet</Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Action</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Duration</TableCell>
                      <TableCell>Started</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {operations.map(op => (
                      <TableRow key={op.id} hover onClick={() => { setOutput(op.output); setOutputStatus(op.status as any); setActiveTab(2) }} sx={{ cursor: 'pointer' }}>
                        <TableCell>
                          <Chip label={op.action} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Chip label={op.status} size="small" color={STATUS_COLORS[op.status] || 'default'} />
                        </TableCell>
                        <TableCell>{formatDuration(op.duration_ms)}</TableCell>
                        <TableCell>{timeAgo(op.started_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}

        {/* State tab */}
        {activeTab === 4 && liveWs.state_json && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Terraform State</Typography>
            <Paper
              variant="outlined"
              sx={{
                p: 2, maxHeight: 500, overflow: 'auto',
                fontFamily: 'monospace', fontSize: 11, lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}
            >
              {(() => {
                try {
                  return JSON.stringify(JSON.parse(liveWs.state_json), null, 2)
                } catch {
                  return liveWs.state_json
                }
              })()}
            </Paper>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {tfInstalled && (
            <>
              <Tooltip title="Initialize Terraform providers">
                <Button size="small" variant="outlined" onClick={() => runAction('init')} disabled={isBusy} startIcon={<i className="ri-download-line" />}>
                  Init
                </Button>
              </Tooltip>
              <Tooltip title="Preview changes without applying">
                <Button size="small" variant="outlined" onClick={() => runAction('plan')} disabled={isBusy} startIcon={<i className="ri-eye-line" />}>
                  Plan
                </Button>
              </Tooltip>
              <Tooltip title="Apply configuration to Proxmox">
                <Button size="small" variant="contained" color="success" onClick={() => runAction('apply')} disabled={isBusy} startIcon={<i className="ri-play-line" />}>
                  Apply
                </Button>
              </Tooltip>
              <Tooltip title="Destroy all managed resources">
                <Button size="small" variant="outlined" color="error" onClick={() => runAction('destroy')} disabled={isBusy} startIcon={<i className="ri-delete-bin-line" />}>
                  Destroy
                </Button>
              </Tooltip>
            </>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onClose}>Close</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  )
}

// ============================================
// Credential Dialog (Create / Edit)
// ============================================

function CredentialDialog({
  open, onClose, providers, editing,
}: {
  open: boolean
  onClose: () => void
  providers: ProviderSchema[]
  editing: TerraformCredential | null
}) {
  const [name, setName] = useState('')
  const [provider, setProvider] = useState('')
  const [description, setDescription] = useState('')
  const [config, setConfig] = useState<Record<string, string | boolean>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name)
        setProvider(editing.provider)
        setDescription(editing.description || '')
        // Config is encrypted server-side; we don't pre-fill sensitive fields on edit
        setConfig({})
      } else {
        setName('')
        setProvider(providers.length > 0 ? providers[0].id : '')
        setDescription('')
        setConfig({})
      }
      setError('')
    }
  }, [open, editing, providers])

  const selectedSchema = providers.find(p => p.id === provider)

  const handleConfigChange = (key: string, value: string | boolean) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setLoading(true)
    setError('')
    try {
      const url = editing
        ? `/api/v1/terraform/credentials/${editing.id}`
        : '/api/v1/terraform/credentials'

      const body: Record<string, unknown> = { name, provider, description }

      // Only include config if fields were filled in
      const hasConfig = Object.values(config).some(v => v !== '' && v !== false)

      if (hasConfig || !editing) {
        body.config = config
      }

      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to save credential')

        return
      }

      globalMutate('/api/v1/terraform/credentials')
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <i className="ri-key-2-line" style={{ fontSize: 20 }} />
          {editing ? 'Edit Credential' : 'Add Credential'}
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

          <TextField
            label="Credential Name"
            value={name}
            onChange={e => setName(e.target.value)}
            fullWidth
            placeholder="Production Proxmox"
            autoFocus
          />

          <TextField
            select
            label="Provider"
            value={provider}
            onChange={e => { setProvider(e.target.value); setConfig({}) }}
            fullWidth
          >
            {providers.map(p => (
              <MenuItem key={p.id} value={p.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <i className={p.icon} style={{ fontSize: 16, opacity: 0.6 }} />
                  {p.label}
                </Box>
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={2}
            placeholder="Optional description"
          />

          {selectedSchema && (
            <>
              <Divider />
              <Typography variant="subtitle2">
                {selectedSchema.label} Configuration
              </Typography>
              {editing && (
                <Alert severity="info" variant="outlined" sx={{ py: 0.5 }}>
                  Leave fields blank to keep existing values. Fill in to update.
                </Alert>
              )}
              {selectedSchema.fields.map(field => {
                if (field.type === 'boolean') {
                  return (
                    <FormControlLabel
                      key={field.key}
                      control={
                        <Switch
                          checked={!!config[field.key]}
                          onChange={e => handleConfigChange(field.key, e.target.checked)}
                        />
                      }
                      label={field.label}
                    />
                  )
                }

                return (
                  <TextField
                    key={field.key}
                    label={field.label}
                    value={config[field.key] || ''}
                    onChange={e => handleConfigChange(field.key, e.target.value)}
                    fullWidth
                    type={field.type === 'password' ? 'password' : 'text'}
                    placeholder={field.placeholder}
                    required={field.required && !editing}
                    helperText={field.required ? 'Required' : 'Optional'}
                    multiline={field.key === 'env_vars' || field.key === 'credentials_json'}
                    rows={field.key === 'env_vars' || field.key === 'credentials_json' ? 4 : undefined}
                  />
                )
              })}
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={loading || !name.trim() || !provider}
        >
          {loading ? 'Saving...' : editing ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ============================================
// Import Workspace Dialog
// ============================================

function ImportWorkspaceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [jsonText, setJsonText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{ name: string; description?: string; hasHcl: boolean; hasState: boolean } | null>(null)

  useEffect(() => {
    if (open) {
      setJsonText('')
      setError('')
      setPreview(null)
    }
  }, [open])

  // Parse preview whenever jsonText changes
  useEffect(() => {
    if (!jsonText.trim()) {
      setPreview(null)
      setError('')

      return
    }

    try {
      const parsed = JSON.parse(jsonText)

      if (parsed._format !== 'cfcenter-terraform-workspace') {
        setError('Invalid format — expected a CFCenter Terraform workspace export file.')
        setPreview(null)

        return
      }

      setError('')
      setPreview({
        name: parsed.name || '(unnamed)',
        description: parsed.description || undefined,
        hasHcl: !!(parsed.hcl_content && parsed.hcl_content.trim()),
        hasState: !!parsed.state_json,
      })
    } catch {
      setError('Invalid JSON')
      setPreview(null)
    }
  }, [jsonText])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]

    if (!file) return

    const reader = new FileReader()

    reader.onload = (ev) => {
      setJsonText(ev.target?.result as string || '')
    }

    reader.readAsText(file)
    e.target.value = ''
  }

  const handleImport = async () => {
    setLoading(true)
    setError('')
    try {
      const parsed = JSON.parse(jsonText)
      const res = await fetch('/api/v1/terraform/workspaces/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Import failed')

        return
      }

      globalMutate('/api/v1/terraform/workspaces')
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <i className="ri-upload-2-line" style={{ fontSize: 20 }} />
          Import Terraform Workspace
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

          <Typography variant="body2" color="text.secondary">
            Paste workspace JSON below or upload a <code>.tfworkspace.json</code> file.
          </Typography>

          <Button variant="outlined" component="label" startIcon={<i className="ri-file-upload-line" />} sx={{ alignSelf: 'flex-start' }}>
            Upload File
            <input type="file" hidden accept=".json,.tfworkspace.json" onChange={handleFileUpload} />
          </Button>

          <TextField
            multiline
            rows={12}
            fullWidth
            value={jsonText}
            onChange={e => setJsonText(e.target.value)}
            placeholder='{\n  "_format": "cfcenter-terraform-workspace",\n  "_version": 1,\n  "name": "my-workspace",\n  ...\n}'
            sx={{ fontFamily: 'monospace', fontSize: 12 }}
          />

          {preview && (
            <Card variant="outlined">
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Preview</Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary">Name</Typography>
                    <Typography variant="caption" fontWeight={600}>{preview.name}</Typography>
                  </Box>
                  {preview.description && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">Description</Typography>
                      <Typography variant="caption">{preview.description}</Typography>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary">HCL Content</Typography>
                    <Chip label={preview.hasHcl ? 'Yes' : 'None'} size="small" color={preview.hasHcl ? 'success' : 'default'} variant="outlined" />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary">Terraform State</Typography>
                    <Chip label={preview.hasState ? 'Included' : 'None'} size="small" color={preview.hasState ? 'info' : 'default'} variant="outlined" />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleImport}
          disabled={loading || !preview}
          startIcon={<i className="ri-upload-2-line" />}
        >
          {loading ? 'Importing...' : 'Import Workspace'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
