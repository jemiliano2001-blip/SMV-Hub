"use client"

import { useState } from "react"
import type { FacturaProveedor } from "@/lib/schemas"
import { formatPrecio, fechaHoyLocal } from "@/lib/format"
import { Search } from "lucide-react"
import ModuleSurface from "@/components/layout/ModuleSurface"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface TablaCuentasPorPagarProps {
  facturas: FacturaProveedor[]
}

export function TablaCuentasPorPagar({ facturas }: TablaCuentasPorPagarProps) {
  const [busqueda, setBusqueda] = useState("")
  const [filtroEstado, setFiltroEstado] = useState<"todas" | "pendientes" | "pagadas">("pendientes")

  const hoyStr = fechaHoyLocal(new Date())

  const facturasFiltradas = facturas.filter((f) => {
    if (filtroEstado === "pendientes" && f.saldoPendiente <= 0) return false
    if (filtroEstado === "pagadas" && f.saldoPendiente > 0) return false

    if (!busqueda.trim()) return true
    const term = busqueda.toLowerCase()
    return (
      f.numeroFactura.toLowerCase().includes(term) ||
      f.proveedorNombre.toLowerCase().includes(term) ||
      (f.origenPo && f.origenPo.toLowerCase().includes(term))
    )
  })

  const chipInactivo = "border-border bg-card text-muted-foreground hover:bg-muted"

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por folio, proveedor u orden..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-lg border border-border bg-card py-1.5 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="flex gap-2 self-end sm:self-auto">
          <button
            onClick={() => setFiltroEstado("pendientes")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              filtroEstado === "pendientes"
                ? "border-amber-300 bg-amber-50 text-amber-800 shadow-2xs"
                : chipInactivo
            }`}
          >
            Pendientes por Pagar
          </button>
          <button
            onClick={() => setFiltroEstado("pagadas")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              filtroEstado === "pagadas"
                ? "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-2xs"
                : chipInactivo
            }`}
          >
            Pagadas
          </button>
          <button
            onClick={() => setFiltroEstado("todas")}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              filtroEstado === "todas"
                ? "border-sky-300 bg-sky-50 text-sky-800 shadow-2xs"
                : chipInactivo
            }`}
          >
            Todas ({facturas.length})
          </button>
        </div>
      </div>

      {/* Tabla */}
      <ModuleSurface className="overflow-x-auto">
        <Table className="w-full text-left text-xs">
          <TableHeader className="border-b border-border bg-muted text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
            <TableRow>
              <TableHead className="px-4 py-3">Factura / Folio</TableHead>
              <TableHead className="px-4 py-3">Proveedor</TableHead>
              <TableHead className="px-4 py-3">Fecha Factura</TableHead>
              <TableHead className="px-4 py-3">Vencimiento</TableHead>
              <TableHead className="px-4 py-3 text-right">Total Odoo</TableHead>
              <TableHead className="px-4 py-3 text-right">Saldo Pendiente</TableHead>
              <TableHead className="px-4 py-3 text-center">Estado Pago</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border">
            {facturasFiltradas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-8 text-center font-mono text-xs text-muted-foreground">
                  No se encontraron facturas de proveedor con los criterios seleccionados.
                </TableCell>
              </TableRow>
            ) : (
              facturasFiltradas.map((f) => {
                const esVencida = f.saldoPendiente > 0 && f.fechaVencimiento && f.fechaVencimiento < hoyStr

                return (
                  <TableRow key={f.id} className="transition-colors hover:bg-muted/80">
                    <TableCell className="px-4 py-3 font-mono font-semibold text-foreground">
                      {f.numeroFactura}
                      {f.origenPo && (
                        <div className="font-sans text-[11px] font-normal text-muted-foreground">PO: {f.origenPo}</div>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 font-medium text-foreground">{f.proveedorNombre || "N/A"}</TableCell>
                    <TableCell className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{f.fechaFactura || "—"}</TableCell>
                    <TableCell className="px-4 py-3 font-mono text-[11px]">
                      {f.fechaVencimiento ? (
                        <span className={esVencida ? "font-bold text-rose-600" : "text-muted-foreground"}>
                          {f.fechaVencimiento} {esVencida && "(Vencida)"}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-mono font-bold text-foreground tabular-nums">
                      {formatPrecio(f.total, f.moneda)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-mono font-bold text-amber-700 tabular-nums">
                      {f.saldoPendiente > 0 ? formatPrecio(f.saldoPendiente, f.moneda) : "—"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-center">
                      {f.saldoPendiente <= 0 ? (
                        <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800">
                          Pagada
                        </span>
                      ) : esVencida ? (
                        <span className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-mono font-bold text-rose-800">
                          Vencida
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-800">
                          Pendiente
                        </span>
                      )}
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
