"use client"

import { useState } from "react"
import type { ResumenConciliacion, EstatusConciliacion } from "@/lib/conciliaciones-odoo"
import { formatPrecio } from "@/lib/format"

interface TablaConciliacionOdooProps {
  resumen: ResumenConciliacion
}

export function TablaConciliacionOdoo({ resumen }: TablaConciliacionOdooProps) {
  const [filtroEstatus, setFiltroEstatus] = useState<"todos" | EstatusConciliacion>("todos")

  const itemsFiltrados = resumen.items.filter((it) => {
    if (filtroEstatus === "todos") return true
    return it.estatus === filtroEstatus
  })

  return (
    <div className="space-y-6">
      {/* Cards KPI de Conciliación */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs font-medium text-slate-400">Conciliadas Exactas</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {resumen.totalConciliadas}
          </div>
          <div className="text-xs text-slate-500 mt-1">Montos y folios coinciden</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs font-medium text-slate-400">Desviación de Precio</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {resumen.totalDesviaciones}
          </div>
          <div className="text-xs text-slate-500 mt-1">Discrepancia &gt; 2.0%</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs font-medium text-slate-400">Solo en SMV Hub</div>
          <div className="text-2xl font-bold text-indigo-400 mt-1">
            {resumen.totalSoloLocal}
          </div>
          <div className="text-xs text-slate-500 mt-1">Pendientes de subir a Odoo</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs font-medium text-slate-400">Solo en Odoo</div>
          <div className="text-2xl font-bold text-purple-400 mt-1">
            {resumen.totalSoloOdoo}
          </div>
          <div className="text-xs text-slate-500 mt-1">Sin captura local previa</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFiltroEstatus("todos")}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            filtroEstatus === "todos"
              ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
              : "bg-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          Todos ({resumen.items.length})
        </button>
        <button
          onClick={() => setFiltroEstatus("conciliado_exacto")}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            filtroEstatus === "conciliado_exacto"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              : "bg-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          Conciliados ({resumen.totalConciliadas})
        </button>
        <button
          onClick={() => setFiltroEstatus("desviacion_precio")}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            filtroEstatus === "desviacion_precio"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              : "bg-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          Desviaciones ({resumen.totalDesviaciones})
        </button>
        <button
          onClick={() => setFiltroEstatus("solo_local")}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            filtroEstatus === "solo_local"
              ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
              : "bg-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          Solo Local ({resumen.totalSoloLocal})
        </button>
        <button
          onClick={() => setFiltroEstatus("solo_odoo")}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            filtroEstatus === "solo_odoo"
              ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
              : "bg-slate-800 text-slate-400 hover:text-slate-200"
          }`}
        >
          Solo Odoo ({resumen.totalSoloOdoo})
        </button>
      </div>

      {/* Tabla de Conciliaciones */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-800/80 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Folio / Factura</th>
              <th className="px-4 py-3">Proveedor</th>
              <th className="px-4 py-3 text-right">SMV Hub (Local)</th>
              <th className="px-4 py-3 text-right">Odoo (Real)</th>
              <th className="px-4 py-3 text-right">Diferencia</th>
              <th className="px-4 py-3 text-center">Estado</th>
              <th className="px-4 py-3">Observación / Alerta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {itemsFiltrados.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No hay registros que coincidan con el filtro seleccionado.
                </td>
              </tr>
            ) : (
              itemsFiltrados.map((it) => (
                <tr key={it.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-100">{it.folio}</td>
                  <td className="px-4 py-3 text-slate-200">{it.proveedor}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-300">
                    {it.montoLocal > 0 ? formatPrecio(it.montoLocal, "USD") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-300">
                    {it.montoOdoo > 0 ? formatPrecio(it.montoOdoo, "USD") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium">
                    {it.diferenciaMonto > 0 ? (
                      <span className={it.porcentajeDesviacion > 2 ? "text-amber-400" : "text-slate-400"}>
                        {formatPrecio(it.diferenciaMonto, "USD")}
                      </span>
                    ) : (
                      <span className="text-slate-500">$0.00</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {it.estatus === "conciliado_exacto" && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Exacto
                      </span>
                    )}
                    {it.estatus === "desviacion_precio" && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        Desviación
                      </span>
                    )}
                    {it.estatus === "solo_local" && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                        Solo Local
                      </span>
                    )}
                    {it.estatus === "solo_odoo" && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
                        Solo Odoo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {it.alertaInconsistencia || <span className="text-slate-600">Sin observaciones</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
