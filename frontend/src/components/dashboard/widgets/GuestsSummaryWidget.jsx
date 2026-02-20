'use client'

import React from 'react'

import { useTranslations } from 'next-intl'

function StatusDot({ color }) {
  return <span className='inline-block w-2 h-2 rounded-full shrink-0' style={{ backgroundColor: color }} />
}

function GuestsSummaryWidget({ data, loading }) {
  const t = useTranslations()
  const guests = data?.guests || {}

  return (
    <div className='h-full grid grid-cols-2 gap-4 p-2'>
      <div>
        <span className='text-[10px] opacity-60 font-semibold'>{t('dashboard.widgets.vms').toUpperCase()}</span>
        <div className='mt-2 space-y-1'>
          <div className='flex items-center gap-1.5 text-xs'><StatusDot color='#4caf50' /> Running: <strong>{guests?.vms?.running || 0}</strong></div>
          <div className='flex items-center gap-1.5 text-xs'><StatusDot color='#9e9e9e' /> Stopped: <strong>{guests?.vms?.stopped || 0}</strong></div>
          <div className='flex items-center gap-1.5 text-xs'><StatusDot color='#2196f3' /> Templates: <strong>{guests?.vms?.templates || 0}</strong></div>
        </div>
      </div>
      <div>
        <span className='text-[10px] opacity-60 font-semibold'>{t('inventory.containers').toUpperCase()}</span>
        <div className='mt-2 space-y-1'>
          <div className='flex items-center gap-1.5 text-xs'><StatusDot color='#4caf50' /> Running: <strong>{guests?.lxc?.running || 0}</strong></div>
          <div className='flex items-center gap-1.5 text-xs'><StatusDot color='#9e9e9e' /> Stopped: <strong>{guests?.lxc?.stopped || 0}</strong></div>
        </div>
      </div>
    </div>
  )
}

export default React.memo(GuestsSummaryWidget)
