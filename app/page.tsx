'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    router.push('/login')
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#071020]">
      <div className="text-center space-y-4">
        {/* Logo J&A */}
        <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#D4A843] to-[#B8860B] flex items-center justify-center shadow-2xl">
          <span className="text-[#071020] font-black text-2xl" style={{ fontFamily: 'serif' }}>J</span>
        </div>
        <p className="text-[#7A9AB8] text-sm animate-pulse">
          Cargando J&A Contadores...
        </p>
      </div>
    </div>
  )
}
