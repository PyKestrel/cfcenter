'use client'

import React from 'react'

import { useTranslations } from 'next-intl'

function KpiVmsWidget({ data, loading }) {
  const t = useTranslations()
  const primaryColor = 'var(--pc-primary)'
  const summary = data?.summary || {}

  return (
    <div className='h-full flex items-center p-2'>
      <div
        className='w-11 h-11 rounded-lg flex items-center justify-center shrink-0 mr-3'
        style={{ backgroundColor: 'color-mix(in srgb, var(--pc-primary) 10%, transparent)' }}
      >
        <i className='ri-computer-line' style={{ fontSize: 22, color: primaryColor }} />
      </div>
      <div className='flex-1 min-w-0'>
        <span className='block text-[10px] opacity-60 font-semibold uppercase tracking-wide'>
          {t('dashboard.widgets.vms')} ({t('common.active').toLowerCase()} / {t('common.total').toLowerCase()})
        </span>
        <span className='block text-lg font-extrabold leading-tight' style={{ color: primaryColor }}>
          {summary.vmsRunning || 0} / {summary.vmsTotal || 0}
        </span>
        <span className='block text-[10px] opacity-50'>
          CPU {summary.cpuPct || 0}% • RAM {summary.ramPct || 0}%
        </span>
      </div>
    </div>
  )
}

export default React.memo(KpiVmsWidget)
