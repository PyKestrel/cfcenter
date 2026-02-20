'use client'

import React from 'react'

import { useTranslations } from 'next-intl'

function KpiAlertsWidget({ data, loading }) {
  const t = useTranslations()
  const alertsSummary = data?.alertsSummary || {}
  const hasCrit = alertsSummary.crit > 0
  const hasWarn = alertsSummary.warn > 0
  const color = hasCrit ? '#f44336' : hasWarn ? '#ff9800' : '#4caf50'
  const value = hasCrit ? `${alertsSummary.crit} crit` : hasWarn ? `${alertsSummary.warn} warn` : 'OK'

  return (
    <div className='h-full flex items-center p-2'>
      <div
        className='w-11 h-11 rounded-lg flex items-center justify-center shrink-0 mr-3'
        style={{ backgroundColor: `${color}18` }}
      >
        <i className='ri-alarm-warning-line' style={{ fontSize: 22, color }} />
      </div>
      <div className='flex-1 min-w-0'>
        <span className='block text-[10px] opacity-60 font-semibold uppercase tracking-wide'>
          {t('dashboard.widgets.alerts')}
        </span>
        <span className='block text-lg font-extrabold leading-tight' style={{ color }}>
          {value}
        </span>
        <span className='block text-[10px] opacity-50'>
          {hasCrit || hasWarn ? `${alertsSummary.crit || 0} ${t('alerts.critical')} • ${alertsSummary.warn || 0} ${t('alerts.warning')}` : t('alerts.noActiveAlerts')}
        </span>
      </div>
    </div>
  )
}

export default React.memo(KpiAlertsWidget)
