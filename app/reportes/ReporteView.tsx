'use client'

import { useState, useCallback, useEffect } from "react"
import Link from "next/link"
import { listarOrdenesParaReporte } from "@/lib/ordenes"
import {
  filtrarPorRango,
  aplanarLineas,
  agrupar,
  calcularKpis,
  periodoPreset,
  type CriterioAgrupacion,
} from "@/lib/reportes"
import type { OrdenCompra } from "@/lib/schemas"
import CabeceraReporte from "@/app/reportes/components/CabeceraReporte"
import FiltrosReporte from "@/app/reportes/components/FiltrosReporte"
import FranjaKpis from "@/app/reportes/components/FranjaKpis"
import TablaReporte from "@/app/reportes/components/TablaReporte"
import AvisoPendientes from "@/app/reportes/components/AvisoPendientes"
import { Loader2, AlertCircle } from "lucide-react"

type PresetTipo = "semana" | "mes" | "personalizado"

const MSG_ERROR = "No se pudieron cargar las órdenes. Verifica tu conexión."

function tituloReporte(desde: Date, hasta: Date): string {
  const opt: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }
  const loc = "es-MX"
  if (
    desde.getDate() === 1 &&
    hasta.getDate() === new Date(hasta.getFullYear(), hasta.getMonth() + 1, 0).getDate() &&
    desde.getMonth() === hasta.getMonth()
  ) {
    return desde.toLocaleDateString(loc, { month: "long", year: "numeric" })
  }
  return `${desde.toLocaleDateString(loc, opt)} — ${hasta.toLocaleDateString(loc, opt)}`
}

export default function ReporteView() {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [presetTipo, setPresetTipo] = useState<PresetTipo>("semana")
  const [periodo, setPeriodo] = useState(() => periodoPreset("semana"))
  const [agruparPor, setAgruparPor] = useState<CriterioAgrupacion>("proveedor")
  const [moneda, setMoneda] = useState("MXN")

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const brutas = await listarOrdenesParaReporte(periodo.desde, periodo.hasta)
      setOrdenes(filtrarPorRango(brutas, periodo.desde, periodo.hasta))
    } catch {
      setError(MSG_ERROR)
    } finally {
      setCargando(false)
    }
  }, [periodo.desde, periodo.hasta])

  useEffect(() => {
    const timer = window.setTimeout(() => void cargar(), 0)
    return () => window.clearTimeout(timer)
  }, [cargar])

  function handlePreset(tipo: "semana" | "mes") {
    setPresetTipo(tipo)
    setPeriodo(periodoPreset(tipo))
  }

  const ordenesDelPeriodo = ordenes
  const lineasTodas = aplanarLineas(ordenesDelPeriodo)
  const monedas = [...new Set(lineasTodas.map((l) => l.moneda))].filter(Boolean)
  const monedaActiva = monedas.includes(moneda) ? moneda : (monedas[0] ?? "MXN")
  const lineas = lineasTodas.filter((l) => l.moneda === monedaActiva)
  const grupos = agrupar(lineas, agruparPor)
  const kpis = calcularKpis(lineas)
  const totalGeneral = grupos.reduce((s, g) => s + g.total, 0)

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="mr-2 size-6 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Cargando órdenes…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 bg-background">
        <AlertCircle className="size-8 text-destructive" />
        <p className="text-sm text-foreground">{error}</p>
        <button
          onClick={cargar}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <main className="w-full">
      <div className="max-w-[1400px] mx-auto px-4 py-6 print:max-w-none print:px-0 print:py-0">

        {/* Navegación (Oculto al imprimir) */}
        <div className="mb-6 no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <Link href="/" className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">
            ← Volver al Inicio
          </Link>

          <Link href="/reportes/contable" className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors">
            Cierre contable →
          </Link>
        </div>

        <FiltrosReporte
          presetTipo={presetTipo}
          desde={periodo.desde}
          hasta={periodo.hasta}
          agruparPor={agruparPor}
          monedas={monedas}
          moneda={monedaActiva}
          onPreset={handlePreset}
          onDesde={(d) => { setPeriodo((p) => ({ ...p, desde: d })); setPresetTipo("personalizado") }}
          onHasta={(d) => { setPeriodo((p) => ({ ...p, hasta: d })); setPresetTipo("personalizado") }}
          onAgrupar={setAgruparPor}
          onMoneda={setMoneda}
        />

        <AvisoPendientes />

        <div className="reporte-document">
          <CabeceraReporte
            titulo="Reporte de compras"
            subtitulo={tituloReporte(periodo.desde, periodo.hasta)}
            moneda={monedaActiva}
            agruparPor={agruparPor}
            kpis={kpis}
            grupos={grupos}
            totalGeneral={totalGeneral}
          />

          {lineas.length > 0 && (
            <div className="mb-6">
              <FranjaKpis kpis={kpis} moneda={monedaActiva} />
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm print:rounded-none print:border-0 print:shadow-none print:p-0">
            <TablaReporte grupos={grupos} totalGeneral={totalGeneral} moneda={monedaActiva} />
          </div>

          <div className="hidden print:flex justify-between mt-3 pt-2 border-t border-gray-200 text-[7.5px] text-gray-400 tracking-wide">
            <span>SMV Maquinados, S.A. de C.V.</span>
            <span>Uso interno · Confidencial</span>
          </div>
        </div>

      </div>
    </main>
  )
}
