'use client'

import LogoSMV from "@/app/LogoSMV"
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { iniciarSesionConGoogle, cerrarSesion } from '@/lib/auth'
import { esCorreoAutorizado } from '@/lib/authorized-emails'
import { LogIn, AlertCircle } from 'lucide-react'

const MENSAJES_ERROR: Record<string, string> = {
  no_autorizado:
    'Tu cuenta de Google no está autorizada para SMV Hub. Contacta al administrador para solicitar acceso.',
}

function LoginForm() {
  const searchParams = useSearchParams()
  const codigoError = searchParams.get('error')
  const errorDesdeQuery =
    codigoError && MENSAJES_ERROR[codigoError] ? MENSAJES_ERROR[codigoError] : null

  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const mensajeError = error ?? errorDesdeQuery

  const handleLogin = async () => {
    try {
      setLoading(true)
      setError(null)
      const usuario = await iniciarSesionConGoogle()
      if (!esCorreoAutorizado(usuario.email)) {
        await cerrarSesion()
        setError(MENSAJES_ERROR.no_autorizado)
        setLoading(false)
        return
      }
      router.push('/')
    } catch (err: unknown) {
      console.error("Error al iniciar sesión:", err instanceof Error ? err.message : "error desconocido")
      setError(err instanceof Error ? err.message : 'Ocurrió un error al intentar iniciar sesión. Por favor, intenta nuevamente.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-[#E2E8F0] p-8">
        
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <LogoSMV height={44} />
          </div>
          <h1 className="text-xl font-semibold text-[#0F172A] tracking-tight mb-2">
            SMV Hub
          </h1>
          <p className="text-[#64748B] text-sm leading-relaxed">
            Inicia sesión para acceder a la plataforma interna del taller.
          </p>
        </div>

        {/* Error Message */}
        {mensajeError && (
          <div className="mb-6 p-4 bg-red-50 rounded-lg flex items-start gap-3 border border-red-100">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{mensajeError}</p>
          </div>
        )}

        {/* Login Button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-[#0F172A] hover:bg-[#1E293B] text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
          ) : (
            <LogIn className="h-5 w-5" />
          )}
          <span>{loading ? 'Iniciando sesión...' : 'Ingresar con Google'}</span>
        </button>
        
      </div>
      
      <p className="mt-8 text-xs text-[#94A3B8]">
        Acceso restringido · SMV Maquinados
      </p>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0369A1]" />
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
