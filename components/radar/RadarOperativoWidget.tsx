'use client'

import { useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ShieldAlert,
  TrendingUp,
  RefreshCw,
  Package,
  Layers,
} from "lucide-react"
import { useRadarOperativo } from "@/lib/hooks/useRadarOperativo"
import { formatPrecio } from "@/lib/format"

export default function RadarOperativoWidget() {
  const { diagnostico, cargando } = useRadarOperativo()
  const [tabActiva, setTabActiva] = useState<"atrasos" | "precios">("atrasos")

  if (cargando) {
    return (
      <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-6 mb-8 text-slate-400 flex items-center justify-between animate-pulse">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
          <span>Evaluando salud de la operación con el Radar de Inteligencia...</span>
        </div>
      </div>
    )
  }

  const { scoreSaludOperativa, nivelSalud, atrasos, anomaliasPrecio, totalAlertasCriticas } = diagnostico

  // Colores según nivel de salud
  const scoreColors =
    nivelSalud === "optimo"
      ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
      : nivelSalud === "atencion"
      ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
      : "text-rose-400 border-rose-500/30 bg-rose-500/10"

  const scoreBadge =
    nivelSalud === "optimo"
      ? "Salud Óptima"
      : nivelSalud === "atencion"
      ? "Atención Requerida"
      : "Riesgo Crítico"

  return (
    <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 mb-8 shadow-2xl relative overflow-hidden transition-all">
      {/* Resplandor decorativo */}
      <div
        className={`absolute -right-20 -top-20 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-20 ${
          nivelSalud === "optimo" ? "bg-emerald-500" : nivelSalud === "atencion" ? "bg-amber-500" : "bg-rose-500"
        }`}
      />

      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
        <div className="flex items-center gap-3.5">
          <div className={`p-3 rounded-xl border ${scoreColors} shadow-inner`}>
            {nivelSalud === "optimo" ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : nivelSalud === "atencion" ? (
              <AlertTriangle className="w-6 h-6" />
            ) : (
              <ShieldAlert className="w-6 h-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-white tracking-tight">Radar de Salud Operativa</h2>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${scoreColors}`}>
                {scoreBadge}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Detección automática de compras atascadas y anomalías de precios
            </p>
          </div>
        </div>

        {/* Medidor de Score Visual */}
        <div className="flex items-center gap-4 bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-2.5">
          <div className="text-right">
            <div className="text-2xl font-bold text-white tracking-tight leading-none">{scoreSaludOperativa}%</div>
            <div className="text-[11px] text-slate-400 mt-1 font-medium">Índice Operativo</div>
          </div>
          <div className="w-10 h-10 rounded-full border-4 border-slate-800 flex items-center justify-center relative">
            <div
              className={`absolute inset-0 rounded-full border-4 ${
                nivelSalud === "optimo" ? "border-emerald-400" : nivelSalud === "atencion" ? "border-amber-400" : "border-rose-500"
              }`}
              style={{
                clipPath: `inset(0 0 ${100 - scoreSaludOperativa}% 0)`,
              }}
            />
          </div>
        </div>
      </div>

      {/* Control de Pestañas de Alertas */}
      <div className="flex items-center gap-2 mt-5 mb-4">
        <button
          onClick={() => setTabActiva("atrasos")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            tabActiva === "atrasos"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
              : "bg-slate-800/50 text-slate-400 hover:text-slate-200 border border-transparent"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Cuellos de Botella</span>
          <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-slate-900 text-slate-300">
            {atrasos.length}
          </span>
        </button>

        <button
          onClick={() => setTabActiva("precios")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            tabActiva === "precios"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
              : "bg-slate-800/50 text-slate-400 hover:text-slate-200 border border-transparent"
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Desvíos de Precio</span>
          <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-slate-900 text-slate-300">
            {anomaliasPrecio.length}
          </span>
        </button>
      </div>

      {/* Contenido Pestaña Atrasos */}
      {tabActiva === "atrasos" && (
        <div className="space-y-2.5">
          {atrasos.length === 0 ? (
            <div className="text-center py-6 border border-slate-800/60 rounded-xl bg-slate-950/40">
              <CheckCircle2 className="w-8 h-8 text-emerald-400/80 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-300">Cero cuellos de botella detectados</p>
              <p className="text-xs text-slate-500 mt-1">Todas las requisiciones y pedidos avanzan dentro del tiempo estimado.</p>
            </div>
          ) : (
            atrasos.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl hover:border-slate-700 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg mt-0.5 ${
                      item.urgente ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    }`}
                  >
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-100 group-hover:text-cyan-300 transition-colors">
                        {item.titulo}
                      </span>
                      {item.urgente && (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          Urgente
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Solicitado por <strong className="text-slate-300 font-normal">{item.solicitante}</strong> • Retraso de{" "}
                      <span className="text-amber-400 font-medium">{item.diasAtraso} días</span>
                    </p>
                  </div>
                </div>

                <Link
                  href={item.href}
                  className="flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 px-3 py-1.5 rounded-lg transition-all"
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
        <div className="space-y-2.5">
          {anomaliasPrecio.length === 0 ? (
            <div className="text-center py-6 border border-slate-800/60 rounded-xl bg-slate-950/40">
              <CheckCircle2 className="w-8 h-8 text-emerald-400/80 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-300">Precios bajo control</p>
              <p className="text-xs text-slate-500 mt-1">No se registran desvíos superiores al 15% respecto al histórico.</p>
            </div>
          ) : (
            anomaliasPrecio.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3.5 bg-slate-950/60 border border-slate-800/80 rounded-xl hover:border-slate-700 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg mt-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-100 group-hover:text-amber-300 transition-colors">
                        {item.descripcion}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                        +{item.porcentajeIncremento}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Proveedor: <strong className="text-slate-300 font-normal">{item.proveedorNombre}</strong> • Nuevo precio{" "}
                      <span className="text-rose-400 font-medium">{formatPrecio(item.precioActualUSD, "USD")}</span> vs histórico{" "}
                      <span className="text-slate-400 line-through">{formatPrecio(item.precioHistoricoUSD, "USD")}</span>
                    </p>
                  </div>
                </div>

                <Link
                  href="/cotizaciones"
                  className="flex items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 rounded-lg transition-all"
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
