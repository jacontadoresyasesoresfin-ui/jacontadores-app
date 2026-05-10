'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { LogOut, User, ChevronDown, ExternalLink, Settings, Building2 } from 'lucide-react'
import { useClient, Profile } from '../../ClientContext'

export default function TopBar() {
    const [menuOpen, setMenuOpen] = useState(false)
    const [clientSelectorOpen, setClientSelectorOpen] = useState(false)
    const router = useRouter()
    const supabase = createClient()
    const { profile, allProfiles, switchClient, clientName, isSimulating } = useClient()

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
    }

    return (
        /* Fondo azul marino exacto de jacontadores.com */
        <header style={{
            background: '#13213C',
            borderBottom: '2px solid rgba(184,150,12,0.3)',
            boxShadow: '0 2px 16px rgba(0,0,0,0.2)',
            position: 'sticky',
            top: 0,
            zIndex: 50,
        }}>
            <style>{`
                .topbar-container {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 0 20px;
                    height: 60px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .badge-portal {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 4px 12px;
                    border-radius: 20px;
                    background: rgba(184,150,12,0.12);
                    border: 1px solid rgba(184,150,12,0.28);
                }
                @media (max-width: 768px) {
                    .topbar-container {
                        padding: 0 10px;
                    }
                    .hide-mobile {
                        display: none !important;
                    }
                    .badge-portal {
                        display: none !important;
                    }
                    .topbar-btn {
                        padding: 5px !important;
                    }
                }
            `}</style>
            <div className="topbar-container">

                {/* Logo + Marca — exactamente como jacontadores.com */}
                <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
                    <div style={{
                        width: '36px', height: '36px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: '1.5px solid rgba(184,150,12,0.5)',
                        flexShrink: 0,
                        background: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Image
                            src="/logo-ja.jpeg"
                            alt="J&A Contadores"
                            width={36}
                            height={36}
                            style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                    </div>
                    <div style={{ lineHeight: 1.2 }}>
                        <div style={{
                            fontFamily: "'Montserrat', sans-serif",
                            fontWeight: 800,
                            fontSize: '14px',
                            color: '#FFFFFF',
                            letterSpacing: '-0.01em',
                        }}>
                            J<span style={{ color: '#B8960C' }}>&</span>A Contadores
                        </div>
                        <div style={{
                            fontSize: '9px',
                            color: 'rgba(255,255,255,0.45)',
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: 500,
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                        }}>
                            Portal BI · Asesores
                        </div>
                    </div>
                </Link>

                {/* Centro — Badge portal */}
                <div className="badge-portal">
                    <div style={{
                        width: '6px', height: '6px',
                        borderRadius: '50%',
                        background: '#B8960C',
                        animation: 'pulse 2s ease-in-out infinite',
                    }} />
                    <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#D4A843',
                        fontFamily: 'Inter, sans-serif',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                    }}>
                        Portal Activo
                    </span>
                </div>

                {/* Derecha — Links + Usuario */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

                    {/* Selector de Cliente para Superadmins y Firma Admins */}
                    {(profile?.role === 'superadmin' || profile?.role === 'firma_admin') && (
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setClientSelectorOpen(v => !v)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '5px 10px',
                                    borderRadius: '8px',
                                    background: isSimulating ? 'rgba(5, 150, 105, 0.15)' : 'rgba(255,255,255,0.07)',
                                    border: `1px solid ${isSimulating ? 'rgba(5, 150, 105, 0.4)' : 'rgba(184,150,12,0.25)'}`,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s',
                                }}>
                                <Building2 style={{ width: '13px', height: '13px', color: isSimulating ? '#10B981' : '#B8960C' }} />
                                <span style={{ fontSize: '11px', fontWeight: 600, color: isSimulating ? '#10B981' : 'rgba(255,255,255,0.8)', fontFamily: 'Inter, sans-serif' }}>
                                    {clientName || 'Seleccionar Empresa'}
                                </span>
                                <ChevronDown style={{ width: '12px', height: '12px', color: 'rgba(255,255,255,0.4)', transform: clientSelectorOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                            </button>

                            {clientSelectorOpen && (
                                <div style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 8px)',
                                    right: 0,
                                    background: '#FFFFFF',
                                    border: '1.5px solid #E0DDD8',
                                    borderRadius: '12px',
                                    boxShadow: '0 12px 40px rgba(19,33,60,0.15)',
                                    minWidth: '220px',
                                    maxHeight: '300px',
                                    overflowY: 'auto',
                                    zIndex: 100,
                                }}>
                                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #F0EDE8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <p style={{ fontSize: '10px', color: '#6B7A8D', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                            Empresas Clientes
                                        </p>
                                        {isSimulating && (
                                            <button 
                                                onClick={() => { switchClient(null); setClientSelectorOpen(false); }}
                                                style={{ fontSize: '9px', background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontWeight: 600 }}
                                            >
                                                Quitar Filtro
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ padding: '4px' }}>
                                        {allProfiles.filter(p => p.company_name).map(p => (
                                            <button
                                                key={p.id}
                                                onClick={() => { switchClient(p); setClientSelectorOpen(false); }}
                                                style={{
                                                    width: '100%',
                                                    display: 'block',
                                                    textAlign: 'left',
                                                    padding: '8px 10px',
                                                    fontSize: '12px',
                                                    fontWeight: 600,
                                                    color: '#13213C',
                                                    background: clientName === p.company_name ? '#F4F4F0' : 'none',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontFamily: 'Inter, sans-serif',
                                                }}
                                                onMouseEnter={e => { if(clientName !== p.company_name) e.currentTarget.style.background = '#F9F7F2' }}
                                                onMouseLeave={e => { if(clientName !== p.company_name) e.currentTarget.style.background = 'none' }}
                                            >
                                                {p.company_name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Link a Soporte Técnico */}
                    <Link href="https://fragatanetwork.com/contacto.html" target="_blank"
                        className="topbar-btn"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '5px 10px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#FFFFFF',
                            fontFamily: 'Inter, sans-serif',
                            textDecoration: 'none',
                            transition: 'all 0.15s',
                            border: '1px solid rgba(255,255,255,0.2)',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#D4A843'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(184,150,12,0.5)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#FFFFFF'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.2)' }}>
                        <ExternalLink style={{ width: '11px', height: '11px', color: '#D4A843' }} />
                        <span className="hide-mobile">Soporte Técnico</span>
                    </Link>

                    {/* Panel Maestro — solo superadmin */}
                    {profile?.role === 'superadmin' && (
                        <Link href="/admin"
                            className="topbar-btn"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '4px',
                                padding: '5px 10px', borderRadius: '8px', fontSize: '11px',
                                fontWeight: 600, color: '#FFFFFF',
                                fontFamily: 'Inter, sans-serif', textDecoration: 'none',
                                transition: 'all 0.15s', border: '1px solid rgba(255,255,255,0.2)',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#D4A843'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(184,150,12,0.5)' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#FFFFFF'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.2)' }}>
                            <Settings style={{ width: '11px', height: '11px', color: '#D4A843' }} />
                            <span className="hide-mobile">Panel Maestro</span>
                        </Link>
                    )}

                    {/* Panel Firma — solo firma_admin */}
                    {profile?.role === 'firma_admin' && (
                        <Link href="/firma-admin"
                            className="topbar-btn"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '4px',
                                padding: '5px 10px', borderRadius: '8px', fontSize: '11px',
                                fontWeight: 600, color: '#FFFFFF',
                                fontFamily: 'Inter, sans-serif', textDecoration: 'none',
                                transition: 'all 0.15s', border: '1px solid rgba(255,255,255,0.2)',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#D4A843'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(184,150,12,0.5)' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#FFFFFF'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(255,255,255,0.2)' }}>
                            <Settings style={{ width: '11px', height: '11px', color: '#D4A843' }} />
                            <span className="hide-mobile">Panel Firma</span>
                        </Link>
                    )}

                    {/* Usuario menú */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setMenuOpen(v => !v)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '5px 10px',
                                borderRadius: '8px',
                                background: 'rgba(255,255,255,0.07)',
                                border: '1px solid rgba(184,150,12,0.25)',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(184,150,12,0.12)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}>
                            <div style={{
                                width: '22px', height: '22px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #B8960C, #D4A843)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <User style={{ width: '12px', height: '12px', color: '#13213C' }} />
                            </div>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.8)', fontFamily: 'Inter, sans-serif' }}>
                                Mi Cuenta
                            </span>
                            <ChevronDown style={{ width: '12px', height: '12px', color: 'rgba(255,255,255,0.4)', transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        </button>

                        {menuOpen && (
                            <div style={{
                                position: 'absolute',
                                top: 'calc(100% + 8px)',
                                right: 0,
                                background: '#FFFFFF',
                                border: '1.5px solid #E0DDD8',
                                borderRadius: '12px',
                                boxShadow: '0 12px 40px rgba(19,33,60,0.15)',
                                minWidth: '180px',
                                overflow: 'hidden',
                                zIndex: 100,
                            }}>
                                <div style={{ padding: '10px 14px', borderBottom: '1px solid #F0EDE8' }}>
                                    <p style={{ fontSize: '10px', color: '#6B7A8D', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        J&A Contadores
                                    </p>
                                </div>
                                <button
                                    onClick={handleLogout}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '10px 14px',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        color: '#DC2626',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontFamily: 'Inter, sans-serif',
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = '#FEF2F2')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                                    <LogOut style={{ width: '14px', height: '14px' }} />
                                    Cerrar Sesión
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    )
}
