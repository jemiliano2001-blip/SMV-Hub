'use client'

import LogoSMV from "@/app/LogoSMV"
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { iniciarSesionConGoogle, iniciarSesionConEmailYPassword, cerrarSesion, useUsuario } from '@/lib/auth'
import { obtenerRolUsuario } from '@/lib/usuarios'
import { LogIn, AlertCircle, Mail, Lock, Loader2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'

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
  const { usuario, cargando: cargandoSesion } = useUsuario()

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

  if (cargandoSesion || usuario) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-10 animate-spin text-primary" aria-label="Cargando" />
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16">
      <Card className="w-full max-w-md gap-0 py-0 shadow-xs">
        <CardHeader className="items-center gap-2 px-8 pt-8 pb-6 text-center">
          <LogoSMV height={44} />
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            SMV Hub
          </h1>
          <CardDescription>
            Inicia sesión para entrar a la plataforma interna del taller.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 px-8 pb-8">
          {mensajeError ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{mensajeError}</AlertDescription>
            </Alert>
          ) : null}

          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={handleLoginGoogle}
            disabled={loadingGoogle || loadingPassword}
          >
            {loadingGoogle ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <LogIn data-icon="inline-start" />
            )}
            {loadingGoogle ? 'Iniciando sesión...' : 'Ingresar con Google'}
          </Button>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">o con tu usuario</span>
            <Separator className="flex-1" />
          </div>

          <form onSubmit={handleLoginPassword} className="flex flex-col gap-3">
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Correo electrónico"
                type="email"
                required
                autoComplete="username"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="correo@ejemplo.com"
                className="h-10 pl-10"
              />
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="Contraseña"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                className="h-10 pl-10"
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              size="lg"
              className="w-full"
              disabled={loadingGoogle || loadingPassword}
            >
              {loadingPassword ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
              {loadingPassword ? 'Iniciando sesión...' : 'Ingresar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-8 text-xs text-muted-foreground">
        Acceso restringido · SMV Maquinados
      </p>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="size-10 animate-spin text-primary" aria-label="Cargando" />
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
