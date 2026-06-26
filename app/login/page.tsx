'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { iniciarSesionConGoogle } from '@/lib/auth'
import { LogIn, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async () => {
    try {
      setLoading(true)
      setError(null)
      await iniciarSesionConGoogle()
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
            <span className="text-3xl font-bold text-[#0369A1] tracking-tight">SMV</span>
          </div>
          <h1 className="text-xl font-semibold text-[#0F172A] tracking-tight mb-2">
            Compras Americanas
          </h1>
          <p className="text-[#64748B] text-sm leading-relaxed">
            Por favor, inicia sesión para acceder al sistema de gestión de compras.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 rounded-lg flex items-start gap-3 border border-red-100">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
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
