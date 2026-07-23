"use client"

import { useState } from "react"
import type { FacturaProveedor } from "@/lib/schemas"
import { formatPrecio, fechaHoyLocal } from "@/lib/format"
import { Search } from "lucide-react"

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

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por folio, proveedor u orden..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0369A1] focus:border-transparent transition-all"
          />
        </div>

        <div className="flex gap-2 self-end sm:self-auto">
          <button
            onClick={() => setFiltroEstado("pendientes")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
              filtroEstado === "pendientes"
                ? "bg-amber-50 text-amber-800 border-amber-300 shadow-2xs"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Pendientes por Pagar
          </button>
          <button
            onClick={() => setFiltroEstado("pagadas")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
              filtroEstado === "pagadas"
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Pagadas
          </button>
          <button
            onClick={() => setFiltroEstado("todas")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
              filtroEstado === "todas"
                ? "bg-sky-50 text-sky-800 border-sky-300 shadow-2xs"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            Todas ({facturas.length})
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Factura / Folio</th>
              <th className="px-4 py-3">Proveedor</th>
              <th className="px-4 py-3">Fecha Factura</th>
              <th className="px-4 py-3">Vencimiento</th>
              <th className="px-4 py-3 text-right">Total Odoo</th>
              <th className="px-4 py-3 text-right">Saldo Pendiente</th>
              <th className="px-4 py-3 text-center">Estado Pago</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {facturasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500 font-mono text-xs">
                  No se encontraron facturas de proveedor con los criterios seleccionados.
                </td>
              </tr>
            ) : (
              facturasFiltradas.map((f) => {
                const esVencida = f.saldoPendiente > 0 && f.fechaVencimiento && f.fechaVencimiento < hoyStr

                return (
                  <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                      {f.numeroFactura}
                      {f.origenPo && (
                        <div className="text-[11px] text-slate-500 font-normal font-sans">PO: {f.origenPo}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-medium">{f.proveedorNombre || "N/A"}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{f.fechaFactura || "—"}</td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      {f.fechaVencimiento ? (
                        <span className={esVencida ? "text-rose-600 font-bold" : "text-slate-600"}>
                          {f.fechaVencimiento} {esVencida && "(Vencida)"}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 tabular-nums">
                      {formatPrecio(f.total, f.moneda)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-amber-700 tabular-nums">
                      {f.saldoPendiente > 0 ? formatPrecio(f.saldoPendiente, f.moneda) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {f.saldoPendiente <= 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          Pagada
                        </span>
                      ) : esVencida ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200">
                          Vencida
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          Pendiente
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
