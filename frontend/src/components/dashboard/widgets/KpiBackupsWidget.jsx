'use client'

import React from 'react'

import { useTranslations } from 'next-intl'

function KpiBackupsWidget({ data, loading }) {
  const t = useTranslations()
  const pbs = data?.pbs || {}
  const hasError = pbs.backups24h?.error > 0
  const hasServers = pbs.servers > 0
  const color = hasError ? '#ff9800' : hasServers ? '#4caf50' : '#9e9e9e'

  return (
    <div className='h-full flex items-center p-2'>
      <div
        className='w-11 h-11 rounded-lg flex items-center justify-center shrink-0 mr-3'
        style={{ backgroundColor: `${color}18` }}
      >
        <i className='ri-shield-check-line' style={{ fontSize: 22, color }} />
      </div>
      <div className='flex-1 min-w-0'>
        <span className='block text-[10px] opacity-60 font-semibold uppercase tracking-wide'>
          {t('dashboard.widgets.backups')} PBS (24h)
        </span>
        <span className='block text-lg font-extrabold leading-tight' style={{ color }}>
          {pbs.backups24h?.total > 0 ? `${pbs.backups24h?.ok || 0} / ${pbs.backups24h?.total || 0}` : '—'}
        </span>
        <span className='block text-[10px] opacity-50'>
          {hasError ? `${pbs.backups24h.error} ${t('jobs.failed').toLowerCase()}` : hasServers ? `${pbs.servers} PBS` : t('common.noData')}
        </span>
      </div>
    </div>
  )
}

export default React.memo(KpiBackupsWidget)
