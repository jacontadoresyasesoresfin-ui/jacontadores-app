'use client'

import { useClient } from '../ClientContext'
import { Building2, ExternalLink, X } from 'lucide-react'

export default function ClientSwitcher() {
    const { profile, allProfiles, switchClient, clientName, isSimulating, activeProfile } = useClient()

    if (profile?.role !== 'superadmin' && profile?.role !== 'firma_admin') return null

    const clients = allProfiles.filter(p => p.company_name)
    if (clients.length === 0) return null

    return (
        <div style={{
            background: '#FFFFFF',
            borderBottom: '1px solid #E5E7EB',
            padding: '7px 20px',
        }}>
            <div style={{
                maxWidth: '1400px',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
            }}>
                <span style={{
                    fontSize: '10px', fontWeight: 700, color: '#6B7A8D',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    flexShrink: 0, marginRight: '4px',
                }}>
                    Empresas
                </span>

                {/* When a client is selected: show name chip + quick links + clear button */}
                {isSimulating && (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '5px',
                                padding: '3px 10px', borderRadius: '3px',
                                background: '#13213C',
                                border: '1px solid #13213C',
                            }}>
                                <Building2 style={{ width: 10, height: 10, color: '#B8960C' }} />
                                <span style={{ fontSize: '11px', fontWeight: 700, color: '#FFFFFF' }}>
                                    {clientName}
                                </span>
                            </div>

                            {activeProfile?.siigo_url && (
                                <a
                                    href={activeProfile.siigo_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '4px',
                                        padding: '3px 10px', borderRadius: '3px', textDecoration: 'none',
                                        background: 'rgba(59,130,246,0.08)',
                                        border: '1px solid rgba(59,130,246,0.3)',
                                        fontSize: '11px', fontWeight: 600, color: '#3B82F6',
                                    }}
                                >
                                    <ExternalLink style={{ width: 10, height: 10 }} />
                                    Siigo
                                </a>
                            )}

                            {activeProfile?.drive_invoices_url && (
                                <a
                                    href={activeProfile.drive_invoices_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '4px',
                                        padding: '3px 10px', borderRadius: '3px', textDecoration: 'none',
                                        background: 'rgba(16,185,129,0.08)',
                                        border: '1px solid rgba(16,185,129,0.3)',
                                        fontSize: '11px', fontWeight: 600, color: '#059669',
                                    }}
                                >
                                    <ExternalLink style={{ width: 10, height: 10 }} />
                                    Facturas
                                </a>
                            )}

                            <button
                                onClick={() => switchClient(null)}
                                title="Quitar selección"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '3px',
                                    padding: '3px 8px', borderRadius: '3px',
                                    background: 'rgba(239,68,68,0.07)',
                                    border: '1px solid rgba(239,68,68,0.25)',
                                    fontSize: '10px', fontWeight: 600, color: '#EF4444',
                                    cursor: 'pointer',
                                }}
                            >
                                <X style={{ width: 10, height: 10 }} />
                                Quitar
                            </button>
                        </div>
                        <span style={{ color: '#D1D5DB', fontSize: '14px', margin: '0 4px' }}>|</span>
                    </>
                )}

                {/* Client pills */}
                {clients.map(p => {
                    const isActive = clientName === p.company_name
                    return (
                        <button
                            key={p.id}
                            onClick={() => switchClient(p)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '5px',
                                padding: '3px 10px', borderRadius: '3px',
                                background: isActive ? 'rgba(19,33,60,0.08)' : 'transparent',
                                border: `1px solid ${isActive ? 'rgba(19,33,60,0.25)' : '#E5E7EB'}`,
                                fontSize: '11px', fontWeight: isActive ? 700 : 500,
                                color: isActive ? '#13213C' : '#6B7A8D',
                                cursor: 'pointer', transition: 'all 0.12s',
                            }}
                        >
                            {p.company_name}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
