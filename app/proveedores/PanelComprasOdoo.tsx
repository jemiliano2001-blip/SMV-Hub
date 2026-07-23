'use client'

import { RefreshCw, Database, TrendingUp, AlertCircle } from 'lucide-react'
import { useComprasOdoo } from '@/lib/hooks/useComprasOdoo'
import { Badge } from '@/components/ui/badge'
import { formatPrecio } from '@/lib/format'
import { CATEGORIAS_PRODUCTO_REGISTRO, FAMILIAS_CON_RANGO } from '@/lib/compras-odoo'
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

type Props = {
  /** Si false, oculta el bloque de sync (útil cuando el sync vive en Inteligencia). */
  mostrarSync?: boolean
  /** Título del bloque de rangos. */
  tituloRangos?: string
}

export default function PanelComprasOdoo({
  mostrarSync = true,
  tituloRangos = 'Rango de precios por familia',
}: Props) {
  const {
    items,
    estadoSync,
    cargando,
    sincronizando,
    error,
    recargar,
    sincronizarAhora,
    familia,
    setFamilia,
    tipo,
    setTipo,
    medida,
    setMedida,
    moneda,
    setMoneda,
    tipos,
    medidas,
    rango,
  } = useComprasOdoo()

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
  } = usePresupuestoInsumos()

  const porCategoria = items.reduce<Record<string, number>>((acc, it) => {
    acc[it.categoriaId] = (acc[it.categoriaId] ?? 0) + 1
    return acc
  }, {})

  const familiasUi = FAMILIAS_CON_RANGO.map((id) => {
    const def = CATEGORIAS_PRODUCTO_REGISTRO.find((c) => c.id === id)
    return { id, etiqueta: def?.etiqueta ?? id }
  })

  return (
    <div className="space-y-6">
      {mostrarSync && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Database className="h-5 w-5 text-sky-600 mt-0.5" />
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">Datos Odoo (México · solo lectura)</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Espejo de POs y facturas de proveedor. Última sync:{' '}
                <span className="font-mono text-slate-700">{formatFecha(estadoSync?.ultimaCorridaEn ?? null)}</span>
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
            className="flex items-center gap-1.5 px-3 py-2 bg-[#0369A1] hover:bg-[#0284C7] disabled:opacity-60 text-white text-xs font-bold rounded-lg"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${sincronizando ? 'animate-spin' : ''}`} />
            {sincronizando ? 'Sincronizando…' : 'Sincronizar ahora'}
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button type="button" className="underline font-bold" onClick={() => void sincronizarAhora()}>
            Reintentar
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(porCategoria).map(([cat, n]) => (
          <div key={cat} className="bg-white border border-slate-200 p-3 rounded-xl shadow-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{cat}</p>
            <p className="text-lg font-extrabold font-mono text-slate-900 mt-1">{n}</p>
          </div>
        ))}
        {!cargando && Object.keys(porCategoria).length === 0 && (
          <div className="col-span-full text-xs text-slate-500 py-4">
            Sin ítems aún. Corre una sincronización contra Odoo.
          </div>
        )}
      </div>

      <PanelClasificacionIA items={items} onActualizado={recargar} />

      <ComparadorPreciosInsumos
        items={items}
        onAgregarAPresupuesto={agregarPartida}
      />

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-extrabold text-slate-900">{tituloRangos}</h3>
        </div>
        <p className="text-[11px] text-slate-500">
          Metales, plásticos, herramientas, papelería, medicinas y otros — mismo motor de min / promedio / máx.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="text-xs font-bold text-slate-600 space-y-1">
            <span>Familia</span>
            <select
              value={familia}
              onChange={(e) => setFamilia(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white"
            >
              {familiasUi.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.etiqueta}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 space-y-1">
            <span>Tipo</span>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white"
            >
              <option value="">Seleccionar…</option>
              {tipos.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 space-y-1">
            <span>Medida</span>
            <select
              value={medida}
              onChange={(e) => setMedida(e.target.value)}
              disabled={!tipo}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white disabled:opacity-50"
            >
              <option value="">Todas</option>
              {medidas.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600 space-y-1">
            <span>Moneda</span>
            <select
              value={moneda}
              onChange={(e) => setMoneda(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm bg-white"
            >
              <option value="">Todas</option>
              <option value="MXN">MXN</option>
              <option value="USD">USD</option>
            </select>
          </label>
        </div>

        {rango && rango.n > 0 && (
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
              <p className="text-[10px] font-bold uppercase text-emerald-700">Mínimo</p>
              <p className="text-base font-extrabold font-mono text-emerald-900 mt-1">
                {formatPrecio(rango.min!, rango.moneda === 'USD' ? 'USD' : 'MXN')}
              </p>
            </div>
            <div className="rounded-lg bg-sky-50 border border-sky-100 p-3">
              <p className="text-[10px] font-bold uppercase text-sky-700">Promedio</p>
              <p className="text-base font-extrabold font-mono text-sky-900 mt-1">
                {formatPrecio(rango.promedio!, rango.moneda === 'USD' ? 'USD' : 'MXN')}
              </p>
            </div>
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
              <p className="text-[10px] font-bold uppercase text-amber-700">Máximo</p>
              <p className="text-base font-extrabold font-mono text-amber-900 mt-1">
                {formatPrecio(rango.max!, rango.moneda === 'USD' ? 'USD' : 'MXN')}
              </p>
            </div>
            <p className="col-span-3 text-[11px] text-slate-500 font-mono">
              n = {rango.n}
              {rango.medida ? ` · medida ${rango.medida}` : ''}
            </p>
          </div>
        )}
        {rango && rango.n === 0 && (
          <p className="text-xs text-slate-500">No hay observaciones para ese filtro.</p>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-100 text-xs font-bold text-slate-600">
          Ítems normalizados (capa intermedia)
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-slate-50 text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2">Fuente</th>
                <th className="px-3 py-2">Ref</th>
                <th className="px-3 py-2">Descripción</th>
                <th className="px-3 py-2">Familia</th>
                <th className="px-3 py-2">SAT</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Medida</th>
                <th className="px-3 py-2 text-right">P. unit</th>
              </tr>
            </thead>
            <tbody>
              {cargando && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-400">
                    Cargando…
                  </td>
                </tr>
              )}
              {!cargando &&
                items.slice(0, 100).map((it) => (
                  <tr key={it.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-1.5 font-mono">{it.fuente}</td>
                    <td className="px-3 py-1.5 font-mono">{it.referenciaDoc}</td>
                    <td className="px-3 py-1.5 max-w-[220px]">
                      <p className="truncate font-medium text-slate-900" title={it.descripcion}>
                        {it.descripcion}
                      </p>
                      {it.odooCategoria && (
                        <p className="text-[9px] text-slate-400 font-mono truncate" title={it.odooCategoria}>
                          Odoo: {it.odooCategoria}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-1">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {it.categoriaId}
                        </Badge>
                        {it.clasificadoPorIa && (
                          <Badge className="bg-sky-100 text-sky-800 border-sky-200 text-[9px] px-1 py-0 font-bold">
                            🤖 IA
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 font-mono">
                      {it.claveProdServ ?? (it.satPendiente ? '—' : '')}
                    </td>
                    <td className="px-3 py-1.5 font-mono">
                      {it.tipoInsumo ?? it.tipoMetal ?? '—'}
                    </td>
                    <td className="px-3 py-1.5 font-mono">{it.medida ?? '—'}</td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      {formatPrecio(it.precioUnitario, it.moneda === 'USD' ? 'USD' : 'MXN')}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

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
