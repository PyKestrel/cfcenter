'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

import {
  Box, Typography, Button, Card, CardContent, Chip, Alert,
  TextField, MenuItem, LinearProgress, Tooltip, Divider,
  FormControlLabel, Switch,
} from '@mui/material'

export default function SoftwareUpdateTab() {
  const [updateInfo, setUpdateInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedBranch, setSelectedBranch] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [polling, setPolling] = useState(false)
  const logsEndRef = useRef(null)
  const pollRef = useRef(null)

  // Fetch update status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/version/update')

      if (!res.ok) throw new Error('Failed to fetch update status')

      const data = await res.json()

      setUpdateInfo(data)

      if (!selectedBranch && data.currentBranch) {
        setSelectedBranch(data.currentBranch)
      }

      return data
    } catch (e) {
      setError(e.message)

      return null
    } finally {
      setLoading(false)
    }
  }, [selectedBranch])

  // Initial load
  useEffect(() => {
    fetchStatus()
  }, [])

  // Poll while update is in progress
  useEffect(() => {
    const state = updateInfo?.state

    if (state && !['idle', 'completed', 'error'].includes(state.status)) {
      if (!polling) {
        setPolling(true)
        pollRef.current = setInterval(async () => {
          const data = await fetchStatus()

          if (data?.state && ['idle', 'completed', 'error'].includes(data.state.status)) {
            clearInterval(pollRef.current)
            setPolling(false)
          }
        }, 2000)
      }
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
      }
    }
  }, [updateInfo?.state?.status])

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [updateInfo?.state?.logs?.length])

  const handleStartUpdate = async () => {
    try {
      setError(null)

      const res = await fetch('/api/v1/version/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch: selectedBranch || 'main' }),
      })

      if (!res.ok) {
        const body = await res.json()

        throw new Error(body.error || 'Failed to start update')
      }

      // Start polling
      fetchStatus()
    } catch (e) {
      setError(e.message)
    }
  }

  const handleDismiss = async () => {
    try {
      await fetch('/api/v1/version/update', { method: 'DELETE' })
      await fetchStatus()
    } catch (e) {
      setError(e.message)
    }
  }

  if (loading) {
    return (
      <Box sx={{ py: 4, textAlign: 'center' }}>
        <LinearProgress sx={{ mb: 2 }} />
        <Typography color="text.secondary">Checking update status...</Typography>
      </Box>
    )
  }

  const state = updateInfo?.state || {}
  const isUpdating = state.status && !['idle', 'completed', 'error'].includes(state.status)
  const isCompleted = state.status === 'completed'
  const isError = state.status === 'error'
  const supported = updateInfo?.updateSupported

  const STATUS_COLORS = {
    idle: 'default',
    checking: 'info',
    pulling: 'info',
    building: 'warning',
    restarting: 'warning',
    completed: 'success',
    error: 'error',
  }

  const STATUS_LABELS = {
    idle: 'Ready',
    checking: 'Checking...',
    pulling: 'Pulling code...',
    building: 'Building image...',
    restarting: 'Restarting...',
    completed: 'Completed',
    error: 'Error',
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {isCompleted && (
        <Alert severity="success" sx={{ mb: 2 }} action={
          <Button color="inherit" size="small" onClick={handleDismiss}>Dismiss</Button>
        }>
          Update completed successfully! The application will restart momentarily.
          {state.newVersion && <> New version: <strong>{state.newVersion}</strong></>}
        </Alert>
      )}

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }} action={
          <Button color="inherit" size="small" onClick={handleDismiss}>Dismiss</Button>
        }>
          Update failed: {state.error}
        </Alert>
      )}

      {/* Current Version Info */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box sx={{ width: 48, height: 48, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#7c4dff18' }}>
              <i className="ri-information-line" style={{ fontSize: 24, color: '#7c4dff' }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" fontWeight={700}>CFCenter</Typography>
              <Typography variant="body2" color="text.secondary">
                Version {updateInfo?.currentVersion || '—'}
              </Typography>
            </Box>
            {state.status && state.status !== 'idle' && (
              <Chip
                label={STATUS_LABELS[state.status] || state.status}
                color={STATUS_COLORS[state.status] || 'default'}
                size="small"
                sx={{ fontWeight: 600 }}
              />
            )}
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>Current Branch</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {updateInfo?.currentBranch || '—'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>Container</Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                {updateInfo?.containerName || '—'}
              </Typography>
            </Box>
            {updateInfo?.lastCommit && (
              <>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Last Commit</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {updateInfo.lastCommit.hash}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Commit Message</Typography>
                  <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                    {updateInfo.lastCommit.message}
                  </Typography>
                </Box>
              </>
            )}
          </Box>

          {!supported && (
            <>
              <Divider sx={{ my: 2 }} />
              <Alert severity="warning" variant="outlined" sx={{ fontSize: 13 }}>
                <strong>GUI updates not available:</strong> {updateInfo?.unsupportedReason || 'Docker socket or repo not mounted.'}
                <br />
                <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                  To enable GUI updates, mount the Docker socket and repo directory when running the container.
                  You can still update via CLI: <code>sudo ./install.sh update</code>
                </Typography>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      {/* Update Controls */}
      {supported && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
              <i className="ri-download-2-line" style={{ marginRight: 8, verticalAlign: 'middle' }} />
              Software Update
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Button
                variant="contained"
                onClick={handleStartUpdate}
                disabled={isUpdating}
                startIcon={isUpdating ? undefined : <i className="ri-download-2-line" />}
                sx={{ minWidth: 180 }}
              >
                {isUpdating ? 'Updating...' : 'Update Now'}
              </Button>

              <FormControlLabel
                control={<Switch checked={showAdvanced} onChange={e => setShowAdvanced(e.target.checked)} size="small" />}
                label={<Typography variant="body2">Advanced options</Typography>}
              />
            </Box>

            {showAdvanced && (
              <Box sx={{ bgcolor: 'action.hover', borderRadius: 1, p: 2, mb: 2 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
                  Target Branch
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <TextField
                    select
                    size="small"
                    value={selectedBranch}
                    onChange={e => setSelectedBranch(e.target.value)}
                    sx={{ minWidth: 220 }}
                    label="Branch"
                  >
                    {(updateInfo?.availableBranches || ['main']).map(b => (
                      <MenuItem key={b} value={b}>
                        {b}
                        {b === updateInfo?.currentBranch && (
                          <Chip label="current" size="small" sx={{ ml: 1, height: 18, fontSize: 10 }} />
                        )}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Typography variant="caption" color="text.secondary">
                    Select a specific branch to pull from. Default is <code>main</code>.
                  </Typography>
                </Box>
                <Alert severity="info" variant="outlined" sx={{ mt: 2, fontSize: 12 }}>
                  <strong>Note:</strong> Switching branches will perform a hard reset to the selected branch.
                  Any local modifications will be discarded.
                </Alert>
              </Box>
            )}

            {/* Progress */}
            {isUpdating && (
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2" fontWeight={600}>{state.message || 'Updating...'}</Typography>
                  <Typography variant="body2" color="text.secondary">{state.progress || 0}%</Typography>
                </Box>
                <LinearProgress variant="determinate" value={state.progress || 0} sx={{ height: 8, borderRadius: 1 }} />
              </Box>
            )}

            {/* Logs */}
            {state.logs && state.logs.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
                  Update Log
                </Typography>
                <Box
                  sx={{
                    bgcolor: '#1a1a2e',
                    color: '#e0e0e0',
                    borderRadius: 1,
                    p: 2,
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: 11,
                    lineHeight: 1.7,
                    maxHeight: 300,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {state.logs.map((line, i) => (
                    <Box key={i} sx={{
                      color: line.includes('ERROR') ? '#ff5252' :
                             line.includes('successfully') || line.includes('OK') ? '#69f0ae' :
                             line.includes('Warning') ? '#ffd740' : '#e0e0e0'
                    }}>
                      {line}
                    </Box>
                  ))}
                  <div ref={logsEndRef} />
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* CLI Instructions */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
            <i className="ri-terminal-line" style={{ marginRight: 8, verticalAlign: 'middle' }} />
            CLI Update
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            You can also update from the command line on your server:
          </Typography>
          <Box
            sx={{
              bgcolor: '#1a1a2e',
              color: '#e0e0e0',
              borderRadius: 1,
              p: 2,
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 12,
              lineHeight: 2,
            }}
          >
            <Box sx={{ color: '#9e9e9e' }}># Update to latest (main branch)</Box>
            <Box>sudo {updateInfo?.repoDir || '/opt/cfcenter'}/install.sh update</Box>
            <Box sx={{ mt: 1, color: '#9e9e9e' }}># Update to a specific branch</Box>
            <Box>sudo {updateInfo?.repoDir || '/opt/cfcenter'}/install.sh update --branch dev</Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
