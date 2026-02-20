'use client'

import React from 'react'

import { useTranslations } from 'next-intl'

function QuickStatsWidget({ data, loading }) {
  const t = useTranslations()
  const summary = data?.summary || {}
  const alertsSummary = data?.alertsSummary || {}

  const stats = [
    { label: t('dashboard.widgets.nodes'), value: `${summary.nodesOnline || 0}/${summary.nodes || 0}`, icon: 'ri-server-line', color: summary.nodesOffline > 0 ? '#f44336' : '#4caf50' },
    { label: t('dashboard.widgets.vms'), value: `${summary.vmsRunning || 0}/${summary.vmsTotal || 0}`, icon: 'ri-computer-line', color: '#2196f3' },
    { label: 'LXC', value: `${summary.lxcRunning || 0}/${summary.lxcTotal || 0}`, icon: 'ri-instance-line', color: '#9c27b0' },
    { label: t('monitoring.cpu'), value: `${summary.cpuPct || 0}%`, icon: 'ri-cpu-line', color: (summary.cpuPct || 0) > 80 ? '#f44336' : '#4caf50' },
    { label: t('monitoring.memory'), value: `${summary.ramPct || 0}%`, icon: 'ri-ram-line', color: (summary.ramPct || 0) > 80 ? '#f44336' : '#4caf50' },
    { label: t('dashboard.widgets.alerts'), value: (alertsSummary.crit || 0) + (alertsSummary.warn || 0), icon: 'ri-alarm-warning-line', color: alertsSummary.crit > 0 ? '#f44336' : alertsSummary.warn > 0 ? '#ff9800' : '#4caf50' },
  ]

  return (
    <div className='h-full flex items-center justify-around p-2 flex-wrap gap-2'>
      {stats.map((stat, idx) => (
        <div key={idx} className='text-center min-w-[60px]'>
          <div className='flex items-center justify-center gap-1'>
            <i className={stat.icon} style={{ fontSize: 14, color: stat.color }} />
            <span className='font-extrabold' style={{ color: stat.color }}>{stat.value}</span>
          </div>
          <span className='text-[9px] opacity-60'>{stat.label}</span>
        </div>
      ))}
    </div>
  )
}

export default React.memo(QuickStatsWidget)
