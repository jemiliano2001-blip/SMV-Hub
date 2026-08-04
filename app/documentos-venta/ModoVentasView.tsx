'use client'

import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
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
        className={`w-full inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-4 text-base font-bold border-2 transition-colors ${
          tab === 'nueva'
            ? 'border-slate-300 bg-white text-slate-700'
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
                className={`rounded-2xl px-4 py-4 text-base font-bold border-2 ${
                  tab === t.id
                    ? 'border-sky-600 bg-sky-50 text-sky-900'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                {t.label}
                <span className="block text-sm font-semibold opacity-70">
                  {t.count}
                </span>
              </button>
            ))}
          </div>

          <label className="block text-sm font-semibold text-slate-600">
            Buscar
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3 text-base"
              placeholder="Cliente, orden de compra o SO…"
            />
          </label>

          {lista.length === 0 ? (
            <p className="text-base text-slate-500 bg-white border border-slate-200 rounded-2xl px-4 py-10 text-center">
              {tab === 'pendientes'
                ? 'No hay solicitudes por atender.'
                : 'Aún no hay solicitudes hechas.'}
            </p>
          ) : (
            <ul className="space-y-3">
              {lista.map((s) => {
                const oc = ordenCompraSolicitud(s)
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onAbrir(s.id)}
                      className="w-full text-left bg-white border-2 border-slate-200 rounded-2xl px-4 py-4 hover:border-sky-400 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-base font-bold text-slate-900">
                          {s.tipo === 'factura' ? 'Factura' : 'Remisión'} ·{' '}
                          {s.partnerName}
                        </p>
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-500 shrink-0">
                          {etiquetaEstadoSolicitudDocumento(s.estado)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mt-1">
                        {oc ? `Orden de compra ${oc}` : 'Sin orden de compra'} · SO{' '}
                        {s.odooSoName}
                      </p>
                      <p className="text-sm text-slate-400 mt-0.5">
                        Pidió {s.solicitadoPorNombre}
                      </p>
                      {s.atendidoPorNombre && (
                        <p className="text-xs text-slate-500 mt-0.5">
                          Atiende {s.atendidoPorNombre}
                        </p>
                      )}
                    </button>
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
