'use client'

import { useState, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { copiarAlPortapapeles } from '@/lib/portapapeles'
import { Badge } from '@/components/ui/badge'
import { Bell, Copy, ExternalLink, Check, Monitor, Volume2, VolumeX, BellRing, CheckCircle2, AlertCircle } from 'lucide-react'
import ModuleEmptyState from '@/components/layout/ModuleEmptyState'
import ModuleFilterChips from '@/components/layout/ModuleFilterChips'
import ModuleSurface from '@/components/layout/ModuleSurface'
import { authBypassActivo, useUsuario } from '@/lib/auth'
import { usePermisos } from '@/lib/hooks/useRol'
import { useSolicitudesBorradoBanosPendientes } from '@/lib/hooks/useBanosSolicitudesBorrado'
import {
  useNotificaciones,
  type FiltroLeida,
  type FiltroOrigen,
} from '@/lib/hooks/useNotificaciones'
import { useDesktopNotificaciones } from '@/lib/hooks/useDesktopNotificaciones'
import { hrefSeguroNotificacion } from '@/lib/notificaciones'
import type { OrigenModuloNotificacion } from '@/lib/schemas'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'

const FILTROS_ORIGEN: readonly (readonly [FiltroOrigen, string])[] = [
  ['todos', 'Todos'],
  ['pedidos-almacen', 'Pedidos'],
  ['requisiciones', 'Requisiciones'],
  ['documentos-venta', 'Documentos'],
  ['banos', 'Baños'],
  ['endmills', 'Endmills'],
]

const ETIQUETAS_ORIGEN: Record<OrigenModuloNotificacion, string> = {
  'pedidos-almacen': 'pedido',
  requisiciones: 'requisición',
  'documentos-venta': 'documento',
  banos: 'baño',
  endmills: 'endmills',
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
  const { usuario } = useUsuario()
  const { modulos, esSuperAdmin, atiendeDocumentosVenta, cargando: cargandoPermisos } = usePermisos(
    authBypassActivo() ? null : usuario
  )
  const {
    items,
    filtrar,
    noLeidas,
    cargando,
    error,
    marcarLeida,
    marcarTodas,
    reintentar,
  } = useNotificaciones({
    enabled: !cargandoPermisos,
    uid: authBypassActivo() ? null : usuario?.uid,
    modulos,
    esSuperAdmin,
    atiendeDocumentosVenta,
  })

  const {
    soportado: soportaEscritorio,
    permiso: permisoEscritorio,
    sonidoActivo,
    solicitarPermiso,
    toggleSonido,
    probarTimbre,
    probarNotificacion,
  } = useDesktopNotificaciones({
    items,
    noLeidas,
    enabled: !cargandoPermisos,
  })

  const [origen, setOrigen] = useState<FiltroOrigen>('todos')
  const [leida, setLeida] = useState<FiltroLeida>('todas')
  const [marcando, setMarcando] = useState(false)
  const [marcandoId, setMarcandoId] = useState<string | null>(null)
  const router = useRouter()

  const pendientesBanos = useSolicitudesBorradoBanosPendientes(esSuperAdmin)
  const [resolviendoId, setResolviendoId] = useState<string | null>(null)

  const listaOrigen = filtrar(origen, 'todas')
  const lista = filtrar(origen, leida)
  const noLeidasOrigen = listaOrigen.filter((item) => !item.leida).length
  const leidasOrigen = listaOrigen.length - noLeidasOrigen
  const solicitudesPendientes = Array.from(pendientesBanos.values())

  async function onActivarEscritorio() {
    const res = await solicitarPermiso()
    if (res === 'granted') {
      toast.success('Notificaciones de escritorio activadas para Windows y PC')
      void probarNotificacion()
    } else if (res === 'denied') {
      toast.error('Permiso denegado por el navegador. Habilítalo en los ajustes del sitio.')
    }
  }

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
        <p className="mt-1 text-xs">{error}</p>
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
      {/* Barra de Notificaciones de Escritorio y Sonido */}
      {soportaEscritorio && (
        <ModuleSurface className="flex flex-wrap items-center justify-between gap-3 border-border bg-card/60 p-3 text-xs">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Monitor className="h-4 w-4 text-primary" />
              <span>Avisos en Windows / PC:</span>
            </div>
            {permisoEscritorio === 'granted' ? (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Activas
              </span>
            ) : permisoEscritorio === 'denied' ? (
              <span className="inline-flex items-center gap-1 font-semibold text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                Bloqueadas en navegador
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void onActivarEscritorio()}
                className="cursor-pointer rounded-lg bg-sky-600 px-2.5 py-1 text-[11px] font-bold text-white transition-colors hover:bg-sky-700"
              >
                Activar en esta computadora
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSonido}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted"
            >
              {sonidoActivo ? (
                <>
                  <Volume2 className="h-3.5 w-3.5 text-primary" />
                  <span>Timbre activo</span>
                </>
              ) : (
                <>
                  <VolumeX className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Timbre silenciado</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={probarTimbre}
              title="Escuchar el sonido de notificación"
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <BellRing className="h-3.5 w-3.5" />
              <span>Probar timbre</span>
            </button>
          </div>
        </ModuleSurface>
      )}

      <ModuleSurface className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <ModuleFilterChips
            ariaLabel="Filtrar por origen"
            value={origen}
            onValueChange={(value) => setOrigen(value as FiltroOrigen)}
            options={FILTROS_ORIGEN.map(([value, label]) => ({ value, label }))}
          />
          <span className="hidden h-6 w-px self-center bg-border sm:block" aria-hidden />
          <ModuleFilterChips
            ariaLabel="Filtrar por estado de lectura"
            value={leida}
            onValueChange={(value) => setLeida(value as FiltroLeida)}
            options={[
              { value: 'todas', label: `Todas ${listaOrigen.length}` },
              { value: 'no_leidas', label: `No leídas ${noLeidasOrigen}` },
              { value: 'leidas', label: `Leídas ${leidasOrigen}` },
            ]}
          />
        </div>

        <button
          type="button"
          disabled={noLeidas === 0 || marcando}
          onClick={() => void onMarcarTodas()}
          className="text-[11px] font-bold text-primary hover:underline disabled:opacity-40"
        >
          {marcando ? 'Marcando…' : 'Marcar todas como leídas'}
        </button>
      </ModuleSurface>

      {esSuperAdmin && solicitudesPendientes.length > 0 && (
        <ModuleSurface className="border-amber-200 bg-amber-50/60 p-3.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-amber-900">
              Solicitudes de borrado pendientes ({solicitudesPendientes.length})
            </h2>
            <span className="text-[10px] text-amber-700">
              Disponibles aunque el aviso ya no esté en el feed
            </span>
          </div>
          <ul className="space-y-2">
            {solicitudesPendientes.map((solicitud) => (
              <li
                key={solicitud.id}
                className="rounded-lg border border-amber-200 bg-card p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 text-xs text-foreground">
                    <p className="font-semibold text-foreground">
                      {solicitud.registroResumen.operador} · {solicitud.registroResumen.bano} (
                      {solicitud.registroResumen.fecha})
                    </p>
                    <p className="mt-0.5 text-muted-foreground">
                      Motivo: {solicitud.motivo}
                      {solicitud.nota ? ` · ${solicitud.nota}` : ''}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {solicitud.solicitadoPorNombre} · {formatearFecha(solicitud.creadoEn)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={resolviendoId === solicitud.id}
                      onClick={() => void onResolverSolicitud(solicitud.id, 'aprobar')}
                      className="rounded-md bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      disabled={resolviendoId === solicitud.id}
                      onClick={() => void onResolverSolicitud(solicitud.id, 'rechazar')}
                      className="rounded-md bg-red-100 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-200 disabled:opacity-50"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </ModuleSurface>
      )}

      {cargando && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Cargando notificaciones…
        </p>
      )}

      {!cargando && lista.length === 0 && (
        <ModuleEmptyState
          icon={Bell}
          title="Sin avisos"
          description="Los avisos nuevos de los módulos que operas aparecerán aquí."
        />
      )}

      <ul className="space-y-2">
        {lista.map((n) => (
          <li key={n.id}>
            <ContextMenu>
              <ContextMenuTrigger asChild>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => void onClickFila(n.id, n.href, n.leida)}
                  onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                    if (e.target !== e.currentTarget) return
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      void onClickFila(n.id, n.href, n.leida)
                    }
                  }}
                  className={`w-full cursor-pointer select-none overflow-hidden rounded-xl border p-3.5 text-left shadow-xs transition-colors hover:border-primary/40 ${
                    n.leida
                      ? 'border-border bg-card'
                      : 'border-sky-200 bg-sky-50/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-foreground">{n.titulo}</span>
                        {!n.leida && (
                          <Badge
                            variant="outline"
                            className="border-sky-300 bg-card text-[10px] text-primary"
                          >
                            Nueva
                          </Badge>
                        )}
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {ETIQUETAS_ORIGEN[n.origenModulo]}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{n.cuerpo}</p>
                      {n.origenModulo === 'banos' &&
                        n.tipo === 'banos_solicitud_creada' &&
                        esSuperAdmin &&
                        pendientesBanos.has(n.origenId) && (
                          <div
                            className="mt-2 flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              disabled={resolviendoId === n.origenId}
                              onClick={() => void onResolverSolicitud(n.origenId, 'aprobar')}
                              className="cursor-pointer rounded-md bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-200 disabled:opacity-50"
                            >
                              Aprobar
                            </button>
                            <button
                              type="button"
                              disabled={resolviendoId === n.origenId}
                              onClick={() => void onResolverSolicitud(n.origenId, 'rechazar')}
                              className="cursor-pointer rounded-md bg-red-100 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-200 disabled:opacity-50"
                            >
                              Rechazar
                            </button>
                          </div>
                        )}
                      <p className="mt-2 font-mono text-[10px] text-muted-foreground">
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
                        className="shrink-0 cursor-pointer rounded-md border border-sky-200 bg-card px-2 py-1 text-[10px] font-bold text-primary hover:bg-sky-50 disabled:opacity-50"
                      >
                        {marcandoId === n.id ? 'Marcando…' : 'Marcar leída'}
                      </button>
                    )}
                  </div>
                </div>
              </ContextMenuTrigger>

              <ContextMenuContent className="w-56">
                <ContextMenuItem onClick={() => void onClickFila(n.id, n.href, n.leida)}>
                  <ExternalLink className="text-primary" />
                  <span>Ir al recurso / módulo</span>
                  <ContextMenuShortcut>↵</ContextMenuShortcut>
                </ContextMenuItem>

                {!n.leida && (
                  <ContextMenuItem onClick={() => void onMarcarUna(n.id)}>
                    <Check className="text-emerald-600" />
                    <span>Marcar como leída</span>
                  </ContextMenuItem>
                )}

                <ContextMenuSeparator />

                <ContextMenuSub>
                  <ContextMenuSubTrigger>
                    <Copy className="text-muted-foreground" />
                    <span>Copiar información</span>
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-48">
                    <ContextMenuItem
                      onClick={() => {
                        void copiarAlPortapapeles(n.titulo, 'Título copiado')
                      }}
                    >
                      <span>Título ({n.titulo})</span>
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => {
                        void copiarAlPortapapeles(n.cuerpo, 'Cuerpo copiado')
                      }}
                    >
                      <span>Mensaje completo</span>
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => {
                        const urlCompleta = `${window.location.origin}${hrefSeguroNotificacion(n.href)}`
                        void copiarAlPortapapeles(urlCompleta, 'Enlace copiado', urlCompleta)
                      }}
                    >
                      <span>Enlace directo</span>
                    </ContextMenuItem>
                  </ContextMenuSubContent>
                </ContextMenuSub>
              </ContextMenuContent>
            </ContextMenu>
          </li>
        ))}
      </ul>
    </div>
  )
}
