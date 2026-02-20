'use client'

import React from 'react'

import { useTranslations } from 'next-intl'

function formatUptime(seconds) {
  if (!seconds || seconds <= 0) return '—'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)

  if (days > 0) return `${days}j ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`

  return `${mins}m`
}

function getUptimeColor(seconds) {
  if (!seconds) return '#9e9e9e'
  const days = seconds / 86400

  if (days > 30) return '#4caf50'
  if (days > 7) return '#8bc34a'
  if (days > 1) return '#ff9800'

  return '#f44336'
}

function UptimeNodesWidget({ data, loading }) {
  const t = useTranslations()
  const nodes = data?.nodes || []

  if (nodes.length === 0) {
    return (
      <div className='h-full flex items-center justify-center p-4'>
        <span className='text-xs opacity-60'>{t('common.noData')}</span>
      </div>
    )
  }

  const sortedNodes = [...nodes].sort((a, b) => (b.uptime || 0) - (a.uptime || 0))

  return (
    <div className='h-full overflow-auto p-1'>
      {sortedNodes.map((node, idx) => {
        const color = node.status === 'online' ? getUptimeColor(node.uptime) : '#f44336'

        return (
          <div key={idx} className='flex items-center justify-between py-1.5 border-b last:border-b-0' style={{ borderColor: 'var(--pc-border-subtle)' }}>
            <div className='flex items-center gap-2'>
              <span className='w-2 h-2 rounded-full shrink-0' style={{ backgroundColor: node.status === 'online' ? '#4caf50' : '#f44336' }} />
              <span className='text-[11px] font-semibold'>{node.name}</span>
              <span className='text-[10px] opacity-50'>{node.connection}</span>
            </div>
            <div className='flex items-center gap-2'>
              <i className='ri-time-line' style={{ fontSize: 12, color, opacity: 0.8 }} />
              <span className='text-[11px] font-bold' style={{ color }}>
                {node.status === 'online' ? formatUptime(node.uptime) : t('common.offline')}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default React.memo(UptimeNodesWidget)
