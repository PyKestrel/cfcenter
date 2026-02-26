'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { useTranslations } from 'next-intl'
import {
  House,
  Database,
  ShareNetwork,
  HardDrives,
  Stack,
  CopySimple,
  ArrowsClockwise,
  ShieldStar,
  ShieldCheck,
  ChartPie,
  CalendarBlank,
  Bell,
  ListChecks,
  ChartLineUp,
  User,
  Lock,
  FileMagnifyingGlass,
  Gear,
  CaretLeft,
  FileCode,
  Notebook,
  CalendarDots,
  CaretRight,
  List,
} from '@phosphor-icons/react'
import { Tooltip } from '@cloudflare/kumo'

import { useLicense } from '@/contexts/LicenseContext'
import { useRBAC } from '@/contexts/RBACContext'

// Map icon names to Phosphor components
const iconMap: Record<string, React.ComponentType<any>> = {
  'ri-dashboard-line': House,
  'ri-database-fill': Database,
  'ri-mind-map': ShareNetwork,
  'ri-database-2-fill': HardDrives,
  'ri-stack-line': Stack,
  'ri-file-copy-fill': CopySimple,
  'ri-loop-left-fill': ArrowsClockwise,
  'ri-shield-star-line': ShieldStar,
  'ri-shield-flash-fill': ShieldCheck,
  'ri-pie-chart-fill': ChartPie,
  'ri-calendar-event-line': CalendarBlank,
  'ri-notification-3-line': Bell,
  'ri-play-list-2-line': ListChecks,
  'ri-file-chart-line': ChartLineUp,
  'ri-user-line': User,
  'ri-lock-2-line': Lock,
  'ri-file-search-line': FileMagnifyingGlass,
  'ri-settings-3-line': Gear,
  'ri-file-code-line': FileCode,
  'ri-play-list-add-line': Notebook,
  'ri-calendar-schedule-line': CalendarDots,
}

// Logo SVG — CFCenter crosshair/target
const LogoIcon = ({ size = 28, accentColor = '#f6821f' }: { size?: number; accentColor?: string }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Center circle */}
      <circle cx="100" cy="100" r="38" fill={accentColor} />
      {/* Top bar */}
      <rect x="85" y="12" width="30" height="38" rx="6" fill={accentColor} opacity="0.85" />
      {/* Bottom bar */}
      <rect x="85" y="150" width="30" height="38" rx="6" fill={accentColor} opacity="0.85" />
      {/* Left bar */}
      <rect x="12" y="85" width="38" height="30" rx="6" fill={accentColor} opacity="0.85" />
      {/* Right bar */}
      <rect x="150" y="85" width="38" height="30" rx="6" fill={accentColor} opacity="0.85" />
    </svg>
  )
}

interface NavItemDef {
  label: string
  icon?: string
  href?: string
  isSection?: boolean
  requiredFeature?: string
  permissions?: string[]
  children?: NavItemDef[]
}

function useNavData(): NavItemDef[] {
  const t = useTranslations()

  return [
    {
      label: t('navigation.dashboard'),
      icon: 'ri-dashboard-line',
      href: '/home',
    },
    {
      isSection: true,
      label: t('navigation.infrastructure'),
      children: [
        { label: t('navigation.inventory'), icon: 'ri-database-fill', href: '/infrastructure/inventory', permissions: ['vm.view', 'node.view'] },
        { label: t('navigation.topology'), icon: 'ri-mind-map', href: '/infrastructure/topology', permissions: ['vm.view', 'node.view'] },
        { label: t('navigation.storage'), icon: 'ri-database-2-fill', href: '/storage/overview', permissions: ['storage.view'] },
        { label: t('navigation.ceph'), icon: 'ri-stack-line', href: '/storage/ceph', permissions: ['storage.view'] },
        { label: t('navigation.backups'), icon: 'ri-file-copy-fill', href: '/operations/backups', permissions: ['backup.view', 'backup.job.view'] },
      ],
    },
    {
      isSection: true,
      label: t('navigation.orchestration'),
      requiredFeature: 'drs',
      permissions: ['vm.migrate', 'vm.config'],
      children: [
        { label: t('navigation.drs'), icon: 'ri-loop-left-fill', href: '/automation/drs', permissions: ['vm.migrate'], requiredFeature: 'drs' },
        { label: t('navigation.siteRecovery'), icon: 'ri-shield-star-line', href: '/automation/site-recovery', permissions: ['vm.config'], requiredFeature: 'ceph_replication' },
        { label: t('navigation.networkSecurity'), icon: 'ri-shield-flash-fill', href: '/automation/network', permissions: ['admin.settings'], requiredFeature: 'microsegmentation' },
        { label: t('navigation.resources'), icon: 'ri-pie-chart-fill', href: '/infrastructure/resources', permissions: ['vm.view', 'node.view'], requiredFeature: 'green_metrics' },
        { label: t('navigation.scheduler'), icon: 'ri-calendar-schedule-line', href: '/automation/scheduler', permissions: ['automation.view'] },
      ],
    },
    {
      isSection: true,
      label: t('navigation.automation'),
      children: [
        { label: t('navigation.templates'), icon: 'ri-file-code-line', href: '/automation/templates', permissions: ['vm.view'] },
        { label: t('navigation.runbooks'), icon: 'ri-play-list-add-line', href: '/automation/runbooks', permissions: ['automation.view'] },
      ],
    },
    {
      isSection: true,
      label: t('navigation.operations'),
      children: [
        { label: t('navigation.events'), icon: 'ri-calendar-event-line', href: '/operations/events' },
        { label: t('navigation.alerts'), icon: 'ri-notification-3-line', href: '/operations/alerts', requiredFeature: 'alerts' },
        { label: t('navigation.jobs'), icon: 'ri-play-list-2-line', href: '/operations/task-center', requiredFeature: 'task_center' },
        { label: t('navigation.reports'), icon: 'ri-file-chart-line', href: '/operations/reports', requiredFeature: 'reports' },
      ],
    },
    {
      isSection: true,
      label: t('navigation.securityAccess'),
      permissions: ['admin.users', 'admin.rbac', 'admin.audit'],
      children: [
        { label: t('navigation.users'), icon: 'ri-user-line', href: '/security/users', permissions: ['admin.users'] },
        { label: t('navigation.rbacRoles'), icon: 'ri-lock-2-line', href: '/security/rbac', permissions: ['admin.rbac'], requiredFeature: 'rbac' },
        { label: t('navigation.auditLogs'), icon: 'ri-file-search-line', href: '/security/audit', permissions: ['admin.audit'] },
      ],
    },
    {
      isSection: true,
      label: t('navigation.settings'),
      permissions: ['admin.settings', 'connection.manage'],
      children: [
        { label: t('navigation.settings'), icon: 'ri-settings-3-line', href: '/settings', permissions: ['connection.manage', 'admin.settings'] },
      ],
    },
  ]
}

type SidebarMode = 'expanded' | 'collapsed' | 'hidden'

export default function Sidebar() {
  const pathname = usePathname()
  const { hasFeature } = useLicense()
  const { hasAnyPermission } = useRBAC() as any
  const navData = useNavData()

  const [mode, setMode] = useState<SidebarMode>('collapsed')
  const [isHovered, setIsHovered] = useState(false)
  const [sidebarHovered, setSidebarHovered] = useState(false)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sidebarHoverRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load saved mode from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pc-sidebar-mode')

    if (saved === 'expanded' || saved === 'collapsed' || saved === 'hidden') {
      setMode(saved)
    }
  }, [])

  // Save mode
  const cycleMode = useCallback(() => {
    setMode(prev => {
      const next = prev === 'expanded' ? 'collapsed' : prev === 'collapsed' ? 'hidden' : 'expanded'

      localStorage.setItem('pc-sidebar-mode', next)
      setIsHovered(false)

      return next
    })
  }, [])

  const handleTriggerEnter = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    setIsHovered(true)
  }, [])

  const handleNavLeave = useCallback(() => {
    if (mode === 'hidden') {
      hoverTimeoutRef.current = setTimeout(() => setIsHovered(false), 300)
    }

    if (mode === 'collapsed') {
      sidebarHoverRef.current = setTimeout(() => setSidebarHovered(false), 300)
    }
  }, [mode])

  const handleNavEnter = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)

    if (mode === 'collapsed') {
      if (sidebarHoverRef.current) clearTimeout(sidebarHoverRef.current)
      setSidebarHovered(true)
    }
  }, [mode])

  // Check if a nav item should be visible
  const isItemVisible = useCallback((item: NavItemDef): boolean => {
    if (item.requiredFeature && !hasFeature(item.requiredFeature)) return false
    if (item.permissions && item.permissions.length > 0 && !hasAnyPermission(item.permissions)) return false

    return true
  }, [hasFeature, hasAnyPermission])

  // Check if a section has any visible children
  const hasSectionVisibleChildren = useCallback((section: NavItemDef): boolean => {
    if (!section.children) return false

    return section.children.some(child => isItemVisible(child))
  }, [isItemVisible])

  const sidebarClasses = [
    'pc-sidebar',
    mode === 'collapsed' ? 'collapsed' : '',
    mode === 'hidden' ? 'hidden' : '',
    mode === 'hidden' && isHovered ? 'hovered' : '',
    mode === 'collapsed' && sidebarHovered ? 'sidebar-hovered' : '',
  ].filter(Boolean).join(' ')

  // Hidden mode: show trigger zone
  if (mode === 'hidden' && !isHovered) {
    return (
      <div className="pc-sidebar-trigger" onMouseEnter={handleTriggerEnter} />
    )
  }

  return (
    <>
      {mode === 'hidden' && isHovered && (
        <div className="pc-sidebar-trigger" onMouseEnter={handleTriggerEnter} />
      )}
      <aside
        className={sidebarClasses}
        onMouseEnter={handleNavEnter}
        onMouseLeave={handleNavLeave}
      >
        {/* Header */}
        <div className="pc-sidebar-header">
          <Link href="/home" className="flex items-center">
            <LogoIcon size={26} />
            <span className="logo-text">CFCenter</span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="pc-sidebar-nav">
          {navData.map((item, idx) => {
            if (item.isSection) {
              if (!isItemVisible(item) && !hasSectionVisibleChildren(item)) {
                return null
              }

              return (
                <div key={idx}>
                  <div className="pc-nav-section">{item.label}</div>
                  {item.children?.map((child, cidx) => {
                    if (!isItemVisible(child)) {
                      return null
                    }

                    return <NavItem key={cidx} item={child} pathname={pathname} collapsed={mode === 'collapsed' && !sidebarHovered} />
                  })}
                </div>
              )
            }

            if (!isItemVisible(item)) {
              return null
            }

            return <NavItem key={idx} item={item} pathname={pathname} collapsed={mode === 'collapsed' && !sidebarHovered} />
          })}
        </nav>

        {/* Toggle */}
        <div className="pc-sidebar-toggle" onClick={cycleMode}>
          {mode === 'expanded' ? (
            <CaretLeft size={18} />
          ) : mode === 'collapsed' ? (
            <List size={18} />
          ) : (
            <CaretRight size={18} />
          )}
        </div>
      </aside>
    </>
  )
}

function NavItem({ item, pathname, collapsed }: { item: NavItemDef; pathname: string; collapsed: boolean }) {
  const IconComponent = item.icon ? iconMap[item.icon] : null
  const isActive = item.href ? pathname === item.href || pathname.startsWith(item.href + '/') : false

  const content = (
    <Link
      href={item.href || '#'}
      className={`pc-nav-item ${isActive ? 'active' : ''}`}
    >
      <span className="pc-nav-icon">
        {IconComponent ? <IconComponent size={18} weight={isActive ? 'fill' : 'regular'} /> : <i className={item.icon || ''} style={{ fontSize: 18 }} />}
      </span>
      <span className="pc-nav-label">{item.label}</span>
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip content={item.label} side="right">
        {content}
      </Tooltip>
    )
  }

  return content
}
