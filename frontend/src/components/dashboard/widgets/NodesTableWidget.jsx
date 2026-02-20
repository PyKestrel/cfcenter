'use client'

import React from 'react'

import { useTranslations } from 'next-intl'

function ProgressBar({ value }) {
  const pct = value || 0

  return (
    <div className='relative h-3.5 rounded-sm overflow-hidden min-w-[80px]' style={{ backgroundColor: 'var(--pc-bg-subtle)' }}>
      <div className='absolute inset-y-0 left-0 rounded-sm' style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #22c55e 0%, #eab308 50%, #ef4444 100%)', backgroundSize: pct > 0 ? `${(100 / pct) * 100}% 100%` : '100% 100%' }} />
      <span className='absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white' style={{ textShadow: '0 0 2px rgba(0,0,0,0.5)' }}>{pct}%</span>
    </div>
  )
}

function NodesTableWidget({ data, loading }) {
  const t = useTranslations()
  const nodes = data?.nodes || []

  if (nodes.length === 0) {
    return (
      <div className='h-full flex items-center justify-center p-4'>
        <div className='w-full text-center text-sm px-3 py-2 rounded-lg' style={{ backgroundColor: '#2196f318', color: '#2196f3' }}>{t('common.noData')}</div>
      </div>
    )
  }

  return (
    <div className='h-full overflow-auto'>
      <table className='w-full text-xs'>
        <thead className='sticky top-0' style={{ backgroundColor: 'var(--pc-bg-card)' }}>
          <tr className='border-b' style={{ borderColor: 'var(--pc-border-subtle)' }}>
            <th className='text-left font-extrabold py-2 px-2'>{t('dashboard.widgets.nodes')}</th>
            <th className='text-left font-extrabold py-2 px-2'>{t('inventory.clusters')}</th>
            <th className='text-center font-extrabold py-2 px-2'>{t('common.status')}</th>
            <th className='text-left font-extrabold py-2 px-2'>{t('monitoring.cpu')}</th>
            <th className='text-left font-extrabold py-2 px-2'>{t('monitoring.memory')}</th>
          </tr>
        </thead>
        <tbody>
          {[...nodes].sort((a, b) => (b.memPct || 0) - (a.memPct || 0)).map((node, idx) => (
            <tr key={idx} className='border-b hover:bg-[var(--pc-bg-subtle)] transition-colors' style={{ borderColor: 'var(--pc-border-subtle)' }}>
              <td className='py-1.5 px-2'>
                <div className='flex items-center gap-2'>
                  <span className='w-2 h-2 rounded-full shrink-0' style={{ backgroundColor: node.status === 'online' ? '#4caf50' : '#f44336' }} />
                  <span className='font-bold'>{node.name}</span>
                </div>
              </td>
              <td className='py-1.5 px-2 opacity-70 text-[11px]'>{node.connection}</td>
              <td className='py-1.5 px-2 text-center'>
                <span className='text-[10px] font-semibold px-1.5 py-0.5 rounded border' style={{ color: node.status === 'online' ? '#4caf50' : '#f44336', borderColor: node.status === 'online' ? '#4caf50' : '#f44336' }}>
                  {node.status === 'online' ? t('common.online') : t('common.offline')}
                </span>
              </td>
              <td className='py-1.5 px-2'><ProgressBar value={node.cpuPct} /></td>
              <td className='py-1.5 px-2'><ProgressBar value={node.memPct} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default React.memo(NodesTableWidget)
