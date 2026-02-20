'use client'

import { useMemo } from 'react'
import { Box } from '@mui/material'
import { motion } from 'motion/react'

// Floating orb component
function FloatingOrb({ size, x, y, color, delay, duration }) {
  return (
    <motion.div
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        left: `${x}%`,
        top: `${y}%`,
        filter: 'blur(40px)',
        pointerEvents: 'none',
      }}
      animate={{
        x: [0, 30, -20, 10, 0],
        y: [0, -25, 15, -10, 0],
        scale: [1, 1.2, 0.9, 1.1, 1],
        opacity: [0.3, 0.5, 0.25, 0.45, 0.3],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  )
}

// Grid overlay for tech feel
function GridOverlay() {
  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
        pointerEvents: 'none',
      }}
    />
  )
}

const ORB_CONFIGS = [
  { size: 300, x: 15, y: 20, color: 'rgba(246,130,31,0.35)', delay: 0, duration: 20 },
  { size: 250, x: 70, y: 60, color: 'rgba(246,130,31,0.2)', delay: 2, duration: 25 },
  { size: 200, x: 80, y: 15, color: 'rgba(59,130,246,0.2)', delay: 4, duration: 22 },
  { size: 350, x: 30, y: 75, color: 'rgba(59,130,246,0.15)', delay: 1, duration: 28 },
  { size: 180, x: 55, y: 40, color: 'rgba(168,85,247,0.15)', delay: 3, duration: 18 },
]

export default function LoginBackground({ children }) {
  const orbs = useMemo(() => ORB_CONFIGS, [])

  return (
    <Box sx={{ position: 'fixed', inset: 0, overflow: 'hidden' }}>
      {/* Base gradient */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, #0a0a12 0%, #0d1117 25%, #111827 50%, #0f172a 75%, #0a0a12 100%)',
        }}
        animate={{
          backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
      />

      {/* Floating orbs */}
      {orbs.map((orb, i) => (
        <FloatingOrb key={i} {...orb} />
      ))}

      {/* Grid overlay */}
      <GridOverlay />

      {/* Radial vignette */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Content */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
        }}
      >
        {children}
      </Box>
    </Box>
  )
}
