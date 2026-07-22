"use client"

import { useState } from "react"
import type { FacturaProveedor } from "@/lib/schemas"
import { formatPrecio, fechaHoyLocal } from "@/lib/format"

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
          <input
            type="text"
            placeholder="Buscar por folio, proveedor u orden..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-slate-900/60 border border-slate-700/80 rounded-lg text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex gap-2 self-end sm:self-auto">
          <button
            onClick={() => setFiltroEstado("pendientes")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filtroEstado === "pendientes"
                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            Pendientes por Pagar
          </button>
          <button
            onClick={() => setFiltroEstado("pagadas")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filtroEstado === "pagadas"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            Pagadas
          </button>
          <button
            onClick={() => setFiltroEstado("todas")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filtroEstado === "todas"
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            Todas ({facturas.length})
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-800/80 text-xs uppercase tracking-wider text-slate-400">
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
          <tbody className="divide-y divide-slate-800/60">
            {facturasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No se encontraron facturas de proveedor con los criterios seleccionados.
                </td>
              </tr>
            ) : (
              facturasFiltradas.map((f) => {
                const esVencida = f.saldoPendiente > 0 && f.fechaVencimiento && f.fechaVencimiento < hoyStr

                return (
                  <tr key={f.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-100">
                      {f.numeroFactura}
                      {f.origenPo && (
                        <div className="text-xs text-slate-400 font-normal">PO: {f.origenPo}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-200">{f.proveedorNombre || "N/A"}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{f.fechaFactura || "—"}</td>
                    <td className="px-4 py-3 text-xs">
                      {f.fechaVencimiento ? (
                        <span className={esVencida ? "text-rose-400 font-medium" : "text-slate-300"}>
                          {f.fechaVencimiento} {esVencida && "(Vencida)"}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-200">
                      {formatPrecio(f.total, f.moneda)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-amber-400">
                      {f.saldoPendiente > 0 ? formatPrecio(f.saldoPendiente, f.moneda) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {f.saldoPendiente <= 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Pagada
                        </span>
                      ) : esVencida ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Vencida
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
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
