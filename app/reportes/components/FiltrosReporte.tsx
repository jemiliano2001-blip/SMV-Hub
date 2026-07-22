'use client'

import type { CriterioAgrupacion } from "@/lib/reportes"

type PresetTipo = "semana" | "mes" | "personalizado"

type Props = {
  presetTipo: PresetTipo
  desde: Date
  hasta: Date
  agruparPor: CriterioAgrupacion
  monedas: string[]
  moneda: string
  onPreset: (tipo: "semana" | "mes") => void
  onDesde: (d: Date) => void
  onHasta: (d: Date) => void
  onAgrupar: (criterio: CriterioAgrupacion) => void
  onMoneda: (m: string) => void
  ocultarAgrupar?: boolean
}

function toInputDate(d: Date): string {
  return d.toISOString().split("T")[0]
}

export default function FiltrosReporte({
  presetTipo,
  desde,
  hasta,
  agruparPor,
  monedas,
  moneda,
  onPreset,
  onDesde,
  onHasta,
  onAgrupar,
  onMoneda,
  ocultarAgrupar,
}: Props) {
  const btnBase = "shrink-0 rounded-md px-3 py-1.5 text-xs font-bold transition-colors"
  const btnActive = "bg-[#0369A1] text-white"
  const btnInactive = "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
  const inputCls = "min-w-0 rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#0369A1]"

  return (
    <div className="no-print mb-4 flex flex-wrap items-end gap-3 sm:mb-6">
      {/* Presets de periodo */}
      <div className="flex w-full gap-2 overflow-x-auto sm:w-auto">
        <button
          className={`${btnBase} ${presetTipo === "semana" ? btnActive : btnInactive}`}
          onClick={() => onPreset("semana")}
        >
          Esta semana
        </button>
        <button
          className={`${btnBase} ${presetTipo === "mes" ? btnActive : btnInactive}`}
          onClick={() => onPreset("mes")}
        >
          Este mes
        </button>
      </div>

      {/* Rango personalizado */}
      <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto">
        <input
          type="date"
          aria-label="Fecha inicial"
          className={`${inputCls} flex-1 sm:flex-none`}
          value={toInputDate(desde)}
          onChange={(e) => onDesde(new Date(e.target.value + "T00:00:00"))}
        />
        <span className="text-xs text-slate-400">—</span>
        <input
          type="date"
          aria-label="Fecha final"
          className={`${inputCls} flex-1 sm:flex-none`}
          value={toInputDate(hasta)}
          onChange={(e) => onHasta(new Date(e.target.value + "T23:59:59"))}
        />
      </div>

      {/* Agrupar por */}
      {!ocultarAgrupar && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Agrupar:</span>
          <select
            className={inputCls}
            value={agruparPor}
            onChange={(e) => onAgrupar(e.target.value as CriterioAgrupacion)}
          >
            <option value="proveedor">Proveedor</option>
            <option value="destino">Destino</option>
            <option value="requisitor">Requisitor</option>
          </select>
        </div>
      )}

      {/* Filtro de moneda (solo cuando hay más de una) */}
      {monedas.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Moneda:</span>
          <select
            className={inputCls}
            value={moneda}
            onChange={(e) => onMoneda(e.target.value)}
          >
            {monedas.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
