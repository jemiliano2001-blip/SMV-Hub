'use client'

import { useState } from "react"
import Link from "next/link"
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Layers,
  Package,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
} from "lucide-react"
import { useRadarOperativo } from "@/lib/hooks/useRadarOperativo"
import { formatPrecio } from "@/lib/format"

export default function RadarOperativoWidget() {
  const { diagnostico, cargando } = useRadarOperativo()
  const [tabActiva, setTabActiva] = useState<"atrasos" | "precios">("atrasos")

  if (cargando) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 shadow-xs text-slate-500 flex items-center justify-between animate-pulse">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-[#0369A1]" />
          <span className="text-sm font-medium text-slate-600">Evaluando salud de la operación con el Radar de Inteligencia...</span>
        </div>
      </div>
    )
  }

  const { scoreSaludOperativa, nivelSalud, atrasos, anomaliasPrecio } = diagnostico

  // Color mappings for badges and accents according to health level
  const statusTheme =
    nivelSalud === "optimo"
      ? {
          badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
          iconBg: "bg-emerald-50 text-emerald-600 border-emerald-200",
          ring: "border-emerald-500 text-emerald-700",
          glow: "bg-emerald-500/10",
        }
      : nivelSalud === "atencion"
      ? {
          badge: "bg-amber-50 text-amber-700 border-amber-200",
          iconBg: "bg-amber-50 text-amber-600 border-amber-200",
          ring: "border-amber-500 text-amber-700",
          glow: "bg-amber-500/10",
        }
      : {
          badge: "bg-rose-50 text-rose-700 border-rose-200",
          iconBg: "bg-rose-50 text-rose-600 border-rose-200",
          ring: "border-rose-500 text-rose-700",
          glow: "bg-rose-500/10",
        }

  const scoreBadgeText =
    nivelSalud === "optimo"
      ? "Salud Óptima"
      : nivelSalud === "atencion"
      ? "Atención Requerida"
      : "Riesgo Crítico"

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 mb-6 shadow-xs relative overflow-hidden transition-all">
      {/* Resplandor ambiental suave decorativo */}
      <div
        className={`absolute -right-16 -top-16 w-64 h-64 rounded-full blur-3xl pointer-events-none ${statusTheme.glow}`}
      />

      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3.5">
          <div className={`p-2.5 rounded-xl border ${statusTheme.iconBg} shadow-2xs`}>
            {nivelSalud === "optimo" ? (
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
            ) : nivelSalud === "atencion" ? (
              <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6" />
            ) : (
              <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <span>Radar de Salud Operativa</span>
                <Activity className="w-4 h-4 text-slate-400 hidden sm:inline-block" />
              </h2>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusTheme.badge}`}>
                {scoreBadgeText}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Detección automática de compras atascadas y anomalías de precios
            </p>
          </div>
        </div>

        {/* Medidor de Score Visual */}
        <div className="flex items-center gap-3.5 bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2 self-start sm:self-auto">
          <div className="text-right">
            <div className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono leading-none">
              {scoreSaludOperativa}%
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-medium">Índice Operativo</div>
          </div>
          <div className="w-10 h-10 rounded-full border-4 border-slate-200 flex items-center justify-center relative bg-white shadow-2xs">
            <div
              className={`absolute inset-0 rounded-full border-4 ${
                nivelSalud === "optimo" ? "border-emerald-500" : nivelSalud === "atencion" ? "border-amber-500" : "border-rose-500"
              }`}
              style={{
                clipPath: `inset(0 0 ${100 - scoreSaludOperativa}% 0)`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Control de Pestañas de Alertas */}
      <div className="flex items-center gap-2 mt-4 mb-3">
        <button
          onClick={() => setTabActiva("atrasos")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            tabActiva === "atrasos"
              ? "bg-sky-50 text-sky-700 border border-sky-200 shadow-2xs"
              : "bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/60"
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-sky-600" />
          <span>Cuellos de Botella</span>
          <span
            className={`ml-1 px-1.5 py-0.2 text-[10px] font-mono rounded-full ${
              tabActiva === "atrasos" ? "bg-sky-100 text-sky-800" : "bg-slate-200/70 text-slate-700"
            }`}
          >
            {atrasos.length}
          </span>
        </button>

        <button
          onClick={() => setTabActiva("precios")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            tabActiva === "precios"
              ? "bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs"
              : "bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/60"
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
          <span>Desvíos de Precio</span>
          <span
            className={`ml-1 px-1.5 py-0.2 text-[10px] font-mono rounded-full ${
              tabActiva === "precios" ? "bg-amber-100 text-amber-800" : "bg-slate-200/70 text-slate-700"
            }`}
          >
            {anomaliasPrecio.length}
          </span>
        </button>
      </div>

      {/* Contenido Pestaña Atrasos */}
      {tabActiva === "atrasos" && (
        <div className="space-y-2">
          {atrasos.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1.5" />
              <p className="text-xs font-bold text-slate-800">Cero cuellos de botella detectados</p>
              <p className="text-[11px] text-slate-500 mt-0.5">Todas las requisiciones y pedidos avanzan dentro del tiempo estimado.</p>
            </div>
          ) : (
            atrasos.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-xl hover:bg-white hover:border-slate-300 hover:shadow-2xs transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg mt-0.5 shrink-0 ${
                      item.urgente ? "bg-rose-50 text-rose-600 border border-rose-200" : "bg-amber-50 text-amber-600 border border-amber-200"
                    }`}
                  >
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-semibold text-slate-900 group-hover:text-[#0369A1] transition-colors">
                        {item.titulo}
                      </span>
                      {item.urgente && (
                        <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">
                          Urgente
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Solicitado por <strong className="text-slate-700 font-semibold">{item.solicitante}</strong> • Retraso de{" "}
                      <span className="text-amber-700 font-bold">{item.diasAtraso} días</span>
                    </p>
                  </div>
                </div>

                <Link
                  href={item.href}
                  className="flex items-center justify-center gap-1 text-xs font-semibold text-[#0369A1] bg-sky-50 hover:bg-sky-100 border border-sky-200 px-3 py-1.5 rounded-lg transition-all self-end sm:self-center"
                >
                  <span>Atender</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))
          )}
        </div>
      )}

      {/* Contenido Pestaña Precios */}
      {tabActiva === "precios" && (
        <div className="space-y-2">
          {anomaliasPrecio.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
              <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-1.5" />
              <p className="text-xs font-bold text-slate-800">Precios bajo control</p>
              <p className="text-[11px] text-slate-500 mt-0.5">No se registran desvíos superiores al 15% respecto al histórico.</p>
            </div>
          ) : (
            anomaliasPrecio.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-xl hover:bg-white hover:border-slate-300 hover:shadow-2xs transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg mt-0.5 shrink-0 bg-rose-50 text-rose-600 border border-rose-200">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs sm:text-sm font-semibold text-slate-900 group-hover:text-amber-800 transition-colors">
                        {item.descripcion}
                      </span>
                      <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200 font-mono">
                        +{item.porcentajeIncremento}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Proveedor: <strong className="text-slate-700 font-semibold">{item.proveedorNombre}</strong> • Nuevo precio{" "}
                      <span className="text-rose-700 font-bold">{formatPrecio(item.precioActualUSD, "USD")}</span> vs histórico{" "}
                      <span className="text-slate-400 line-through">{formatPrecio(item.precioHistoricoUSD, "USD")}</span>
                    </p>
                  </div>
                </div>

                <Link
                  href="/cotizaciones"
                  className="flex items-center justify-center gap-1 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg transition-all self-end sm:self-center"
                >
                  <span>Comparar</span>
                  <Layers className="w-3.5 h-3.5" />
                </Link>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
