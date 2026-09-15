/**
 * Precio histórico por pieza/proveedor y alertas de precio — lógica PURA, sin Firebase.
 *
 * Extraída de `proveedores-inteligencia-cruzada.ts` (que importa el SDK cliente) para que la
 * memoria operativa la use desde Route Handlers (frente C, T2.2). Aquel módulo la re-exporta:
 * los consumidores existentes no cambian.
 */

import { aUSD, TIPO_CAMBIO_DEFAULT_USD_MXN } from "@/lib/tipo-cambio"
import { llavesCoinciden } from "@/lib/pieza-matching"

export type FuentePrecio = "cotizacion_historica" | "compra" | "cotizacion_requisicion" | "factura_odoo"

export interface PuntoPrecioHistorico {
  llavePieza: string
  descripcion: string
  numeroParte: string | null
  proveedorId: string | null
  proveedorNombre: string
  precioUnitarioUSD: number
  monedaOriginal: "USD" | "MXN"
  precioOriginal: number
  fecha: string
  fuente: FuentePrecio
  docId: string
}

export interface ResumenPrecioPiezaProveedor {
  llavePieza: string
  descripcion: string
  proveedorId: string | null
  proveedorNombre: string
  precioMinUSD: number
  precioMaxUSD: number
  precioPromedioUSD: number
  ultimoPrecioUSD: number
  ultimaFecha: string
  muestras: number
  puntos: PuntoPrecioHistorico[]
}

export function resumirPreciosPorPiezaProveedor(
  puntos: PuntoPrecioHistorico[]
): ResumenPrecioPiezaProveedor[] {
  const grupos = new Map<string, PuntoPrecioHistorico[]>()
  for (const p of puntos) {
    const key = `${p.proveedorId || p.proveedorNombre}::${p.llavePieza}`
    const arr = grupos.get(key) ?? []
    arr.push(p)
    grupos.set(key, arr)
  }

  const resúmenes: ResumenPrecioPiezaProveedor[] = []
  for (const arr of grupos.values()) {
    const precios = arr.map((p) => p.precioUnitarioUSD)
    const ordenados = [...arr].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))
    const ultimo = ordenados[0]
    resúmenes.push({
      llavePieza: arr[0].llavePieza,
      descripcion: arr[0].descripcion,
      proveedorId: arr[0].proveedorId,
      proveedorNombre: arr[0].proveedorNombre,
      precioMinUSD: Math.min(...precios),
      precioMaxUSD: Math.max(...precios),
      precioPromedioUSD: precios.reduce((s, n) => s + n, 0) / precios.length,
      ultimoPrecioUSD: ultimo.precioUnitarioUSD,
      ultimaFecha: ultimo.fecha,
      muestras: arr.length,
      puntos: arr,
    })
  }
  return resúmenes.sort((a, b) => b.muestras - a.muestras)
}

// ── B6: Alertas de precio ────────────────────────────────────────────────────

export type TipoAlertaPrecio = "mejor_que_historico" | "en_rango" | "caro" | "sin_historico"

export interface AlertaPrecio {
  tipo: TipoAlertaPrecio
  mensaje: string
  precioActualUSD: number
  precioMinHistoricoUSD: number | null
  desviacionPct: number | null
}

const UMBRAL_CARO = 0.35

export function evaluarAlertaPrecio(
  precioActual: number,
  moneda: "USD" | "MXN",
  llavePieza: string,
  proveedorId: string | null,
  resúmenes: ResumenPrecioPiezaProveedor[],
  tipoCambioUsdMxn: number = TIPO_CAMBIO_DEFAULT_USD_MXN
): AlertaPrecio {
  const actualUSD = aUSD(precioActual, moneda, tipoCambioUsdMxn)
  const candidatos = resúmenes.filter(
    (r) =>
      llavesCoinciden(r.llavePieza, llavePieza) &&
      (proveedorId ? r.proveedorId === proveedorId : true)
  )
  if (candidatos.length === 0) {
    return {
      tipo: "sin_historico",
      mensaje: "Sin histórico de precio para esta pieza/proveedor.",
      precioActualUSD: actualUSD,
      precioMinHistoricoUSD: null,
      desviacionPct: null,
    }
  }
  const minHist = Math.min(...candidatos.map((c) => c.precioMinUSD))
  // Un mínimo histórico de 0 (precio no capturado; el schema lo default-ea a 0)
  // no es base válida de comparación: dividir entre él daría Infinity/NaN.
  if (minHist <= 0) {
    return {
      tipo: "sin_historico",
      mensaje: "Sin histórico de precio válido para comparar.",
      precioActualUSD: actualUSD,
      precioMinHistoricoUSD: null,
      desviacionPct: null,
    }
  }
  const desv = (actualUSD - minHist) / minHist
  if (actualUSD <= minHist) {
    return {
      tipo: "mejor_que_historico",
      mensaje: `Mejor que el mínimo histórico ($${minHist.toFixed(2)} USD).`,
      precioActualUSD: actualUSD,
      precioMinHistoricoUSD: minHist,
      desviacionPct: desv,
    }
  }
  if (desv > UMBRAL_CARO) {
    return {
      tipo: "caro",
      mensaje: `Caro: +${(desv * 100).toFixed(0)}% sobre mínimo histórico ($${minHist.toFixed(2)} USD).`,
      precioActualUSD: actualUSD,
      precioMinHistoricoUSD: minHist,
      desviacionPct: desv,
    }
  }
  return {
    tipo: "en_rango",
    mensaje: `En rango histórico (mín $${minHist.toFixed(2)} USD).`,
    precioActualUSD: actualUSD,
    precioMinHistoricoUSD: minHist,
    desviacionPct: desv,
  }
}
