'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'

function AuthCallbackContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const supabase = createClient()

    useEffect(() => {
        const handleAuthCallback = async () => {
            const code = searchParams.get('code')
            const next = searchParams.get('next') ?? '/dashboard'

            if (code) {
                const { error } = await supabase.auth.exchangeCodeForSession(code)
                if (!error) {
                    router.push(next)
                } else {
                    router.push('/auth/auth-code-error')
                }
            } else {
                router.push('/login')
            }
        }

        handleAuthCallback()
    }, [router, searchParams, supabase])

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0B0E11] text-[#EAECEF]">
            <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 rounded-full border-2 border-[#F0B90B] border-t-transparent animate-spin"></div>
                <p>Autenticando...</p>
            </div>
        </div>
    )
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={<div>Cargando...</div>}>
            <AuthCallbackContent />
        </Suspense>
    )
}
