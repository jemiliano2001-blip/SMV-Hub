'use client'

import AuthGuard from "@/app/AuthGuard"
import { useMemo, useState } from "react"
import { Loader2, AlertCircle } from "lucide-react"
import { useFinanzasFacturas } from "@/lib/hooks/useFinanzasFacturas"
import {
  facturasValidas,
  monedasPresentes,
  filtrarPorMoneda,
  filtrarPorRango,
  clasificarCobranza,
  diasAtraso,
  rangoDeMes,
  mesActualStr,
  type EstadoCobranza,
} from "@/lib/finanzas"
import { formatPrecio, formatFecha } from "@/lib/format"
import FinanzasNav from "@/app/finanzas/FinanzasNav"
import BannerSync from "@/app/finanzas/BannerSync"
import SelectorMes from "@/app/finanzas/SelectorMes"

type Filtro = "todas" | EstadoCobranza
type PeriodoCobranza = "todas" | "mes"

const ETIQUETA_ESTADO: Record<EstadoCobranza, { label: string; clase: string }> = {
  pagada: { label: "Pagada", clase: "bg-emerald-50 text-emerald-700" },
  pendiente: { label: "Pendiente", clase: "bg-amber-50 text-amber-700" },
  vencida: { label: "Vencida", clase: "bg-red-50 text-red-700" },
}

function Cobranza() {
  const { facturas, estadoSync, loading, error, recargar } = useFinanzasFacturas()
  const [monedaActiva, setMonedaActiva] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>("todas")
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoCobranza>("todas")
  const [mesSeleccionado, setMesSeleccionado] = useState(() => mesActualStr())

  const monedas = useMemo(() => monedasPresentes(facturas), [facturas])
  const moneda = monedaActiva ?? monedas[0] ?? "MXN"

  const filas = useMemo(() => {
    const hoy = new Date()
    let base = facturasValidas(filtrarPorMoneda(facturas, moneda)).filter((f) => f.tipo === "factura")
    if (periodoTipo === "mes") {
      const { desde, hasta } = rangoDeMes(mesSeleccionado)
      base = filtrarPorRango(base, desde, hasta)
    }
    return base
      .map((f) => ({ factura: f, estado: clasificarCobranza(f, hoy), atraso: diasAtraso(f, hoy) }))
      .sort((a, b) => b.atraso - a.atraso)
  }, [facturas, moneda, periodoTipo, mesSeleccionado])

  const filasFiltradas = filtro === "todas" ? filas : filas.filter((f) => f.estado === filtro)

  const totalPorCobrar = useMemo(
    () => filas.filter((f) => f.estado !== "pagada").reduce((s, f) => s + f.factura.saldoPendiente, 0),
    [filas]
  )
  const numVencidas = filas.filter((f) => f.estado === "vencida").length
  const numPendientes = filas.filter((f) => f.estado === "pendiente").length

  if (loading && facturas.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
        <span className="text-sm text-gray-600">Cargando cobranza…</span>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BannerSync estadoSync={estadoSync} onSincronizado={recargar} />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-gray-200/50 p-1 rounded-lg gap-1">
            {(["todas", "mes"] as PeriodoCobranza[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodoTipo(p)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  periodoTipo === p ? "bg-white text-[#0369A1] shadow-sm" : "text-gray-500"
                }`}
              >
                {p === "todas" ? "Todas" : "Por mes"}
              </button>
            ))}
          </div>
          {periodoTipo === "mes" && <SelectorMes value={mesSeleccionado} onChange={setMesSeleccionado} />}
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Total por cobrar</p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{formatPrecio(totalPorCobrar, moneda)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Pendientes</p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{numPendientes}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Vencidas</p>
          <p className="text-2xl font-bold text-red-600 tabular-nums">{numVencidas}</p>
        </div>
      </div>

      <div className="flex bg-gray-200/50 p-1 rounded-lg w-fit gap-1">
        {(["todas", "pendiente", "vencida", "pagada"] as Filtro[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all capitalize ${
              filtro === f ? "bg-white text-[#0369A1] shadow-sm" : "text-gray-500"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        {filasFiltradas.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">No hay facturas para este filtro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-600">Cliente</th>
                  <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-600">Factura</th>
                  <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-600">Vencimiento</th>
                  <th className="pb-2 pr-3 text-right text-xs font-semibold text-gray-600">Total</th>
                  <th className="pb-2 pr-3 text-right text-xs font-semibold text-gray-600">Saldo</th>
                  <th className="pb-2 pr-3 text-right text-xs font-semibold text-gray-600">Días atraso</th>
                  <th className="pb-2 text-left text-xs font-semibold text-gray-600">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filasFiltradas.map(({ factura, estado, atraso }) => (
                  <tr key={factura.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 pr-3">{factura.cliente}</td>
                    <td className="py-2 pr-3 font-mono text-xs text-gray-500">{factura.numeroFactura}</td>
                    <td className="py-2 pr-3">{formatFecha(factura.fechaVencimiento)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatPrecio(factura.total, moneda)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums font-medium">
                      {formatPrecio(factura.saldoPendiente, moneda)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-gray-500">{atraso > 0 ? atraso : "—"}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ETIQUETA_ESTADO[estado].clase}`}>
                        {ETIQUETA_ESTADO[estado].label}
                      </span>
                    </td>
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

export default function CobranzaPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-gray-50 flex flex-col">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Cobranza</h1>
              <p className="text-sm text-gray-500 mt-1">Facturas pagadas, pendientes y vencidas</p>
            </div>
            <FinanzasNav />
          </div>

          <Cobranza />
        </div>
      </main>
    </AuthGuard>
  )
}
