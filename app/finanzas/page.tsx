'use client'

import AuthGuard from "@/app/AuthGuard"
import { useMemo, useState } from "react"
import { Loader2, AlertCircle, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react"
import { useFinanzasFacturas } from "@/lib/hooks/useFinanzasFacturas"
import {
  monedasPresentes,
  filtrarPorMoneda,
  filtrarPorRango,
  calcularKpisFinanzas,
  compararKpis,
  serieMensual,
  agruparPorCliente,
  periodoPreset,
  rangoDeMes,
  mesActualStr,
  mesAnteriorStr,
  type DeltaKpi,
} from "@/lib/finanzas"
import { detectarAnomaliasFinancieras, type AnomaliaFinanciera } from "@/lib/finanzas-anomalias"
import { formatPrecio } from "@/lib/format"
import FinanzasNav from "@/app/finanzas/FinanzasNav"
import BannerSync from "@/app/finanzas/BannerSync"
import SelectorMes from "@/app/finanzas/SelectorMes"
import GraficaTendencia from "@/app/finanzas/GraficaTendencia"

function DeltaBadge({ delta }: { delta: DeltaKpi }) {
  if (delta.porcentaje === null) {
    return <span className="text-xs text-gray-400">— vs. mes anterior</span>
  }
  const positivo = delta.porcentaje >= 0
  const Icono = positivo ? TrendingUp : TrendingDown
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        positivo ? "text-emerald-600" : "text-red-600"
      }`}
    >
      <Icono className="h-3 w-3" />
      {positivo ? "+" : ""}
      {delta.porcentaje.toFixed(1)}% vs. mes anterior
    </span>
  )
}

function KpiCard({
  titulo,
  valor,
  subtitulo,
  delta,
}: {
  titulo: string
  valor: string
  subtitulo?: string
  delta?: DeltaKpi
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-gray-500 mb-1">{titulo}</p>
      <p className="text-2xl font-bold text-gray-900 tabular-nums leading-tight">{valor}</p>
      {delta && <div className="mt-1"><DeltaBadge delta={delta} /></div>}
      {subtitulo && <p className="text-xs text-gray-400 mt-1">{subtitulo}</p>}
    </div>
  )
}

function AlertasFinancieras({ alertas }: { alertas: AnomaliaFinanciera[] }) {
  const visibles = alertas.slice(0, 5)

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Alertas para revisar</h2>
          <p className="mt-1 text-xs text-gray-400">
            Reglas de integridad y desviaciones del último mes cerrado
          </p>
        </div>
        <AlertTriangle className={`h-5 w-5 ${alertas.length > 0 ? "text-amber-500" : "text-emerald-500"}`} />
      </div>

      {visibles.length === 0 ? (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          No hay alertas con los datos actuales.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {visibles.map((alerta) => (
            <div key={alerta.id} className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  alerta.severidad === "alta"
                    ? "bg-red-100 text-red-700"
                    : alerta.severidad === "media"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-600"
                }`}>
                  {alerta.severidad}
                </span>
                <p className="text-sm font-medium text-gray-800">{alerta.titulo}</p>
              </div>
              <p className="mt-1 text-xs text-gray-600">{alerta.detalle}</p>
              <p className="mt-1 text-xs font-medium text-gray-500">Acción: {alerta.accion}</p>
            </div>
          ))}
          {alertas.length > visibles.length && (
            <p className="pt-1 text-xs text-gray-500">
              Hay {alertas.length - visibles.length} alertas adicionales en los datos cargados.
            </p>
          )}
        </div>
      )}
    </section>
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
  const deltasMes = useMemo(() => {
    const { desde, hasta } = rangoDeMes(mesAnteriorStr(mesSeleccionado))
    const kpisAnteriores = calcularKpisFinanzas(filtrarPorRango(facturasMoneda, desde, hasta))
    return compararKpis(kpisMes, kpisAnteriores)
  }, [facturasMoneda, kpisMes, mesSeleccionado])
  const kpisAnio = useMemo(
    () => calcularKpisFinanzas(filtrarPorRango(facturasMoneda, desdeAnio, hastaAnio)),
    [facturasMoneda, desdeAnio, hastaAnio]
  )
  const serie12Meses = useMemo(
    () => serieMensual(facturasMoneda, 12, rangoDeMes(mesSeleccionado).hasta),
    [facturasMoneda, mesSeleccionado]
  )
  const alertas = useMemo(
    () => detectarAnomaliasFinancieras(facturasMoneda),
    [facturasMoneda]
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
          <KpiCard titulo="Facturación" valor={formatPrecio(kpisMes.facturacionTotal, moneda)} subtitulo="Neto de notas de crédito" delta={deltasMes.facturacionTotal} />
          <KpiCard titulo="Subtotal" valor={formatPrecio(kpisMes.subtotal, moneda)} delta={deltasMes.subtotal} />
          <KpiCard titulo="IVA" valor={formatPrecio(kpisMes.impuestos, moneda)} delta={deltasMes.impuestos} />
          <KpiCard titulo="Facturas" valor={String(kpisMes.numFacturas)} subtitulo={`${kpisMes.numNotasCredito} notas de crédito`} delta={deltasMes.numFacturas} />
        </div>
      </div>

      <AlertasFinancieras alertas={alertas} />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">
          Tendencia de facturación — últimos 12 meses ({moneda})
        </h2>
        <GraficaTendencia serie={serie12Meses} moneda={moneda} />
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
