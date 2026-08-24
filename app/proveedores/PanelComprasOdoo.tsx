'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, Database, AlertCircle } from 'lucide-react'
import { useComprasOdoo } from '@/lib/hooks/useComprasOdoo'
import { Badge } from '@/components/ui/badge'
import { obtenerTipoCambio, TIPO_CAMBIO_DEFAULT_USD_MXN } from '@/lib/tipo-cambio'
import PanelClasificacionIA from './PanelClasificacionIA'
import ComparadorPreciosInsumos from './components/ComparadorPreciosInsumos'
import DrawerPresupuestoInsumos from './components/DrawerPresupuestoInsumos'
import { usePresupuestoInsumos } from '@/lib/hooks/usePresupuestoInsumos'

function formatFecha(d: Date | null): string {
  if (!d) return 'Nunca'
  return d.toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function PanelComprasOdoo() {
  const {
    items,
    estadoSync,
    sincronizando,
    error,
    recargar,
    sincronizarAhora,
  } = useComprasOdoo()

  const [usdToMxn, setUsdToMxn] = useState(TIPO_CAMBIO_DEFAULT_USD_MXN)
  useEffect(() => {
    obtenerTipoCambio()
      .then((config) => setUsdToMxn(config.usdToMxn))
      .catch((err) => console.error('Error cargando tipo de cambio:', err))
  }, [])

  const {
    partidas,
    agregarPartida,
    removerPartida,
    actualizarCantidad,
    cambiarProveedorPartida,
    limpiarPresupuesto,
    totalMxn,
    totalUsd,
    totalPartidas,
    exportarAExcel,
  } = usePresupuestoInsumos(usdToMxn)

  return (
    <div className="space-y-6">
        <div className="bg-card border border-border rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Database className="h-5 w-5 text-sky-600 mt-0.5" />
            <div>
              <h2 className="text-sm font-bold text-foreground">Base de compras Odoo · solo lectura</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Espejo de POs y facturas de proveedor. Última sync:{' '}
                <span className="font-mono text-foreground">{formatFecha(estadoSync?.ultimaCorridaEn ?? null)}</span>
              </p>
              {estadoSync?.ultimoError && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {estadoSync.ultimoError}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline" className="font-mono text-[10px]">
                  POs: {estadoSync?.posSincronizados ?? 0}
                </Badge>
                <Badge variant="outline" className="font-mono text-[10px]">
                  Facturas: {estadoSync?.facturasSincronizadas ?? 0}
                </Badge>
                <Badge variant="outline" className="font-mono text-[10px]">
                  Ítems: {estadoSync?.itemsSincronizados ?? items.length}
                </Badge>
                <Badge variant="outline" className="font-mono text-[10px]">
                  Proveedores: {estadoSync?.proveedoresUpsert ?? 0}
                </Badge>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void sincronizarAhora()}
            disabled={sincronizando}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white text-xs font-bold rounded-lg"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${sincronizando ? 'animate-spin' : ''}`} />
            {sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
          </button>
        </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button type="button" className="underline font-bold" onClick={() => void sincronizarAhora()}>
            Reintentar
          </button>
        </div>
      )}

      <PanelClasificacionIA items={items} onActualizado={recargar} />

      <ComparadorPreciosInsumos
        items={items}
        onAgregarAPresupuesto={agregarPartida}
        usdToMxn={usdToMxn}
      />

      <DrawerPresupuestoInsumos
        partidas={partidas}
        totalMxn={totalMxn}
        totalUsd={totalUsd}
        totalPartidas={totalPartidas}
        onActualizarCantidad={actualizarCantidad}
        onRemoverPartida={removerPartida}
        onCambiarProveedor={cambiarProveedorPartida}
        onLimpiarTodo={limpiarPresupuesto}
        onExportarAExcel={exportarAExcel}
        todosLosItems={items}
      />
    </div>
  )
}
