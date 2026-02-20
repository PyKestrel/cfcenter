'use client'

/**
 * CFCenter Motion Animation Utilities
 *
 * Reusable animated components powered by the `motion` library.
 * Import from '@components/motion' to add fluid animations anywhere in the app.
 *
 * Usage:
 *   import { PageTransition, FadeIn, SlideUp, StaggerList, AnimatedCard, ScaleOnHover } from '@components/motion'
 */

import { motion, AnimatePresence } from 'motion/react'
import { forwardRef } from 'react'

// ============================================
// Animation Presets (reusable variant objects)
// ============================================

export const presets = {
  // Smooth ease curve (Apple-like)
  smooth: [0.22, 1, 0.36, 1],
  // Snappy spring
  spring: { type: 'spring', stiffness: 300, damping: 24 },
  // Gentle spring
  gentle: { type: 'spring', stiffness: 200, damping: 20 },
}

// ============================================
// PageTransition — wraps page content for enter/exit animations
// ============================================

export function PageTransition({ children, className }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: presets.smooth }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ============================================
// FadeIn — simple opacity fade with optional delay
// ============================================

export function FadeIn({ children, delay = 0, duration = 0.4, className, style }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration, delay, ease: 'easeOut' }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  )
}

// ============================================
// FadeInOnScroll — fades in when element enters viewport
// ============================================

export function FadeInOnScroll({ children, delay = 0, className, style }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay, ease: presets.smooth }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  )
}

// ============================================
// SlideUp — slides content up from below
// ============================================

export function SlideUp({ children, delay = 0, distance = 24, duration = 0.45, className, style }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: distance }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: presets.smooth }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  )
}

// ============================================
// SlideIn — slides from a given direction
// ============================================

export function SlideIn({ children, direction = 'left', delay = 0, distance = 30, className, style }) {
  const axis = direction === 'left' || direction === 'right' ? 'x' : 'y'
  const sign = direction === 'left' || direction === 'up' ? -1 : 1

  return (
    <motion.div
      initial={{ opacity: 0, [axis]: distance * sign }}
      animate={{ opacity: 1, [axis]: 0 }}
      transition={{ duration: 0.45, delay, ease: presets.smooth }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  )
}

// ============================================
// StaggerList — staggers children animations
// ============================================

const staggerContainerVariants = {
  hidden: { opacity: 0 },
  show: (custom) => ({
    opacity: 1,
    transition: {
      staggerChildren: custom?.stagger ?? 0.06,
      delayChildren: custom?.delay ?? 0.1,
    },
  }),
}

const staggerItemVariants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(3px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.35, ease: 'easeOut' },
  },
}

export function StaggerList({ children, stagger = 0.06, delay = 0.1, className, style }) {
  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="hidden"
      animate="show"
      custom={{ stagger, delay }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className, style }) {
  return (
    <motion.div variants={staggerItemVariants} className={className} style={style}>
      {children}
    </motion.div>
  )
}

// ============================================
// AnimatedCard — card with hover lift effect
// ============================================

export function AnimatedCard({ children, className, style, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: presets.smooth }}
      whileHover={{
        y: -3,
        boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
        transition: { duration: 0.2 },
      }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  )
}

// ============================================
// ScaleOnHover — subtle scale effect on hover
// ============================================

export function ScaleOnHover({ children, scale = 1.02, className, style }) {
  return (
    <motion.div
      whileHover={{ scale }}
      whileTap={{ scale: scale - 0.04 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  )
}

// ============================================
// PressEffect — press-down effect for buttons/interactive elements
// ============================================

export function PressEffect({ children, className, style }) {
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  )
}

// ============================================
// AnimatedCounter — animates a number counting up
// ============================================

export function AnimatedNumber({ value, className, style }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={className}
      style={style}
    >
      {value}
    </motion.span>
  )
}

// ============================================
// CollapseHeight — animated height expand/collapse
// ============================================

export function CollapseHeight({ isOpen, children, className }) {
  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: presets.smooth }}
          style={{ overflow: 'hidden' }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ============================================
// SkeletonPulse — animated loading placeholder
// ============================================

export function SkeletonPulse({ width = '100%', height = 16, borderRadius = 6, className }) {
  return (
    <motion.div
      animate={{ opacity: [0.3, 0.6, 0.3] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.06) 100%)',
      }}
      className={className}
    />
  )
}

// Re-export motion primitives for convenience
export { motion, AnimatePresence }
