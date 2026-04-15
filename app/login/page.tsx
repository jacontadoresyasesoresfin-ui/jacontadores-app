'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { Lock, Mail, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import Image from 'next/image'

export default function LoginPage() {
    const router = useRouter()
    const supabase = createClient()
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    const [isError, setIsError] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [tab, setTab] = useState<'login' | 'register'>('login')

    const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)
        const formData = new FormData(e.currentTarget)
        const email = formData.get('email') as string
        const password = formData.get('password') as string
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password })
            if (error) { setIsError(true); setMessage(error.message) }
            else router.push('/dashboard')
        } catch { setIsError(true); setMessage('Error inesperado. Intente de nuevo.') }
        finally { setLoading(false) }
    }

    const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)
        const formData = new FormData(e.currentTarget)
        const email = formData.get('email') as string
        const password = formData.get('password') as string
        const fullName = formData.get('fullName') as string
        try {
            const { error } = await supabase.auth.signUp({
                email, password,
                options: { data: { full_name: fullName } },
            })
            if (error) { setIsError(true); setMessage(error.message) }
            else { setIsError(false); setMessage('✅ Revisa tu correo para confirmar la cuenta') }
        } catch { setIsError(true); setMessage('Error inesperado. Intente de nuevo.') }
        finally { setLoading(false) }
    }

    return (
        <div className="min-h-screen flex" style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>

            {/* ── Panel Izquierdo — Branding ── */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12"
                style={{ background: 'linear-gradient(145deg, #0B2447 0%, #144272 40%, #205295 80%, #0B2447 100%)' }}>

                {/* Decoración de fondo */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-10"
                        style={{ background: 'radial-gradient(circle, #14B8A6, transparent)' }} />
                    <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full opacity-10"
                        style={{ background: 'radial-gradient(circle, #D4A843, transparent)' }} />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full opacity-5"
                        style={{ background: 'radial-gradient(circle, #fff, transparent)' }} />
                    {/* Grid pattern */}
                    <div className="absolute inset-0 opacity-5"
                        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                </div>

                {/* Logo */}
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-14 h-14 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center bg-white/10 backdrop-blur-sm border border-white/20">
                            <Image src="/logo-ja.jpeg" alt="J&A Logo" width={56} height={56} className="object-contain" />
                        </div>
                        <div>
                            <p className="text-white/60 text-xs font-semibold tracking-[0.2em] uppercase">Portal Empresarial</p>
                            <h1 className="text-white font-black text-2xl leading-tight" style={{ fontFamily: 'var(--font-outfit)' }}>
                                J<span style={{ color: '#D4A843' }}>&</span>A Contadores
                            </h1>
                        </div>
                    </div>
                </div>

                {/* Contenido central */}
                <div className="relative z-10 space-y-8">
                    <div>
                        <h2 className="text-white font-black text-4xl leading-tight mb-4" style={{ fontFamily: 'var(--font-outfit)' }}>
                            Gestión Financiera<br />
                            <span style={{ color: '#14B8A6' }}>Inteligente</span>
                        </h2>
                        <p className="text-white/60 text-base leading-relaxed max-w-md">
                            Plataforma de Business Intelligence para visualizar y controlar las finanzas de tu empresa en tiempo real, desde cualquier lugar.
                        </p>
                    </div>

                    {/* Features */}
                    <div className="space-y-3">
                        {[
                            { icon: '📊', text: 'Analytics financiero con datos reales de Google Sheets' },
                            { icon: '🛡️', text: 'Seguridad multi-empresa con roles diferenciados' },
                            { icon: '📋', text: 'Reportes tributarios automáticos — Ley Colombiana' },
                            { icon: '🔗', text: 'Integración con Mercado Libre y Siigo' },
                        ].map((f, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl"
                                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
                                <span className="text-xl">{f.icon}</span>
                                <span className="text-white/80 text-sm font-medium">{f.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer branding */}
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck className="w-4 h-4" style={{ color: '#14B8A6' }} />
                        <span className="text-white/50 text-xs">Protegido con Supabase Auth · SSL/TLS Cifrado</span>
                    </div>
                    <p className="text-white/30 text-xs">
                        © {new Date().getFullYear()} J&A Contadores - Consultores · Tunja, Boyacá, Colombia
                    </p>
                </div>
            </div>

            {/* ── Panel Derecho — Formulario ── */}
            <div className="flex-1 flex items-center justify-center p-8"
                style={{ background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)' }}>

                <div className="w-full max-w-md">

                    {/* Mobile logo */}
                    <div className="flex lg:hidden justify-center mb-8">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl overflow-hidden shadow-lg bg-white flex items-center justify-center border border-gray-200">
                                <Image src="/logo-ja.jpeg" alt="J&A Logo" width={48} height={48} className="object-contain" />
                            </div>
                            <div>
                                <h1 className="font-black text-xl text-slate-800" style={{ fontFamily: 'var(--font-outfit)' }}>
                                    J<span style={{ color: '#D4A843' }}>&</span>A Contadores
                                </h1>
                                <p className="text-xs text-slate-500 font-semibold tracking-widest uppercase">Portal</p>
                            </div>
                        </div>
                    </div>

                    {/* Card principal */}
                    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden"
                        style={{ boxShadow: '0 25px 60px rgba(11,36,71,0.12), 0 8px 24px rgba(11,36,71,0.08)' }}>

                        {/* Tab Header */}
                        <div className="flex" style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                            {(['login', 'register'] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => { setTab(t); setMessage(null) }}
                                    className="flex-1 py-4 text-sm font-bold transition-all duration-200 relative"
                                    style={{
                                        color: tab === t ? '#0B2447' : '#94A3B8',
                                        background: tab === t ? 'white' : 'transparent',
                                    }}
                                >
                                    {t === 'login' ? 'Iniciar Sesión' : 'Registrarse'}
                                    {tab === t && (
                                        <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                                            style={{ background: 'linear-gradient(90deg, #14B8A6, #0EA5E9)' }} />
                                    )}
                                </button>
                            ))}
                        </div>

                        <div className="p-8">
                            <div className="mb-6">
                                <h2 className="text-2xl font-black text-slate-800 mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>
                                    {tab === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}
                                </h2>
                                <p className="text-slate-500 text-sm">
                                    {tab === 'login'
                                        ? 'Accede al portal de gestión financiera de J&A'
                                        : 'Regístrate para acceder a la plataforma'}
                                </p>
                            </div>

                            {/* LOGIN FORM */}
                            {tab === 'login' && (
                                <form onSubmit={handleLogin} className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Correo electrónico</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input
                                                name="email" type="email" required
                                                placeholder="tu@empresa.com"
                                                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200"
                                                style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0' }}
                                                onFocus={e => e.target.style.borderColor = '#14B8A6'}
                                                onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contraseña</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input
                                                name="password" type={showPassword ? 'text' : 'password'} required
                                                placeholder="••••••••"
                                                className="w-full pl-10 pr-11 py-3 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200"
                                                style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0' }}
                                                onFocus={e => e.target.style.borderColor = '#14B8A6'}
                                                onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                                            />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {message && (
                                        <div className={`text-sm px-4 py-3 rounded-xl font-medium ${isError
                                            ? 'text-red-700 bg-red-50 border border-red-200'
                                            : 'text-emerald-700 bg-emerald-50 border border-emerald-200'}`}>
                                            {message}
                                        </div>
                                    )}

                                    <button type="submit" disabled={loading}
                                        className="w-full py-3.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-[0.99] disabled:opacity-60"
                                        style={{ background: 'linear-gradient(135deg, #0B2447 0%, #144272 50%, #205295 100%)', boxShadow: '0 4px 20px rgba(11,36,71,0.3)' }}>
                                        {loading ? (
                                            <span className="flex items-center gap-2">
                                                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                                Verificando...
                                            </span>
                                        ) : (
                                            <>Entrar al Portal <ArrowRight className="w-4 h-4" /></>
                                        )}
                                    </button>
                                </form>
                            )}

                            {/* REGISTER FORM */}
                            {tab === 'register' && (
                                <form onSubmit={handleSignup} className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nombre completo</label>
                                        <div className="relative">
                                            <input
                                                name="fullName" type="text" required
                                                placeholder="María García"
                                                className="w-full px-4 py-3 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200"
                                                style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0' }}
                                                onFocus={e => e.target.style.borderColor = '#14B8A6'}
                                                onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Correo electrónico</label>
                                        <div className="relative">
                                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input
                                                name="email" type="email" required
                                                placeholder="tu@empresa.com"
                                                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200"
                                                style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0' }}
                                                onFocus={e => e.target.style.borderColor = '#14B8A6'}
                                                onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contraseña</label>
                                        <div className="relative">
                                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input
                                                name="password" type={showPassword ? 'text' : 'password'} required
                                                placeholder="••••••••"
                                                className="w-full pl-10 pr-11 py-3 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none transition-all duration-200"
                                                style={{ background: '#F8FAFC', border: '1.5px solid #E2E8F0' }}
                                                onFocus={e => e.target.style.borderColor = '#14B8A6'}
                                                onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                                            />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {message && (
                                        <div className={`text-sm px-4 py-3 rounded-xl font-medium ${isError
                                            ? 'text-red-700 bg-red-50 border border-red-200'
                                            : 'text-emerald-700 bg-emerald-50 border border-emerald-200'}`}>
                                            {message}
                                        </div>
                                    )}

                                    <button type="submit" disabled={loading}
                                        className="w-full py-3.5 rounded-xl font-bold text-white text-sm flex items-center justify-center gap-2 transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-[0.99] disabled:opacity-60"
                                        style={{ background: 'linear-gradient(135deg, #0D9488 0%, #14B8A6 100%)', boxShadow: '0 4px 20px rgba(20,184,166,0.3)' }}>
                                        {loading ? (
                                            <span className="flex items-center gap-2">
                                                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                                Creando cuenta...
                                            </span>
                                        ) : (
                                            <>Crear Cuenta <ArrowRight className="w-4 h-4" /></>
                                        )}
                                    </button>
                                </form>
                            )}

                            {/* Footer card */}
                            <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                                <div className="flex items-center gap-1.5">
                                    <ShieldCheck className="w-3.5 h-3.5 text-teal-500" />
                                    <span>Supabase Auth · Cifrado SSL</span>
                                </div>
                                <a href="https://jacontadores.com" target="_blank" rel="noopener noreferrer"
                                    className="font-bold hover:text-teal-600 transition-colors"
                                    style={{ color: '#D4A843' }}>
                                    jacontadores.com
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* Contacto */}
                    <p className="text-center text-xs text-slate-400 mt-6">
                        ¿Necesitas acceso?{' '}
                        <a href="tel:+573138385201" className="font-semibold hover:underline" style={{ color: '#0B2447' }}>
                            +57 313 838 5201
                        </a>
                        {' · '}
                        <a href="mailto:info@jacontadores.com" className="font-semibold hover:underline" style={{ color: '#0B2447' }}>
                            info@jacontadores.com
                        </a>
                    </p>
                </div>
            </div>
        </div>
    )
}
