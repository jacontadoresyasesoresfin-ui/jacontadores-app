'use client'

import { useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { User } from '@supabase/supabase-js'

export default function AuthGuard({ children, childrenWithUser }: {
    children?: ReactNode,
    childrenWithUser?: (user: User) => ReactNode
}) {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const router = useRouter()
    const supabase = createClient()

    useEffect(() => {
        const checkUser = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession()

                if (!session) {
                    router.push('/login')
                    return
                }

                setUser(session.user)
            } catch (error) {
                console.error("Auth check failed", error)
                router.push('/login')
            } finally {
                setLoading(false)
            }
        }

        checkUser()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                router.push('/login')
                setUser(null)
            } else {
                setUser(session.user)
            }
            setLoading(false)
        })

        return () => subscription.unsubscribe()
    }, [router, supabase])

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0B0E11] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 rounded-full border-2 border-[#F0B90B] border-t-transparent animate-spin"></div>
                    <p className="text-[#848E9C] text-sm animate-pulse">Verificando sesión...</p>
                </div>
            </div>
        )
    }

    if (!user) {
        return null
    }

    if (childrenWithUser) {
        return <>{childrenWithUser(user)}</>
    }

    return <>{children}</>
}
