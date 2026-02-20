'use client'

import React, { useEffect, useMemo, useState } from 'react'

import { useTranslations } from 'next-intl'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { SpinnerGap } from '@phosphor-icons/react'

const TIMEFRAMES = [
  { value: 'hour', label: '1h' },
  { value: 'day', label: '24h' },
  { value: 'week', label: '7d' },
]

// Color palette for nodes
const NODE_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316',
  '#eab308', '#84cc16', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#2563eb', '#7c3aed',
]

function InfraGlobalChartWidget({ data, loading: dashboardLoading }) {
  const t = useTranslations()
  const [timeframe, setTimeframe] = useState('week')
  const [metric, setMetric] = useState('ram')
  const [trendsData, setTrendsData] = useState(null)
  const [nodeNames, setNodeNames] = useState([])
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

  // Fetch trends data
  useEffect(() => {
    const fetchTrends = async () => {
      const connIds = Object.keys(nodesByConnection)
      if (connIds.length === 0) return

      setLoading(true)
      try {
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

        // Collect all node names and build per-timestamp data with per-node values
        const allNodeNames = new Set()
        const timeMap = new Map()

        results.forEach((connData) => {
          Object.entries(connData).forEach(([nodeKey, nodePoints]) => {
            const nodeName = nodeKey.replace(/^node:/, '')
            allNodeNames.add(nodeName)

            if (!Array.isArray(nodePoints)) return
            nodePoints.forEach((point) => {
              // Use epoch (ts) as map key for correct ordering, fall back to t
              const key = point.ts || point.t
              if (!timeMap.has(key)) {
                timeMap.set(key, { ts: point.ts || 0, t: point.t })
              }
              const entry = timeMap.get(key)
              entry[`${nodeName}_cpu`] = point.cpu || 0
              entry[`${nodeName}_ram`] = point.ram || 0
            })
          })
        })

        // Sort by epoch timestamp (ts), not by display string
        const aggregated = Array.from(timeMap.values())
          .sort((a, b) => a.ts - b.ts)

        setNodeNames([...allNodeNames].sort())
        setTrendsData(aggregated)
      } catch (e) {
        console.error('Failed to fetch infra trends:', e)
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
      <div className='rounded border p-3 shadow-lg max-w-[220px]' style={{ backgroundColor: 'var(--pc-bg-card)', borderColor: 'var(--pc-border-subtle)' }}>
        <span className='text-xs font-bold mb-1 block'>{label}</span>
        {payload.map((entry) => (
          <div key={entry.dataKey} className='flex items-center gap-1 mt-0.5'>
            <span className='w-2 h-2 rounded-full shrink-0' style={{ backgroundColor: entry.color }} />
            <span className='text-xs flex-1 opacity-70'>{entry.name}</span>
            <span className='text-xs font-semibold font-mono'>{entry.value}%</span>
          </div>
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
        <span className='text-xs opacity-60'>{t('common.noData')}</span>
      </div>
    )
  }

  const suffix = metric === 'cpu' ? '_cpu' : '_ram'

  return (
    <div className='h-full flex flex-col'>
      {/* Controls */}
      <div className='flex justify-between items-center mb-2 gap-2'>
        <div className='flex rounded border overflow-hidden' style={{ borderColor: 'var(--pc-border-subtle)' }}>
          {['cpu', 'ram'].map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`px-2.5 py-0.5 text-[11px] font-medium transition-colors ${metric === m ? 'bg-[var(--pc-primary)] text-white' : 'hover:bg-[var(--pc-bg-subtle)]'}`}
            >
              {m.toUpperCase()}
            </button>
          ))}
        </div>
        <div className='flex rounded border overflow-hidden' style={{ borderColor: 'var(--pc-border-subtle)' }}>
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={`px-2 py-0.5 text-[11px] font-medium transition-colors ${timeframe === tf.value ? 'bg-[var(--pc-primary)] text-white' : 'hover:bg-[var(--pc-bg-subtle)]'}`}
            >
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
              {nodeNames.map((name, i) => {
                const color = NODE_COLORS[i % NODE_COLORS.length]
                return (
                  <linearGradient key={name} id={`infra-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                )
              })}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.2)" />
            <XAxis
              dataKey="t"
              tick={{ fontSize: 10, fill: '#999' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: '#999' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            {nodeNames.map((name, i) => {
              const color = NODE_COLORS[i % NODE_COLORS.length]
              return (
                <Area
                  key={name}
                  type="monotone"
                  dataKey={`${name}${suffix}`}
                  name={name}
                  stroke={color}
                  strokeWidth={1.5}
                  fill={`url(#infra-grad-${i})`}
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0 }}
                  connectNulls
                />
              )
            })}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Legend — compact node list */}
      {nodeNames.length > 1 && (
        <div className='flex flex-wrap gap-2 mt-1 justify-center'>
          {nodeNames.map((name, i) => (
            <div key={name} className='flex items-center gap-1'>
              <span className='w-1.5 h-1.5 rounded-full' style={{ backgroundColor: NODE_COLORS[i % NODE_COLORS.length] }} />
              <span className='text-[9px] opacity-60'>{name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default React.memo(InfraGlobalChartWidget)
