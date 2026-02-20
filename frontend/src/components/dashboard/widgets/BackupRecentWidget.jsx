'use client'

import React from 'react'

import { useTranslations } from 'next-intl'

function BackupRecentWidget({ data, loading }) {
  const t = useTranslations()
  const pbs = data?.pbs || {}

  function timeAgo(ts) {
    if (!ts) return ''
    const now = Date.now() / 1000
    const diff = Math.floor(now - ts)

    if (diff < 60) return t('time.justNow')
    if (diff < 3600) return t('time.minutesAgo', { count: Math.floor(diff / 60) })
    if (diff < 86400) return t('time.hoursAgo', { count: Math.floor(diff / 3600) })

    return t('time.daysAgo', { count: Math.floor(diff / 86400) })
  }

  const recentErrors = pbs.recentErrors || []
  const backups24h = pbs.backups24h || {}
  const items = []

  recentErrors.forEach(err => {
    items.push({ type: 'error', name: err.id || 'Unknown', taskType: err.type, time: err.time, server: err.server, status: err.status })
  })

  if (items.length === 0 && backups24h.total > 0) {
    return (
      <div className='h-full flex flex-col justify-center p-4'>
        <div className='text-center'>
          <span className='block text-3xl font-extrabold' style={{ color: backups24h.error > 0 ? '#ff9800' : '#4caf50' }}>
            {backups24h.ok}/{backups24h.total}
          </span>
          <span className='block text-xs opacity-60'>{t('dashboard.widgets.backups')} (24h)</span>
        </div>
        {backups24h.error > 0 && (
          <div className='mt-4 p-3 rounded text-center' style={{ backgroundColor: '#ff980022' }}>
            <span className='text-sm font-bold' style={{ color: '#ff9800' }}>{backups24h.error} {t('jobs.failed').toLowerCase()}</span>
          </div>
        )}
        {backups24h.error === 0 && (
          <div className='mt-4 p-3 rounded text-center' style={{ backgroundColor: '#4caf5022' }}>
            <span className='text-sm font-bold' style={{ color: '#4caf50' }}>{t('common.success')}</span>
          </div>
        )}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className='h-full flex items-center justify-center p-4'>
        <span className='text-xs opacity-60'>{t('common.noData')}</span>
      </div>
    )
  }

  return (
    <div className='h-full overflow-auto p-1'>
      {items.map((item, idx) => (
        <div key={idx} className='py-1.5 border-b last:border-b-0' style={{ borderColor: 'var(--pc-border-subtle)' }}>
          <div className='flex items-center gap-2 mb-0.5'>
            <span className='inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded text-white' style={{ backgroundColor: item.type === 'error' ? '#f44336' : '#4caf50' }}>
              {item.type === 'error' ? t('jobs.failed') : 'OK'}
            </span>
            <span className='text-[11px] font-semibold'>{item.name}</span>
          </div>
          <span className='text-[9px] opacity-50'>{item.taskType} • {item.server} • {timeAgo(item.time)}</span>
        </div>
      ))}
    </div>
  )
}

export default React.memo(BackupRecentWidget)
