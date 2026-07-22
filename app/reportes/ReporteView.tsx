'use client'

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { listarOrdenes } from "@/lib/ordenes"
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

import DashboardInteligenciaCompras from "./DashboardInteligenciaCompras"
import { BarChart3, FileSpreadsheet } from "lucide-react"

export default function ReporteView() {
  const [tabVista, setTabVista] = useState<"dashboard" | "gerencial">("dashboard")
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [presetTipo, setPresetTipo] = useState<PresetTipo>("semana")
  const [periodo, setPeriodo] = useState(() => periodoPreset("semana"))
  const [agruparPor, setAgruparPor] = useState<CriterioAgrupacion>("proveedor")
  const [moneda, setMoneda] = useState("MXN")

  // Recarga manual (botón "Reintentar"): aquí sí marcamos cargando de inmediato.
  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      setOrdenes(await listarOrdenes())
    } catch {
      setError(MSG_ERROR)
    } finally {
      setCargando(false)
    }
  }, [])

  // Carga inicial: el estado arranca en `cargando = true`, así que sólo
  // actualizamos estado después del await para no disparar renders en cascada.
  useEffect(() => {
    let activo = true
    listarOrdenes()
      .then((data) => { if (activo) setOrdenes(data) })
      .catch(() => { if (activo) setError(MSG_ERROR) })
      .finally(() => { if (activo) setCargando(false) })
    return () => { activo = false }
  }, [])

  function handlePreset(tipo: "semana" | "mes") {
    setPresetTipo(tipo)
    setPeriodo(periodoPreset(tipo))
  }

  const ordenesDelPeriodo = filtrarPorRango(ordenes, periodo.desde, periodo.hasta)
  const lineasTodas = aplanarLineas(ordenesDelPeriodo)
  const monedas = [...new Set(lineasTodas.map((l) => l.moneda))].filter(Boolean)
  const monedaActiva = monedas.includes(moneda) ? moneda : (monedas[0] ?? "MXN")
  const lineas = lineasTodas.filter((l) => l.moneda === monedaActiva)
  const grupos = agrupar(lineas, agruparPor)
  const kpis = calcularKpis(lineas)
  const totalGeneral = grupos.reduce((s, g) => s + g.total, 0)

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
        <span className="text-sm text-gray-600">Cargando órdenes…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="text-sm text-gray-700">{error}</p>
        <button
          onClick={cargar}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="max-w-[1400px] mx-auto px-4 py-6 print:max-w-none print:px-0 print:py-0">

        {/* Navegación y selector de pestañas (Oculto al imprimir) */}
        <div className="mb-6 no-print flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <Link href="/" className="text-xs font-bold text-[#0369A1] hover:underline flex items-center gap-1">
            ← Volver al Inicio
          </Link>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setTabVista("dashboard")}
              className={[
                "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                tabVista === "dashboard"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60",
              ].join(" ")}
            >
              <BarChart3 className="h-4 w-4 text-amber-400" />
              Dashboard Inteligencia 3-Tier
            </button>

            <button
              onClick={() => setTabVista("gerencial")}
              className={[
                "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                tabVista === "gerencial"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60",
              ].join(" ")}
            >
              <FileSpreadsheet className="h-4 w-4 text-slate-500" />
              Reporte Gerencial &amp; Filtros
            </button>
          </div>

          <Link href="/reportes/contable" className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors">
            Reporte Contable →
          </Link>
        </div>

        {tabVista === "dashboard" && <DashboardInteligenciaCompras />}

        {tabVista === "gerencial" && (
          <>
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

        </>
        )}

      </div>
    </div>
  )
}
