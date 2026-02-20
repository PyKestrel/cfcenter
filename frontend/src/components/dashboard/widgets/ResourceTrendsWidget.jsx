'use client'

import React, { useEffect, useMemo, useState } from 'react'

import { useTranslations } from 'next-intl'
import { SpinnerGap } from '@phosphor-icons/react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'

const TIMEFRAMES = [
  { value: 'hour', label: '1h' },
  { value: 'day', label: '24h' },
  { value: 'week', label: '7d' },
]

const CPU_COLOR = 'var(--pc-primary, #3b82f6)'
const RAM_COLOR = '#8b5cf6'

function ResourceTrendsWidget({ data, loading: dashboardLoading }) {
  const t = useTranslations()
  const [timeframe, setTimeframe] = useState('hour')
  const [trendsData, setTrendsData] = useState(null)
  const [loading, setLoading] = useState(false)

  // Group nodes by connection
  const nodesByConnection = useMemo(() => {
    const nodes = data?.nodes || []
    const grouped = {}

    nodes.forEach((node) => {
      const connId = node.connectionId
      if (!connId) return
      if (!grouped[connId]) grouped[connId] = []
      grouped[connId].push({ node: node.name })
    })

    return grouped
  }, [data?.nodes])

  // Fetch trends data when timeframe or nodes change
  useEffect(() => {
    const fetchTrends = async () => {
      const connIds = Object.keys(nodesByConnection)
      if (connIds.length === 0) return

      setLoading(true)
      try {
        // Fetch trends for all connections in parallel
        const results = await Promise.all(
          connIds.map(async (connId) => {
            const items = nodesByConnection[connId]
            const res = await fetch(`/api/v1/connections/${connId}/nodes/trends`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ items, timeframe }),
            })
            if (!res.ok) return {}
            const json = await res.json()
            return json.data || {}
          })
        )

        // Merge all results and calculate averages per timestamp
        const timeMap = new Map()

        results.forEach((connData) => {
          Object.values(connData).forEach((nodePoints) => {
            if (!Array.isArray(nodePoints)) return
            nodePoints.forEach((point) => {
              const key = point.t
              if (!timeMap.has(key)) {
                timeMap.set(key, { t: key, cpuSum: 0, ramSum: 0, count: 0 })
              }
              const entry = timeMap.get(key)
              entry.cpuSum += point.cpu || 0
              entry.ramSum += point.ram || 0
              entry.count += 1
            })
          })
        })

        // Convert to array with averages
        const aggregated = Array.from(timeMap.values())
          .map((entry) => ({
            t: entry.t,
            cpu: entry.count > 0 ? Math.round((entry.cpuSum / entry.count) * 10) / 10 : 0,
            ram: entry.count > 0 ? Math.round((entry.ramSum / entry.count) * 10) / 10 : 0,
          }))
          .sort((a, b) => {
            // Sort by time (HH:MM format)
            return a.t.localeCompare(b.t)
          })

        setTrendsData(aggregated)
      } catch (e) {
        console.error('Failed to fetch trends:', e)
        setTrendsData([])
      } finally {
        setLoading(false)
      }
    }

    fetchTrends()
  }, [nodesByConnection, timeframe])

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null

    return (
      <div className='px-2 py-1.5 rounded shadow-lg border text-xs' style={{ backgroundColor: 'var(--pc-bg-elevated)', borderColor: 'var(--pc-border)' }}>
        <span className='font-semibold block'>{label}</span>
        {payload.map((entry) => (
          <span key={entry.dataKey} className='block' style={{ color: entry.color }}>
            {entry.dataKey === 'cpu' ? 'CPU' : 'RAM'}: {entry.value}%
          </span>
        ))}
      </div>
    )
  }

  if (dashboardLoading || loading) {
    return (
      <div className='h-full flex items-center justify-center'>
        <SpinnerGap size={24} className='animate-spin' style={{ color: 'var(--pc-primary)' }} />
      </div>
    )
  }

  if (!trendsData || trendsData.length === 0) {
    return (
      <div className='h-full flex items-center justify-center'>
        <span className='text-xs' style={{ color: 'var(--pc-text-muted)' }}>{t('common.noData')}</span>
      </div>
    )
  }

  return (
    <div className='h-full flex flex-col'>
      {/* Timeframe selector */}
      <div className='flex justify-end mb-2'>
        <div className='flex rounded overflow-hidden border' style={{ borderColor: 'var(--pc-border)' }}>
          {TIMEFRAMES.map((tf) => (
            <button key={tf.value} onClick={() => setTimeframe(tf.value)}
              className='px-2 py-0.5 text-[11px] font-medium transition-colors min-w-[32px]'
              style={{
                backgroundColor: timeframe === tf.value ? 'var(--pc-primary)' : 'transparent',
                color: timeframe === tf.value ? '#fff' : 'var(--pc-text-secondary)',
              }}>
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className='flex-1 min-h-0'>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trendsData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="cpuGradientTrends" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="ramGradientTrends" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={RAM_COLOR} stopOpacity={0.3} />
                <stop offset="95%" stopColor={RAM_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--pc-border-subtle)" />
            <XAxis
              dataKey="t"
              tick={{ fontSize: 10, fill: 'var(--pc-text-muted)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: 'var(--pc-text-muted)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconSize={8}
              wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
            />
            <Area
              type="monotone"
              dataKey="cpu"
              name="CPU"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#cpuGradientTrends)"
            />
            <Area
              type="monotone"
              dataKey="ram"
              name="RAM"
              stroke={RAM_COLOR}
              strokeWidth={2}
              fill="url(#ramGradientTrends)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default React.memo(ResourceTrendsWidget)
