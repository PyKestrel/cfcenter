'use client'

import { ReactNode } from 'react'

interface EnterpriseGuardProps {
  children: ReactNode
  requiredFeature?: string
  featureName?: string
}

/**
 * All features are always available — this guard is now a no-op passthrough.
 */
export default function EnterpriseGuard({
  children,
}: EnterpriseGuardProps) {
  return <>{children}</>
}
