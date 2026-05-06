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
        <div className="min-h-screen flex bg-slate-50" style={{ fontFamily: 'var(--font-inter), system-ui, sans-serif' }}>

            {/* ── Panel Izquierdo — Branding ── */}
            <div className="hidden lg:flex lg:w-[45%] relative flex-col justify-between p-14 bg-slate-900 border-r border-slate-800">
                {/* Fondo sutil (Dot pattern) */}
                <div className="absolute inset-0 opacity-[0.03]"
                    style={{ backgroundImage: 'radial-gradient(#ffffff 1.5px, transparent 1.5px)', backgroundSize: '32px 32px' }} />

                <div className="relative z-10">
                    <div className="flex flex-col items-start gap-5 mb-4">
                        <Image src="/logo-ja.jpeg" alt="J&A Logo" width={110} height={110} className="object-contain" />
                        <div>
                            <h1 className="text-white font-bold text-3xl" style={{ fontFamily: 'Montserrat, sans-serif' }}>J&A Contadores</h1>
                            <p className="text-slate-400 text-sm font-semibold tracking-widest uppercase mt-1">Portal Financiero</p>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 max-w-sm">
                    <h2 className="text-white font-bold text-3xl leading-snug mb-5">
                        Inteligencia y control para el futuro de su empresa.
                    </h2>
                    <p className="text-slate-400 text-sm leading-relaxed mb-10">
                        Acceda al ecosistema centralizado de reportes tributarios, conciliación DIAN y analítica financiera corporativa.
                    </p>
                    <div className="space-y-4">
                        {[
                            { icon: <ShieldCheck className="w-5 h-5 text-slate-300"/>, text: 'Seguridad e integridad de datos empresariales' },
                            { icon: <Lock className="w-5 h-5 text-slate-300"/>, text: 'Acceso corporativo y gestión de roles' },
                        ].map((f, i) => (
                            <div key={i} className="flex items-center gap-3">
                                {f.icon}
                                <span className="text-slate-300 text-sm">{f.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="relative z-10">
                    <p className="text-slate-500 text-xs">
                        © {new Date().getFullYear()} J&A Contadores - Asesores · Colombia
                    </p>
                </div>
            </div>

            {/* ── Panel Derecho — Formulario ── */}
            <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12">
                
                <div className="w-full max-w-[400px]">
                    {/* Header móvil */}
                    <div className="lg:hidden flex flex-col items-center gap-3 mb-10 text-center">
                        <Image src="/logo-ja.jpeg" alt="J&A Logo" width={70} height={70} className="object-contain" />
                        <div>
                            <h1 className="font-bold text-2xl text-slate-900" style={{ fontFamily: 'Montserrat, sans-serif' }}>J&A Contadores</h1>
                            <p className="text-xs text-slate-500 font-semibold tracking-widest uppercase mt-0.5">Portal Financiero</p>
                        </div>
                    </div>

                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">
                            {tab === 'login' ? 'Iniciar Sesión' : 'Solicitar Acceso'}
                        </h2>
                        <p className="text-slate-500 text-sm">
                            {tab === 'login'
                                ? 'Ingrese sus credenciales corporativas para acceder.'
                                : 'Complete sus datos para registrar un usuario.'}
                        </p>
                    </div>

                    <div className="flex mb-8 border-b border-slate-200">
                        {(['login', 'register'] as const).map(t => (
                            <button
                                key={t}
                                onClick={() => { setTab(t); setMessage(null) }}
                                className={`pb-3 text-sm font-semibold transition-colors relative mr-6 ${
                                    tab === t ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
                                }`}
                            >
                                {t === 'login' ? 'Acceso' : 'Registro'}
                                {tab === t && (
                                    <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-slate-900" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* LOGIN FORM */}
                    {tab === 'login' && (
                        <form onSubmit={handleLogin} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Correo Corporativo</label>
                                <div className="relative">
                                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        name="email" type="email" required
                                        placeholder="usuario@empresa.com"
                                        className="w-full pl-10 pr-4 py-2.5 rounded border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-all bg-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Contraseña</label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        name="password" type={showPassword ? 'text' : 'password'} required
                                        placeholder="••••••••"
                                        className="w-full pl-10 pr-11 py-2.5 rounded border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-all bg-white"
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {message && (
                                <div className={`text-sm px-4 py-3 rounded border font-medium ${isError
                                    ? 'text-red-800 bg-red-50 border-red-200'
                                    : 'text-emerald-800 bg-emerald-50 border-emerald-200'}`}>
                                    {message}
                                </div>
                            )}

                            <button type="submit" disabled={loading}
                                className="w-full py-2.5 rounded font-semibold text-white text-sm flex items-center justify-center gap-2 transition-colors bg-slate-900 hover:bg-slate-800 active:bg-slate-950 disabled:opacity-50 mt-2">
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <span className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                                        Validando...
                                    </span>
                                ) : (
                                    <>Ingresar al Sistema <ArrowRight className="w-4 h-4" /></>
                                )}
                            </button>
                        </form>
                    )}

                    {/* REGISTER FORM */}
                    {tab === 'register' && (
                        <form onSubmit={handleSignup} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Nombre Completo</label>
                                <div className="relative">
                                    <input
                                        name="fullName" type="text" required
                                        placeholder="Ej. María García"
                                        className="w-full px-4 py-2.5 rounded border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-all bg-white"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Correo Corporativo</label>
                                <div className="relative">
                                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        name="email" type="email" required
                                        placeholder="usuario@empresa.com"
                                        className="w-full pl-10 pr-4 py-2.5 rounded border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-all bg-white"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Contraseña</label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        name="password" type={showPassword ? 'text' : 'password'} required
                                        placeholder="••••••••"
                                        className="w-full pl-10 pr-11 py-2.5 rounded border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-all bg-white"
                                    />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {message && (
                                <div className={`text-sm px-4 py-3 rounded border font-medium ${isError
                                    ? 'text-red-800 bg-red-50 border-red-200'
                                    : 'text-emerald-800 bg-emerald-50 border-emerald-200'}`}>
                                    {message}
                                </div>
                            )}

                            <button type="submit" disabled={loading}
                                className="w-full py-2.5 rounded font-semibold text-white text-sm flex items-center justify-center gap-2 transition-colors bg-slate-900 hover:bg-slate-800 active:bg-slate-950 disabled:opacity-50 mt-2">
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <span className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                                        Procesando...
                                    </span>
                                ) : (
                                    <>Solicitar Registro <ArrowRight className="w-4 h-4" /></>
                                )}
                            </button>
                        </form>
                    )}

                    <div className="mt-12 pt-6 border-t border-slate-200">
                        <p className="text-xs text-slate-400 mb-1">Contacto de soporte:</p>
                        <p className="text-sm text-slate-600">
                            <a href="mailto:info@jacontadores.com" className="font-semibold hover:text-slate-900 transition-colors">info@jacontadores.com</a>
                            {' · '}
                            <span className="font-semibold">+57 313 838 5201</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
