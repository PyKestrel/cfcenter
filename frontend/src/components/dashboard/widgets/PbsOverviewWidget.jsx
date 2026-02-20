'use client'

import React from 'react'

import { useTranslations } from 'next-intl'

function PbsOverviewWidget({ data, loading }) {
  const t = useTranslations()
  const pbs = data?.pbs || {}

  if (!pbs.servers || pbs.servers === 0) {
    return (
      <div className='h-full flex items-center justify-center p-4'>
        <div className='w-full text-center text-sm px-3 py-2 rounded-lg' style={{ backgroundColor: '#2196f318', color: '#2196f3' }}>{t('common.noData')}</div>
      </div>
    )
  }

  const usagePct = pbs.usagePct || 0

  return (
    <div className='h-full flex flex-col gap-3 p-2 overflow-auto'>
      {/* Stats globales */}
      <div className='grid grid-cols-2 gap-4'>
        <div>
          <span className='text-[10px] opacity-60 font-semibold'>{t('storage.title').toUpperCase()} PBS</span>
          <div className='mt-1'>
            <div className='relative h-3.5 rounded-sm overflow-hidden mb-1' style={{ backgroundColor: 'var(--pc-bg-subtle)' }}>
              <div className='absolute inset-y-0 left-0 rounded-sm' style={{ width: `${usagePct}%`, background: 'linear-gradient(90deg, #22c55e 0%, #eab308 50%, #ef4444 100%)', backgroundSize: usagePct > 0 ? `${(100 / (usagePct || 1)) * 100}% 100%` : '100% 100%' }} />
              <span className='absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white' style={{ textShadow: '0 0 2px rgba(0,0,0,0.5)' }}>{usagePct}%</span>
            </div>
            <span className='text-[9px] opacity-60'>{pbs.totalUsedFormatted} / {pbs.totalSizeFormatted}</span>
          </div>
        </div>
        <div>
          <span className='text-[10px] opacity-60 font-semibold'>{t('dashboard.widgets.activity').toUpperCase()} 24H</span>
          <div className='mt-1 space-y-0.5'>
            <div className='flex items-center gap-1 text-[11px]'>
              <i className='ri-checkbox-circle-fill' style={{ color: '#4caf50', fontSize: 12 }} />
              Backups OK: <strong>{pbs.backups24h?.ok || 0}</strong>
            </div>
            {pbs.backups24h?.error > 0 && (
              <div className='flex items-center gap-1 text-[11px]' style={{ color: '#f44336' }}>
                <i className='ri-close-circle-fill' style={{ fontSize: 12 }} />
                {t('jobs.failed')}: <strong>{pbs.backups24h.error}</strong>
              </div>
            )}
            <div className='flex items-center gap-1 text-[11px]'>
              <i className='ri-verified-badge-fill' style={{ color: '#2196f3', fontSize: 12 }} />
              Verify: <strong>{pbs.verify24h?.ok || 0}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Serveurs PBS */}
      {pbs.serverDetails?.length > 0 && (
        <div>
          <span className='text-[10px] opacity-60 font-semibold mb-1 block'>{t('storage.server').toUpperCase()}</span>
          {pbs.serverDetails.map((server, idx) => (
            <div key={idx} className='flex items-center justify-between py-1 border-b' style={{ borderColor: 'var(--pc-border-subtle)' }}>
              <div className='flex items-center gap-2'>
                <i className='ri-hard-drive-2-line' style={{ opacity: 0.6, fontSize: 12 }} />
                <span className='text-[11px] font-semibold'>{server.name}</span>
              </div>
              <div className='flex items-center gap-2'>
                <span className='text-[10px] opacity-60'>{server.datastores} DS</span>
                <span className='text-[9px] font-bold px-1.5 py-0.5 rounded' style={{
                  backgroundColor: server.usagePct > 80 ? '#f4433622' : server.usagePct > 60 ? '#ff980022' : '#4caf5022',
                  color: server.usagePct > 80 ? '#f44336' : server.usagePct > 60 ? '#ff9800' : '#4caf50',
                }}>{server.usagePct}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Erreurs récentes */}
      {pbs.recentErrors?.length > 0 && (
        <div className='px-2 py-1 rounded text-[10px] font-semibold' style={{ backgroundColor: '#ff980018', color: '#ff9800' }}>
          {pbs.recentErrors.length} {t('common.error').toLowerCase()}(s)
        </div>
      )}
    </div>
  )
}

export default React.memo(PbsOverviewWidget)
