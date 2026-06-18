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
}: Props) {
  const btnBase = "px-3 py-1.5 text-sm rounded-md font-medium transition-colors"
  const btnActive = "bg-blue-600 text-white"
  const btnInactive = "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
  const inputCls = "rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"

  return (
    <div className="flex flex-wrap gap-3 items-end mb-6 no-print">
      {/* Presets de periodo */}
      <div className="flex gap-2">
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
      <div className="flex gap-2 items-center">
        <input
          type="date"
          className={inputCls}
          value={toInputDate(desde)}
          onChange={(e) => onDesde(new Date(e.target.value + "T00:00:00"))}
        />
        <span className="text-gray-400 text-sm">—</span>
        <input
          type="date"
          className={inputCls}
          value={toInputDate(hasta)}
          onChange={(e) => onHasta(new Date(e.target.value + "T23:59:59"))}
        />
      </div>

      {/* Agrupar por */}
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
