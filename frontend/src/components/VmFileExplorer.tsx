'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'

interface FileEntry {
  name: string
  path: string
  type: 'file' | 'directory' | 'symlink'
  size: number
  permissions: string | null
  owner: string | null
  group: string | null
  modified: string
  linkTarget?: string
}

interface VmFileExplorerProps {
  connectionId: string
  node: string
  vmType: 'qemu' | 'lxc'
  vmid: number
  vmName: string
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`

  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function getFileIcon(entry: FileEntry): string {
  if (entry.type === 'directory') return 'ri-folder-fill'
  if (entry.type === 'symlink') return 'ri-links-fill'

  const ext = entry.name.split('.').pop()?.toLowerCase() || ''
  const iconMap: Record<string, string> = {
    txt: 'ri-file-text-line',
    log: 'ri-file-text-line',
    md: 'ri-markdown-line',
    json: 'ri-braces-line',
    xml: 'ri-code-s-slash-line',
    yml: 'ri-file-code-line',
    yaml: 'ri-file-code-line',
    conf: 'ri-settings-3-line',
    cfg: 'ri-settings-3-line',
    ini: 'ri-settings-3-line',
    sh: 'ri-terminal-box-line',
    bash: 'ri-terminal-box-line',
    py: 'ri-file-code-line',
    js: 'ri-file-code-line',
    ts: 'ri-file-code-line',
    html: 'ri-html5-line',
    css: 'ri-css3-line',
    jpg: 'ri-image-line',
    jpeg: 'ri-image-line',
    png: 'ri-image-line',
    gif: 'ri-image-line',
    svg: 'ri-image-line',
    pdf: 'ri-file-pdf-line',
    zip: 'ri-file-zip-line',
    gz: 'ri-file-zip-line',
    tar: 'ri-file-zip-line',
    deb: 'ri-file-zip-line',
    rpm: 'ri-file-zip-line',
    exe: 'ri-file-line',
    dll: 'ri-file-line',
    so: 'ri-file-line',
  }

  return iconMap[ext] || 'ri-file-line'
}

function getFileIconColor(entry: FileEntry): string {
  if (entry.type === 'directory') return '#f59e0b'
  if (entry.type === 'symlink') return '#3b82f6'

  const ext = entry.name.split('.').pop()?.toLowerCase() || ''

  if (['sh', 'bash', 'py', 'js', 'ts'].includes(ext)) return '#22c55e'
  if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext)) return '#a855f7'
  if (['zip', 'gz', 'tar', 'deb', 'rpm'].includes(ext)) return '#ef4444'
  if (['conf', 'cfg', 'ini', 'yml', 'yaml'].includes(ext)) return '#06b6d4'

  return '#6b7280'
}

// Detect if a file is likely text-based and previewable
function isPreviewable(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const textExts = [
    'txt', 'log', 'md', 'json', 'xml', 'yml', 'yaml', 'conf', 'cfg', 'ini',
    'sh', 'bash', 'py', 'js', 'ts', 'html', 'css', 'csv', 'env', 'toml',
    'service', 'timer', 'socket', 'mount', 'network', 'rules', 'cron',
    'properties', 'gitignore', 'dockerfile', 'makefile',
  ]
  // Also check common config files without extensions
  const noExtNames = [
    'hosts', 'fstab', 'passwd', 'shadow', 'group', 'sudoers',
    'crontab', 'profile', 'bashrc', 'vimrc', 'gitconfig',
    'dockerfile', 'makefile', 'license', 'readme', 'changelog',
  ]

  return textExts.includes(ext) || noExtNames.includes(name.toLowerCase())
}

export default function VmFileExplorer({ connectionId, node, vmType, vmid, vmName }: VmFileExplorerProps) {
  const [currentPath, setCurrentPath] = useState('/')
  const [files, setFiles] = useState<FileEntry[]>([])
  const [os, setOs] = useState<'linux' | 'windows'>('linux')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Preview dialog
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewContent, setPreviewContent] = useState('')
  const [previewPath, setPreviewPath] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadPath, setUploadPath] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const basePath = `/api/v1/connections/${encodeURIComponent(connectionId)}/guests/${encodeURIComponent(vmType)}/${encodeURIComponent(node)}/${encodeURIComponent(vmid)}/files`

  const fetchFiles = useCallback(async (dirPath: string) => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`${basePath}?path=${encodeURIComponent(dirPath)}`)
      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || `HTTP ${res.status}`)
      }

      setFiles(json.data.files || [])
      setOs(json.data.os || 'linux')
      setCurrentPath(dirPath)
    } catch (e: any) {
      setError(e.message || 'Failed to load directory')
      setFiles([])
    } finally {
      setLoading(false)
    }
  }, [basePath])

  useEffect(() => {
    if (vmType === 'qemu') {
      fetchFiles('/')
    }
  }, [vmType, fetchFiles])

  const navigateTo = (path: string) => {
    fetchFiles(path)
    setSearch('')
  }

  const navigateUp = () => {
    if (os === 'windows') {
      const parts = currentPath.split('\\').filter(Boolean)
      if (parts.length <= 1) return
      parts.pop()
      navigateTo(parts.join('\\') + '\\')
    } else {
      if (currentPath === '/') return
      const parts = currentPath.split('/').filter(Boolean)
      parts.pop()
      navigateTo('/' + parts.join('/'))
    }
  }

  const handleFileClick = (entry: FileEntry) => {
    if (entry.type === 'directory') {
      navigateTo(entry.path)
    }
  }

  const handlePreview = async (entry: FileEntry) => {
    setPreviewPath(entry.path)
    setPreviewOpen(true)
    setPreviewLoading(true)
    setPreviewContent('')

    try {
      const res = await fetch(
        `${basePath}/download?path=${encodeURIComponent(entry.path)}&mode=preview`
      )
      const json = await res.json()

      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)

      setPreviewContent(json.data.content || '')
    } catch (e: any) {
      setPreviewContent(`Error: ${e.message}`)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleDownload = async (entry: FileEntry) => {
    const url = `${basePath}/download?path=${encodeURIComponent(entry.path)}&mode=download`
    const a = document.createElement('a')
    a.href = url
    a.download = entry.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const handleUpload = async () => {
    if (!uploadFile || !uploadPath) return

    setUploading(true)
    setUploadError(null)

    try {
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1] || '')
        }
        reader.onerror = reject
        reader.readAsDataURL(uploadFile)
      })

      const res = await fetch(basePath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: uploadPath, content: base64 }),
      })
      const json = await res.json()

      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)

      setUploadOpen(false)
      setUploadFile(null)
      setUploadPath('')
      fetchFiles(currentPath) // Refresh
    } catch (e: any) {
      setUploadError(e.message)
    } finally {
      setUploading(false)
    }
  }

  const openUploadDialog = () => {
    const sep = os === 'windows' ? '\\' : '/'
    const base = currentPath.endsWith(sep) ? currentPath : currentPath + sep
    setUploadPath(base)
    setUploadFile(null)
    setUploadError(null)
    setUploadOpen(true)
  }

  // Build breadcrumbs from current path
  const breadcrumbs = (() => {
    if (os === 'windows') {
      const parts = currentPath.split('\\').filter(Boolean)
      const crumbs = [{ label: 'Computer', path: 'C:\\' }]

      let accumulated = ''

      for (const part of parts) {
        accumulated += part + '\\'
        crumbs.push({ label: part, path: accumulated })
      }

      return crumbs
    }

    const parts = currentPath.split('/').filter(Boolean)
    const crumbs = [{ label: '/', path: '/' }]

    let accumulated = ''

    for (const part of parts) {
      accumulated += '/' + part
      crumbs.push({ label: part, path: accumulated })
    }

    return crumbs
  })()

  // Filter files by search
  const filteredFiles = search
    ? files.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : files

  // Sort: directories first, then alphabetically
  const sortedFiles = [...filteredFiles].sort((a, b) => {
    if (a.name === '..') return -1
    if (b.name === '..') return 1
    if (a.type === 'directory' && b.type !== 'directory') return -1
    if (a.type !== 'directory' && b.type === 'directory') return 1

    return a.name.localeCompare(b.name)
  })

  if (vmType !== 'qemu') {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <i className="ri-error-warning-line" style={{ fontSize: 40, color: '#f59e0b', marginBottom: 8 }} />
        <Typography variant="h6" color="text.secondary">
          File Explorer requires QEMU Guest Agent
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          This feature is only available for QEMU virtual machines with the guest agent installed and running.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ py: 2 }}>
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: 0 }}>
          {/* Toolbar */}
          <Box
            sx={{
              display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5,
              borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap',
            }}
          >
            <Tooltip title="Go up">
              <span>
                <IconButton
                  size="small"
                  onClick={navigateUp}
                  disabled={currentPath === '/' || loading}
                >
                  <i className="ri-arrow-up-line" style={{ fontSize: 18 }} />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={() => fetchFiles(currentPath)} disabled={loading}>
                <i className="ri-refresh-line" style={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Home">
              <IconButton size="small" onClick={() => navigateTo('/')} disabled={loading}>
                <i className="ri-home-line" style={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>

            <Box sx={{ flex: 1, mx: 1 }}>
              <Breadcrumbs maxItems={6} separator="›" sx={{ fontSize: 13 }}>
                {breadcrumbs.map((bc, i) => (
                  i === breadcrumbs.length - 1 ? (
                    <Typography key={bc.path} variant="body2" fontWeight={600} sx={{ fontSize: 13 }}>
                      {bc.label}
                    </Typography>
                  ) : (
                    <Link
                      key={bc.path}
                      component="button"
                      variant="body2"
                      underline="hover"
                      onClick={() => navigateTo(bc.path)}
                      sx={{ fontSize: 13, cursor: 'pointer' }}
                    >
                      {bc.label}
                    </Link>
                  )
                ))}
              </Breadcrumbs>
            </Box>

            <TextField
              size="small"
              placeholder="Filter files..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              sx={{ width: 180, '& .MuiInputBase-root': { height: 32, fontSize: 12 } }}
              InputProps={{
                startAdornment: <i className="ri-search-line" style={{ fontSize: 14, marginRight: 4, opacity: 0.5 }} />,
              }}
            />

            <Button
              size="small"
              variant="outlined"
              startIcon={<i className="ri-upload-2-line" style={{ fontSize: 14 }} />}
              onClick={openUploadDialog}
              disabled={loading}
              sx={{ fontSize: 12, textTransform: 'none' }}
            >
              Upload
            </Button>
          </Box>

          {/* Loading */}
          {loading && <LinearProgress />}

          {/* Error */}
          {error && (
            <Alert severity="error" sx={{ m: 2, borderRadius: 1 }}>
              {error}
            </Alert>
          )}

          {/* File table */}
          {!error && (
            <TableContainer sx={{ maxHeight: 600 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, py: 1 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, py: 1, width: 100 }}>Size</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, py: 1, width: 100 }}>Permissions</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, py: 1, width: 120 }}>Owner</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, py: 1, width: 140 }}>Modified</TableCell>
                    <TableCell sx={{ fontWeight: 700, fontSize: 11, py: 1, width: 100 }} align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedFiles.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                        {search ? 'No files match your filter' : 'Empty directory'}
                      </TableCell>
                    </TableRow>
                  )}
                  {sortedFiles.map(entry => (
                    <TableRow
                      key={entry.name}
                      hover
                      sx={{
                        cursor: entry.type === 'directory' ? 'pointer' : 'default',
                        '&:hover': { bgcolor: 'action.hover' },
                      }}
                      onDoubleClick={() => handleFileClick(entry)}
                    >
                      <TableCell sx={{ py: 0.75 }}>
                        <Box
                          sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: entry.type === 'directory' ? 'pointer' : 'default' }}
                          onClick={() => entry.type === 'directory' && handleFileClick(entry)}
                        >
                          <i
                            className={getFileIcon(entry)}
                            style={{ fontSize: 18, color: getFileIconColor(entry), flexShrink: 0 }}
                          />
                          <Typography variant="body2" sx={{ fontSize: 12, fontWeight: entry.type === 'directory' ? 600 : 400 }}>
                            {entry.name}
                          </Typography>
                          {entry.type === 'symlink' && entry.linkTarget && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>
                              → {entry.linkTarget}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ py: 0.75 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                          {entry.type === 'directory' ? '—' : formatFileSize(entry.size)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 0.75 }}>
                        {entry.permissions && (
                          <Typography
                            variant="caption"
                            sx={{ fontSize: 10, fontFamily: 'monospace', color: 'text.secondary' }}
                          >
                            {entry.permissions}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ py: 0.75 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                          {entry.owner ? `${entry.owner}:${entry.group || ''}` : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 0.75 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                          {entry.modified || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ py: 0.75 }} align="right">
                        {entry.type !== 'directory' && (
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                            {isPreviewable(entry.name) && (
                              <Tooltip title="Preview">
                                <IconButton size="small" onClick={() => handlePreview(entry)}>
                                  <i className="ri-eye-line" style={{ fontSize: 14 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Download">
                              <IconButton size="small" onClick={() => handleDownload(entry)}>
                                <i className="ri-download-line" style={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Footer */}
          <Box sx={{ px: 2, py: 1, borderTop: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="caption" color="text.secondary">
              {sortedFiles.length} items {search && `(filtered from ${files.length})`}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={os === 'windows' ? 'Windows' : 'Linux'}
                size="small"
                icon={<i className={os === 'windows' ? 'ri-windows-fill' : 'ri-terminal-box-line'} style={{ fontSize: 12 }} />}
                sx={{ height: 22, fontSize: 10 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: 11 }}>
                {currentPath}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 14 }}>
          <i className="ri-file-text-line" style={{ fontSize: 18 }} />
          {previewPath.split('/').pop() || previewPath.split('\\').pop()}
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', fontFamily: 'monospace', fontSize: 11 }}>
            {previewPath}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          {previewLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <TextField
              multiline
              fullWidth
              value={previewContent}
              InputProps={{ readOnly: true }}
              sx={{
                '& .MuiInputBase-root': {
                  fontFamily: '"Cascadia Code", "Fira Code", monospace',
                  fontSize: 12,
                  lineHeight: 1.6,
                },
              }}
              minRows={10}
              maxRows={30}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
          <Button
            variant="outlined"
            startIcon={<i className="ri-download-line" style={{ fontSize: 14 }} />}
            onClick={() => {
              const url = `${basePath}/download?path=${encodeURIComponent(previewPath)}&mode=download`
              const a = document.createElement('a')
              a.href = url
              a.download = previewPath.split('/').pop() || 'file'
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
            }}
          >
            Download
          </Button>
        </DialogActions>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 14 }}>
          <i className="ri-upload-2-line" style={{ fontSize: 18 }} />
          Upload File
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              size="small"
              label="Destination Path"
              value={uploadPath}
              onChange={e => setUploadPath(e.target.value)}
              fullWidth
              helperText="Full path on the VM where the file will be saved"
              sx={{ '& .MuiInputBase-root': { fontFamily: 'monospace', fontSize: 13 } }}
            />

            <Box
              sx={{
                border: '2px dashed',
                borderColor: uploadFile ? 'primary.main' : 'divider',
                borderRadius: 2,
                p: 3,
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
                '&:hover': { borderColor: 'primary.main' },
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file) {
                    setUploadFile(file)
                    // Auto-fill path if only directory was specified
                    const sep = os === 'windows' ? '\\' : '/'
                    if (uploadPath.endsWith(sep) || uploadPath === '') {
                      setUploadPath((uploadPath || currentPath + sep) + file.name)
                    }
                  }
                }}
              />
              {uploadFile ? (
                <Box>
                  <i className="ri-file-check-line" style={{ fontSize: 32, color: '#22c55e' }} />
                  <Typography variant="body2" fontWeight={600} sx={{ mt: 1 }}>
                    {uploadFile.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatFileSize(uploadFile.size)}
                  </Typography>
                </Box>
              ) : (
                <Box>
                  <i className="ri-upload-cloud-line" style={{ fontSize: 32, color: '#6b7280' }} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Click to select a file
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Max 48 MB (QEMU Guest Agent limit)
                  </Typography>
                </Box>
              )}
            </Box>

            {uploadError && (
              <Alert severity="error">{uploadError}</Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={!uploadFile || !uploadPath || uploading}
            startIcon={uploading ? <CircularProgress size={14} /> : <i className="ri-upload-2-line" style={{ fontSize: 14 }} />}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
