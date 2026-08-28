'use client'

import { useState, useMemo, type KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { copiarAlPortapapeles } from '@/lib/portapapeles'
import { Badge } from '@/components/ui/badge'
import {
  Bell,
  Copy,
  ExternalLink,
  Check,
  Monitor,
  Volume2,
  VolumeX,
  BellRing,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Search,
  Download,
  FileSpreadsheet,
  Package,
  FileText,
  Receipt,
  Flame,
  ShieldAlert,
  Inbox,
  Clock,
  Sliders,
} from 'lucide-react'
import ModuleEmptyState from '@/components/layout/ModuleEmptyState'
import ModuleFilterChips from '@/components/layout/ModuleFilterChips'
import ModuleSurface from '@/components/layout/ModuleSurface'
import ModuleTabs from '@/components/layout/ModuleTabs'
import { Button } from '@/components/ui/button'
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
import { descargarCSVNotificaciones, exportarExcelNotificaciones } from '@/lib/notificaciones-export'
import type { OrigenModuloNotificacion, TipoNotificacion } from '@/lib/schemas'
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
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'

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

function iconoParaTipo(tipo: TipoNotificacion) {
  switch (tipo) {
    case 'pedido_almacen_creado':
    case 'pedido_almacen_estado':
      return <Package className="h-4 w-4 text-sky-600" />
    case 'requisicion_creada':
    case 'requisicion_estado':
      return <FileText className="h-4 w-4 text-emerald-600" />
    case 'solicitud_documento_creada':
    case 'solicitud_documento_estado':
    case 'solicitud_documento_mensaje':
      return <Receipt className="h-4 w-4 text-indigo-600" />
    case 'banos_solicitud_creada':
    case 'banos_solicitud_resuelta':
      return <ShieldAlert className="h-4 w-4 text-amber-600" />
    case 'endmills_stock_critico':
      return <Flame className="h-4 w-4 text-rose-600" />
    case 'orden_recibida_almacen':
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" />
    default:
      return <Bell className="h-4 w-4 text-primary" />
  }
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
  const confirmar = useConfirmDialog()
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
    descartarNotificacion,
    descartarTodas,
    reintentar,
  } = useNotificaciones({
    enabled: !cargandoPermisos,
    uid: authBypassActivo() ? null : usuario?.uid,
    modulos,
    esSuperAdmin,
    atiendeDocumentosVenta,
  })

  const {
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

  const [tabActual, setTabActual] = useState<'bandeja' | 'solicitudes' | 'preferencias'>('bandeja')
  const [origen, setOrigen] = useState<FiltroOrigen>('todos')
  const [leida, setLeida] = useState<FiltroLeida>('todas')
  const [busqueda, setBusqueda] = useState('')
  const [marcando, setMarcando] = useState(false)
  const [marcandoId, setMarcandoId] = useState<string | null>(null)
  const [descartandoId, setDescartandoId] = useState<string | null>(null)
  const router = useRouter()

  const pendientesBanos = useSolicitudesBorradoBanosPendientes(esSuperAdmin)
  const [resolviendoId, setResolviendoId] = useState<string | null>(null)

  const listaOrigen = filtrar(origen, 'todas')
  const listaFiltradaPorEstado = filtrar(origen, leida)

  // Búsqueda de texto
  const lista = useMemo(() => {
    if (!busqueda.trim()) return listaFiltradaPorEstado
    const q = busqueda.toLowerCase().trim()
    return listaFiltradaPorEstado.filter((n) => {
      const matchTitulo = n.titulo.toLowerCase().includes(q)
      const matchCuerpo = n.cuerpo.toLowerCase().includes(q)
      const matchAutor = n.creadoPorNombre?.toLowerCase().includes(q)
      const matchOrigen = n.origenModulo.toLowerCase().includes(q)
      return matchTitulo || matchCuerpo || matchAutor || matchOrigen
    })
  }, [listaFiltradaPorEstado, busqueda])

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

  async function onDescartarUna(id: string) {
    setDescartandoId(id)
    try {
      await descartarNotificacion(id)
      toast.success('Notificación eliminada de tu bandeja')
    } catch {
      toast.error('No se pudo eliminar la notificación')
    } finally {
      setDescartandoId(null)
    }
  }

  async function onDescartarLeidas() {
    const leidasIds = items.filter((n) => n.leida).map((n) => n.id)
    if (leidasIds.length === 0) {
      toast.info('No hay notificaciones leídas para eliminar')
      return
    }
    const aceptado = await confirmar({
      title: 'Eliminar notificaciones leídas',
      description: `Se eliminarán ${leidasIds.length} avisos leídos de tu bandeja personal.`,
      confirmLabel: 'Eliminar leídas',
      variant: 'destructive',
    })
    if (!aceptado) return
    try {
      await descartarTodas(leidasIds)
      toast.success(`${leidasIds.length} notificaciones eliminadas`)
    } catch {
      toast.error('No se pudieron eliminar las notificaciones')
    }
  }

  async function onDescartarTodasVisibles() {
    if (lista.length === 0) return
    const aceptado = await confirmar({
      title: 'Eliminar todas las notificaciones visibles',
      description: `Se eliminarán ${lista.length} avisos de tu bandeja personal.`,
      confirmLabel: 'Eliminar todas',
      variant: 'destructive',
    })
    if (!aceptado) return
    try {
      await descartarTodas(lista.map((n) => n.id))
      toast.success('Notificaciones eliminadas de tu bandeja')
    } catch {
      toast.error('No se pudieron eliminar las notificaciones')
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
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        <p className="font-semibold">No se pudieron cargar las notificaciones</p>
        <p className="mt-1 text-xs">{error}</p>
        <button
          type="button"
          onClick={reintentar}
          className="mt-3 cursor-pointer text-xs font-bold underline"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Navegación con pestañas */}
      <ModuleTabs
        value={tabActual}
        onValueChange={(val) => setTabActual(val as 'bandeja' | 'solicitudes' | 'preferencias')}
        items={[
          {
            value: 'bandeja',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Inbox className="h-4 w-4" />
                <span>Bandeja de Entrada ({lista.length})</span>
                {noLeidas > 0 && (
                  <span className="rounded-full bg-primary px-1.5 py-0.2 font-mono text-[10px] font-bold text-primary-foreground">
                    {noLeidas}
                  </span>
                )}
              </span>
            ),
            content: (
              <div className="space-y-3">
                {/* Barra de Filtros, Búsqueda y Acciones */}
                <ModuleSurface className="space-y-3 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="relative min-w-[220px] flex-1">
                      <Search className="absolute top-2.5 left-3 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Buscar aviso por palabra, mensaje o solicitante..."
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        className="w-full rounded-lg border border-input bg-background py-1.5 pr-3 pl-8 text-xs text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => descargarCSVNotificaciones(lista)}
                        disabled={lista.length === 0}
                      >
                        <Download data-icon="inline-start" />
                        CSV
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void exportarExcelNotificaciones(lista)}
                        disabled={lista.length === 0}
                      >
                        <FileSpreadsheet data-icon="inline-start" />
                        Excel
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={noLeidas === 0 || marcando}
                        onClick={() => void onMarcarTodas()}
                      >
                        <Check data-icon="inline-start" />
                        {marcando ? 'Marcando…' : 'Marcar todas leídas'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        disabled={lista.length === 0}
                        onClick={() => void onDescartarLeidas()}
                      >
                        <Trash2 data-icon="inline-start" />
                        Eliminar leídas
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-xs">
                    <div className="flex flex-wrap items-center gap-3">
                      <ModuleFilterChips
                        ariaLabel="Filtrar por origen"
                        value={origen}
                        onValueChange={(value) => setOrigen(value as FiltroOrigen)}
                        options={FILTROS_ORIGEN.map(([value, label]) => ({ value, label }))}
                      />
                      <span className="hidden h-5 w-px bg-border sm:block" aria-hidden />
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

                    {lista.length > 0 && (
                      <button
                        type="button"
                        onClick={() => void onDescartarTodasVisibles()}
                        className="cursor-pointer font-mono text-[11px] text-muted-foreground hover:text-destructive hover:underline"
                      >
                        Vaciar lista visible ({lista.length})
                      </button>
                    )}
                  </div>
                </ModuleSurface>

                {cargando && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Cargando notificaciones…
                  </p>
                )}

                {!cargando && lista.length === 0 && (
                  <ModuleEmptyState
                    icon={Bell}
                    title="Bandeja limpia"
                    description="No hay avisos pendientes o que coincidan con la búsqueda."
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
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 min-w-0 flex-1">
                                <div className="mt-0.5 shrink-0 rounded-lg border border-border/80 bg-card p-2 shadow-2xs">
                                  {iconoParaTipo(n.tipo)}
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-bold text-foreground sm:text-sm">
                                      {n.titulo}
                                    </span>
                                    {!n.leida && (
                                      <Badge
                                        variant="outline"
                                        className="border-sky-300 bg-card text-[10px] font-bold text-primary"
                                      >
                                        Nueva
                                      </Badge>
                                    )}
                                    <Badge variant="outline" className="font-mono text-[10px]">
                                      {ETIQUETAS_ORIGEN[n.origenModulo]}
                                    </Badge>
                                  </div>
                                  <p className="mt-1 text-xs text-muted-foreground">{n.cuerpo}</p>

                                  <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10px] text-muted-foreground">
                                    <span className="inline-flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {formatearFecha(n.creadoEn)}
                                    </span>
                                    {n.creadoPorNombre && <span>· Por: {n.creadoPorNombre}</span>}
                                  </div>
                                </div>
                              </div>

                              <div
                                className="flex shrink-0 items-center gap-1.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {!n.leida && (
                                  <button
                                    type="button"
                                    disabled={marcandoId === n.id}
                                    onClick={() => void onMarcarUna(n.id)}
                                    className="cursor-pointer rounded-md border border-sky-200 bg-card px-2 py-1 text-[10px] font-bold text-primary hover:bg-sky-50 disabled:opacity-50"
                                    title="Marcar como leída"
                                  >
                                    {marcandoId === n.id ? '...' : 'Leída'}
                                  </button>
                                )}

                                <button
                                  type="button"
                                  disabled={descartandoId === n.id}
                                  onClick={() => void onDescartarUna(n.id)}
                                  className="cursor-pointer rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                                  title="Eliminar notificación"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
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

                          <ContextMenuItem
                            variant="destructive"
                            onClick={() => void onDescartarUna(n.id)}
                          >
                            <Trash2 />
                            <span>Eliminar notificación</span>
                          </ContextMenuItem>

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
            ),
          },
          {
            value: 'solicitudes',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                <span>Solicitudes ({solicitudesPendientes.length})</span>
              </span>
            ),
            content: (
              <div className="space-y-3">
                {solicitudesPendientes.length === 0 ? (
                  <ModuleEmptyState
                    icon={ShieldAlert}
                    title="Sin solicitudes pendientes"
                    description="No hay solicitudes de eliminación de registros pendientes de autorización."
                  />
                ) : (
                  <ModuleSurface className="border-amber-200 bg-amber-50/60 p-3.5">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold text-amber-900">
                        Solicitudes de borrado pendientes ({solicitudesPendientes.length})
                      </h2>
                      <span className="font-mono text-[10px] text-amber-700">
                        Autorizaciones reservadas a Super-admin
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {solicitudesPendientes.map((solicitud) => (
                        <li
                          key={solicitud.id}
                          className="rounded-lg border border-amber-200 bg-card p-3 shadow-2xs"
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
                                className="cursor-pointer rounded-md bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-200 disabled:opacity-50"
                              >
                                Aprobar
                              </button>
                              <button
                                type="button"
                                disabled={resolviendoId === solicitud.id}
                                onClick={() => void onResolverSolicitud(solicitud.id, 'rechazar')}
                                className="cursor-pointer rounded-md bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-200 disabled:opacity-50"
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
              </div>
            ),
          },
          {
            value: 'preferencias',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Sliders className="h-4 w-4" />
                <span>Preferencias & Alertas</span>
              </span>
            ),
            content: (
              <div className="space-y-4">
                <ModuleSurface className="space-y-4 p-4">
                  <h3 className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <Monitor className="h-4 w-4 text-primary" />
                    <span>Notificaciones en Windows y Navegador</span>
                  </h3>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-card p-3.5 text-xs">
                    <div>
                      <p className="font-semibold text-foreground">Avisos del Sistema en Escritorio</p>
                      <p className="mt-0.5 text-muted-foreground">
                        Recibe alertas nativas de Windows/Mac cuando lleguen nuevos pedidos o requisiciones.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {permisoEscritorio === 'granted' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                          <CheckCircle2 className="h-4 w-4" />
                          Habilitadas
                        </span>
                      ) : permisoEscritorio === 'denied' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-destructive">
                          <AlertCircle className="h-4 w-4" />
                          Bloqueadas en navegador
                        </span>
                      ) : (
                        <Button type="button" size="sm" onClick={() => void onActivarEscritorio()}>
                          Activar en esta PC
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-card p-3.5 text-xs">
                    <div>
                      <p className="font-semibold text-foreground">Sonido de Timbre para Alertas</p>
                      <p className="mt-0.5 text-muted-foreground">
                        Reproduce un tono discreto al recibir nuevos eventos en tiempo real.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={toggleSonido}
                      >
                        {sonidoActivo ? (
                          <>
                            <Volume2 className="text-primary" data-icon="inline-start" />
                            <span>Sonido Activo</span>
                          </>
                        ) : (
                          <>
                            <VolumeX className="text-muted-foreground" data-icon="inline-start" />
                            <span>Silenciado</span>
                          </>
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={probarTimbre}
                      >
                        <BellRing data-icon="inline-start" />
                        <span>Probar timbre</span>
                      </Button>
                    </div>
                  </div>
                </ModuleSurface>

                <ModuleSurface className="p-4">
                  <h3 className="mb-2 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Canales Asignados a tu Cuenta
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Recibes alertas automáticas de los siguientes canales según tus módulos autorizados:
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {modulos?.map((m) => (
                      <Badge key={m} variant="outline" className="font-mono text-xs">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </ModuleSurface>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
