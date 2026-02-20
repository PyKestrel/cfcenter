'use client'

import React from 'react'

import { useTranslations } from 'next-intl'
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

function GaugeChart({ value, label, subtitle, color, size = 150 }) {
  return (
    <div className='text-center flex-1 flex flex-col items-center'>
      <div className='relative mx-auto' style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={[
                { value: Math.min(value || 0, 100) },
                { value: Math.max(100 - (value || 0), 0) }
              ]}
              innerRadius="70%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              stroke="none"
            >
              <Cell fill={color || '#4caf50'} />
              <Cell fill="rgba(255,255,255,0.08)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center'>
          <span className='text-xl font-extrabold leading-none'>{value || 0}%</span>
        </div>
      </div>
      <span className='font-bold mt-3 block'>{label}</span>
      {subtitle && <span className='text-sm opacity-50'>{subtitle}</span>}
    </div>
  )
}

function ResourcesGaugesWidget({ data, loading }) {
  const t = useTranslations()
  const primaryColor = 'var(--pc-primary)'
  const resources = data?.resources || {}

  return (
    <div className='h-full flex justify-around items-center p-4 gap-4'>
      <GaugeChart
        value={resources.cpuPct}
        label={t('monitoring.cpu')}
        subtitle={`${resources.cpuCores || 0} cores`}
        color={primaryColor}
      />
      <GaugeChart
        value={resources.ramPct}
        label={t('monitoring.memory')}
        subtitle={resources.memUsedFormatted ? `${resources.memUsedFormatted}` : '0'}
        color={primaryColor}
      />
      <GaugeChart
        value={resources.storagePct}
        label={t('storage.title')}
        subtitle={resources.storageUsedFormatted ? `${resources.storageUsedFormatted}` : '0'}
        color={primaryColor}
      />
    </div>
  )
}

export default React.memo(ResourcesGaugesWidget)
