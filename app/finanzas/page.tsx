'use client'

import AuthGuard from "@/app/AuthGuard"
import { useMemo, useState } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import { useFinanzasFacturas } from "@/lib/hooks/useFinanzasFacturas"
import {
  monedasPresentes,
  filtrarPorMoneda,
  filtrarPorRango,
  calcularKpisFinanzas,
  agruparPorCliente,
  periodoPreset,
  rangoDeMes,
  mesActualStr,
} from "@/lib/finanzas"
import { formatPrecio } from "@/lib/format"
import FinanzasNav from "@/app/finanzas/FinanzasNav"
import BannerSync from "@/app/finanzas/BannerSync"
import SelectorMes from "@/app/finanzas/SelectorMes"

function KpiCard({ titulo, valor, subtitulo }: { titulo: string; valor: string; subtitulo?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500 mb-1">{titulo}</p>
      <p className="text-2xl font-bold text-gray-900 tabular-nums leading-tight">{valor}</p>
      {subtitulo && <p className="text-xs text-gray-400 mt-1">{subtitulo}</p>}
    </div>
  )
}

function ResumenFinanzas() {
  const { facturas, estadoSync, loading, error, recargar } = useFinanzasFacturas()
  const [monedaActiva, setMonedaActiva] = useState<string | null>(null)

  const monedas = useMemo(() => monedasPresentes(facturas), [facturas])
  const moneda = monedaActiva ?? monedas[0] ?? "MXN"
  const facturasMoneda = useMemo(() => filtrarPorMoneda(facturas, moneda), [facturas, moneda])

  const [mesSeleccionado, setMesSeleccionado] = useState(() => mesActualStr())
  const { desde: desdeMes, hasta: hastaMes } = useMemo(() => rangoDeMes(mesSeleccionado), [mesSeleccionado])
  const { desde: desdeAnio, hasta: hastaAnio } = periodoPreset("anio")

  const kpisMes = useMemo(
    () => calcularKpisFinanzas(filtrarPorRango(facturasMoneda, desdeMes, hastaMes)),
    [facturasMoneda, desdeMes, hastaMes]
  )
  const kpisAnio = useMemo(
    () => calcularKpisFinanzas(filtrarPorRango(facturasMoneda, desdeAnio, hastaAnio)),
    [facturasMoneda, desdeAnio, hastaAnio]
  )
  const topClientes = useMemo(
    () => agruparPorCliente(filtrarPorRango(facturasMoneda, desdeAnio, hastaAnio)).slice(0, 5),
    [facturasMoneda, desdeAnio, hastaAnio]
  )

  if (loading && facturas.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
        <span className="text-sm text-gray-600">Cargando facturación…</span>
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BannerSync estadoSync={estadoSync} onSincronizado={recargar} />
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
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Facturación del mes</h2>
          <SelectorMes value={mesSeleccionado} onChange={setMesSeleccionado} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard titulo="Facturación" valor={formatPrecio(kpisMes.facturacionTotal, moneda)} subtitulo="Neto de notas de crédito" />
          <KpiCard titulo="Subtotal" valor={formatPrecio(kpisMes.subtotal, moneda)} />
          <KpiCard titulo="IVA" valor={formatPrecio(kpisMes.impuestos, moneda)} />
          <KpiCard titulo="Facturas" valor={String(kpisMes.numFacturas)} subtitulo={`${kpisMes.numNotasCredito} notas de crédito`} />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Acumulado del año</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard titulo="Facturación" valor={formatPrecio(kpisAnio.facturacionTotal, moneda)} subtitulo="Neto de notas de crédito" />
          <KpiCard titulo="Subtotal" valor={formatPrecio(kpisAnio.subtotal, moneda)} />
          <KpiCard titulo="IVA" valor={formatPrecio(kpisAnio.impuestos, moneda)} />
          <KpiCard titulo="Clientes" valor={String(kpisAnio.numClientes)} />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Top clientes del año</h2>
        {topClientes.length === 0 ? (
          <p className="text-sm text-gray-500 py-4 text-center">Sin facturación registrada este año.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {topClientes.map((g) => (
                <tr key={g.cliente} className="border-b border-gray-100 last:border-0">
                  <td className="py-2 pr-3">{g.cliente}</td>
                  <td className="py-2 pr-3 text-right tabular-nums font-medium">{formatPrecio(g.total, moneda)}</td>
                  <td className="py-2 text-right tabular-nums text-gray-500 w-20">{g.pctDelTotal.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default function FinanzasPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-gray-50 flex flex-col">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Finanzas</h1>
              <p className="text-sm text-gray-500 mt-1">
                Facturación de clientes y cobranza — espejo de solo lectura de Odoo
              </p>
            </div>
            <FinanzasNav />
          </div>

          <ResumenFinanzas />
        </div>
      </main>
    </AuthGuard>
  )
}
