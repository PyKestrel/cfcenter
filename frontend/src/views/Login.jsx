'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'motion/react'
import {
  Alert, Box, Button, Checkbox, CircularProgress, Divider, FormControl, FormControlLabel,
  IconButton, InputAdornment, InputLabel, MenuItem, Select, TextField, Typography, alpha, useTheme
} from '@mui/material'
import LoginBackground from '@components/LoginBackground'

// Inline CFCenter crosshair logo for login page (standalone, no nav dependencies)
function CFCenterLogo({ size = 48, accentColor = '#f6821f' }) {
  return (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
    >
      <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="100" r="38" fill={accentColor} />
        <rect x="85" y="12" width="30" height="38" rx="6" fill={accentColor} opacity="0.85" />
        <rect x="85" y="150" width="30" height="38" rx="6" fill={accentColor} opacity="0.85" />
        <rect x="12" y="85" width="38" height="30" rx="6" fill={accentColor} opacity="0.85" />
        <rect x="150" y="85" width="38" height="30" rx="6" fill={accentColor} opacity="0.85" />
      </svg>
    </motion.div>
  )
}

// Stagger container for form fields
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.3 },
  },
}

const staggerItem = {
  hidden: { opacity: 0, y: 20, filter: 'blur(4px)' },
  show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.4, ease: 'easeOut' } },
}

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'
  const errorParam = searchParams.get('error')
  const t = useTranslations()
  const theme = useTheme()

  const [authMethod, setAuthMethod] = useState('local')
  const [isPasswordShown, setIsPasswordShown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingSetup, setCheckingSetup] = useState(true)
  const [error, setError] = useState('')
  const [ldapEnabled, setLdapEnabled] = useState(false)
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [totpRequired, setTotpRequired] = useState(false)
  const [totpCode, setTotpCode] = useState('')

  // Vérifier si le setup initial est requis
  useEffect(() => {
    fetch('/api/v1/app/status')
      .then(res => res.json())
      .then(data => {
        if (data.setupRequired) {
          router.push('/setup')
        } else {
          setCheckingSetup(false)
        }
      })
      .catch(() => setCheckingSetup(false))
  }, [router])

  useEffect(() => {
    fetch('/api/v1/auth/providers')
      .then(res => res.json())
      .then(data => setLdapEnabled(data.ldapEnabled || false))
      .catch(() => {})
    if (errorParam) setError(decodeURIComponent(errorParam))
  }, [errorParam])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = authMethod === 'local'
        ? await signIn('credentials', { email, password, totp_code: totpCode || '', redirect: false, callbackUrl })
        : await signIn('ldap', { username, password, redirect: false, callbackUrl })
      if (result?.error) {
        if (result.error === 'TOTP_REQUIRED' || result.error.includes('TOTP_REQUIRED')) {
          setTotpRequired(true)
          setError('')
        } else {
          setError(result.error)
        }
      }
      else if (result?.ok) { router.push(callbackUrl); router.refresh() }
    } catch { setError(t('auth.loginError')) }
    finally { setLoading(false) }
  }

  const accentColor = theme.palette.primary.main || '#f6821f'

  // Afficher un loader pendant la vérification du setup
  if (checkingSetup) {
    return (
      <LoginBackground>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}
        >
          <CircularProgress sx={{ color: accentColor }} />
        </motion.div>
      </LoginBackground>
    )
  }

  return (
    <LoginBackground>
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{ width: '100%', maxWidth: 440 }}
      >
        <Box sx={{
          width: '100%',
          bgcolor: alpha(theme.palette.background.paper, 0.85),
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: 3,
          p: 4,
          boxShadow: `0 16px 48px ${alpha('#000', 0.35)}, 0 0 0 1px ${alpha('#fff', 0.05)}`,
          border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        }}>
          {/* Logo + Brand */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            <motion.div variants={staggerItem}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4, gap: 1.5 }}>
                <CFCenterLogo size={52} accentColor={accentColor} />
                <Typography
                  variant='h6'
                  sx={{
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'text.primary',
                  }}
                >
                  CFCenter
                </Typography>
              </Box>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Typography variant='h5' sx={{ fontWeight: 700, textAlign: 'center', mb: 0.5 }}>
                {t('auth.welcomeTitle')}
              </Typography>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Typography variant='body2' sx={{ opacity: 0.5, textAlign: 'center', mb: 3 }}>
                {t('auth.loginSubtitle')}
              </Typography>
            </motion.div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                  animate={{ opacity: 1, height: 'auto', marginBottom: 16 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Alert severity='error' sx={{ borderRadius: 2 }}>{error}</Alert>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleLogin}>
              {ldapEnabled && (
                <motion.div variants={staggerItem}>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>{t('auth.loginMethod')}</InputLabel>
                    <Select value={authMethod} label={t('auth.loginMethod')} onChange={e => setAuthMethod(e.target.value)}>
                      <MenuItem value='local'>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <i className='ri-user-line' />{t('auth.localAccount')}
                        </Box>
                      </MenuItem>
                      <MenuItem value='ldap'>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <i className='ri-server-line' />{t('auth.ldapAd')}
                        </Box>
                      </MenuItem>
                    </Select>
                  </FormControl>
                </motion.div>
              )}

              <motion.div variants={staggerItem}>
                {authMethod === 'local' ? (
                  <TextField fullWidth label='Email' type='email' value={email} onChange={e => setEmail(e.target.value)} sx={{ mb: 2 }} autoFocus required />
                ) : (
                  <TextField fullWidth label={t('auth.username')} value={username} onChange={e => setUsername(e.target.value)} sx={{ mb: 2 }} autoFocus required placeholder={t('auth.usernamePlaceholder')} />
                )}
              </motion.div>

              <motion.div variants={staggerItem}>
                <TextField
                  fullWidth
                  label={t('auth.password')}
                  type={isPasswordShown ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  sx={{ mb: 2 }}
                  required
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position='end'>
                        <IconButton size='small' edge='end' onClick={() => setIsPasswordShown(!isPasswordShown)}>
                          <i className={isPasswordShown ? 'ri-eye-off-line' : 'ri-eye-line'} />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </motion.div>

              {/* 2FA TOTP input — shown when server requires it */}
              <AnimatePresence>
                {totpRequired && authMethod === 'local' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Alert severity='info' sx={{ mb: 2, borderRadius: 2 }}>
                      <Typography variant='body2'>
                        Enter the 6-digit code from your authenticator app, or a recovery code.
                      </Typography>
                    </Alert>
                    <TextField
                      fullWidth
                      label='2FA Code'
                      value={totpCode}
                      onChange={e => setTotpCode(e.target.value.replace(/\s/g, ''))}
                      sx={{ mb: 2 }}
                      required
                      autoFocus
                      placeholder='000000'
                      inputProps={{ maxLength: 19, autoComplete: 'one-time-code', inputMode: 'numeric', style: { letterSpacing: '0.2em', fontFamily: 'JetBrains Mono, monospace', textAlign: 'center', fontSize: '1.1rem' } }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div variants={staggerItem}>
                {authMethod === 'local' ? (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <FormControlLabel
                      control={<Checkbox checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} size='small' />}
                      label={<Typography variant='body2'>{t('auth.rememberMe')}</Typography>}
                    />
                    <Typography variant='body2' color='primary' sx={{ cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }} onClick={() => alert(t('common.comingSoon'))}>
                      {t('auth.forgotPassword')}
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ mb: 3 }} />
                )}
              </motion.div>

              <motion.div variants={staggerItem}>
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  <Button
                    fullWidth
                    variant='contained'
                    type='submit'
                    disabled={loading}
                    sx={{
                      py: 1.5,
                      fontWeight: 600,
                      fontSize: '0.95rem',
                      borderRadius: 2,
                      textTransform: 'none',
                      boxShadow: `0 4px 14px ${alpha(accentColor, 0.4)}`,
                      '&:hover': {
                        boxShadow: `0 6px 20px ${alpha(accentColor, 0.5)}`,
                      },
                    }}
                  >
                    {loading ? (
                      <CircularProgress size={22} sx={{ color: 'inherit' }} />
                    ) : (
                      t('auth.login')
                    )}
                  </Button>
                </motion.div>
              </motion.div>
            </form>

            <motion.div variants={staggerItem}>
              <Divider sx={{ my: 3, opacity: 0.3 }} />
              <Typography variant='caption' sx={{ display: 'block', textAlign: 'center', opacity: 0.35 }}>
                CFCenter — {t('auth.appSubtitle')}
              </Typography>
            </motion.div>
          </motion.div>
        </Box>
      </motion.div>
    </LoginBackground>
  )
}
