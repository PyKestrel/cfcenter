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
}

// Logo SVG
const LogoIcon = ({ size = 28, accentColor = '#f6821f' }: { size?: number; accentColor?: string }) => {
  const height = (size * 170) / 220

  return (
    <svg width={size} height={height} viewBox="0 0 220 170" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M 174.30 158.91 C160.99,140.34 155.81,133.18 151.52,127.42 C149.04,124.08 147.00,120.78 147.00,120.10 C147.00,119.42 148.91,116.47 151.25,113.55 C153.59,110.63 157.44,105.71 159.81,102.62 C162.18,99.53 164.71,97.00 165.44,97.00 C166.58,97.00 182.93,119.09 200.79,144.77 C203.71,148.95 208.32,155.38 211.04,159.06 C213.77,162.74 216.00,166.03 216.00,166.37 C216.00,166.72 207.92,167.00 198.05,167.00 L 180.10 167.00 Z M 164.11 69.62 C161.87,67.24 159.22,63.61 151.44,52.29 L 147.85 47.07 L 153.79 39.29 C157.05,35.00 161.25,29.62 163.11,27.32 C164.98,25.02 169.65,19.08 173.50,14.11 L 180.50 5.08 L 199.25 5.04 C209.56,5.02 218.00,5.23 218.00,5.51 C218.00,5.79 214.51,10.42 210.25,15.81 C205.99,21.19 199.80,29.11 196.50,33.41 C193.20,37.71 189.15,42.92 187.50,44.98 C183.18,50.39 169.32,68.18 167.76,70.30 C166.52,72.01 166.33,71.98 164.11,69.62 Z"
        fill={accentColor}
      />
      <path
        d="M 0.03 164.75 C0.05,162.18 2.00,159.04 9.28,149.83 C19.92,136.37 45.56,103.43 54.84,91.32 L 61.17 83.05 L 58.87 79.77 C49.32,66.18 11.10,12.77 8.83,9.86 C7.28,7.85 6.00,5.94 6.00,5.61 C6.00,5.27 14.21,5.01 24.25,5.03 L 42.50 5.06 L 53.50 20.63 C59.55,29.20 65.44,37.40 66.58,38.85 C72.16,45.97 97.33,81.69 97.70,83.02 C98.13,84.59 95.40,88.27 63.50,129.06 C53.05,142.42 42.77,155.64 40.66,158.43 C32.84,168.76 34.77,168.00 16.33,168.00 L 0.00 168.00 L 0.03 164.75 Z M 55.56 167.09 C55.25,166.59 56.95,163.78 59.33,160.84 C61.71,157.90 66.10,152.33 69.08,148.46 C72.06,144.59 81.47,132.50 90.00,121.60 C98.53,110.69 106.38,100.58 107.46,99.13 C108.54,97.69 111.81,93.49 114.72,89.80 L 120.00 83.10 L 115.25 76.47 C112.64,72.82 109.82,68.83 109.00,67.61 C108.18,66.38 105.73,62.93 103.57,59.94 C101.41,56.95 96.88,50.67 93.51,46.00 C77.15,23.36 65.00,6.12 65.00,5.57 C65.00,5.23 73.21,5.08 83.24,5.23 L 101.49 5.50 L 124.77 38.00 C137.58,55.88 150.09,73.37 152.58,76.88 C155.08,80.39 156.91,83.79 156.66,84.44 C156.41,85.09 153.55,88.97 150.30,93.06 C147.06,97.15 137.93,108.82 130.02,119.00 C122.12,129.18 110.29,144.36 103.75,152.75 L 91.85 168.00 L 73.98 168.00 C64.16,168.00 55.87,167.59 55.56,167.09 Z"
        fill="#FCFCFC"
      />
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
            <span className="logo-text">ProxCenter</span>
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
