'use client'

import { LucideIcon } from 'lucide-react'

interface MetricCardProps {
    title: string
    value: string
    change: number
    changeLabel: string
    icon: LucideIcon
    trend?: 'up' | 'down' | 'neutral'
    sparklineData?: number[]
    accentColor?: string
}

export default function MetricCard({
    title,
    value,
    change,
    changeLabel,
    icon: Icon,
    trend = 'up',
    sparklineData = [20, 35, 25, 45, 30, 50, 40],
    accentColor,
}: MetricCardProps) {
    const isPositive = trend === 'up'
    const isNeutral = trend === 'neutral'

    const color = accentColor || (isPositive ? '#14B8A6' : isNeutral ? '#94A3B8' : '#EF4444')
    const bgColor = `${color}18`

    const maxVal = Math.max(...sparklineData, 1)
    const minVal = Math.min(...sparklineData)
    const range = maxVal - minVal || 1

    // Build SVG polyline points
    const points = sparklineData.map((val, i) => {
        const x = (i / (sparklineData.length - 1)) * 88
        const y = 28 - ((val - minVal) / range) * 24
        return `${x},${y}`
    }).join(' ')

    return (
        <div
            className="relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-0.5"
            style={{
                background: '#FFFFFF',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
            }}
            onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 12px rgba(15,23,42,0.08), 0 0 0 1px ${color}40`
            }}
            onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(15,23,42,0.04)'
            }}
        >
            {/* Fondo decorativo */}
            <div className="absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-8 translate-x-8 opacity-5"
                style={{ background: color }} />

            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</p>
                    <h3 className="text-2xl font-black text-slate-800 mt-1 leading-none font-mono">{value}</h3>
                </div>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ml-3"
                    style={{ background: bgColor }}>
                    <Icon className="w-5 h-5" style={{ color }} />
                </div>
            </div>

            {/* Footer: cambio + sparkline */}
            <div className="flex items-end justify-between">
                <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded-md"
                        style={{
                            color: isPositive ? '#0F766E' : isNeutral ? '#64748B' : '#DC2626',
                            background: isPositive ? '#CCFBF1' : isNeutral ? '#F1F5F9' : '#FEE2E2'
                        }}>
                        {isPositive ? '↑' : trend === 'down' ? '↓' : '•'} {Math.abs(change)}%
                    </span>
                    <span className="text-xs text-slate-400">{changeLabel}</span>
                </div>

                {/* Sparkline */}
                <svg width="88" height="28" className="opacity-80">
                    <defs>
                        <linearGradient id={`sg-${title.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                            <stop offset="100%" stopColor={color} stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <polyline
                        fill="none"
                        stroke={color}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={points}
                    />
                </svg>
            </div>
        </div>
    )
}
