'use client'

import { useState, useEffect } from 'react'

import { useRouter } from 'next/navigation'

import { useSession, signOut } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import {
  Moon,
  Sun,
  Bell,
  SignOut as SignOutIcon,
  UserCircle,
  Gear,
  CaretDown,
  ArrowsClockwise,
  Warning,
  CheckCircle,
} from '@phosphor-icons/react'
import { Tooltip } from '@cloudflare/kumo'

import { usePageTitle } from '@/contexts/PageTitleContext'
import { useLicense, Features } from '@/contexts/LicenseContext'
import { useActiveAlerts, useDRSRecommendations, useVersionCheck, useOrchestratorHealth } from '@/hooks/useNavbarNotifications'
import { VERSION } from '@/config/version'

// Get initials from name/email
const getInitials = (name?: string | null, email?: string | null): string => {
  if (name) {
    const parts = name.split(' ')
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
    return name.substring(0, 2).toUpperCase()
  }
  if (email) return email.substring(0, 2).toUpperCase()
  return 'U'
}

export default function Header() {
  const router = useRouter()
  const { data: session } = useSession()
  const t = useTranslations()
  const { title: pageTitle, subtitle: pageSubtitle, icon: pageIcon } = usePageTitle()
  const { hasFeature, isEnterprise } = useLicense()

  // Notifications data
  const alertsRes = useActiveAlerts(isEnterprise)
  const drsRes = useDRSRecommendations(isEnterprise, hasFeature(Features.DRS))
  const versionRes = useVersionCheck()
  const healthRes = useOrchestratorHealth(isEnterprise)

  const alerts = alertsRes?.data?.alerts || alertsRes?.data || []
  const recommendations = drsRes?.data?.recommendations || drsRes?.data || []
  const hasUpdate = versionRes?.data?.hasUpdate || false
  const latestVersion = versionRes?.data?.latestVersion || ''
  const orchestratorHealthy = healthRes?.data?.status === 'healthy'

  const [isDark, setIsDark] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  // Dark mode detection and toggle
  useEffect(() => {
    const saved = localStorage.getItem('pc-theme')
    if (saved === 'dark') {
      document.documentElement.classList.add('dark')
      setIsDark(true)
    } else if (saved === 'light') {
      document.documentElement.classList.remove('dark')
      setIsDark(false)
    } else {
      // System preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (prefersDark) document.documentElement.classList.add('dark')
      setIsDark(prefersDark)
    }
  }, [])

  const toggleDarkMode = () => {
    const next = !isDark
    setIsDark(next)
    if (next) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('pc-theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('pc-theme', 'light')
    }
  }

  const totalAlerts = (Array.isArray(alerts) ? alerts.length : 0) + (Array.isArray(recommendations) ? recommendations.length : 0)
  const initials = getInitials(session?.user?.name, session?.user?.email)

  return (
    <header className="pc-header">
      {/* Page title */}
      <div className="pc-header-title">
        {pageIcon && (
          <span className="pc-nav-icon" style={{ color: 'var(--pc-primary)' }}>
            <i className={pageIcon} style={{ fontSize: 18 }} />
          </span>
        )}
        <div className="flex flex-col">
          <h1>{pageTitle || 'ProxCenter'}</h1>
          {pageSubtitle && <span className="subtitle">{pageSubtitle}</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="pc-header-actions">
        {/* Orchestrator health indicator */}
        {isEnterprise && (
          <Tooltip content={orchestratorHealthy ? t('common.healthy') : t('common.unhealthy')}>
            <span
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-[var(--pc-border-subtle)] cursor-pointer"
              style={{ color: orchestratorHealthy ? 'var(--pc-success)' : 'var(--pc-error)' }}
            >
              {orchestratorHealthy ? <CheckCircle size={18} weight="fill" /> : <Warning size={18} weight="fill" />}
            </span>
          </Tooltip>
        )}

        {/* Version update indicator */}
        {hasUpdate && (
          <Tooltip content={`${t('common.updateAvailable')}: ${latestVersion}`}>
            <span
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-[var(--pc-border-subtle)] cursor-pointer"
              style={{ color: 'var(--pc-info)' }}
            >
              <ArrowsClockwise size={18} weight="bold" />
            </span>
          </Tooltip>
        )}

        {/* Alerts */}
        {isEnterprise && (
          <Tooltip content={`${totalAlerts} ${t('navigation.alerts')}`}>
            <span
              className="relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-[var(--pc-border-subtle)] cursor-pointer"
              style={{ color: 'var(--pc-text-secondary)' }}
              onClick={() => router.push('/operations/alerts')}
            >
              <Bell size={18} />
              {totalAlerts > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-semibold text-white bg-[var(--pc-error)] rounded-full">
                  {totalAlerts > 99 ? '99+' : totalAlerts}
                </span>
              )}
            </span>
          </Tooltip>
        )}

        {/* Dark mode toggle */}
        <Tooltip content={isDark ? t('common.lightMode') : t('common.darkMode')}>
          <span
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-[var(--pc-border-subtle)] cursor-pointer"
            style={{ color: 'var(--pc-text-secondary)' }}
            onClick={toggleDarkMode}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </span>
        </Tooltip>

        {/* User menu */}
        <div className="relative">
          <button
            className="flex items-center gap-2 px-2 py-1 rounded-lg transition-colors hover:bg-[var(--pc-border-subtle)]"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
          >
            <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold text-white" style={{ background: 'var(--pc-primary)' }}>
              {initials}
            </div>
            <CaretDown size={12} style={{ color: 'var(--pc-text-muted)' }} />
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div
                className="absolute right-0 top-full mt-1 z-50 min-w-[200px] rounded-lg border shadow-lg"
                style={{
                  background: 'var(--pc-bg-elevated)',
                  borderColor: 'var(--pc-border)',
                }}
              >
                <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--pc-border-subtle)' }}>
                  <div className="text-sm font-medium" style={{ color: 'var(--pc-text)' }}>
                    {session?.user?.name || 'User'}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--pc-text-muted)' }}>
                    {session?.user?.email || ''}
                  </div>
                </div>
                <div className="py-1">
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--pc-border-subtle)]"
                    style={{ color: 'var(--pc-text-secondary)' }}
                    onClick={() => { router.push('/profile'); setUserMenuOpen(false) }}
                  >
                    <UserCircle size={16} /> {t('navigation.profile')}
                  </button>
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--pc-border-subtle)]"
                    style={{ color: 'var(--pc-text-secondary)' }}
                    onClick={() => { router.push('/settings'); setUserMenuOpen(false) }}
                  >
                    <Gear size={16} /> {t('navigation.settings')}
                  </button>
                </div>
                <div className="border-t py-1" style={{ borderColor: 'var(--pc-border-subtle)' }}>
                  <button
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--pc-border-subtle)]"
                    style={{ color: 'var(--pc-error)' }}
                    onClick={() => signOut({ callbackUrl: '/login' })}
                  >
                    <SignOutIcon size={16} /> {t('common.logout')}
                  </button>
                </div>
                <div className="px-3 py-1.5 border-t text-[10px]" style={{ borderColor: 'var(--pc-border-subtle)', color: 'var(--pc-text-muted)' }}>
                  ProxCenter v{VERSION}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
