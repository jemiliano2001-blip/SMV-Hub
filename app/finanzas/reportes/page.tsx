'use client'

import AuthGuard from "@/app/AuthGuard"
import { useMemo, useState } from "react"
import * as XLSX from "xlsx"
import { Loader2, AlertCircle, Download, Printer } from "lucide-react"
import { useFinanzasFacturas } from "@/lib/hooks/useFinanzasFacturas"
import {
  monedasPresentes,
  filtrarPorMoneda,
  filtrarPorRango,
  agruparPorCliente,
  calcularKpisFinanzas,
  periodoPreset,
} from "@/lib/finanzas"
import { formatPrecio, formatFecha } from "@/lib/format"
import FinanzasNav from "@/app/finanzas/FinanzasNav"
import BannerSync from "@/app/finanzas/BannerSync"

type Periodo = "mes" | "anio"

function ReportesFinanzas() {
  const { facturas, estadoSync, loading, error, recargar } = useFinanzasFacturas()
  const [monedaActiva, setMonedaActiva] = useState<string | null>(null)
  const [periodo, setPeriodo] = useState<Periodo>("mes")

  const monedas = useMemo(() => monedasPresentes(facturas), [facturas])
  const moneda = monedaActiva ?? monedas[0] ?? "MXN"
  const { desde, hasta } = periodoPreset(periodo)

  const facturasPeriodo = useMemo(
    () => filtrarPorRango(filtrarPorMoneda(facturas, moneda), desde, hasta),
    [facturas, moneda, desde, hasta]
  )
  const grupos = useMemo(() => agruparPorCliente(facturasPeriodo), [facturasPeriodo])
  const kpis = useMemo(() => calcularKpisFinanzas(facturasPeriodo), [facturasPeriodo])

  function exportarExcel() {
    const filas = facturasPeriodo.map((f) => ({
      Cliente: f.cliente,
      Factura: f.numeroFactura,
      Tipo: f.tipo === "nota_credito" ? "Nota de crédito" : "Factura",
      Fecha: f.fechaFactura ?? "",
      Vencimiento: f.fechaVencimiento ?? "",
      Moneda: f.moneda,
      Subtotal: f.subtotal,
      IVA: f.impuestos,
      Total: f.total,
      "Saldo pendiente": f.saldoPendiente,
      "Estado de pago": f.estadoPago,
    }))
    const worksheet = XLSX.utils.json_to_sheet(filas)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Facturación")
    const nombre = `finanzas_${periodo === "mes" ? "mes" : "anio"}_${moneda}.xlsx`
    XLSX.writeFile(workbook, nombre)
  }

  if (loading && facturas.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
        <span className="text-sm text-gray-600">Cargando reporte…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="text-sm text-gray-700">{error}</p>
        <button onClick={recargar} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BannerSync estadoSync={estadoSync} onSincronizado={recargar} />
        <div className="flex flex-wrap gap-2">
          {monedas.length > 1 && (
            <div className="flex gap-1">
              {monedas.map((m) => (
                <button
                  key={m}
                  onClick={() => setMonedaActiva(m)}
                  className={`px-3 py-1 text-xs font-medium rounded-full border ${
                    m === moneda ? "bg-[#0369A1] text-white border-[#0369A1]" : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
          <div className="flex bg-gray-200/50 p-1 rounded-lg">
            {(["mes", "anio"] as Periodo[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  periodo === p ? "bg-white text-[#0369A1] shadow-sm" : "text-gray-500"
                }`}
              >
                {p === "mes" ? "Mes actual" : "Acumulado del año"}
              </button>
            ))}
          </div>
          <button
            onClick={exportarExcel}
            className="flex items-center gap-1.5 rounded-lg bg-white border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Download className="h-3.5 w-3.5" /> Excel
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg bg-white border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Printer className="h-3.5 w-3.5" /> Imprimir
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm print:border-0 print:shadow-none">
          <p className="text-xs text-gray-500 mb-1">Facturación</p>
          <p className="text-xl font-bold text-gray-900 tabular-nums">{formatPrecio(kpis.facturacionTotal, moneda)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm print:border-0 print:shadow-none">
          <p className="text-xs text-gray-500 mb-1">Subtotal</p>
          <p className="text-xl font-bold text-gray-900 tabular-nums">{formatPrecio(kpis.subtotal, moneda)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm print:border-0 print:shadow-none">
          <p className="text-xs text-gray-500 mb-1">IVA</p>
          <p className="text-xl font-bold text-gray-900 tabular-nums">{formatPrecio(kpis.impuestos, moneda)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm print:border-0 print:shadow-none">
          <p className="text-xs text-gray-500 mb-1">Facturas</p>
          <p className="text-xl font-bold text-gray-900 tabular-nums">{kpis.numFacturas}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 print:border-0 print:shadow-none print:p-0">
        {grupos.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">Sin facturación en este periodo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-600">Cliente</th>
                  <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-600">Factura</th>
                  <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-600">Fecha</th>
                  <th className="pb-2 pr-3 text-right text-xs font-semibold text-gray-600">Subtotal</th>
                  <th className="pb-2 pr-3 text-right text-xs font-semibold text-gray-600">IVA</th>
                  <th className="pb-2 text-right text-xs font-semibold text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {facturasPeriodo.map((f) => (
                  <tr key={f.id} className="border-b border-gray-100">
                    <td className="py-1.5 pr-3">{f.cliente}</td>
                    <td className="py-1.5 pr-3 font-mono text-xs text-gray-500">{f.numeroFactura}</td>
                    <td className="py-1.5 pr-3 text-xs">{formatFecha(f.fechaFactura)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{formatPrecio(f.subtotal, moneda)}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{formatPrecio(f.impuestos, moneda)}</td>
                    <td className="py-1.5 text-right tabular-nums font-medium">{formatPrecio(f.total, moneda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ReportesFinanzasPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-gray-50 flex flex-col print:bg-white">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 print:hidden">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Reportes de Finanzas</h1>
              <p className="text-sm text-gray-500 mt-1">Exporta a Excel o imprime el detalle de facturación</p>
            </div>
            <FinanzasNav />
          </div>

          <ReportesFinanzas />
        </div>
      </main>
    </AuthGuard>
  )
}
