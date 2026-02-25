'use client'

import { createContext, useContext, ReactNode } from 'react'

// Features disponibles — all always enabled
export const Features = {
  DRS: 'drs',
  FIREWALL: 'firewall',
  MICROSEGMENTATION: 'microsegmentation',
  ROLLING_UPDATES: 'rolling_updates',
  AI_INSIGHTS: 'ai_insights',
  PREDICTIVE_ALERTS: 'predictive_alerts',
  ALERTS: 'alerts',
  GREEN_METRICS: 'green_metrics',
  CROSS_CLUSTER_MIGRATION: 'cross_cluster_migration',
  CEPH_REPLICATION: 'ceph_replication',
  LDAP: 'ldap',
  REPORTS: 'reports',
  RBAC: 'rbac',
  TASK_CENTER: 'task_center',
  NOTIFICATIONS: 'notifications',
  CVE_SCANNER: 'cve_scanner',
} as const

type FeatureId = typeof Features[keyof typeof Features]

interface LicenseContextValue {
  status: { licensed: boolean; expired: boolean; edition: string; features: string[] } | null
  loading: boolean
  error: string | null
  isLicensed: boolean
  isEnterprise: boolean
  features: { id: string; enabled: boolean }[]
  hasFeature: (featureId: FeatureId | string) => boolean
  refresh: () => Promise<void>
}

// All features always unlocked — no community/enterprise distinction
const ALL_FEATURES = Object.values(Features)

const ALL_FEATURES_LIST = ALL_FEATURES.map(id => ({ id, enabled: true }))

const STATIC_STATUS = {
  licensed: true,
  expired: false,
  edition: 'enterprise' as const,
  features: ALL_FEATURES as unknown as string[],
}

const staticValue: LicenseContextValue = {
  status: STATIC_STATUS,
  loading: false,
  error: null,
  isLicensed: true,
  isEnterprise: true,
  features: ALL_FEATURES_LIST,
  hasFeature: () => true,
  refresh: async () => {},
}

const LicenseContext = createContext<LicenseContextValue>(staticValue)

export function LicenseProvider({ children }: { children: ReactNode }) {
  return (
    <LicenseContext.Provider value={staticValue}>
      {children}
    </LicenseContext.Provider>
  )
}

export function useLicense() {
  const context = useContext(LicenseContext)

  if (!context) {
    throw new Error('useLicense must be used within a LicenseProvider')
  }

  return context
}

export default LicenseContext
