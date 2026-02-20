'use client'

import React from 'react'

import { useTranslations } from 'next-intl'
import { SpinnerGap } from '@phosphor-icons/react'

import { useClusterSecurityGroups } from '@/hooks/useZeroTrust'

const GROUP_COLORS = [
  '#22c55e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4',
  '#ec4899', '#10b981', '#6366f1', '#f97316'
]

function ZeroTrustSecurityGroupsWidget({ data, loading, config }) {
  const t = useTranslations()
  const { data: clustersData = [], isLoading: loadingData } = useClusterSecurityGroups(60000)

  if (loadingData) {
    return (
      <div className='h-full flex items-center justify-center'>
        <SpinnerGap size={24} className='animate-spin' style={{ color: 'var(--pc-primary)' }} />
      </div>
    )
  }

  const totalGroups = clustersData.reduce((acc, c) => acc + c.groups.length, 0)

  return (
    <div className='h-full flex flex-col p-3 overflow-hidden'>
      <div className='flex justify-between items-center mb-3'>
        <span className='text-xs opacity-60 font-semibold uppercase tracking-wider'>Security Groups</span>
        <span className='text-[9px] px-1.5 py-0.5 rounded' style={{ backgroundColor: 'var(--pc-bg-subtle)' }}>{totalGroups} groups</span>
      </div>

      <div className='flex-1 overflow-auto'>
        {clustersData.length > 0 ? (
          <div className='space-y-3'>
            {clustersData.map((cluster) => (
              <div key={cluster.id}>
                <span className='text-[10px] font-semibold mb-1 block' style={{ color: 'var(--pc-text-muted)' }}>{cluster.name}</span>
                {cluster.groups.length > 0 ? (
                  <div className='flex flex-wrap gap-1'>
                    {cluster.groups.map((sg, index) => {
                      const color = GROUP_COLORS[index % GROUP_COLORS.length]
                      const isBase = sg.group?.startsWith('sg-base-')

                      return (
                        <span key={sg.group} className='inline-flex items-center gap-0.5 text-[9px] h-5 px-1.5 rounded-sm' style={{ borderLeft: `2px solid ${color}`, backgroundColor: isBase ? '#8b5cf60d' : 'transparent' }}>
                          {isBase && <i className='ri-lock-line' style={{ fontSize: 9 }} />}
                          {sg.group?.length > 12 ? sg.group.slice(0, 12) + '...' : sg.group}
                        </span>
                      )
                    })}
                    {cluster.groups.length === 10 && (
                      <span className='text-[9px] h-5 px-1.5 rounded-sm flex items-center' style={{ backgroundColor: 'var(--pc-bg-subtle)' }}>...</span>
                    )}
                  </div>
                ) : (
                  <span className='text-[9px]' style={{ color: 'var(--pc-text-muted)' }}>{t('dashboard.noGroup')}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className='flex items-center justify-center h-full'>
            <span className='text-xs' style={{ color: 'var(--pc-text-muted)' }}>{t('dashboard.noPveCluster')}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default React.memo(ZeroTrustSecurityGroupsWidget)
