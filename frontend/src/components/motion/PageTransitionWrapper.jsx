'use client'

import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'

/**
 * Client-side wrapper that animates page transitions within the dashboard layout.
 * Uses the current pathname as a key so content animates when navigating between pages.
 */
export default function PageTransitionWrapper({ children }) {
  const pathname = usePathname()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        style={{ display: 'contents' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
