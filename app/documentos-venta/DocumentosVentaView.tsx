'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Inbox, RefreshCw } from 'lucide-react'
import { authBypassActivo, useUsuario } from '@/lib/auth'
import { usePermisos } from '@/lib/hooks/useRol'
import { puedeAtenderDocumentosVenta } from '@/lib/roles'
import { useDocumentosVenta } from '@/lib/hooks/useDocumentosVenta'
import { filtrarSoPorTexto, ordenCompraSolicitud } from '@/lib/documentos-venta-helpers'
import type { SolicitudDocumento, VentaOdooSo } from '@/lib/schemas'
import NuevaSolicitudPanel from './NuevaSolicitudPanel'
import SolicitudDetalleModal from './SolicitudDetalleModal'
import ModoVentasView from './ModoVentasView'
import ModuleEmptyState from '@/components/layout/ModuleEmptyState'
import ModuleTabs from '@/components/layout/ModuleTabs'

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
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">
        Última sync:{' '}
        <span className="font-semibold text-foreground">
          {formatoSync(syncState?.ultimaSyncEn ?? null)}
        </span>
        {typeof syncState?.filas === 'number' && (
          <span className="text-muted-foreground"> · {syncState.filas} SO a facturar</span>
        )}
        {syncState?.error && (
          <span className="ml-2 text-destructive">Error: {syncState.error}</span>
        )}
      </p>
      {puedeSyncManual && (
        <button
          type="button"
          onClick={() => void sincronizar().catch(() => undefined)}
          disabled={sincronizando}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-semibold hover:bg-muted/80 disabled:opacity-50"
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
          <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
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

  return (
    <div className="space-y-4">
      {syncBar}

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <p>{error}</p>
          <button
            type="button"
            className="shrink-0 text-xs font-bold underline"
            onClick={clearError}
          >
            Cerrar
          </button>
        </div>
      )}

      <ModuleTabs
        value={tab}
        onValueChange={(v) => setTab(v as TabTaller)}
        items={[
          {
            value: 'nueva',
            label: 'Nueva solicitud',
            content: loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
            ) : (
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
            ),
          },
          {
            value: 'mias',
            label: 'Mis solicitudes',
            content: loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
            ) : (
              <ListaSolicitudes
                items={solicitudes.filter((s) => s.solicitadoPorUid === usuario?.uid)}
                vacio="Aún no tienes solicitudes."
                onAbrir={setSolicitudId}
              />
            ),
          },
        ]}
      />

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
      <ModuleEmptyState
        icon={Inbox}
        title="Sin solicitudes"
        description={vacio}
      />
    )
  }
  return (
    <ul className="space-y-2">
      {items.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            onClick={() => onAbrir(s.id)}
            className="w-full cursor-pointer rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">
                {s.tipo === 'factura' ? 'Factura' : 'Remisión'} · {s.odooSoName}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {s.estado.replace('_', ' ')}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
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
