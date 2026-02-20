'use client'

import React from 'react'

import { useTranslations } from 'next-intl'
import { SpinnerGap } from '@phosphor-icons/react'

import { useLicense } from '@/contexts/LicenseContext'
import { useVMFirewallCoverage } from '@/hooks/useZeroTrust'

function ProgressBar({ value, label }) {
  const pct = Math.min(value || 0, 100)

  return (
    <div className='mb-3'>
      <span className='text-[10px] mb-1 block' style={{ color: 'var(--pc-text-muted)' }}>{label}</span>
      <div className='relative h-3.5 rounded-sm overflow-hidden' style={{ backgroundColor: 'var(--pc-bg-subtle)' }}>
        <div className='absolute inset-y-0 left-0 rounded-sm' style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #22c55e 0%, #eab308 50%, #ef4444 100%)', backgroundSize: pct > 0 ? `${(100 / pct) * 100}% 100%` : '100% 100%' }} />
        <span className='absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white' style={{ textShadow: '0 0 2px rgba(0,0,0,0.5)' }}>{Math.round(pct)}%</span>
      </div>
    </div>
  )
}

function ZeroTrustCoverageWidget({ data, loading, config }) {
  const t = useTranslations('firewall')
  const { isEnterprise } = useLicense()
  const { data: vmData = [], isLoading: loadingData } = useVMFirewallCoverage(isEnterprise, 60000)

  if (loadingData) {
    return (
      <div className='h-full flex items-center justify-center'>
        <SpinnerGap size={24} className='animate-spin' style={{ color: 'var(--pc-primary)' }} />
      </div>
    )
  }

  // En mode Community, afficher un message
  if (!isEnterprise) {
    return (
      <div className='h-full flex flex-col items-center justify-center p-4 text-center'>
        <i className='ri-vip-crown-fill' style={{ fontSize: 32, color: '#f59e0b', marginBottom: 8 }} />
        <span className='text-xs opacity-60'>Enterprise</span>
      </div>
    )
  }

  const total = vmData.length || 1
  const protected_ = vmData.filter(v => v.firewallEnabled).length
  const withSG = vmData.filter(v => v.hasSG).length

  const protectionRate = (protected_ / total) * 100
  const sgRate = (withSG / total) * 100

  return (
    <div className='h-full flex flex-col p-3'>
      <span className='text-xs opacity-60 font-semibold uppercase tracking-wider mb-3'>{t('vmFirewallCoverage')}</span>

      {/* Stats Row */}
      <div className='flex gap-2 mb-4'>
        <div className='flex-1 text-center p-2 rounded' style={{ backgroundColor: '#22c55e1a' }}>
          <div className='text-xl font-black leading-none' style={{ color: '#22c55e' }}>{protected_}</div>
          <span className='text-[9px]' style={{ color: 'var(--pc-text-muted)' }}>{t('protectedLabel')}</span>
        </div>
        <div className='flex-1 text-center p-2 rounded' style={{ backgroundColor: '#ef44441a' }}>
          <div className='text-xl font-black leading-none' style={{ color: '#ef4444' }}>{total - protected_}</div>
          <span className='text-[9px]' style={{ color: 'var(--pc-text-muted)' }}>{t('unprotectedLabel')}</span>
        </div>
        <div className='flex-1 text-center p-2 rounded' style={{ backgroundColor: '#8b5cf61a' }}>
          <div className='text-xl font-black leading-none' style={{ color: '#8b5cf6' }}>{withSG}</div>
          <span className='text-[9px]' style={{ color: 'var(--pc-text-muted)' }}>{t('withSgLabel')}</span>
        </div>
      </div>

      {/* Progress Bars */}
      <div className='flex-1'>
        <ProgressBar value={protectionRate} label='Protection' />
        <ProgressBar value={sgRate} label='Micro-segmentation' />
      </div>
    </div>
  )
}

export default React.memo(ZeroTrustCoverageWidget)
