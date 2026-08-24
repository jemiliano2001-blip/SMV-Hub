"use client"

import { useState } from "react"
import type { ResumenConciliacion, EstatusConciliacion } from "@/lib/conciliaciones-odoo"
import { formatPrecio } from "@/lib/format"
import ModuleSurface from "@/components/layout/ModuleSurface"
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

  const chipInactivo = "border-border bg-card text-muted-foreground hover:bg-muted"

  return (
    <div className="space-y-6">
      {/* Cards KPI de Conciliación */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ModuleSurface className="space-y-1 p-4">
          <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Conciliadas Exactas</p>
          <p className="font-mono text-xl font-bold text-emerald-600 tabular-nums sm:text-2xl">
            {resumen.totalConciliadas}
          </p>
          <p className="text-[11px] font-medium text-muted-foreground">Montos y folios coinciden</p>
        </ModuleSurface>

        <ModuleSurface className="space-y-1 p-4">
          <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Desviación de Precio</p>
          <p className="font-mono text-xl font-bold text-amber-600 tabular-nums sm:text-2xl">
            {resumen.totalDesviaciones}
          </p>
          <p className="text-[11px] font-medium text-muted-foreground">Discrepancia &gt; 2.0%</p>
        </ModuleSurface>

        <ModuleSurface className="space-y-1 p-4">
          <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Solo en SMV Hub</p>
          <p className="font-mono text-xl font-bold text-sky-700 tabular-nums sm:text-2xl">
            {resumen.totalSoloLocal}
          </p>
          <p className="text-[11px] font-medium text-muted-foreground">Pendientes de subir a Odoo</p>
        </ModuleSurface>

        <ModuleSurface className="space-y-1 p-4">
          <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Solo en Odoo</p>
          <p className="font-mono text-xl font-bold text-purple-600 tabular-nums sm:text-2xl">
            {resumen.totalSoloOdoo}
          </p>
          <p className="text-[11px] font-medium text-muted-foreground">Sin captura local previa</p>
        </ModuleSurface>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFiltroEstatus("todos")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            filtroEstatus === "todos"
              ? "border-sky-300 bg-sky-50 text-sky-800 shadow-2xs"
              : chipInactivo
          }`}
        >
          Todos ({resumen.items.length})
        </button>
        <button
          onClick={() => setFiltroEstatus("conciliado_exacto")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            filtroEstatus === "conciliado_exacto"
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-2xs"
              : chipInactivo
          }`}
        >
          Conciliados ({resumen.totalConciliadas})
        </button>
        <button
          onClick={() => setFiltroEstatus("desviacion_precio")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            filtroEstatus === "desviacion_precio"
              ? "border-amber-300 bg-amber-50 text-amber-800 shadow-2xs"
              : chipInactivo
          }`}
        >
          Desviaciones ({resumen.totalDesviaciones})
        </button>
        <button
          onClick={() => setFiltroEstatus("solo_local")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            filtroEstatus === "solo_local"
              ? "border-indigo-300 bg-indigo-50 text-indigo-800 shadow-2xs"
              : chipInactivo
          }`}
        >
          Solo Local ({resumen.totalSoloLocal})
        </button>
        <button
          onClick={() => setFiltroEstatus("solo_odoo")}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
            filtroEstatus === "solo_odoo"
              ? "border-purple-300 bg-purple-50 text-purple-800 shadow-2xs"
              : chipInactivo
          }`}
        >
          Solo Odoo ({resumen.totalSoloOdoo})
        </button>
      </div>

      {/* Tabla de Conciliaciones */}
      <ModuleSurface className="overflow-x-auto">
        <Table className="w-full text-left text-xs">
          <TableHeader className="border-b border-border bg-muted text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
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
          <TableBody className="divide-y divide-border">
            {itemsFiltrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-8 text-center font-mono text-xs text-muted-foreground">
                  No hay registros que coincidan con el filtro seleccionado.
                </TableCell>
              </TableRow>
            ) : (
              itemsFiltrados.map((it) => {
                const monedaLocal = it.ordenCompraLocal?.moneda ?? "USD"
                const monedaOdoo = it.facturaOdoo?.moneda ?? "USD"
                return (
                <TableRow key={it.id} className="transition-colors hover:bg-muted/80">
                  <TableCell className="px-4 py-3 font-mono font-semibold text-foreground">{it.folio}</TableCell>
                  <TableCell className="px-4 py-3 font-medium text-foreground">{it.proveedor}</TableCell>
                  <TableCell className="px-4 py-3 text-right font-mono text-foreground tabular-nums">
                    {it.montoLocal > 0 ? formatPrecio(it.montoLocal, monedaLocal) : "—"}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right font-mono text-foreground tabular-nums">
                    {it.montoOdoo > 0 ? formatPrecio(it.montoOdoo, monedaOdoo) : "—"}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right font-mono font-bold tabular-nums">
                    {it.diferenciaMonto > 0 ? (
                      <span className={it.porcentajeDesviacion > 2 ? "text-amber-700" : "text-muted-foreground"}>
                        {formatPrecio(it.diferenciaMonto, monedaLocal)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">$0.00</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-center">
                    {it.estatus === "conciliado_exacto" && (
                      <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800">
                        Exacto
                      </span>
                    )}
                    {it.estatus === "desviacion_precio" && (
                      <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-800">
                        Desviación
                      </span>
                    )}
                    {it.estatus === "solo_local" && (
                      <span className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-mono font-bold text-indigo-800">
                        Solo Local
                      </span>
                    )}
                    {it.estatus === "solo_odoo" && (
                      <span className="inline-flex items-center rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-mono font-bold text-purple-800">
                        Solo Odoo
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                    {it.alertaInconsistencia || <span className="text-muted-foreground">Sin observaciones</span>}
                  </TableCell>
                </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </ModuleSurface>
    </div>
  )
}
