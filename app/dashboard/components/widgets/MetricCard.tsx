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

const JA = {
    NAVY: '#13213C',
    GOLD: '#B8960C',
    BORDER: '#E5E7EB',
    TEXT: '#1C2B45',
    GREY: '#4B5563',
    GREY_LT: '#9CA3AF',
    GREEN: '#10B981',
    RED: '#EF4444',
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

    const color = accentColor || (isPositive ? JA.GREEN : isNeutral ? JA.GREY : JA.RED)
    
    const maxVal = Math.max(...sparklineData, 1)
    const minVal = Math.min(...sparklineData)
    const range = maxVal - minVal || 1

    const points = sparklineData.map((val, i) => {
        const x = (i / (sparklineData.length - 1)) * 80
        const y = 20 - ((val - minVal) / range) * 16
        return `${x},${y}`
    }).join(' ')

    return (
        <div
            style={{
                background: '#FFFFFF',
                border: `1px solid ${JA.BORDER}`,
                borderRadius: '2px',
                padding: '20px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '130px'
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '11px', fontWeight: 600, color: JA.GREY, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                        {title}
                    </p>
                    <h3 style={{ fontSize: '24px', fontWeight: 700, color: JA.TEXT, marginTop: '4px', marginBottom: 0, fontFamily: 'Inter, sans-serif' }}>
                        {value}
                    </h3>
                </div>
                <div style={{ 
                    width: '36px', 
                    height: '36px', 
                    borderRadius: '2px', 
                    background: '#F8FAFC', 
                    border: `1px solid ${JA.BORDER}`,
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center' 
                }}>
                    <Icon style={{ width: '16px', height: '16px', color: JA.NAVY }} />
                </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: isPositive ? JA.GREEN : isNeutral ? JA.GREY : JA.RED,
                    }}>
                        {isPositive ? '+' : trend === 'down' ? '-' : ''}{Math.abs(change)}%
                    </span>
                    <span style={{ fontSize: '11px', color: JA.GREY_LT }}>{changeLabel}</span>
                </div>

                <svg width="80" height="20" style={{ opacity: 0.6 }}>
                    <polyline
                        fill="none"
                        stroke={color}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={points}
                    />
                </svg>
            </div>
        </div>
    )
}

