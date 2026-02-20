'use client'

import React from 'react'

import { useTranslations } from 'next-intl'

function ProgressBar({ value }) {
  const pct = Math.min(value || 0, 100)

  return (
    <div className='relative h-3.5 rounded-sm overflow-hidden flex-1' style={{ backgroundColor: 'var(--pc-bg-subtle)' }}>
      <div className='absolute inset-y-0 left-0 rounded-sm' style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #22c55e 0%, #eab308 50%, #ef4444 100%)', backgroundSize: pct > 0 ? `${(100 / pct) * 100}% 100%` : '100% 100%' }} />
      <span className='absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white' style={{ textShadow: '0 0 2px rgba(0,0,0,0.5)' }}>{value}%</span>
    </div>
  )
}

function TopConsumersWidget({ data, loading }) {
  const t = useTranslations()
  const topCpu = data?.topCpu || []
  const topRam = data?.topRam || []

  if (topCpu.length === 0 && topRam.length === 0) {
    return (
      <div className='h-full flex items-center justify-center p-4'>
        <div className='w-full text-center text-sm px-3 py-2 rounded-lg' style={{ backgroundColor: '#2196f318', color: '#2196f3' }}>{t('common.noData')}</div>
      </div>
    )
  }

  return (
    <div className='h-full grid grid-cols-2 gap-4 p-2 overflow-auto'>
      <div>
        <span className='text-xs opacity-60 font-semibold mb-2 block'>TOP {t('monitoring.cpu').toUpperCase()}</span>
        {topCpu.slice(0, 10).map((vm, idx) => (
          <div key={idx} className='flex items-center gap-2 mb-2.5'>
            <span className='text-[11px] font-medium w-[100px] truncate'>{vm.name}</span>
            <ProgressBar value={vm.value} />
          </div>
        ))}
      </div>
      <div>
        <span className='text-xs opacity-60 font-semibold mb-2 block'>TOP {t('monitoring.memory').toUpperCase()}</span>
        {topRam.slice(0, 10).map((vm, idx) => (
          <div key={idx} className='flex items-center gap-2 mb-2.5'>
            <span className='text-[11px] font-medium w-[100px] truncate'>{vm.name}</span>
            <ProgressBar value={vm.value} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default React.memo(TopConsumersWidget)
