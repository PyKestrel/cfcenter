'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

import { useTranslations } from 'next-intl'
import useSWR from 'swr'
import {
  ArrowClockwise,
  ArrowSquareOut,
  Bug,
  CaretDown,
  CaretUp,
  CheckCircle,
  CircleNotch,
  Clock,
  CloudArrowDown,
  Cube,
  GithubLogo,
  Info,
  Package,
  Rocket,
  ShieldCheck,
  Terminal,
  Warning,
  WarningCircle,
  XCircle
} from '@phosphor-icons/react'

import { VERSION, CHANGELOG, GITHUB_URL } from '@/config/version'
import { usePageTitle } from '@/contexts/PageTitleContext'

const fetcher = url => fetch(url).then(r => r.json())

// ─── Update Steps ────────────────────────────────────────────────────────────
const UPDATE_STEPS = [
  { key: 'checking', icon: ShieldCheck },
  { key: 'pulling', icon: CloudArrowDown },
  { key: 'building', icon: Package },
  { key: 'restarting', icon: Rocket },
  { key: 'completed', icon: CheckCircle }
]

function getStepIndex(status) {
  const map = { checking: 0, pulling: 1, building: 2, restarting: 3, completed: 4 }

  return map[status] ?? -1
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function AboutPage() {
  const { setPageInfo } = usePageTitle()
  const t = useTranslations()

  const [showConfirm, setShowConfirm] = useState(false)
  const [showLogs, setShowLogs] = useState(false)
  const [expandedVersion, setExpandedVersion] = useState(null)
  const [reconnecting, setReconnecting] = useState(false)
  const logsEndRef = useRef(null)

  useEffect(() => {
    setPageInfo(t('aboutPage.title'), t('aboutPage.subtitle'), 'ri-information-line')

    return () => setPageInfo('', '', '')
  }, [setPageInfo, t])

  // Fetch version check
  const { data: versionData, isLoading: versionLoading, mutate: recheckVersion } = useSWR(
    '/api/v1/version/check',
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  )

  // Fetch update capability & state
  const { data: updateData, mutate: refreshUpdate } = useSWR(
    '/api/v1/version/update',
    fetcher,
    { refreshInterval: updateActive => (updateActive?.state?.status && !['idle', 'completed', 'error'].includes(updateActive.state.status)) ? 1500 : 0, revalidateOnFocus: false }
  )

  const updateState = updateData?.state
  const updateSupported = updateData?.updateSupported
  const isUpdating = updateState && !['idle', 'completed', 'error'].includes(updateState.status)

  // Poll during active update
  useEffect(() => {
    if (!isUpdating) return

    const interval = setInterval(() => refreshUpdate(), 1500)

    return () => clearInterval(interval)
  }, [isUpdating, refreshUpdate])

  // Auto-scroll logs
  useEffect(() => {
    if (showLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [updateState?.logs?.length, showLogs])

  // Handle reconnection after restart
  useEffect(() => {
    if (updateState?.status === 'restarting') {
      // The container is about to restart — start reconnection polling
      const timeout = setTimeout(() => {
        setReconnecting(true)

        const poll = setInterval(async () => {
          try {
            const res = await fetch('/api/health')

            if (res.ok) {
              clearInterval(poll)
              window.location.reload()
            }
          } catch {
            // Still restarting
          }
        }, 3000)

        // Stop polling after 5 minutes
        setTimeout(() => clearInterval(poll), 300000)
      }, 5000)

      return () => clearTimeout(timeout)
    }
  }, [updateState?.status])

  // Start update
  const startUpdate = useCallback(async () => {
    setShowConfirm(false)
    setShowLogs(true)

    await fetch('/api/v1/version/update', { method: 'POST' })

    refreshUpdate()
  }, [refreshUpdate])

  // Dismiss update state
  const dismissUpdate = useCallback(async () => {
    await fetch('/api/v1/version/update', { method: 'DELETE' })

    refreshUpdate()
  }, [refreshUpdate])

  const changelogEntries = Object.entries(CHANGELOG)

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">

      {/* ── Reconnecting Overlay ── */}
      {reconnecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="rounded-xl p-8 text-center space-y-4" style={{ background: 'var(--pc-bg-elevated)' }}>
            <CircleNotch size={40} className="animate-spin mx-auto" style={{ color: 'var(--pc-primary)' }} />
            <p className="text-lg font-semibold" style={{ color: 'var(--pc-text-primary)' }}>
              {t('about.updateReconnecting')}
            </p>
            <p className="text-sm" style={{ color: 'var(--pc-text-secondary)' }}>
              {t('about.updateReconnectDesc')}
            </p>
          </div>
        </div>
      )}

      {/* ── Header Card ── */}
      <div
        className="rounded-xl border p-6"
        style={{ background: 'var(--pc-bg-elevated)', borderColor: 'var(--pc-border)' }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--pc-primary)', color: '#fff' }}
            >
              <Rocket size={24} weight="bold" />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--pc-text-primary)' }}>
                CFCenter
              </h1>
              <p className="text-sm" style={{ color: 'var(--pc-text-secondary)' }}>
                {t('about.description')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
              style={{ background: 'var(--pc-primary)', color: '#fff' }}
            >
              v{VERSION}
            </span>
            {versionData?.updateAvailable && (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
                style={{ background: 'rgba(234, 179, 8, 0.15)', color: 'rgb(234, 179, 8)' }}
              >
                <ArrowClockwise size={14} />
                {t('about.updateAvailable')}
              </span>
            )}
            {versionData && !versionData.updateAvailable && !versionData.error && (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium"
                style={{ background: 'rgba(34, 197, 94, 0.15)', color: 'rgb(34, 197, 94)' }}
              >
                <CheckCircle size={14} weight="bold" />
                {t('about.upToDate')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Update Available Banner ── */}
      {versionData?.updateAvailable && (
        <div
          className="rounded-xl border p-5 space-y-4"
          style={{
            background: 'rgba(234, 179, 8, 0.06)',
            borderColor: 'rgba(234, 179, 8, 0.25)'
          }}
        >
          <div className="flex items-start gap-3">
            <CloudArrowDown size={24} weight="duotone" style={{ color: 'rgb(234, 179, 8)', flexShrink: 0, marginTop: 2 }} />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base" style={{ color: 'var(--pc-text-primary)' }}>
                {t('about.newVersionAvailable', { version: versionData.latestVersion })}
              </h3>
              {versionData.publishedAt && (
                <p className="text-sm mt-0.5" style={{ color: 'var(--pc-text-secondary)' }}>
                  {t('about.publishedOn', { date: new Date(versionData.publishedAt).toLocaleDateString() })}
                </p>
              )}

              {/* Release notes */}
              {versionData.releaseNotes && (
                <div
                  className="mt-3 p-3 rounded-lg text-sm whitespace-pre-wrap max-h-48 overflow-y-auto"
                  style={{ background: 'var(--pc-bg)', color: 'var(--pc-text-secondary)' }}
                >
                  {versionData.releaseNotes}
                </div>
              )}

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {updateSupported && !isUpdating && updateState?.status !== 'completed' && (
                  <button
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90 cursor-pointer"
                    style={{ background: 'var(--pc-primary)', color: '#fff' }}
                    onClick={() => setShowConfirm(true)}
                  >
                    <Rocket size={16} weight="bold" />
                    {t('about.updateNow')}
                  </button>
                )}
                {versionData.releaseUrl && (
                  <a
                    href={versionData.releaseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
                    style={{ color: 'var(--pc-primary)' }}
                  >
                    <ArrowSquareOut size={14} />
                    {t('about.viewRelease')}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Update Confirmation Dialog ── */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div
            className="rounded-xl border p-6 max-w-md w-full mx-4 space-y-4"
            style={{ background: 'var(--pc-bg-elevated)', borderColor: 'var(--pc-border)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(234, 179, 8, 0.15)' }}>
                <Warning size={22} style={{ color: 'rgb(234, 179, 8)' }} />
              </div>
              <h3 className="font-semibold text-lg" style={{ color: 'var(--pc-text-primary)' }}>
                {t('about.updateConfirm')}
              </h3>
            </div>
            <p className="text-sm" style={{ color: 'var(--pc-text-secondary)' }}>
              {t('about.updateConfirmDesc')}
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                style={{ color: 'var(--pc-text-secondary)' }}
                onClick={() => setShowConfirm(false)}
              >
                {t('common.cancel')}
              </button>
              <button
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:opacity-90 cursor-pointer"
                style={{ background: 'var(--pc-primary)', color: '#fff' }}
                onClick={startUpdate}
              >
                <Rocket size={16} weight="bold" />
                {t('about.updateNow')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Update Progress ── */}
      {(isUpdating || updateState?.status === 'completed' || updateState?.status === 'error') && (
        <div
          className="rounded-xl border p-5 space-y-4"
          style={{
            background: 'var(--pc-bg-elevated)',
            borderColor: updateState.status === 'error'
              ? 'rgba(239, 68, 68, 0.3)'
              : updateState.status === 'completed'
                ? 'rgba(34, 197, 94, 0.3)'
                : 'var(--pc-border)'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {updateState.status === 'error' ? (
                <XCircle size={20} weight="bold" style={{ color: 'rgb(239, 68, 68)' }} />
              ) : updateState.status === 'completed' ? (
                <CheckCircle size={20} weight="bold" style={{ color: 'rgb(34, 197, 94)' }} />
              ) : (
                <CircleNotch size={20} className="animate-spin" style={{ color: 'var(--pc-primary)' }} />
              )}
              <h3 className="font-semibold" style={{ color: 'var(--pc-text-primary)' }}>
                {updateState.status === 'error'
                  ? t('about.updateFailed')
                  : updateState.status === 'completed'
                    ? t('about.updateCompleted')
                    : t('about.updateProgress')}
              </h3>
            </div>
            {(updateState.status === 'completed' || updateState.status === 'error') && (
              <button
                className="text-xs px-2 py-1 rounded transition-colors cursor-pointer hover:opacity-80"
                style={{ color: 'var(--pc-text-secondary)' }}
                onClick={dismissUpdate}
              >
                {t('about.updateDismiss')}
              </button>
            )}
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--pc-border)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${updateState.progress || 0}%`,
                background: updateState.status === 'error'
                  ? 'rgb(239, 68, 68)'
                  : updateState.status === 'completed'
                    ? 'rgb(34, 197, 94)'
                    : 'var(--pc-primary)'
              }}
            />
          </div>

          {/* Steps */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {UPDATE_STEPS.map((step, i) => {
              const currentIdx = getStepIndex(updateState.status)
              const isActive = i === currentIdx
              const isDone = i < currentIdx || updateState.status === 'completed'
              const isError = updateState.status === 'error' && i === currentIdx
              const StepIcon = step.icon

              return (
                <div
                  key={step.key}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap"
                  style={{
                    background: isActive ? 'rgba(var(--pc-primary-rgb, 59, 130, 246), 0.1)' : isError ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                    color: isDone ? 'rgb(34, 197, 94)' : isActive ? 'var(--pc-primary)' : isError ? 'rgb(239, 68, 68)' : 'var(--pc-text-secondary)',
                    opacity: isDone || isActive || isError ? 1 : 0.5
                  }}
                >
                  {isDone ? (
                    <CheckCircle size={14} weight="bold" />
                  ) : isActive && updateState.status !== 'error' ? (
                    <CircleNotch size={14} className="animate-spin" />
                  ) : isError ? (
                    <XCircle size={14} weight="bold" />
                  ) : (
                    <StepIcon size={14} />
                  )}
                  {t(`about.updateStep${step.key.charAt(0).toUpperCase() + step.key.slice(1)}`)}
                </div>
              )
            })}
          </div>

          {/* Current message */}
          {updateState.message && (
            <p className="text-sm" style={{ color: 'var(--pc-text-secondary)' }}>
              {updateState.message}
            </p>
          )}

          {/* Error details */}
          {updateState.status === 'error' && updateState.error && (
            <div
              className="p-3 rounded-lg text-sm"
              style={{ background: 'rgba(239, 68, 68, 0.08)', color: 'rgb(239, 68, 68)' }}
            >
              {updateState.error}
            </div>
          )}

          {/* Logs toggle */}
          <button
            className="flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer hover:opacity-80"
            style={{ color: 'var(--pc-text-secondary)' }}
            onClick={() => setShowLogs(v => !v)}
          >
            <Terminal size={14} />
            {t('about.updateLogs')}
            {showLogs ? <CaretUp size={12} /> : <CaretDown size={12} />}
          </button>

          {showLogs && updateState.logs?.length > 0 && (
            <div
              className="rounded-lg p-3 text-xs font-mono max-h-64 overflow-y-auto space-y-0.5"
              style={{ background: 'var(--pc-bg)', color: 'var(--pc-text-secondary)' }}
            >
              {updateState.logs.map((log, i) => (
                <div key={i} className="whitespace-pre-wrap break-all">{log}</div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      )}

      {/* ── Version Info & System ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Version Info */}
        <div
          className="rounded-xl border p-5 space-y-3"
          style={{ background: 'var(--pc-bg-elevated)', borderColor: 'var(--pc-border)' }}
        >
          <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--pc-text-primary)' }}>
            <Info size={18} />
            {t('about.systemInfo')}
          </h3>
          <div className="space-y-2.5">
            <InfoRow label={t('about.currentVersion')} value={`v${VERSION}`} />
            <InfoRow
              label={t('about.latestVersion')}
              value={
                versionLoading
                  ? '...'
                  : versionData?.latestVersion
                    ? `v${versionData.latestVersion}`
                    : '—'
              }
            />
            <InfoRow
              label={t('about.environment')}
              value={
                <span className="inline-flex items-center gap-1">
                  <Cube size={14} />
                  {updateSupported ? t('about.dockerMode') : t('about.standaloneMode')}
                </span>
              }
            />
            <InfoRow
              label={t('about.guiUpdateEnabled')}
              value={
                updateSupported ? (
                  <span style={{ color: 'rgb(34, 197, 94)' }}>{t('about.enabled')}</span>
                ) : (
                  <span style={{ color: 'var(--pc-text-secondary)' }}>{t('about.notConfigured')}</span>
                )
              }
            />
          </div>

          {/* Check for updates button */}
          <button
            className="flex items-center gap-1.5 text-sm font-medium mt-2 transition-colors cursor-pointer hover:opacity-80"
            style={{ color: 'var(--pc-primary)' }}
            onClick={() => recheckVersion()}
            disabled={versionLoading}
          >
            <ArrowClockwise size={14} className={versionLoading ? 'animate-spin' : ''} />
            {versionLoading ? t('about.checkingForUpdates') : t('common.refresh')}
          </button>
        </div>

        {/* Links */}
        <div
          className="rounded-xl border p-5 space-y-3"
          style={{ background: 'var(--pc-bg-elevated)', borderColor: 'var(--pc-border)' }}
        >
          <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--pc-text-primary)' }}>
            <GithubLogo size={18} />
            GitHub
          </h3>
          <div className="space-y-2">
            <LinkRow
              icon={<GithubLogo size={16} />}
              label={t('about.allReleases')}
              href={`${GITHUB_URL}/releases`}
            />
            <LinkRow
              icon={<Bug size={16} />}
              label={t('about.reportBug')}
              href={`${GITHUB_URL}/issues/new`}
            />
            <LinkRow
              icon={<ArrowSquareOut size={16} />}
              label="GitHub Repository"
              href={GITHUB_URL}
            />
          </div>

          {/* GUI update not supported notice */}
          {updateSupported === false && (
            <div
              className="mt-3 p-3 rounded-lg text-xs flex items-start gap-2"
              style={{ background: 'rgba(234, 179, 8, 0.06)', color: 'var(--pc-text-secondary)' }}
            >
              <WarningCircle size={16} style={{ color: 'rgb(234, 179, 8)', flexShrink: 0, marginTop: 1 }} />
              <div>
                <p className="font-medium" style={{ color: 'var(--pc-text-primary)' }}>
                  {t('about.updateNotSupported')}
                </p>
                <p className="mt-0.5">{t('about.updateNotSupportedDesc')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Changelog ── */}
      <div
        className="rounded-xl border p-5"
        style={{ background: 'var(--pc-bg-elevated)', borderColor: 'var(--pc-border)' }}
      >
        <h3 className="font-semibold flex items-center gap-2 mb-4" style={{ color: 'var(--pc-text-primary)' }}>
          <Clock size={18} />
          {t('about.changelog')}
        </h3>
        <div className="space-y-1">
          {changelogEntries.map(([version, info], idx) => {
            const isExpanded = expandedVersion === version || (expandedVersion === null && idx === 0)
            const isCurrent = version === VERSION

            return (
              <div key={version}>
                <button
                  className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg text-left transition-colors cursor-pointer"
                  style={{
                    background: isExpanded ? 'var(--pc-bg)' : 'transparent',
                    color: 'var(--pc-text-primary)'
                  }}
                  onClick={() => setExpandedVersion(isExpanded ? '__none__' : version)}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-semibold text-sm">v{version}</span>
                    {isCurrent && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                        style={{ background: 'var(--pc-primary)', color: '#fff' }}
                      >
                        current
                      </span>
                    )}
                    <span className="text-xs" style={{ color: 'var(--pc-text-secondary)' }}>
                      {info.date}
                    </span>
                  </div>
                  {isExpanded ? <CaretUp size={14} /> : <CaretDown size={14} />}
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3">
                    <ul className="space-y-1.5 mt-1">
                      {info.changes.map((change, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-sm"
                          style={{ color: 'var(--pc-text-secondary)' }}
                        >
                          <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'var(--pc-primary)' }} />
                          {change}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Footer ── */}
      <p className="text-center text-xs pb-4" style={{ color: 'var(--pc-text-secondary)' }}>
        © {new Date().getFullYear()} CFCenter — {t('about.copyright')}
      </p>
    </div>
  )
}

// ─── Helper Components ───────────────────────────────────────────────────────
function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span style={{ color: 'var(--pc-text-secondary)' }}>{label}</span>
      <span className="font-medium" style={{ color: 'var(--pc-text-primary)' }}>{value}</span>
    </div>
  )
}

function LinkRow({ icon, label, href }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-sm py-1.5 transition-colors hover:opacity-80"
      style={{ color: 'var(--pc-primary)' }}
    >
      {icon}
      {label}
      <ArrowSquareOut size={12} className="ml-auto opacity-50" />
    </a>
  )
}
