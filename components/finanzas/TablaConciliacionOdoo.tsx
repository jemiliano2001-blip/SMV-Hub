"use client"

import { useState } from "react"
import type { ResumenConciliacion, EstatusConciliacion } from "@/lib/conciliaciones-odoo"
import { formatPrecio } from "@/lib/format"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-1">
          <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">Conciliadas Exactas</p>
          <p className="text-xl sm:text-2xl font-bold font-mono text-emerald-600 tabular-nums">
            {resumen.totalConciliadas}
          </p>
          <p className="text-[11px] text-slate-500 font-medium">Montos y folios coinciden</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-1">
          <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">Desviación de Precio</p>
          <p className="text-xl sm:text-2xl font-bold font-mono text-amber-600 tabular-nums">
            {resumen.totalDesviaciones}
          </p>
          <p className="text-[11px] text-slate-500 font-medium">Discrepancia &gt; 2.0%</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-1">
          <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">Solo en SMV Hub</p>
          <p className="text-xl sm:text-2xl font-bold font-mono text-sky-700 tabular-nums">
            {resumen.totalSoloLocal}
          </p>
          <p className="text-[11px] text-slate-500 font-medium">Pendientes de subir a Odoo</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-1">
          <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">Solo en Odoo</p>
          <p className="text-xl sm:text-2xl font-bold font-mono text-purple-600 tabular-nums">
            {resumen.totalSoloOdoo}
          </p>
          <p className="text-[11px] text-slate-500 font-medium">Sin captura local previa</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFiltroEstatus("todos")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
            filtroEstatus === "todos"
              ? "bg-sky-50 text-sky-800 border-sky-300 shadow-2xs"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          Todos ({resumen.items.length})
        </button>
        <button
          onClick={() => setFiltroEstatus("conciliado_exacto")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
            filtroEstatus === "conciliado_exacto"
              ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          Conciliados ({resumen.totalConciliadas})
        </button>
        <button
          onClick={() => setFiltroEstatus("desviacion_precio")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
            filtroEstatus === "desviacion_precio"
              ? "bg-amber-50 text-amber-800 border-amber-300 shadow-2xs"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          Desviaciones ({resumen.totalDesviaciones})
        </button>
        <button
          onClick={() => setFiltroEstatus("solo_local")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
            filtroEstatus === "solo_local"
              ? "bg-indigo-50 text-indigo-800 border-indigo-300 shadow-2xs"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          Solo Local ({resumen.totalSoloLocal})
        </button>
        <button
          onClick={() => setFiltroEstatus("solo_odoo")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
            filtroEstatus === "solo_odoo"
              ? "bg-purple-50 text-purple-800 border-purple-300 shadow-2xs"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          Solo Odoo ({resumen.totalSoloOdoo})
        </button>
      </div>

      {/* Tabla de Conciliaciones */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <Table className="w-full text-left text-xs">
          <TableHeader className="bg-slate-50 border-b border-slate-200 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
            <TableRow>
              <TableHead className="px-4 py-3">Folio / Factura</TableHead>
              <TableHead className="px-4 py-3">Proveedor</TableHead>
              <TableHead className="px-4 py-3 text-right">SMV Hub (Local)</TableHead>
              <TableHead className="px-4 py-3 text-right">Odoo (Real)</TableHead>
              <TableHead className="px-4 py-3 text-right">Diferencia</TableHead>
              <TableHead className="px-4 py-3 text-center">Estado</TableHead>
              <TableHead className="px-4 py-3">Observación / Alerta</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100">
            {itemsFiltrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-8 text-center text-slate-500 font-mono text-xs">
                  No hay registros que coincidan con el filtro seleccionado.
                </TableCell>
              </TableRow>
            ) : (
              itemsFiltrados.map((it) => {
                const monedaLocal = it.ordenCompraLocal?.moneda ?? "USD"
                const monedaOdoo = it.facturaOdoo?.moneda ?? "USD"
                return (
                <TableRow key={it.id} className="hover:bg-slate-50/80 transition-colors">
                  <TableCell className="px-4 py-3 font-mono font-semibold text-slate-900">{it.folio}</TableCell>
                  <TableCell className="px-4 py-3 text-slate-700 font-medium">{it.proveedor}</TableCell>
                  <TableCell className="px-4 py-3 text-right font-mono text-slate-800 tabular-nums">
                    {it.montoLocal > 0 ? formatPrecio(it.montoLocal, monedaLocal) : "—"}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right font-mono text-slate-800 tabular-nums">
                    {it.montoOdoo > 0 ? formatPrecio(it.montoOdoo, monedaOdoo) : "—"}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right font-mono font-bold tabular-nums">
                    {it.diferenciaMonto > 0 ? (
                      <span className={it.porcentajeDesviacion > 2 ? "text-amber-700" : "text-slate-600"}>
                        {formatPrecio(it.diferenciaMonto, monedaLocal)}
                      </span>
                    ) : (
                      <span className="text-slate-400">$0.00</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-center">
                    {it.estatus === "conciliado_exacto" && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                        Exacto
                      </span>
                    )}
                    {it.estatus === "desviacion_precio" && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        Desviación
                      </span>
                    )}
                    {it.estatus === "solo_local" && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                        Solo Local
                      </span>
                    )}
                    {it.estatus === "solo_odoo" && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-purple-50 text-purple-800 border border-purple-200">
                        Solo Odoo
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-xs text-slate-600">
                    {it.alertaInconsistencia || <span className="text-slate-400">Sin observaciones</span>}
                  </TableCell>
                </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

