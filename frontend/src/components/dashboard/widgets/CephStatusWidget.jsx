'use client'

import React from 'react'

import { useTranslations } from 'next-intl'

function CephStatusWidget({ data, loading }) {
  const t = useTranslations()
  const ceph = data?.ceph

  if (!ceph || !ceph.available) {
    return (
      <div className='h-full flex items-center justify-center p-4'>
        <div className='w-full text-center text-sm px-3 py-2 rounded-lg' style={{ backgroundColor: '#2196f318', color: '#2196f3' }}>
          {t('common.notAvailable')}
        </div>
      </div>
    )
  }

  const healthColor = ceph.health === 'HEALTH_OK' ? '#4caf50' : ceph.health === 'HEALTH_WARN' ? '#ff9800' : '#f44336'
  const usedPct = ceph.usedPct || 0

  return (
    <div className='h-full flex flex-col gap-3 p-2 overflow-auto'>
      {/* Health */}
      <div className='flex items-center justify-between'>
        <span className='text-[10px] opacity-60 font-semibold'>HEALTH</span>
        <span className='text-[10px] font-bold px-2 py-0.5 rounded' style={{ backgroundColor: `${healthColor}22`, color: healthColor }}>
          {ceph.health?.replace('HEALTH_', '') || 'UNKNOWN'}
        </span>
      </div>

      {/* Storage */}
      <div>
        <span className='text-[10px] opacity-60 font-semibold'>{t('storage.title').toUpperCase()}</span>
        <div className='relative mt-1 h-3.5 rounded-sm overflow-hidden' style={{ backgroundColor: 'var(--pc-bg-subtle)' }}>
          <div
            className='absolute inset-y-0 left-0 rounded-sm'
            style={{
              width: `${usedPct}%`,
              background: 'linear-gradient(90deg, #22c55e 0%, #eab308 50%, #ef4444 100%)',
              backgroundSize: usedPct > 0 ? `${(100 / usedPct) * 100}% 100%` : '100% 100%',
            }}
          />
          <span className='absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white' style={{ textShadow: '0 0 2px rgba(0,0,0,0.5)' }}>
            {usedPct}%
          </span>
        </div>
      </div>

      {/* OSDs */}
      <div className='grid grid-cols-2 gap-2'>
        <div>
          <span className='text-[10px] opacity-60 font-semibold'>OSDs</span>
          <div className='text-sm font-bold'>
            {ceph.osdsUp || 0} / {ceph.osdsTotal || 0}
            <span className='text-xs opacity-60 ml-1'>up</span>
          </div>
        </div>
        <div>
          <span className='text-[10px] opacity-60 font-semibold'>PGs</span>
          <div className='text-sm font-bold'>{ceph.pgsTotal || 0}</div>
        </div>
      </div>

      {/* I/O */}
      {(ceph.readBps > 0 || ceph.writeBps > 0) && (
        <div className='grid grid-cols-2 gap-2'>
          <div>
            <span className='text-[10px] opacity-60 font-semibold'>READ</span>
            <div className='text-xs font-bold'>{formatBps(ceph.readBps)}</div>
          </div>
          <div>
            <span className='text-[10px] opacity-60 font-semibold'>WRITE</span>
            <div className='text-xs font-bold'>{formatBps(ceph.writeBps)}</div>
          </div>
        </div>
      )}
    </div>
  )
}

function formatBps(bps) {
  if (!bps || bps === 0) return '0 B/s'
  const k = 1024
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s']
  const i = Math.floor(Math.log(bps) / Math.log(k))

  return parseFloat((bps / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default React.memo(CephStatusWidget)
