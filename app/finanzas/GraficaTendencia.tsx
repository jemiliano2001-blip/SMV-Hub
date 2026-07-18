'use client'

import { useMemo, useState } from "react"
import type { PuntoMensual } from "@/lib/finanzas"
import { formatPrecio } from "@/lib/format"

const ANCHO = 720
const ALTO = 220
const MARGEN = { top: 16, right: 12, bottom: 28, left: 12 }

const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

function etiquetaMes(mes: string): string {
  const [anio, m] = mes.split("-").map(Number)
  return `${MESES_CORTOS[m - 1]} ${String(anio).slice(2)}`
}

/**
 * Línea de tendencia mensual en SVG puro (sin librería de charting).
 * Espera una serie de una sola moneda — nunca mezclar monedas en una gráfica.
 */
export default function GraficaTendencia({ serie, moneda }: { serie: PuntoMensual[]; moneda: string }) {
  const [hover, setHover] = useState<number | null>(null)

  const { puntos, path, areaPath } = useMemo(() => {
    const maxVal = Math.max(...serie.map((p) => p.total), 0)
    const minVal = Math.min(...serie.map((p) => p.total), 0)
    const rango = maxVal - minVal || 1

    const w = ANCHO - MARGEN.left - MARGEN.right
    const h = ALTO - MARGEN.top - MARGEN.bottom
    const paso = serie.length > 1 ? w / (serie.length - 1) : 0

    const pts = serie.map((p, i) => ({
      ...p,
      x: MARGEN.left + i * paso,
      y: MARGEN.top + h - ((p.total - minVal) / rango) * h,
    }))

    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
    const yCero = MARGEN.top + h - ((0 - minVal) / rango) * h
    const area = pts.length > 0
      ? `${d} L${pts[pts.length - 1].x.toFixed(1)},${yCero.toFixed(1)} L${pts[0].x.toFixed(1)},${yCero.toFixed(1)} Z`
      : ""

    return { puntos: pts, path: d, areaPath: area }
  }, [serie])

  if (serie.length === 0) {
    return <p className="text-sm text-gray-500 py-4 text-center">Sin datos para graficar.</p>
  }

  const activo = hover !== null ? puntos[hover] : null

  return (
    <div className="relative">
      {activo && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white shadow-lg pointer-events-none z-10 whitespace-nowrap">
          <span className="font-medium">{etiquetaMes(activo.mes)}:</span>{" "}
          <span className="tabular-nums">{formatPrecio(activo.total, moneda)}</span>
        </div>
      )}
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Tendencia de facturación mensual en ${moneda}`}
        onMouseLeave={() => setHover(null)}
      >
        <path d={areaPath} fill="#0369A1" opacity={0.08} />
        <path d={path} fill="none" stroke="#0369A1" strokeWidth={2} strokeLinejoin="round" />
        {puntos.map((p, i) => (
          <g key={p.mes}>
            {/* zona de hover ancha e invisible por punto */}
            <rect
              x={p.x - (ANCHO / serie.length) / 2}
              y={0}
              width={ANCHO / serie.length}
              height={ALTO}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
            <circle
              cx={p.x}
              cy={p.y}
              r={hover === i ? 5 : 3}
              fill={hover === i ? "#0369A1" : "#fff"}
              stroke="#0369A1"
              strokeWidth={2}
              pointerEvents="none"
            />
            <text
              x={p.x}
              y={ALTO - 8}
              textAnchor="middle"
              className="fill-gray-400"
              fontSize={10}
            >
              {etiquetaMes(p.mes)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
