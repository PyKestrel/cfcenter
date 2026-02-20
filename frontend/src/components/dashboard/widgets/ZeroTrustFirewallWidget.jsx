'use client'

import React from 'react'

import { SpinnerGap } from '@phosphor-icons/react'

import { useClusterFirewallOptions } from '@/hooks/useZeroTrust'

function ZeroTrustFirewallWidget({ data, loading, config }) {
  const { data: firewallData, isLoading: loadingData } = useClusterFirewallOptions(30000)

  if (loadingData) {
    return (
      <div className='h-full flex items-center justify-center'>
        <SpinnerGap size={24} className='animate-spin' style={{ color: 'var(--pc-primary)' }} />
      </div>
    )
  }

  const isEnabled = firewallData?.enable === 1
  const policyIn = firewallData?.policy_in || 'ACCEPT'
  const policyOut = firewallData?.policy_out || 'ACCEPT'
  const connectionName = firewallData?.connectionName || ''

  return (
    <div className='h-full flex items-center p-2'>
      <div className='w-11 h-11 rounded-lg flex items-center justify-center shrink-0 mr-3'
        style={{ backgroundColor: isEnabled ? '#22c55e26' : '#ef444426' }}>
        <i className={isEnabled ? 'ri-shield-check-line' : 'ri-shield-cross-line'}
           style={{ fontSize: 22, color: isEnabled ? '#22c55e' : '#ef4444' }} />
      </div>
      <div className='flex-1 min-w-0'>
        <span className='text-xs opacity-60 font-semibold uppercase tracking-wider block'>Firewall Cluster</span>
        <div className='flex items-center gap-2'>
          <span className='text-sm font-bold' style={{ color: isEnabled ? '#22c55e' : '#ef4444' }}>
            {isEnabled ? '● Actif' : '○ Inactif'}
          </span>
          {connectionName && (
            <span className='text-[9px] px-1 py-0.5 rounded' style={{ backgroundColor: 'var(--pc-bg-subtle)' }}>{connectionName}</span>
          )}
        </div>
        <div className='flex gap-1 mt-1'>
          <span className='text-[9px] font-semibold px-1.5 py-0.5 rounded'
            style={{ backgroundColor: policyIn === 'DROP' ? '#ef444426' : '#22c55e26', color: policyIn === 'DROP' ? '#ef4444' : '#22c55e' }}>
            IN: {policyIn}
          </span>
          <span className='text-[9px] font-semibold px-1.5 py-0.5 rounded'
            style={{ backgroundColor: policyOut === 'DROP' ? '#ef444426' : '#22c55e26', color: policyOut === 'DROP' ? '#ef4444' : '#22c55e' }}>
            OUT: {policyOut}
          </span>
        </div>
      </div>
    </div>
  )
}

export default React.memo(ZeroTrustFirewallWidget)
