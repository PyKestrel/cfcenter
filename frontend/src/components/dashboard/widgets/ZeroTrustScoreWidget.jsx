'use client'

import React from 'react'

import { useTranslations } from 'next-intl'
import { SpinnerGap } from '@phosphor-icons/react'

import { useFirewallScores } from '@/hooks/useZeroTrust'

function ZeroTrustScoreWidget({ data, loading, config }) {
  const t = useTranslations()
  const { data: clusters = [], isLoading: loadingData } = useFirewallScores(60000)

  if (loadingData) {
    return (
      <div className='h-full flex items-center justify-center'>
        <SpinnerGap size={24} className='animate-spin' style={{ color: 'var(--pc-primary)' }} />
      </div>
    )
  }

  if (clusters.length === 0) {
    return (
      <div className='h-full flex items-center justify-center'>
        <span className='text-xs' style={{ color: 'var(--pc-text-muted)' }}>{t('dashboard.noPveCluster')}</span>
      </div>
    )
  }

  // Global average score
  const avgScore = Math.round(clusters.reduce((acc, c) => acc + c.score, 0) / clusters.length)
  const avgColor = avgScore >= 80 ? '#22c55e' : avgScore >= 50 ? '#f59e0b' : '#ef4444'

  return (
    <div className='h-full flex flex-col p-3 overflow-hidden'>
      {/* Header with global score */}
      <div className='flex items-center justify-between mb-3'>
        <span className='text-xs opacity-60 font-semibold uppercase tracking-wider'>Zero Trust</span>
        <span className='text-[10px] font-bold px-1.5 py-0.5 rounded' style={{ backgroundColor: `${avgColor}26`, color: avgColor }}>
          Score: {avgScore}
        </span>
      </div>

      {/* Clusters list */}
      <div className='flex-1 overflow-auto space-y-1.5'>
        {clusters.map((cluster) => {
          const color = cluster.score >= 80 ? '#22c55e' : cluster.score >= 50 ? '#f59e0b' : '#ef4444'

          return (
            <div key={cluster.id} className='flex items-center gap-2 p-2 rounded' style={{ backgroundColor: `${color}0d`, border: `1px solid ${color}33` }}>
              <div className='w-7 h-7 rounded flex items-center justify-center shrink-0' style={{ backgroundColor: `${color}26` }} title={cluster.enabled ? 'Firewall actif' : 'Firewall inactif'}>
                <i className={cluster.enabled ? 'ri-shield-check-line' : 'ri-shield-cross-line'} style={{ fontSize: 14, color }} />
              </div>
              <div className='flex-1 min-w-0'>
                <span className='text-xs font-semibold block leading-tight'>{cluster.name}</span>
                <span className='text-[9px]' style={{ color: 'var(--pc-text-muted)' }}>IN: {cluster.policyIn} • OUT: {cluster.policyOut}</span>
              </div>
              <div className='min-w-[32px] text-center px-1 py-0.5 rounded' style={{ backgroundColor: `${color}26` }}>
                <span className='text-[11px] font-black' style={{ color }}>{cluster.score}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default React.memo(ZeroTrustScoreWidget)
