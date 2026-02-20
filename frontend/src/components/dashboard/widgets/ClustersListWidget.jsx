'use client'

import React from 'react'

import { useTranslations } from 'next-intl'

const HEALTH_COLORS = { HEALTH_OK: '#4caf50', HEALTH_WARN: '#ff9800', HEALTH_ERR: '#f44336' }

function ClustersListWidget({ data, loading }) {
  const t = useTranslations()
  const clusters = (data?.clusters || []).filter(c => c.isCluster)

  if (clusters.length === 0) {
    return (
      <div className='h-full flex items-center justify-center p-4'>
        <span className='text-xs opacity-60'>{t('common.noData')}</span>
      </div>
    )
  }

  return (
    <div className='h-full flex flex-col gap-2 p-2 overflow-auto'>
      {clusters.map((cluster, idx) => (
        <div key={idx} className='p-3 rounded-lg flex items-center justify-between gap-2' style={{ backgroundColor: 'var(--pc-bg-subtle)' }}>
          <div className='min-w-0'>
            <span className='block text-[13px] font-bold'>{cluster.name}</span>
            <span className='block text-[10px] opacity-60'>
              {cluster.nodes} {t('inventory.nodes').toLowerCase()} • {cluster.onlineNodes} {t('common.online').toLowerCase()}
            </span>
          </div>
          <div className='flex gap-1 shrink-0'>
            {cluster.quorum && (
              <span className='text-[9px] font-semibold px-1.5 py-0.5 rounded text-white' style={{ backgroundColor: cluster.quorum.quorate ? '#4caf50' : '#f44336' }}>
                Quorum
              </span>
            )}
            {cluster.cephHealth && (
              <span className='text-[9px] font-semibold px-1.5 py-0.5 rounded text-white' style={{ backgroundColor: HEALTH_COLORS[cluster.cephHealth] || '#f44336' }}>
                {cluster.cephHealth.replace('HEALTH_', '')}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default React.memo(ClustersListWidget)
