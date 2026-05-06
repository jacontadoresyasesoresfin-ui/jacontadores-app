import Link from 'next/link'
import AuthGuard from '@/components/AuthGuard'
import { ClientProvider } from './ClientContext'
import TabNavigation from './components/navigation/TabNavigation'
import TopBar from './components/header/TopBar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthGuard>
            {/* Fondo crema — idéntico a jacontadores.com */}
            <div style={{ minHeight: '100vh', background: '#F4F4F0', display: 'flex', flexDirection: 'column' }}>
                {/* Contenido principal envuelto con ClientProvider para que TopBar y Tabs tengan acceso */}
                <ClientProvider>
                    {/* Top Bar — Navy J&A */}
                    <TopBar />

                    {/* Navegación de Tabs */}
                    <TabNavigation />

                    <main style={{ flex: 1, padding: '24px 20px 40px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
                        {children}
                    </main>
                </ClientProvider>

                {/* Footer — idéntico al estilo de jacontadores.com */}
                <footer style={{
                    background: '#13213C',
                    borderTop: '2px solid rgba(184,150,12,0.25)',
                    padding: '14px 24px',
                }}>
                    <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter, sans-serif' }}>
                            © {new Date().getFullYear()} J&A Contadores — Asesores · Tunja, Boyacá · Colombia
                        </span>
                        <Link href="https://jacontadores.com" target="_blank"
                            style={{ fontSize: '11px', color: '#B8960C', fontWeight: '600', fontFamily: 'Inter, sans-serif', textDecoration: 'none' }}>
                            jacontadores.com ↗
                        </Link>
                    </div>
                </footer>
            </div>
        </AuthGuard>
    )
}
