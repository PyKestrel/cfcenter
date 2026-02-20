'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'motion/react'
import {
  Alert,
  Box,
  Button,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
  CircularProgress,
  alpha,
  useTheme,
} from '@mui/material'
import LoginBackground from '@components/LoginBackground'

// Inline CFCenter crosshair logo (standalone, no nav dependencies)
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

// Stagger animation variants
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

// Password strength indicator
function PasswordStrength({ password }) {
  if (!password) return null

  let strength = 0
  if (password.length >= 8) strength++
  if (password.length >= 12) strength++
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++
  if (/[0-9]/.test(password)) strength++
  if (/[^A-Za-z0-9]/.test(password)) strength++

  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981']
  const labels = ['Weak', 'Fair', 'Good', 'Strong', 'Excellent']
  const idx = Math.min(strength, 4)

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      transition={{ duration: 0.3 }}
    >
      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, mb: 1 }}>
        {[0, 1, 2, 3, 4].map(i => (
          <Box
            key={i}
            sx={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              bgcolor: i <= idx ? colors[idx] : 'rgba(255,255,255,0.1)',
              transition: 'background-color 0.3s ease',
            }}
          />
        ))}
      </Box>
      <Typography variant='caption' sx={{ color: colors[idx], fontSize: '0.7rem' }}>
        {labels[idx]}
      </Typography>
    </motion.div>
  )
}

export default function SetupPage() {
  const router = useRouter()
  const t = useTranslations()
  const theme = useTheme()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [setupRequired, setSetupRequired] = useState(false)
  const [isPasswordShown, setIsPasswordShown] = useState(false)

  // Form
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [name, setName] = useState('')

  const accentColor = theme.palette.primary.main || '#f6821f'

  useEffect(() => {
    // Vérifier si le setup est nécessaire
    fetch('/api/v1/auth/setup')
      .then(res => res.json())
      .then(data => {
        setSetupRequired(data.setupRequired)

        if (!data.setupRequired) {
          // Rediriger vers login si déjà configuré
          router.push('/login')
        }
      })
      .catch(() => setSetupRequired(true))
      .finally(() => setLoading(false))
  }, [router])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Validation
    if (password !== confirmPassword) {
      setError(t('setup.passwordMismatch'))
      return
    }

    if (password.length < 8) {
      setError(t('setup.passwordMinLength'))
      return
    }

    setSubmitting(true)

    try {
      const res = await fetch('/api/v1/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || t('setup.creationError'))
        return
      }

      setSuccess(true)
      setTimeout(() => router.push('/login'), 2000)
    } catch (err) {
      setError(t('setup.serverError'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
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

  if (!setupRequired) {
    return null
  }

  return (
    <LoginBackground>
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{ width: '100%', maxWidth: 480 }}
      >
        <Box
          sx={{
            width: '100%',
            bgcolor: alpha(theme.palette.background.paper, 0.85),
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderRadius: 3,
            p: 4,
            boxShadow: `0 16px 48px ${alpha('#000', 0.35)}, 0 0 0 1px ${alpha('#fff', 0.05)}`,
            border: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
          }}
        >
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {/* Logo + Brand */}
            <motion.div variants={staggerItem}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3, gap: 1.5 }}>
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

            {/* Step indicator */}
            <motion.div variants={staggerItem}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 3 }}>
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    bgcolor: accentColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#fff',
                  }}
                >
                  1
                </Box>
                <Typography variant='body2' sx={{ fontWeight: 600 }}>
                  {t('setup.title')}
                </Typography>
              </Box>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Typography variant='body2' sx={{ opacity: 0.5, textAlign: 'center', mb: 3 }}>
                {t('setup.subtitle')}
              </Typography>
            </motion.div>

            {/* Success */}
            <AnimatePresence>
              {success && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                >
                  <Box sx={{ textAlign: 'center', py: 3 }}>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.2 }}
                    >
                      <Box
                        sx={{
                          width: 64,
                          height: 64,
                          borderRadius: '50%',
                          bgcolor: alpha('#22c55e', 0.15),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          mx: 'auto',
                          mb: 2,
                        }}
                      >
                        <i className='ri-check-line' style={{ fontSize: 32, color: '#22c55e' }} />
                      </Box>
                    </motion.div>
                    <Typography variant='h6' sx={{ fontWeight: 600, mb: 1 }}>
                      {t('setup.successMessage')}
                    </Typography>
                    <Typography variant='body2' sx={{ opacity: 0.5 }}>
                      Redirecting to login...
                    </Typography>
                  </Box>
                </motion.div>
              )}
            </AnimatePresence>

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
            {!success && (
              <form onSubmit={handleSubmit}>
                <motion.div variants={staggerItem}>
                  <TextField
                    fullWidth
                    label={t('setup.nameLabel')}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    sx={{ mb: 2 }}
                    placeholder={t('setup.namePlaceholder')}
                  />
                </motion.div>

                <motion.div variants={staggerItem}>
                  <TextField
                    fullWidth
                    label={t('setup.emailLabel')}
                    type='email'
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    sx={{ mb: 2 }}
                    required
                    autoFocus
                    placeholder='admin@example.com'
                  />
                </motion.div>

                <motion.div variants={staggerItem}>
                  <TextField
                    fullWidth
                    label={t('setup.passwordLabel')}
                    type={isPasswordShown ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    sx={{ mb: 0.5 }}
                    required
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position='end'>
                          <IconButton
                            size='small'
                            edge='end'
                            onClick={() => setIsPasswordShown(!isPasswordShown)}
                          >
                            <i className={isPasswordShown ? 'ri-eye-off-line' : 'ri-eye-line'} />
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <PasswordStrength password={password} />
                </motion.div>

                <motion.div variants={staggerItem}>
                  <TextField
                    fullWidth
                    label={t('setup.confirmPasswordLabel')}
                    type={isPasswordShown ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    sx={{ mb: 3, mt: 1 }}
                    required
                    error={confirmPassword !== '' && password !== confirmPassword}
                    helperText={
                      confirmPassword !== '' && password !== confirmPassword
                        ? t('setup.passwordMismatch')
                        : ''
                    }
                  />
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
                      disabled={submitting}
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
                      {submitting ? (
                        <CircularProgress size={22} sx={{ color: 'inherit' }} />
                      ) : (
                        t('setup.createAccount')
                      )}
                    </Button>
                  </motion.div>
                </motion.div>
              </form>
            )}

            {/* Info */}
            <motion.div variants={staggerItem}>
              <Alert
                severity='info'
                sx={{
                  mt: 3,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.info.main, 0.08),
                  '& .MuiAlert-icon': { opacity: 0.7 },
                }}
              >
                {t('setup.adminRightsInfo')}
              </Alert>
            </motion.div>
          </motion.div>
        </Box>
      </motion.div>
    </LoginBackground>
  )
}
