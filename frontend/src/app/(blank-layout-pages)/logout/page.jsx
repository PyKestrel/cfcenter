'use client'

import { useEffect } from 'react'
import { signOut } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { motion } from 'motion/react'
import { Box, CircularProgress, Typography, useTheme } from '@mui/material'
import LoginBackground from '@components/LoginBackground'

export default function LogoutPage() {
  const t = useTranslations()
  const theme = useTheme()
  const accentColor = theme.palette.primary.main || '#f6821f'

  useEffect(() => {
    // Auto logout and redirect to login
    signOut({ callbackUrl: '/login' })
  }, [])

  return (
    <LoginBackground>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <CircularProgress sx={{ color: accentColor }} size={36} thickness={3} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 0.7, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <Typography variant='body1' sx={{ color: 'rgba(255,255,255,0.7)' }}>
            {t('auth.loggingOut')}
          </Typography>
        </motion.div>
      </motion.div>
    </LoginBackground>
  )
}
