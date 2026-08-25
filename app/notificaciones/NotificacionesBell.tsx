'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell, Monitor, Volume2, VolumeX } from 'lucide-react'
import { toast } from 'sonner'
import { useNotificaciones } from '@/lib/hooks/useNotificaciones'
import { useDesktopNotificaciones } from '@/lib/hooks/useDesktopNotificaciones'
import { authBypassActivo, useUsuario } from '@/lib/auth'
import { usePermisos } from '@/lib/hooks/useRol'
import { hrefSeguroNotificacion } from '@/lib/notificaciones'
import { puedeVerNotificaciones } from '@/lib/roles'

function formatearRelativo(fecha: Date): string {
  return fecha.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function NotificacionesBell() {
  const { usuario } = useUsuario()
  const { modulos, esSuperAdmin, atiendeDocumentosVenta, cargando: cargandoPermisos } = usePermisos(
    authBypassActivo() ? null : usuario
  )
  const visible = authBypassActivo() || puedeVerNotificaciones(modulos)
  const {
    items,
    paraDropdown,
    noLeidas,
    marcarLeida,
    marcarTodas,
    cargando,
    error,
    reintentar,
  } = useNotificaciones({
    enabled: visible && !cargandoPermisos,
    uid: authBypassActivo() ? null : usuario?.uid,
    modulos,
    esSuperAdmin,
    atiendeDocumentosVenta,
  })

  const {
    permiso,
    sonidoActivo,
    toggleSonido,
    solicitarPermiso,
  } = useDesktopNotificaciones({
    items,
    noLeidas,
    enabled: visible && !cargandoPermisos,
  })

  const [abierto, setAbierto] = useState(false)
  const [marcandoTodas, setMarcandoTodas] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (!abierto) return
    function onClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', onClickFuera)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickFuera)
      document.removeEventListener('keydown', onEscape)
    }
  }, [abierto])

  if (!visible) return null

  async function onClickItem(id: string, href: string, leida: boolean) {
    setAbierto(false)
    if (!leida) {
      try {
        await marcarLeida(id)
      } catch {
        toast.error('No se pudo marcar como leída')
      }
    }
    router.push(hrefSeguroNotificacion(href))
  }

  async function onMarcarTodas() {
    setMarcandoTodas(true)
    try {
      await marcarTodas()
      toast.success('Todas marcadas como leídas')
    } catch {
      toast.error('No se pudieron marcar como leídas')
    } finally {
      setMarcandoTodas(false)
    }
  }

  async function onActivarEscritorio() {
    const res = await solicitarPermiso()
    if (res === 'granted') {
      toast.success('Avisos de escritorio activados para Windows / PC')
    } else if (res === 'denied') {
      toast.error('Permiso denegado en el navegador. Habilítalo en la barra de direcciones.')
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={noLeidas > 0 ? `Notificaciones (${noLeidas} sin leer)` : 'Notificaciones'}
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className="relative flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-4 w-4" />
        {noLeidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {noLeidas > 99 ? '99+' : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 z-50 mt-1.5 w-80 animate-in fade-in-50 zoom-in-95 overflow-hidden rounded-lg border border-border bg-card shadow-md duration-100">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Notificaciones
              </span>
              <button
                type="button"
                onClick={toggleSonido}
                title={sonidoActivo ? 'Silenciar sonido' : 'Activar sonido'}
                className="cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {sonidoActivo ? (
                  <Volume2 className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5 text-muted-foreground/60" />
                )}
              </button>
            </div>
            {noLeidas > 0 && (
              <button
                type="button"
                disabled={marcandoTodas}
                onClick={() => void onMarcarTodas()}
                className="text-[10px] font-bold text-primary hover:underline disabled:opacity-50"
              >
                {marcandoTodas ? 'Marcando…' : `Marcar todas (${noLeidas})`}
              </button>
            )}
          </div>

          {permiso === 'default' && (
            <div className="flex items-center justify-between gap-2 border-b border-sky-200 bg-sky-50/70 px-3 py-2 text-[11px] text-sky-900">
              <div className="flex items-center gap-1.5 min-w-0">
                <Monitor className="h-3.5 w-3.5 shrink-0 text-sky-600" />
                <span className="truncate">¿Activar avisos en Windows?</span>
              </div>
              <button
                type="button"
                onClick={() => void onActivarEscritorio()}
                className="shrink-0 cursor-pointer rounded bg-sky-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-sky-700"
              >
                Activar
              </button>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-800">
              <span>No se pudo actualizar el estado de lectura.</span>
              <button type="button" onClick={reintentar} className="font-bold underline">
                Reintentar
              </button>
            </div>
          )}

          <div className="max-h-80 overflow-y-auto">
            {cargando && (
              <p className="px-3 py-4 text-xs text-muted-foreground">Cargando…</p>
            )}
            {!cargando && paraDropdown.length === 0 && (
              <p className="px-3 py-4 text-xs text-muted-foreground">No hay avisos por ahora.</p>
            )}
            {paraDropdown.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => void onClickItem(n.id, n.href, n.leida)}
                className={`w-full border-b border-border px-3 py-2.5 text-left transition-colors hover:bg-muted ${
                  n.leida ? 'opacity-70' : 'bg-sky-50/40'
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.leida && (
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">{n.titulo}</p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{n.cuerpo}</p>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {formatearRelativo(n.creadoEn)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <Link
            href="/notificaciones"
            onClick={() => setAbierto(false)}
            className="block border-t border-border px-3 py-2.5 text-center text-xs font-bold text-primary hover:bg-muted"
          >
            Ver todas
          </Link>
        </div>
      )}
    </div>
  )
}
