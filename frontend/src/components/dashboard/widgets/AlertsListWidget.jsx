'use client'

import React from 'react'

import { useTranslations } from 'next-intl'

const SEVERITY_COLORS = { crit: '#f44336', warn: '#ff9800', info: '#2196f3' }

function AlertsListWidget({ data, loading }) {
  const t = useTranslations()
  const alerts = data?.alerts || []

  function timeAgo(date) {
    const now = new Date()
    const past = new Date(date)
    const diff = Math.floor((now - past) / 1000)

    if (diff < 60) return t('time.justNow')
    if (diff < 3600) return t('time.minutesAgo', { count: Math.floor(diff / 60) })
    if (diff < 86400) return t('time.hoursAgo', { count: Math.floor(diff / 3600) })

    return t('time.daysAgo', { count: Math.floor(diff / 86400) })
  }

  if (alerts.length === 0) {
    return (
      <div className='h-full flex items-center justify-center p-4'>
        <div className='w-full text-center text-sm px-3 py-2 rounded-lg' style={{ backgroundColor: '#4caf5018', color: '#4caf50' }}>
          {t('alerts.noActiveAlerts')}
        </div>
      </div>
    )
  }

  const severityConfig = {
    crit: { label: 'CRIT' },
    warn: { label: 'WARN' },
    info: { label: 'INFO' },
  }

  return (
    <div className='h-full overflow-auto p-1'>
      {alerts.map((alert, idx) => {
        const cfg = severityConfig[alert.severity] || severityConfig.info
        const color = SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.info

        return (
          <div key={idx} className='px-1 py-1.5 border-b last:border-b-0' style={{ borderColor: 'var(--pc-border-subtle)' }}>
            <div className='flex items-center gap-1.5'>
              <span className='inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded min-w-[40px] text-center text-white' style={{ backgroundColor: color }}>
                {cfg.label}
              </span>
              <span className='text-[11px] font-semibold truncate'>{alert.message}</span>
            </div>
            <div className='flex items-center gap-2 mt-0.5'>
              <span className='text-[9px] opacity-50'>{timeAgo(alert.time)}</span>
              <span className='text-[9px] opacity-40'>• {alert.source}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default React.memo(AlertsListWidget)
