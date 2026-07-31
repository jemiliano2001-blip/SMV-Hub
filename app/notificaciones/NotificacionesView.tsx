'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { authBypassActivo, useUsuario } from '@/lib/auth'
import { usePermisos } from '@/lib/hooks/useRol'
import { useSolicitudesBorradoBanosPendientes } from '@/lib/hooks/useBanosSolicitudesBorrado'
import {
  useNotificaciones,
  type FiltroLeida,
  type FiltroOrigen,
} from '@/lib/hooks/useNotificaciones'
import { hrefSeguroNotificacion } from '@/lib/notificaciones'
import type { OrigenModuloNotificacion } from '@/lib/schemas'

const FILTROS_ORIGEN: readonly (readonly [FiltroOrigen, string])[] = [
  ['todos', 'Todos'],
  ['pedidos-almacen', 'Pedidos'],
  ['requisiciones', 'Requisiciones'],
  ['documentos-venta', 'Documentos'],
  ['banos', 'Baños'],
]

const ETIQUETAS_ORIGEN: Record<OrigenModuloNotificacion, string> = {
  'pedidos-almacen': 'pedido',
  requisiciones: 'requisición',
  'documentos-venta': 'documento',
  banos: 'baño',
}

function formatearFecha(fecha: Date): string {
  return fecha.toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function NotificacionesView() {
  const {
    items,
    filtrar,
    noLeidas,
    cargando,
    error,
    marcarLeida,
    marcarTodas,
    reintentar,
  } = useNotificaciones()
  const [origen, setOrigen] = useState<FiltroOrigen>('todos')
  const [leida, setLeida] = useState<FiltroLeida>('todas')
  const [marcando, setMarcando] = useState(false)
  const [marcandoId, setMarcandoId] = useState<string | null>(null)
  const router = useRouter()

  const { usuario } = useUsuario()
  const { esSuperAdmin } = usePermisos(authBypassActivo() ? null : usuario)
  const pendientesBanos = useSolicitudesBorradoBanosPendientes(esSuperAdmin)
  const [resolviendoId, setResolviendoId] = useState<string | null>(null)

  const lista = filtrar(origen, leida)
  const leidas = items.length - noLeidas

  async function onResolverSolicitud(solicitudId: string, decision: 'aprobar' | 'rechazar') {
    setResolviendoId(solicitudId)
    try {
      const token = await usuario?.getIdToken()
      const res = await fetch(`/api/banos/solicitudes-borrado/${solicitudId}/resolver`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ decision }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(data.error || 'No se pudo resolver la solicitud')
        return
      }
      toast.success(decision === 'aprobar' ? 'Solicitud aprobada' : 'Solicitud rechazada')
    } catch {
      toast.error('No se pudo resolver la solicitud')
    } finally {
      setResolviendoId(null)
    }
  }

  async function onClickFila(id: string, href: string, yaLeida: boolean) {
    if (!yaLeida) {
      try {
        await marcarLeida(id)
      } catch {
        toast.error('No se pudo marcar como leída. Intenta de nuevo.')
      }
    }
    router.push(hrefSeguroNotificacion(href))
  }

  async function onMarcarUna(id: string) {
    setMarcandoId(id)
    try {
      await marcarLeida(id)
      toast.success('Notificación marcada como leída')
    } catch {
      toast.error('No se pudo marcar como leída. Intenta de nuevo.')
    } finally {
      setMarcandoId(null)
    }
  }

  async function onMarcarTodas() {
    setMarcando(true)
    try {
      await marcarTodas()
      toast.success('Todas marcadas como leídas')
    } catch {
      toast.error('No se pudieron marcar como leídas')
    } finally {
      setMarcando(false)
    }
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-semibold">No se pudieron cargar las notificaciones</p>
        <p className="text-xs mt-1">{error}</p>
        <button
          type="button"
          onClick={reintentar}
          className="mt-3 text-xs font-bold underline"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTROS_ORIGEN.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={origen === value}
              onClick={() => setOrigen(value)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold border transition-colors ${
                origen === value
                  ? 'bg-[#0369A1] text-white border-[#0369A1]'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
          <span className="w-px h-6 bg-slate-200 mx-1 self-center" />
          {(
            [
              ['todas', `Todas ${items.length}`],
              ['no_leidas', `No leídas ${noLeidas}`],
              ['leidas', `Leídas ${leidas}`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={leida === value}
              onClick={() => setLeida(value)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold border transition-colors ${
                leida === value
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={noLeidas === 0 || marcando}
          onClick={() => void onMarcarTodas()}
          className="text-[11px] font-bold text-[#0369A1] disabled:opacity-40 hover:underline"
        >
          {marcando ? 'Marcando…' : 'Marcar todas como leídas'}
        </button>
      </div>

      {cargando && (
        <p className="text-sm text-slate-500 py-8 text-center">Cargando notificaciones…</p>
      )}

      {!cargando && lista.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-slate-700">Sin avisos</p>
          <p className="text-xs text-slate-500 mt-1">
            Los avisos nuevos de los módulos que operas aparecerán aquí.
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {lista.map((n) => (
          <li key={n.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => void onClickFila(n.id, n.href, n.leida)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  void onClickFila(n.id, n.href, n.leida)
                }
              }}
              className={`w-full text-left rounded-xl border p-3.5 transition-colors hover:border-[#0369A1]/40 cursor-pointer ${
                n.leida
                  ? 'bg-white border-slate-200'
                  : 'bg-sky-50/60 border-sky-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900">{n.titulo}</span>
                    {!n.leida && (
                      <Badge variant="outline" className="text-[10px] bg-white border-sky-300 text-[#0369A1]">
                        Nueva
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {ETIQUETAS_ORIGEN[n.origenModulo]}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{n.cuerpo}</p>
                  {n.origenModulo === 'banos' &&
                    n.tipo === 'banos_solicitud_creada' &&
                    esSuperAdmin &&
                    pendientesBanos.has(n.origenId) && (
                      <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          disabled={resolviendoId === n.origenId}
                          onClick={() => void onResolverSolicitud(n.origenId, 'aprobar')}
                          className="text-[11px] font-semibold bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-2.5 py-1 rounded-md disabled:opacity-50"
                        >
                          Aprobar
                        </button>
                        <button
                          type="button"
                          disabled={resolviendoId === n.origenId}
                          onClick={() => void onResolverSolicitud(n.origenId, 'rechazar')}
                          className="text-[11px] font-semibold bg-red-100 text-red-700 hover:bg-red-200 px-2.5 py-1 rounded-md disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      </div>
                    )}
                  <p className="text-[10px] text-slate-400 font-mono mt-2">
                    {formatearFecha(n.creadoEn)}
                    {n.creadoPorNombre ? ` · ${n.creadoPorNombre}` : ''}
                  </p>
                </div>
                {!n.leida && (
                  <button
                    type="button"
                    disabled={marcandoId === n.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      void onMarcarUna(n.id)
                    }}
                    className="shrink-0 rounded-md border border-sky-200 bg-white px-2 py-1 text-[10px] font-bold text-[#0369A1] hover:bg-sky-50 disabled:opacity-50"
                  >
                    {marcandoId === n.id ? 'Marcando…' : 'Marcar leída'}
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
