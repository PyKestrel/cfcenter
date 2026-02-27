'use client'

import { useState, useEffect, useCallback } from 'react'

import {
  Box, Typography, Button, Card, CardContent, Chip, IconButton,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, Alert, Tabs, Tab,
  InputAdornment, Divider, CardActions,
} from '@mui/material'
import useSWR, { mutate as globalMutate } from 'swr'
import { useTranslations } from 'next-intl'

import { usePageTitle } from '@/contexts/PageTitleContext'

// ============================================
// Types
// ============================================

interface VmTemplate {
  id: string
  name: string
  description: string | null
  category: string
  icon: string | null
  type: 'qemu' | 'lxc'
  config: string
  metadata: string
  is_builtin: boolean
  is_public: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

interface ParsedMetadata {
  version?: string
  author?: string
  tags?: string[]
  os?: string
  os_version?: string
  min_disk_gb?: number
  min_memory_mb?: number
  recommended_cores?: number
  notes?: string
  exported_at?: string
}

// ============================================
// Helpers
// ============================================

const fetcher = (url: string) => fetch(url).then(r => r.json())

const CATEGORY_LABELS: Record<string, string> = {
  linux: 'Linux',
  windows: 'Windows',
  container: 'Containers',
  application: 'Applications',
  custom: 'Custom',
}

const CATEGORY_ICONS: Record<string, string> = {
  linux: 'ri-terminal-box-line',
  windows: 'ri-windows-fill',
  container: 'ri-ship-2-line',
  application: 'ri-apps-2-line',
  custom: 'ri-user-settings-line',
}

const ICON_MAP: Record<string, string> = {
  ubuntu: 'ri-ubuntu-fill',
  debian: 'ri-terminal-box-line',
  rocky: 'ri-shield-check-line',
  alpine: 'ri-leaf-line',
  windows: 'ri-windows-fill',
  docker: 'ri-ship-2-line',
  kubernetes: 'ri-apps-2-line',
  database: 'ri-database-2-fill',
  web: 'ri-global-line',
}

function parseMeta(raw: string): ParsedMetadata {
  try { return JSON.parse(raw) } catch { return {} }
}

function parseConfig(raw: string): Record<string, any> {
  try { return JSON.parse(raw) } catch { return {} }
}

function formatMemory(mb?: number): string {
  if (!mb) return '—'
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`

  return `${mb} MB`
}

// ============================================
// Main Page
// ============================================

export default function TemplatesPage() {
  const t = useTranslations()
  const { setPageInfo } = usePageTitle()

  useEffect(() => {
    setPageInfo('Templates', 'VM & container template marketplace', 'ri-file-code-line')

    return () => setPageInfo('', '', '')
  }, [setPageInfo])

  const [activeTab, setActiveTab] = useState(0)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [viewConfigTemplate, setViewConfigTemplate] = useState<VmTemplate | null>(null)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<VmTemplate | null>(null)

  const { data: templatesRes, isLoading } = useSWR('/api/v1/templates', fetcher, {
    refreshInterval: 30000,
  })

  const templates: VmTemplate[] = Array.isArray(templatesRes?.data) ? templatesRes.data : []

  const categorySet = new Set<string>()

  for (const tpl of templates) {
    if (tpl.category) categorySet.add(tpl.category)
  }

  const categories = ['all', ...Array.from(categorySet)]
  const tabCategory = categories[activeTab] || 'all'

  const filtered = templates.filter(tpl => {
    if (tabCategory !== 'all' && tpl.category !== tabCategory) return false

    if (search) {
      const q = search.toLowerCase()
      const meta = parseMeta(tpl.metadata)
      const tags = Array.isArray(meta.tags) ? meta.tags : []
      const searchable = [tpl.name, tpl.description, tpl.category, ...tags].join(' ').toLowerCase()

      return searchable.includes(q)
    }

    return true
  })

  const handleDelete = useCallback(async (tpl: VmTemplate) => {
    try {
      const res = await fetch(`/api/v1/templates/${tpl.id}`, { method: 'DELETE' })

      if (!res.ok) {
        const body = await res.json()

        throw new Error(body.error || 'Delete failed')
      }

      setSuccess(`Template "${tpl.name}" deleted`)
      setDeleteConfirm(null)
      globalMutate('/api/v1/templates')
    } catch (e: any) {
      setError(e.message)
    }
  }, [])

  const handleDownloadJSON = useCallback((tpl: VmTemplate) => {
    const config = parseConfig(tpl.config)
    const metadata = parseMeta(tpl.metadata)

    const exportData = {
      name: tpl.name,
      description: tpl.description,
      category: tpl.category,
      type: tpl.type,
      config,
      metadata,
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')

    a.href = url
    a.download = `${tpl.name.replace(/\s+/g, '-').toLowerCase()}.template.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  // Stats
  const builtinCount = templates.filter(tpl => tpl.is_builtin).length
  const customCount = templates.filter(tpl => !tpl.is_builtin).length
  const qemuCount = templates.filter(tpl => tpl.type === 'qemu').length
  const lxcCount = templates.filter(tpl => tpl.type === 'lxc').length

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
          { label: 'Total Templates', value: templates.length, icon: 'ri-file-code-line', color: '#7c4dff' },
          { label: 'Marketplace', value: builtinCount, icon: 'ri-store-2-line', color: '#00bfa5' },
          { label: 'Custom', value: customCount, icon: 'ri-user-settings-line', color: '#ff6d00' },
          { label: 'QEMU / LXC', value: `${qemuCount} / ${lxcCount}`, icon: 'ri-computer-line', color: '#2979ff' },
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search templates..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ minWidth: 260 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <i className="ri-search-line" style={{ fontSize: 18 }} />
                </InputAdornment>
              ),
            }
          }}
        />
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" startIcon={<i className="ri-upload-2-line" />} onClick={() => setImportDialogOpen(true)}>
          Import JSON
        </Button>
        <Button variant="outlined" startIcon={<i className="ri-download-2-line" />} onClick={() => setExportDialogOpen(true)}>
          Export from VM
        </Button>
      </Box>

      {/* Category Tabs */}
      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
        {categories.map((cat) => (
          <Tab
            key={cat}
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {cat !== 'all' && <i className={CATEGORY_ICONS[cat] || 'ri-folder-line'} style={{ fontSize: 16 }} />}
                {cat === 'all' ? 'All' : CATEGORY_LABELS[cat] || cat}
                <Chip label={cat === 'all' ? templates.length : templates.filter(tpl => tpl.category === cat).length} size="small" sx={{ height: 20, fontSize: 11 }} />
              </Box>
            }
          />
        ))}
      </Tabs>

      {/* Template Grid */}
      {isLoading ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <Typography color="text.secondary">Loading templates...</Typography>
        </Box>
      ) : filtered.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <i className="ri-file-code-line" style={{ fontSize: 48, opacity: 0.3 }} />
          <Typography color="text.secondary" sx={{ mt: 1 }}>No templates found</Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr', lg: '1fr 1fr 1fr 1fr' }, gap: 2 }}>
          {filtered.map((tpl, i) => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              index={i}
              onViewConfig={() => setViewConfigTemplate(tpl)}
              onDownload={() => handleDownloadJSON(tpl)}
              onDelete={() => setDeleteConfirm(tpl)}
            />
          ))}
        </Box>
      )}

      {/* View Config Dialog */}
      <ConfigViewerDialog template={viewConfigTemplate} onClose={() => setViewConfigTemplate(null)} />

      {/* Import Dialog */}
      <ImportTemplateDialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} onSuccess={(msg) => { setSuccess(msg); globalMutate('/api/v1/templates') }} onError={setError} />

      {/* Export from VM Dialog */}
      <ExportFromVmDialog open={exportDialogOpen} onClose={() => setExportDialogOpen(false)} onSuccess={(msg) => { setSuccess(msg); globalMutate('/api/v1/templates') }} onError={setError} />

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>Delete Template</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete <strong>{deleteConfirm?.name}</strong>? This cannot be undone.</Typography>
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
// Template Card
// ============================================

function TemplateCard({ template, index, onViewConfig, onDownload, onDelete }: {
  template: VmTemplate
  index: number
  onViewConfig: () => void
  onDownload: () => void
  onDelete: () => void
}) {
  const meta = parseMeta(template.metadata)
  const config = parseConfig(template.config)
  const iconClass = ICON_MAP[template.icon || ''] || 'ri-file-code-line'

  return (
    <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column', transition: 'border-color 0.2s, box-shadow 0.2s', '&:hover': { borderColor: 'primary.main', boxShadow: 2 } }}>
      <CardContent sx={{ flex: 1, pb: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: template.type === 'lxc' ? '#00bfa518' : '#7c4dff18', flexShrink: 0 }}>
            <i className={iconClass} style={{ fontSize: 20, color: template.type === 'lxc' ? '#00bfa5' : '#7c4dff' }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={700} noWrap>{template.name}</Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
              <Chip label={template.type.toUpperCase()} size="small" sx={{ height: 18, fontSize: 10, fontWeight: 700 }} color={template.type === 'lxc' ? 'success' : 'primary'} variant="outlined" />
              {template.is_builtin && <Chip label="Marketplace" size="small" sx={{ height: 18, fontSize: 10 }} color="info" variant="outlined" />}
            </Box>
          </Box>
        </Box>

        {/* Description */}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 12, lineHeight: 1.5 }}>
          {template.description || 'No description'}
        </Typography>

        {/* Specs */}
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {(config.cores || meta.recommended_cores) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <i className="ri-cpu-line" style={{ fontSize: 14, opacity: 0.6 }} />
              <Typography variant="caption" color="text.secondary">{config.cores || meta.recommended_cores} cores</Typography>
            </Box>
          )}
          {(config.memory || meta.min_memory_mb) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <i className="ri-ram-line" style={{ fontSize: 14, opacity: 0.6 }} />
              <Typography variant="caption" color="text.secondary">{formatMemory(config.memory || meta.min_memory_mb)}</Typography>
            </Box>
          )}
          {meta.min_disk_gb && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <i className="ri-hard-drive-3-line" style={{ fontSize: 14, opacity: 0.6 }} />
              <Typography variant="caption" color="text.secondary">{meta.min_disk_gb} GB</Typography>
            </Box>
          )}
        </Box>

        {/* Tags */}
        {Array.isArray(meta.tags) && meta.tags.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
            {meta.tags.slice(0, 4).map(tag => (
              <Chip key={tag} label={tag} size="small" sx={{ height: 18, fontSize: 10 }} variant="outlined" />
            ))}
            {meta.tags.length > 4 && <Typography variant="caption" color="text.secondary">+{meta.tags.length - 4}</Typography>}
          </Box>
        )}
      </CardContent>

      <Divider />

      <CardActions sx={{ px: 2, py: 1, justifyContent: 'space-between' }}>
        <Box>
          <Tooltip title="View configuration">
            <IconButton size="small" onClick={onViewConfig}><i className="ri-code-s-slash-line" style={{ fontSize: 16 }} /></IconButton>
          </Tooltip>
          <Tooltip title="Download as JSON">
            <IconButton size="small" onClick={onDownload}><i className="ri-download-line" style={{ fontSize: 16 }} /></IconButton>
          </Tooltip>
          {!template.is_builtin && (
            <Tooltip title="Delete">
              <IconButton size="small" color="error" onClick={onDelete}><i className="ri-delete-bin-line" style={{ fontSize: 16 }} /></IconButton>
            </Tooltip>
          )}
        </Box>
      </CardActions>
    </Card>
  )
}

// ============================================
// Config Viewer Dialog
// ============================================

function ConfigViewerDialog({ template, onClose }: { template: VmTemplate | null; onClose: () => void }) {
  if (!template) return null

  const config = parseConfig(template.config)
  const metadata = parseMeta(template.metadata)

  return (
    <Dialog open={!!template} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <i className="ri-code-s-slash-line" style={{ fontSize: 20 }} />
        {template.name} — Configuration
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>VM Configuration</Typography>
        <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 2, mb: 2, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}>
          {JSON.stringify(config, null, 2)}
        </Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Metadata</Typography>
        <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 2, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
          {JSON.stringify(metadata, null, 2)}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

// ============================================
// Import Template Dialog
// ============================================

function ImportTemplateDialog({ open, onClose, onSuccess, onError }: {
  open: boolean
  onClose: () => void
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}) {
  const [jsonText, setJsonText] = useState('')
  const [loading, setLoading] = useState(false)

  const handleImport = async () => {
    try {
      setLoading(true)
      const parsed = JSON.parse(jsonText)
      const { name, description, category, type, config, metadata } = parsed

      if (!name || !type || !config) {
        throw new Error('JSON must contain: name, type, config')
      }

      const res = await fetch('/api/v1/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, category, type, config, metadata }),
      })

      if (!res.ok) {
        const body = await res.json()

        throw new Error(body.error || 'Import failed')
      }

      onSuccess(`Template "${name}" imported successfully`)
      setJsonText('')
      onClose()
    } catch (e: any) {
      onError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]

    if (!file) return

    const reader = new FileReader()

    reader.onload = (ev) => {
      setJsonText(ev.target?.result as string || '')
    }

    reader.readAsText(file)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Import Template from JSON</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Button variant="outlined" component="label" startIcon={<i className="ri-upload-2-line" />}>
            Upload File
            <input type="file" hidden accept=".json,.template.json" onChange={handleFileUpload} />
          </Button>
        </Box>
        <TextField
          multiline
          rows={12}
          fullWidth
          placeholder={'{\n  "name": "My Template",\n  "type": "qemu",\n  "config": { ... },\n  "metadata": { ... }\n}'}
          value={jsonText}
          onChange={e => setJsonText(e.target.value)}
          sx={{ fontFamily: 'monospace', fontSize: 12 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleImport} disabled={loading || !jsonText.trim()}>
          {loading ? 'Importing...' : 'Import Template'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ============================================
// Export from VM Dialog
// ============================================

function ExportFromVmDialog({ open, onClose, onSuccess, onError }: {
  open: boolean
  onClose: () => void
  onSuccess: (msg: string) => void
  onError: (msg: string) => void
}) {
  const [templateName, setTemplateName] = useState('')
  const [templateDesc, setTemplateDesc] = useState('')
  const [category, setCategory] = useState('custom')
  const [selectedVm, setSelectedVm] = useState('')
  const [loading, setLoading] = useState(false)

  const { data: inventoryRes } = useSWR(open ? '/api/v1/inventory' : null, fetcher)

  // Flatten inventory into VM options
  const vmOptions: { label: string; value: string; connection_id: string; type: string; node: string; vmid: string }[] = []

  const clusters = Array.isArray(inventoryRes?.data?.clusters) ? inventoryRes.data.clusters : []

  for (const conn of clusters) {
    const nodes = Array.isArray(conn?.nodes) ? conn.nodes : []

    for (const node of nodes) {
      const guests = Array.isArray(node?.guests) ? node.guests : []

      for (const guest of guests) {
        vmOptions.push({
          label: `${guest.name || guest.vmid} (${guest.vmid}) — ${node.node}@${conn.name}`,
          value: `${conn.id}|${guest.type || 'qemu'}|${node.node}|${guest.vmid}`,
          connection_id: conn.id,
          type: guest.type || 'qemu',
          node: node.node,
          vmid: String(guest.vmid),
        })
      }
    }
  }

  const handleExport = async () => {
    try {
      setLoading(true)
      const vm = vmOptions.find(v => v.value === selectedVm)

      if (!vm) throw new Error('Select a VM')
      if (!templateName.trim()) throw new Error('Template name is required')

      const res = await fetch('/api/v1/templates/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connection_id: vm.connection_id,
          type: vm.type,
          node: vm.node,
          vmid: vm.vmid,
          template_name: templateName.trim(),
          template_description: templateDesc.trim() || undefined,
          category,
        }),
      })

      if (!res.ok) {
        const body = await res.json()

        throw new Error(body.error || 'Export failed')
      }

      onSuccess(`Template "${templateName}" exported from VM ${vm.vmid}`)
      setTemplateName('')
      setTemplateDesc('')
      setSelectedVm('')
      onClose()
    } catch (e: any) {
      onError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Export VM Configuration as Template</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        <TextField
          select
          label="Source VM"
          value={selectedVm}
          onChange={e => setSelectedVm(e.target.value)}
          fullWidth
          size="small"
        >
          {vmOptions.length === 0 && <MenuItem disabled>Loading VMs...</MenuItem>}
          {vmOptions.map(vm => (
            <MenuItem key={vm.value} value={vm.value}>{vm.label}</MenuItem>
          ))}
        </TextField>
        <TextField label="Template Name" value={templateName} onChange={e => setTemplateName(e.target.value)} fullWidth size="small" required />
        <TextField label="Description" value={templateDesc} onChange={e => setTemplateDesc(e.target.value)} fullWidth size="small" multiline rows={2} />
        <TextField
          select
          label="Category"
          value={category}
          onChange={e => setCategory(e.target.value)}
          fullWidth
          size="small"
        >
          <MenuItem value="linux">Linux</MenuItem>
          <MenuItem value="windows">Windows</MenuItem>
          <MenuItem value="container">Container</MenuItem>
          <MenuItem value="application">Application</MenuItem>
          <MenuItem value="custom">Custom</MenuItem>
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleExport} disabled={loading || !selectedVm || !templateName.trim()}>
          {loading ? 'Exporting...' : 'Export as Template'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
