'use client'

import React from 'react'

import { useTranslations } from 'next-intl'

function KpiClustersWidget({ data, loading }) {
  const t = useTranslations()
  const summary = data?.summary || {}
  const hasOffline = summary.nodesOffline > 0
  const color = hasOffline ? '#f44336' : '#4caf50'

  return (
    <div className='h-full flex items-center p-2'>
      <div
        className='w-11 h-11 rounded-lg flex items-center justify-center shrink-0 mr-3'
        style={{ backgroundColor: `${color}18` }}
      >
        <i className='ri-server-line' style={{ fontSize: 22, color }} />
      </div>
      <div className='flex-1 min-w-0'>
        <span className='block text-[10px] opacity-60 font-semibold uppercase tracking-wide'>
          {t('inventory.clusters')} / {t('dashboard.widgets.nodes')}
        </span>
        <span className='block text-lg font-extrabold leading-tight' style={{ color }}>
          {summary.clusters || 0} / {summary.nodes || 0}
        </span>
        <span className='block text-[10px] opacity-50'>
          {hasOffline ? `${summary.nodesOffline} ${t('common.offline').toLowerCase()}` : t('common.online')}
        </span>
      </div>
    </div>
  )
}

export default React.memo(KpiClustersWidget)
