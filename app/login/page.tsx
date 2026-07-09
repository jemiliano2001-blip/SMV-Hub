'use client'

import LogoSMV from "@/app/LogoSMV"
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { iniciarSesionConGoogle, iniciarSesionConEmailYPassword, cerrarSesion } from '@/lib/auth'
import { obtenerRolUsuario } from '@/lib/usuarios'
import { LogIn, AlertCircle, Mail, Lock } from 'lucide-react'

const MENSAJES_ERROR: Record<string, string> = {
  no_autorizado:
    'Tu cuenta no está autorizada para SMV Hub. Contacta al administrador para solicitar acceso.',
}

const MENSAJES_ERROR_FIREBASE: Record<string, string> = {
  'auth/wrong-password': 'Contraseña incorrecta. Intenta de nuevo.',
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'No existe una cuenta con ese correo.',
  'auth/user-disabled': 'Esta cuenta fue desactivada. Contacta al administrador.',
  'auth/too-many-requests': 'Demasiados intentos fallidos. Espera unos minutos e intenta de nuevo.',
}

function mensajeErrorFirebase(err: unknown): string {
  const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : ''
  return MENSAJES_ERROR_FIREBASE[code] ?? 'Ocurrió un error al intentar iniciar sesión. Por favor, intenta nuevamente.'
}

function LoginForm() {
  const searchParams = useSearchParams()
  const codigoError = searchParams.get('error')
  const errorDesdeQuery =
    codigoError && MENSAJES_ERROR[codigoError] ? MENSAJES_ERROR[codigoError] : null

  const [error, setError] = useState<string | null>(null)
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [loadingPassword, setLoadingPassword] = useState(false)
  const [correo, setCorreo] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()

  const mensajeError = error ?? errorDesdeQuery

  async function entrarSiAutorizado(uid: string, email: string | null): Promise<void> {
    const rol = await obtenerRolUsuario(uid, email)
    if (!rol) {
      await cerrarSesion()
      setError(MENSAJES_ERROR.no_autorizado)
      return
    }
    router.push('/')
  }

  const handleLoginGoogle = async () => {
    try {
      setLoadingGoogle(true)
      setError(null)
      const usuario = await iniciarSesionConGoogle()
      await entrarSiAutorizado(usuario.uid, usuario.email)
    } catch (err: unknown) {
      console.error("Error al iniciar sesión con Google:", err instanceof Error ? err.message : "error desconocido")
      setError(mensajeErrorFirebase(err))
    } finally {
      setLoadingGoogle(false)
    }
  }

  const handleLoginPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setLoadingPassword(true)
      setError(null)
      const usuario = await iniciarSesionConEmailYPassword(correo, password)
      await entrarSiAutorizado(usuario.uid, usuario.email)
    } catch (err: unknown) {
      console.error("Error al iniciar sesión con correo:", err instanceof Error ? err.message : "error desconocido")
      setError(mensajeErrorFirebase(err))
    } finally {
      setLoadingPassword(false)
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

        {/* Google Sign-In */}
        <button
          onClick={handleLoginGoogle}
          disabled={loadingGoogle || loadingPassword}
          className="w-full flex items-center justify-center gap-3 bg-[#0F172A] hover:bg-[#1E293B] text-white px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingGoogle ? (
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
          ) : (
            <LogIn className="h-5 w-5" />
          )}
          <span>{loadingGoogle ? 'Iniciando sesión...' : 'Ingresar con Google'}</span>
        </button>

        {/* Separator */}
        <div className="flex items-center gap-3 my-6">
          <div className="h-px flex-1 bg-[#E2E8F0]" />
          <span className="text-xs text-[#94A3B8]">o con tu usuario</span>
          <div className="h-px flex-1 bg-[#E2E8F0]" />
        </div>

        {/* Email/Password form */}
        <form onSubmit={handleLoginPassword} className="space-y-3">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
            <input
              type="email"
              required
              autoComplete="username"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="correo@ejemplo.com"
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0369A1]"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8]" />
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-[#0369A1]"
            />
          </div>
          <button
            type="submit"
            disabled={loadingGoogle || loadingPassword}
            className="w-full flex items-center justify-center gap-2 bg-white hover:bg-[#F8FAFC] text-[#0F172A] px-6 py-2.5 rounded-lg font-medium border border-[#E2E8F0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingPassword && (
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-[#0F172A]"></div>
            )}
            <span>{loadingPassword ? 'Iniciando sesión...' : 'Ingresar'}</span>
          </button>
        </form>

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
