'use client'

import { useState, useEffect } from 'react'

import { useTranslations } from 'next-intl'
import { useSession } from 'next-auth/react'

import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material'

import { usePageTitle } from '@/contexts/PageTitleContext'


// Fonction pour obtenir les initiales
const getInitials = (name, email) => {
  if (name) {
    const parts = name.split(' ')

    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }

    
return name.substring(0, 2).toUpperCase()
  }

  if (email) {
    return email.substring(0, 2).toUpperCase()
  }

  
return 'U'
}

const useRoleConfig = () => {
  const t = useTranslations('user')

  
return (role) => {
    switch (role) {
      case 'admin': return { label: t('admin'), color: 'error', description: t('adminDesc') }
      case 'operator': return { label: t('operator'), color: 'warning', description: t('operatorDesc') }
      case 'viewer': return { label: t('viewer'), color: 'info', description: t('viewerDesc') }
      default: return { label: role, color: 'default', description: '' }
    }
  }
}

export default function ProfilePage() {
  const t = useTranslations()
  const getRoleConfig = useRoleConfig()
  const { data: session, update: updateSession } = useSession()

  const { setPageInfo } = usePageTitle()

  useEffect(() => {
    setPageInfo(t('profile.title'), t('settings.subtitle'), 'ri-user-line')
    
return () => setPageInfo('', '', '')
  }, [setPageInfo, t])
  const user = session?.user

  const [name, setName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileError, setProfileError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const roleConfig = getRoleConfig(user?.role)

  useEffect(() => {
    if (user?.name) {
      setName(user.name)
    }
  }, [user?.name])

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    setProfileError('')
    setProfileSuccess('')

    try {
      const res = await fetch(`/api/v1/users/${user?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })

      const data = await res.json()

      if (!res.ok) {
        setProfileError(data.error || t('settings.saveError'))
        
return
      }

      setProfileSuccess(t('profile.updated'))
      await updateSession({ name })
    } catch (e) {
      setProfileError(t('settings.connectionError'))
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async () => {
    setPasswordError('')
    setPasswordSuccess('')

    if (newPassword !== confirmPassword) {
      setPasswordError(t('profilePage.passwordsDoNotMatch'))

return
    }

    if (newPassword.length < 8) {
      setPasswordError(t('profilePage.passwordMinLength'))

return
    }

    setSavingPassword(true)

    try {
      const res = await fetch(`/api/v1/users/${user?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      })

      const data = await res.json()

      if (!res.ok) {
        setPasswordError(data.error || t('common.error'))
        
return
      }

      setPasswordSuccess(t('common.success'))
      setNewPassword('')
      setConfirmPassword('')
    } catch (e) {
      setPasswordError(t('settings.connectionError'))
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Carte principale avec avatar et infos */}
      <Card variant='outlined'>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
            {/* Avatar et infos de base */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 220 }}>
              <Avatar
                src={user?.avatar || undefined}
                sx={{ 
                  width: 120, 
                  height: 120, 
                  fontSize: '2.5rem', 
                  fontWeight: 700,
                  bgcolor: 'primary.main',
                  mb: 2,
                }}
              >
                {!user?.avatar && getInitials(user?.name, user?.email)}
              </Avatar>
              <Chip 
                label={roleConfig.label} 
                color={roleConfig.color}
                sx={{ mb: 1 }}
              />
              <Typography variant='caption' sx={{ opacity: 0.5, textAlign: 'center' }}>
                {roleConfig.description}
              </Typography>
            </Box>

            {/* Détails du compte */}
            <Box sx={{ flex: 1, minWidth: 400 }}>
              <Typography variant='h6' sx={{ fontWeight: 600, mb: 2 }}>
                {t('profile.personalInfo')}
              </Typography>
              
              <Box sx={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 1.5, mb: 3 }}>
                <Typography variant='body2' sx={{ opacity: 0.6 }}>Email</Typography>
                <Typography variant='body2' sx={{ fontWeight: 500 }}>{user?.email}</Typography>

                <Typography variant='body2' sx={{ opacity: 0.6 }}>{t('common.name')}</Typography>
                <Typography variant='body2' sx={{ fontWeight: 500 }}>{user?.name || '—'}</Typography>

                <Typography variant='body2' sx={{ opacity: 0.6 }}>{t('auth.loginMethod')}</Typography>
                <Typography variant='body2' sx={{ fontWeight: 500 }}>
                  {user?.authProvider === 'ldap' ? t('auth.ldapAd') : t('auth.localAccount')}
                </Typography>

                <Typography variant='body2' sx={{ opacity: 0.6 }}>ID</Typography>
                <Typography variant='body2' sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {user?.id}
                </Typography>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Formulaires côte à côte */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
        {/* Informations personnelles */}
        <Card variant='outlined'>
          <CardContent sx={{ p: 3 }}>
            <Typography variant='h6' sx={{ fontWeight: 600, mb: 3 }}>
              {t('common.edit')} {t('profile.title').toLowerCase()}
            </Typography>

            {profileError && <Alert severity='error' sx={{ mb: 2 }}>{profileError}</Alert>}
            {profileSuccess && <Alert severity='success' sx={{ mb: 2 }}>{profileSuccess}</Alert>}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                fullWidth
                label='Email'
                value={user?.email || ''}
                disabled
                size='small'
              />
              <TextField
                fullWidth
                label={t('profilePage.fullName')}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={t('profilePage.fullNamePlaceholder')}
                size='small'
              />
              <Button
                variant='contained'
                onClick={handleSaveProfile}
                disabled={savingProfile}
                fullWidth
              >
                {savingProfile ? t('common.saving') : t('settings.saveChanges')}
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Changement de mot de passe */}
        {user?.authProvider !== 'ldap' ? (
          <Card variant='outlined'>
            <CardContent sx={{ p: 3 }}>
              <Typography variant='h6' sx={{ fontWeight: 600, mb: 3 }}>
                {t('profile.changePassword')}
              </Typography>

              {passwordError && <Alert severity='error' sx={{ mb: 2 }}>{passwordError}</Alert>}
              {passwordSuccess && <Alert severity='success' sx={{ mb: 2 }}>{passwordSuccess}</Alert>}

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  fullWidth
                  label={t('profilePage.newPassword')}
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  size='small'
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position='end'>
                        <IconButton size='small' onClick={() => setShowNewPassword(!showNewPassword)}>
                          <i className={showNewPassword ? 'ri-eye-off-line' : 'ri-eye-line'} />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  fullWidth
                  label={t('profilePage.confirmPassword')}
                  type='password'
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  error={!!(confirmPassword && newPassword !== confirmPassword)}
                  helperText={confirmPassword && newPassword !== confirmPassword ? t('profilePage.passwordsDoNotMatch') : t('profilePage.minChars')}
                  size='small'
                />
                <Button
                  variant='contained'
                  color='warning'
                  onClick={handleChangePassword}
                  disabled={savingPassword || !newPassword || !confirmPassword}
                  fullWidth
                >
                  {savingPassword ? t('common.saving') : t('profile.changePassword')}
                </Button>
              </Box>
            </CardContent>
          </Card>
        ) : (
          <Card variant='outlined'>
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
              <Alert severity='info'>
                <Typography variant='body2' dangerouslySetInnerHTML={{ __html: t('profilePage.ldapAccountNotice') }} />
                <Typography variant='body2' sx={{ mt: 1 }}>
                  {t('profilePage.ldapPasswordChangeNotice')}
                </Typography>
              </Alert>
            </CardContent>
          </Card>
        )}
      </Box>

      {/* Two-Factor Authentication */}
      {user?.authProvider !== 'ldap' && <TwoFactorSection />}
    </Box>
  )
}

// ============================================
// Two-Factor Authentication Section
// ============================================

function TwoFactorSection() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [enrollData, setEnrollData] = useState(null)
  const [totpCode, setTotpCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [recoveryCodes, setRecoveryCodes] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Fetch current 2FA status
  useEffect(() => {
    fetch('/api/v1/auth/totp/setup')
      .then(r => r.json())
      .then(data => { setStatus(data.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleBeginSetup = async () => {
    setEnrolling(true)
    setError('')
    try {
      const res = await fetch('/api/v1/auth/totp/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setEnrollData(data.data)
    } catch (e) {
      setError(e.message)
    } finally {
      setEnrolling(false)
    }
  }

  const handleVerify = async () => {
    setVerifying(true)
    setError('')
    try {
      const res = await fetch('/api/v1/auth/totp/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: totpCode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Verification failed')
      setRecoveryCodes(data.data.recovery_codes)
      setSuccess('Two-factor authentication enabled!')
      setEnrollData(null)
      setStatus({ ...status, enabled: true })
    } catch (e) {
      setError(e.message)
    } finally {
      setVerifying(false)
    }
  }

  const handleDisable = async () => {
    if (!confirm('Disable two-factor authentication? You will no longer need a code to sign in.')) return
    setError('')
    try {
      const res = await fetch('/api/v1/auth/totp/setup', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to disable 2FA')
      setStatus({ enabled: false, verified: false, enabled_at: null, recovery_codes_remaining: 0 })
      setSuccess('Two-factor authentication disabled.')
      setRecoveryCodes(null)
      setEnrollData(null)
    } catch (e) {
      setError(e.message)
    }
  }

  if (loading) return null

  return (
    <Card variant='outlined'>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Box sx={{
            width: 40, height: 40, borderRadius: 1.5,
            background: status?.enabled ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i className='ri-shield-keyhole-line' style={{ fontSize: 20, color: 'white' }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant='h6' fontWeight={600}>Two-Factor Authentication</Typography>
            <Typography variant='caption' sx={{ opacity: 0.5 }}>
              {status?.enabled ? 'Enabled' : 'Not enabled'}{status?.enabled && status?.recovery_codes_remaining > 0 ? ` • ${status.recovery_codes_remaining} recovery codes remaining` : ''}
            </Typography>
          </Box>
          {status?.enabled && (
            <Button variant='outlined' color='error' size='small' onClick={handleDisable}>
              Disable 2FA
            </Button>
          )}
        </Box>

        {error && <Alert severity='error' sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity='success' sx={{ mb: 2 }}>{success}</Alert>}

        {/* Recovery codes display (shown once after enrollment) */}
        {recoveryCodes && (
          <Alert severity='warning' sx={{ mb: 2 }}>
            <Typography variant='subtitle2' fontWeight={700} sx={{ mb: 1 }}>
              Save your recovery codes!
            </Typography>
            <Typography variant='body2' sx={{ mb: 1.5 }}>
              These codes can be used to access your account if you lose your authenticator device. Each code can only be used once. Store them in a safe place.
            </Typography>
            <Box sx={{
              display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0.5,
              p: 1.5, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.05)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem',
            }}>
              {recoveryCodes.map((code, i) => (
                <Typography key={i} variant='body2' fontFamily='inherit'>{code}</Typography>
              ))}
            </Box>
            <Button
              size='small' sx={{ mt: 1.5 }}
              onClick={() => {
                navigator.clipboard.writeText(recoveryCodes.join('\n'))
                setSuccess('Recovery codes copied to clipboard!')
              }}
              startIcon={<i className='ri-file-copy-line' />}
            >
              Copy to clipboard
            </Button>
          </Alert>
        )}

        {/* Not enabled — show setup button */}
        {!status?.enabled && !enrollData && (
          <Button
            variant='contained'
            onClick={handleBeginSetup}
            disabled={enrolling}
            startIcon={<i className='ri-shield-keyhole-line' />}
          >
            {enrolling ? 'Setting up...' : 'Enable Two-Factor Authentication'}
          </Button>
        )}

        {/* Enrollment in progress — show QR code and verification */}
        {enrollData && (
          <Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant='subtitle2' fontWeight={600} sx={{ mb: 1 }}>
              Step 1: Scan this QR code with your authenticator app
            </Typography>
            <Typography variant='body2' sx={{ opacity: 0.6, mb: 2 }}>
              Use Google Authenticator, Authy, 1Password, or any TOTP-compatible app.
            </Typography>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 3 }}>
              {enrollData.qr_code && (
                <Box sx={{ p: 1, bgcolor: 'white', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                  <img src={enrollData.qr_code} alt='QR Code' width={200} height={200} />
                </Box>
              )}
              <Box>
                <Typography variant='caption' sx={{ opacity: 0.5, display: 'block', mb: 0.5 }}>
                  Or enter this key manually:
                </Typography>
                <Typography
                  variant='body2'
                  sx={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', p: 1, borderRadius: 1, bgcolor: 'action.hover', wordBreak: 'break-all', maxWidth: 280 }}
                >
                  {enrollData.secret}
                </Typography>
              </Box>
            </Box>

            <Typography variant='subtitle2' fontWeight={600} sx={{ mb: 1 }}>
              Step 2: Enter the code from your authenticator app
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <TextField
                label='6-digit code'
                value={totpCode}
                onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                size='small'
                placeholder='000000'
                inputProps={{ maxLength: 6, inputMode: 'numeric', style: { letterSpacing: '0.3em', fontFamily: 'JetBrains Mono, monospace', textAlign: 'center' } }}
                sx={{ width: 180 }}
              />
              <Button variant='contained' onClick={handleVerify} disabled={verifying || totpCode.length !== 6}>
                {verifying ? 'Verifying...' : 'Verify & Enable'}
              </Button>
              <Button variant='outlined' onClick={() => { setEnrollData(null); setTotpCode('') }}>
                Cancel
              </Button>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
