'use client'

import { User, Bell, Shield, Palette, Database, Save, Info } from "lucide-react"
import { useState } from 'react'

const JA = {
    NAVY:    '#13213C',
    GOLD:    '#B8960C',
    TEXT:    '#1C2B45',
    GREY:    '#4B5563',
    BORDER:  '#E5E7EB',
    BG:      '#F8FAFC',
    WHITE:   '#FFFFFF',
}

const cardStyle = {
    background: JA.WHITE,
    border: `1px solid ${JA.BORDER}`,
    borderRadius: '2px',
    padding: '24px',
}

const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    fontSize: '13px',
    border: `1px solid ${JA.BORDER}`,
    borderRadius: '2px',
    background: JA.BG,
    color: JA.TEXT,
    outline: 'none',
}

const labelStyle = {
    display: 'block',
    fontSize: '11px',
    fontWeight: 700,
    color: JA.GREY,
    textTransform: 'uppercase',
    marginBottom: '6px',
    letterSpacing: '0.05em',
}

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState('profile')

    const tabs = [
        { id: 'profile', label: 'Perfil', icon: User },
        { id: 'notifications', label: 'Notificaciones', icon: Bell },
        { id: 'security', label: 'Seguridad', icon: Shield },
        { id: 'appearance', label: 'Apariencia', icon: Palette },
        { id: 'integrations', label: 'Integraciones', icon: Database },
    ]

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px' }}>
            {/* Header */}
            <div style={{ borderBottom: `1px solid ${JA.BORDER}`, paddingBottom: '20px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>Configuración de <span style={{ color: JA.GOLD }}>Cuenta</span></h1>
                <p style={{ fontSize: '12px', color: JA.GREY, marginTop: '4px' }}>Administra las preferencias de tu perfil y la seguridad de la aplicación.</p>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', background: JA.BG, padding: '4px', border: `1px solid ${JA.BORDER}`, borderRadius: '2px' }}>
                {tabs.map(tab => (
                    <button 
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            padding: '10px 16px', border: 'none', borderRadius: '1px', fontSize: '11px', fontWeight: 700,
                            cursor: 'pointer', transition: 'all 0.2s',
                            background: activeTab === tab.id ? JA.NAVY : 'transparent',
                            color: activeTab === tab.id ? 'white' : JA.GREY
                        }}>
                        <tab.icon style={{ width: '14px', height: '14px' }} />
                        {tab.label.toUpperCase()}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div style={cardStyle}>
                {activeTab === 'profile' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 700, color: JA.NAVY, margin: 0 }}>Información Personal</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <label style={labelStyle}>Nombre</label>
                                <input style={inputStyle} defaultValue="Juan" />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <label style={labelStyle}>Apellido</label>
                                <input style={inputStyle} defaultValue="Pérez" />
                            </div>
                        </div>
                        <div>
                            <label style={labelStyle}>Correo Electrónico</label>
                            <input style={inputStyle} defaultValue="juan@jacontadores.com" disabled />
                        </div>
                        <div>
                            <label style={labelStyle}>Empresa / Entidad</label>
                            <input style={inputStyle} defaultValue="Mi Empresa S.A.S" />
                        </div>
                        <button style={{
                            alignSelf: 'flex-start', padding: '10px 24px', background: JA.NAVY, color: 'white',
                            border: 'none', borderRadius: '2px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '8px'
                        }}>
                            <Save style={{ width: '14px', height: '14px' }} />
                            GUARDAR CAMBIOS
                        </button>
                    </div>
                )}

                {activeTab !== 'profile' && (
                    <div style={{ padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '2px', background: JA.BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Info style={{ width: '20px', height: '20px', color: JA.BORDER }} />
                        </div>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: JA.TEXT, margin: 0 }}>Módulo en Mantenimiento Corporativo</p>
                        <p style={{ fontSize: '11px', color: JA.GREY, maxWidth: '300px' }}>Esta sección de configuración está siendo estandarizada bajo el nuevo protocolo de seguridad JA. Estará disponible en breve.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
