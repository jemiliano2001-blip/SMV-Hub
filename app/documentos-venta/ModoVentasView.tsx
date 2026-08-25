'use client'

import { useMemo, useState } from 'react'
import { Plus, MessageSquare, CheckCircle, Copy, Play, XCircle, Inbox } from 'lucide-react'
import { copiarAlPortapapeles } from '@/lib/portapapeles'
import type {
  EstadoSolicitudDocumento,
  MensajeSolicitudDocumento,
  NuevaSolicitudDocumento,
  SolicitudDocumento,
  VentaOdooSo,
} from '@/lib/schemas'
import {
  etiquetaEstadoSolicitudDocumento,
  ordenCompraSolicitud,
  particionarSolicitudesVentas,
} from '@/lib/documentos-venta-helpers'
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
import ModuleEmptyState from '@/components/layout/ModuleEmptyState'
import DetalleVentasSimple from './DetalleVentasSimple'
import NuevaSolicitudPanel from './NuevaSolicitudPanel'

type Props = {
  solicitudes: SolicitudDocumento[]
  mensajes: MensajeSolicitudDocumento[]
  sos: VentaOdooSo[]
  busquedaSo: string
  onBusquedaSoChange: (q: string) => void
  uid: string
  nombre: string
  solicitudId: string | null
  onAbrir: (id: string) => void
  onCerrarDetalle: () => void
  onCrear: (
    data: NuevaSolicitudDocumento,
    opts?: { lineasSo?: readonly { odooLineId: number; qtyPending: number }[] }
  ) => Promise<string>
  onActualizarEstado: (args: {
    id: string
    desde: EstadoSolicitudDocumento
    hacia: EstadoSolicitudDocumento
    esAtendedor: boolean
    esSolicitante: boolean
    uid: string
    nombre: string
    folioOdoo?: string | null
    motivoRechazo?: string | null
  }) => Promise<void>
  onEnviarMensaje: (
    solicitudId: string,
    texto: string,
    autorUid: string,
    autorNombre: string
  ) => Promise<string>
}

type TabVentas = 'pendientes' | 'hechas' | 'nueva'

function coincideBusqueda(s: SolicitudDocumento, q: string): boolean {
  const n = q.trim().toLowerCase()
  if (!n) return true
  const hay = [
    s.partnerName,
    s.odooSoName,
    ordenCompraSolicitud(s) ?? '',
    s.tipo,
    s.solicitadoPorNombre,
  ]
    .join(' ')
    .toLowerCase()
  return hay.includes(n)
}

export default function ModoVentasView({
  solicitudes,
  mensajes,
  sos,
  busquedaSo,
  onBusquedaSoChange,
  uid,
  nombre,
  solicitudId,
  onAbrir,
  onCerrarDetalle,
  onCrear,
  onActualizarEstado,
  onEnviarMensaje,
}: Props) {
  const [tab, setTab] = useState<TabVentas>('pendientes')
  const [busqueda, setBusqueda] = useState('')

  const { pendientes, hechas } = useMemo(
    () => particionarSolicitudesVentas(solicitudes),
    [solicitudes]
  )

  const lista = useMemo(() => {
    const base = tab === 'pendientes' ? pendientes : hechas
    return base.filter((s) => coincideBusqueda(s, busqueda))
  }, [tab, pendientes, hechas, busqueda])

  const seleccionada =
    solicitudId != null
      ? (solicitudes.find((s) => s.id === solicitudId) ?? null)
      : null

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setTab(tab === 'nueva' ? 'pendientes' : 'nueva')}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 px-4 py-4 text-base font-bold transition-colors ${
          tab === 'nueva'
            ? 'border-border bg-card text-foreground'
            : 'border-sky-600 bg-sky-600 text-white hover:bg-sky-700'
        }`}
      >
        {tab === 'nueva' ? (
          'Volver a las solicitudes'
        ) : (
          <>
            <Plus className="h-5 w-5" />
            Nueva solicitud
          </>
        )}
      </button>

      {tab === 'nueva' ? (
        <NuevaSolicitudPanel
          sos={sos}
          solicitudesActivas={solicitudes}
          busqueda={busquedaSo}
          onBusquedaChange={onBusquedaSoChange}
          uid={uid}
          nombre={nombre}
          onCrear={async (data, opts) => {
            const id = await onCrear(data, opts)
            setTab('pendientes')
            onAbrir(id)
            return id
          }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                {
                  id: 'pendientes' as const,
                  label: 'Pendientes',
                  count: pendientes.length,
                },
                { id: 'hechas' as const, label: 'Hechas', count: hechas.length },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-2xl border-2 px-4 py-4 text-base font-bold ${
                  tab === t.id
                    ? 'border-sky-600 bg-sky-50 text-sky-900'
                    : 'border-border bg-card text-muted-foreground'
                }`}
              >
                {t.label}
                <span className="block text-sm font-semibold opacity-70">
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          <label className="block text-sm font-semibold text-muted-foreground">
            Buscar
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="mt-1 w-full rounded-xl border border-input bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground"
              placeholder="Cliente, orden de compra o SO…"
            />
          </label>

          {lista.length === 0 ? (
            <ModuleEmptyState
              icon={Inbox}
              title={
                tab === 'pendientes'
                  ? 'Sin solicitudes por atender'
                  : 'Sin solicitudes hechas'
              }
              description={
                tab === 'pendientes'
                  ? 'No hay solicitudes por atender.'
                  : 'Aún no hay solicitudes hechas.'
              }
            />
          ) : (
            <ul className="space-y-3">
              {lista.map((s) => {
                const oc = ordenCompraSolicitud(s)
                return (
                  <li key={s.id}>
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={() => onAbrir(s.id)}
                          className="w-full cursor-pointer select-none rounded-2xl border-2 border-border bg-card p-4 text-left shadow-xs transition-all hover:border-sky-500 hover:shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                                  s.tipo === 'factura'
                                    ? 'bg-sky-100 text-sky-800'
                                    : 'bg-indigo-100 text-indigo-800'
                                }`}
                              >
                                {s.tipo === 'factura' ? 'Factura' : 'Remisión'}
                              </span>
                              <p className="text-base font-bold text-foreground">
                                {s.partnerName}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                s.estado === 'completada'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : s.estado === 'en_proceso'
                                    ? 'bg-sky-100 text-sky-800'
                                    : s.estado === 'rechazada'
                                      ? 'bg-red-100 text-destructive'
                                      : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {etiquetaEstadoSolicitudDocumento(s.estado)}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>
                              SO <strong className="text-foreground">{s.odooSoName}</strong>
                            </span>
                            <span>·</span>
                            <span>
                              {oc ? (
                                <>Orden de compra: <strong className="text-foreground">{oc}</strong></>
                              ) : (
                                'Sin orden de compra'
                              )}
                            </span>
                            <span>·</span>
                            <span>Pidió: <strong className="text-foreground">{s.solicitadoPorNombre}</strong></span>
                            {s.atendidoPorNombre && (
                              <>
                                <span>·</span>
                                <span>Atiende: <strong className="text-foreground">{s.atendidoPorNombre}</strong></span>
                              </>
                            )}
                          </div>

                          <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1 text-primary font-semibold">
                              <MessageSquare className="h-3.5 w-3.5" />
                              Ver detalle y chat
                            </span>
                            {s.folioOdoo && (
                              <span className="font-mono font-semibold text-emerald-600">
                                Folio: {s.folioOdoo}
                              </span>
                            )}
                          </div>
                        </button>
                      </ContextMenuTrigger>

                      <ContextMenuContent className="w-56">
                        <ContextMenuItem onClick={() => onAbrir(s.id)}>
                          <MessageSquare className="text-primary" />
                          <span>Abrir solicitud y chat</span>
                          <ContextMenuShortcut>↵</ContextMenuShortcut>
                        </ContextMenuItem>

                        {s.estado === 'pendiente' && (
                          <ContextMenuItem
                            onClick={() => {
                              void onActualizarEstado({
                                id: s.id,
                                desde: s.estado,
                                hacia: 'en_proceso',
                                esAtendedor: true,
                                esSolicitante: s.solicitadoPorUid === uid,
                                uid,
                                nombre,
                              })
                            }}
                          >
                            <Play className="text-sky-600" />
                            <span>Atender solicitud</span>
                          </ContextMenuItem>
                        )}

                        {s.estado === 'en_proceso' && (
                          <ContextMenuItem
                            onClick={() => {
                              void onActualizarEstado({
                                id: s.id,
                                desde: s.estado,
                                hacia: 'completada',
                                esAtendedor: true,
                                esSolicitante: s.solicitadoPorUid === uid,
                                uid,
                                nombre,
                              })
                            }}
                          >
                            <CheckCircle className="text-emerald-600" />
                            <span>Marcar como lista / completada</span>
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
                                void copiarAlPortapapeles(s.partnerName, 'Cliente copiado')
                              }}
                            >
                              <span>Cliente ({s.partnerName})</span>
                            </ContextMenuItem>
                            {oc && (
                              <ContextMenuItem
                                onClick={() => {
                                  void copiarAlPortapapeles(oc, 'Orden de compra copiada')
                                }}
                              >
                                <span>Orden Compra ({oc})</span>
                              </ContextMenuItem>
                            )}
                            <ContextMenuItem
                              onClick={() => {
                                void copiarAlPortapapeles(s.odooSoName, 'Folio SO copiado')
                              }}
                            >
                              <span>Folio SO ({s.odooSoName})</span>
                            </ContextMenuItem>
                            <ContextMenuItem
                              onClick={() => {
                                void copiarAlPortapapeles(s.solicitadoPorNombre, 'Solicitante copiado')
                              }}
                            >
                              <span>Solicitante ({s.solicitadoPorNombre})</span>
                            </ContextMenuItem>
                          </ContextMenuSubContent>
                        </ContextMenuSub>

                        {s.estado !== 'rechazada' && s.estado !== 'completada' && (
                          <>
                            <ContextMenuSeparator />
                            <ContextMenuItem
                              variant="destructive"
                              onClick={() => {
                                void onActualizarEstado({
                                  id: s.id,
                                  desde: s.estado,
                                  hacia: 'rechazada',
                                  esAtendedor: true,
                                  esSolicitante: s.solicitadoPorUid === uid,
                                  uid,
                                  nombre,
                                  motivoRechazo: 'Cancelado desde menú contextual',
                                })
                              }}
                            >
                              <XCircle />
                              <span>Rechazar / Cancelar solicitud</span>
                            </ContextMenuItem>
                          </>
                        )}
                      </ContextMenuContent>
                    </ContextMenu>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {seleccionada && (
        <DetalleVentasSimple
          solicitud={seleccionada}
          mensajes={mensajes}
          uid={uid}
          nombre={nombre}
          onClose={onCerrarDetalle}
          onActualizarEstado={onActualizarEstado}
          onEnviarMensaje={onEnviarMensaje}
        />
      )}
    </div>
  )
}
