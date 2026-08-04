'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { authBypassActivo, useUsuario } from '@/lib/auth'
import { usePermisos } from '@/lib/hooks/useRol'
import { puedeAtenderDocumentosVenta } from '@/lib/roles'
import { useDocumentosVenta } from '@/lib/hooks/useDocumentosVenta'
import { filtrarSoPorTexto, ordenCompraSolicitud } from '@/lib/documentos-venta-helpers'
import type { SolicitudDocumento, VentaOdooSo } from '@/lib/schemas'
import NuevaSolicitudPanel from './NuevaSolicitudPanel'
import SolicitudDetalleModal from './SolicitudDetalleModal'
import ModoVentasView from './ModoVentasView'

type TabTaller = 'nueva' | 'mias'

function formatoSync(d: Date | null): string {
  if (!d) return 'Sin sync'
  return d.toLocaleString('es-MX', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

export default function DocumentosVentaView() {
  const searchParams = useSearchParams()
  const { usuario } = useUsuario()
  const { esSuperAdmin, atiendeDocumentosVenta, rol } = usePermisos(
    authBypassActivo() ? null : usuario
  )
  const atiende = puedeAtenderDocumentosVenta({
    atiendeDocumentosVenta,
    esSuperAdmin,
  })
  const puedeSyncManual = esSuperAdmin || rol === 'admin'

  const [tab, setTab] = useState<TabTaller>('nueva')
  const [solicitudId, setSolicitudId] = useState<string | null>(
    searchParams.get('solicitud')
  )
  const [busqueda, setBusqueda] = useState('')

  const {
    sos,
    syncState,
    solicitudes,
    mensajes,
    loading,
    sincronizando,
    error,
    clearError,
    sincronizar,
    crearSolicitud,
    actualizarEstado,
    agregarMensaje,
  } = useDocumentosVenta({
    uid: usuario?.uid ?? null,
    atiende,
    solicitudIdSeleccionada: solicitudId,
  })

  useEffect(() => {
    const id = searchParams.get('solicitud')
    if (id) {
      const timer = window.setTimeout(() => {
        setSolicitudId(id)
        if (!atiende) setTab('mias')
      }, 0)
      return () => window.clearTimeout(timer)
    }
  }, [searchParams, atiende])

  const sosFiltradas = useMemo(
    () => filtrarSoPorTexto(sos, busqueda),
    [sos, busqueda]
  )

  const solicitudSeleccionada: SolicitudDocumento | null = useMemo(() => {
    if (!solicitudId) return null
    return solicitudes.find((s) => s.id === solicitudId) ?? null
  }, [solicitudId, solicitudes])

  const soDeSolicitud: VentaOdooSo | null = useMemo(() => {
    if (!solicitudSeleccionada) return null
    return sos.find((s) => s.odooId === solicitudSeleccionada.odooSoId) ?? null
  }, [solicitudSeleccionada, sos])

  const nombre = usuario?.displayName || usuario?.email || 'Usuario'

  const syncBar = (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3">
      <p className="text-xs text-slate-500">
        Última sync:{' '}
        <span className="font-semibold text-slate-700">
          {formatoSync(syncState?.ultimaSyncEn ?? null)}
        </span>
        {typeof syncState?.filas === 'number' && (
          <span className="text-slate-400"> · {syncState.filas} SO a facturar</span>
        )}
        {syncState?.error && (
          <span className="text-red-600 ml-2">Error: {syncState.error}</span>
        )}
      </p>
      {puedeSyncManual && (
        <button
          type="button"
          onClick={() => void sincronizar().catch(() => undefined)}
          disabled={sincronizando}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${sincronizando ? 'animate-spin' : ''}`} />
          Actualizar desde Odoo
        </button>
      )}
    </div>
  )

  if (atiende && usuario) {
    return (
      <div className="space-y-4">
        {syncBar}
        {error && (
          <div className="flex items-start justify-between gap-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl px-4 py-3">
            <p>{error}</p>
            <button
              type="button"
              className="text-xs font-bold underline shrink-0"
              onClick={clearError}
            >
              Cerrar
            </button>
          </div>
        )}
        {loading ? (
          <p className="text-sm text-slate-500 py-8 text-center">Cargando…</p>
        ) : (
          <ModoVentasView
            solicitudes={solicitudes}
            mensajes={mensajes}
            sos={sosFiltradas}
            busquedaSo={busqueda}
            onBusquedaSoChange={setBusqueda}
            uid={usuario.uid}
            nombre={nombre}
            solicitudId={solicitudId}
            onAbrir={setSolicitudId}
            onCerrarDetalle={() => setSolicitudId(null)}
            onCrear={crearSolicitud}
            onActualizarEstado={actualizarEstado}
            onEnviarMensaje={agregarMensaje}
          />
        )}
      </div>
    )
  }

  const tabs: { id: TabTaller; label: string }[] = [
    { id: 'nueva', label: 'Nueva solicitud' },
    { id: 'mias', label: 'Mis solicitudes' },
  ]

  return (
    <div className="space-y-4">
      {syncBar}

      {error && (
        <div className="flex items-start justify-between gap-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl px-4 py-3">
          <p>{error}</p>
          <button
            type="button"
            className="text-xs font-bold underline shrink-0"
            onClick={clearError}
          >
            Cerrar
          </button>
        </div>
      )}

      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-xs font-semibold border-b-2 -mb-px ${
              tab === t.id
                ? 'border-sky-600 text-sky-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <p className="text-sm text-slate-500 py-8 text-center">Cargando…</p>
      )}

      {!loading && tab === 'nueva' && (
        <NuevaSolicitudPanel
          sos={sosFiltradas}
          solicitudesActivas={solicitudes}
          busqueda={busqueda}
          onBusquedaChange={setBusqueda}
          uid={usuario?.uid ?? ''}
          nombre={nombre}
          onCrear={async (data, opts) => {
            const id = await crearSolicitud(data, opts)
            setSolicitudId(id)
            setTab('mias')
            return id
          }}
        />
      )}

      {!loading && tab === 'mias' && (
        <ListaSolicitudes
          items={solicitudes.filter((s) => s.solicitadoPorUid === usuario?.uid)}
          vacio="Aún no tienes solicitudes."
          onAbrir={setSolicitudId}
        />
      )}

      {solicitudSeleccionada && usuario && (
        <SolicitudDetalleModal
          solicitud={solicitudSeleccionada}
          so={soDeSolicitud}
          mensajes={mensajes}
          uid={usuario.uid}
          nombre={nombre}
          atiende={false}
          onClose={() => setSolicitudId(null)}
          onActualizarEstado={actualizarEstado}
          onEnviarMensaje={agregarMensaje}
        />
      )}
    </div>
  )
}

function ListaSolicitudes({
  items,
  vacio,
  onAbrir,
}: {
  items: SolicitudDocumento[]
  vacio: string
  onAbrir: (id: string) => void
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500 bg-white border border-slate-200 rounded-xl px-4 py-8 text-center">
        {vacio}
      </p>
    )
  }
  return (
    <ul className="space-y-2">
      {items.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            onClick={() => onAbrir(s.id)}
            className="w-full text-left bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-sky-300 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-900">
                {s.tipo === 'factura' ? 'Factura' : 'Remisión'} · {s.odooSoName}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                {s.estado.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {s.partnerName}
              {ordenCompraSolicitud(s)
                ? ` · Orden de compra ${ordenCompraSolicitud(s)}`
                : ' · Sin orden de compra'}
            </p>
          </button>
        </li>
      ))}
    </ul>
  )
}
