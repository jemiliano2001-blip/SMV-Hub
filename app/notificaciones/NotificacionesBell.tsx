'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { toast } from 'sonner'
import { useNotificaciones } from '@/lib/hooks/useNotificaciones'
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={noLeidas > 0 ? `Notificaciones (${noLeidas} sin leer)` : 'Notificaciones'}
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        className="relative flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0369A1]"
      >
        <Bell className="h-4 w-4" />
        {noLeidas > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
            {noLeidas > 99 ? '99+' : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 mt-1.5 w-80 rounded-lg border border-slate-200 bg-white shadow-md z-50 animate-in fade-in-50 zoom-in-95 duration-100">
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
              Notificaciones
            </span>
            {noLeidas > 0 && (
              <button
                type="button"
                disabled={marcandoTodas}
                onClick={() => void onMarcarTodas()}
                className="text-[10px] font-bold text-[#0369A1] hover:underline disabled:opacity-50"
              >
                {marcandoTodas ? 'Marcando…' : `Marcar todas (${noLeidas})`}
              </button>
            )}
          </div>

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
              <p className="px-3 py-4 text-xs text-slate-500">Cargando…</p>
            )}
            {!cargando && paraDropdown.length === 0 && (
              <p className="px-3 py-4 text-xs text-slate-500">No hay avisos por ahora.</p>
            )}
            {paraDropdown.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => void onClickItem(n.id, n.href, n.leida)}
                className={`w-full text-left px-3 py-2.5 border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                  n.leida ? 'opacity-70' : 'bg-sky-50/40'
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.leida && (
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0369A1]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900 truncate">{n.titulo}</p>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{n.cuerpo}</p>
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">
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
            className="block px-3 py-2.5 text-center text-xs font-bold text-[#0369A1] hover:bg-sky-50 border-t border-slate-100"
          >
            Ver todas
          </Link>
        </div>
      )}
    </div>
  )
}
