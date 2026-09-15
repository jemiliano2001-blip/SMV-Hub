/**
 * Tipos de la memoria operativa (frente C, v1 = órdenes + cotizaciones).
 * Ver docs/superpowers/specs/2026-09-13-memoria-operativa-design.md y el plan 2026-09-15.
 */

import type { FuenteBusquedaIndice } from "@/lib/schemas"
import type { AlertaPrecio } from "@/lib/precios-historicos"

/** nueva-compra extrae hasta 20 ítems por factura: una consulta cubre la factura completa. */
export const MAX_PIEZAS_POR_CONSULTA = 20

/** Una pieza que se está capturando (nueva-compra, cotización). Todo opcional salvo la descripción. */
export interface PiezaConsulta {
  descripcion: string
  numeroParte?: string | null
  proveedor?: string | null
  proveedorId?: string | null
  precioUnitario?: number | null
  moneda?: "USD" | "MXN" | null
}

/**
 * exacto   → misma llave o mismo número de parte: es la misma pieza (alimenta la alerta de precio).
 * hermano  → ambos con número de parte y distinto: misma familia, otro tamaño/variante (C0).
 * parecido → vecino semántico sin número de parte que lo confirme ni lo descarte.
 */
export type EmpateMemoria = "exacto" | "hermano" | "parecido"

export type FuenteMemoria = Extract<FuenteBusquedaIndice, "orden-item" | "cotizacion">

export interface ReferenciaHistorica {
  fuente: FuenteMemoria
  /** Id del doc origen (orden o cotización); para orden-item es `${ordenId}#${indice}`. */
  refId: string
  refPath: string
  titulo: string
  proveedorNombre: string | null
  proveedorId: string | null
  /** null cuando no hay precio de referencia o el usuario no puede ver montos. */
  precioUnitario: number | null
  moneda: string | null
  fecha: string | null
  empate: EmpateMemoria
  /** Coseno contra la pieza consultada (0–1). */
  score: number
  numeroParte: string | null
  ubicacion: string | null
  estatus: string | null
}

/** Agregado sobre hermanos + parecidos: dónde se ha comprado/cotizado la familia (C0: el caso del 90 %). */
export interface FamiliaComprada {
  proveedorNombre: string
  proveedorId: string | null
  veces: number
  ultimoPrecio: number | null
  moneda: string | null
  ultimaFecha: string | null
}

export interface ProveedorPreferidoMemoria {
  proveedorNombre: string
  proveedorId: string | null
  veces: number
}

export interface FamiliaClasificacion {
  categoriaId: string
  tipoInsumo: string | null
  medida: string | null
}

export interface ClaveSatValidada {
  claveProdServ: string
  descripcionSat: string | null
  confianza: string
}

export interface ContextoOperativo {
  /** Índice de la pieza en la consulta (misma posición que `piezas[]`). */
  indice: number
  llavePieza: string
  /** Números de parte detectados en la pieza (explícito + embebidos en la descripción). */
  numerosParte: string[]
  comprasPrevias: ReferenciaHistorica[]
  cotizacionesPrevias: ReferenciaHistorica[]
  totalExactos: number
  totalParecidos: number
  familiaComprada: FamiliaComprada | null
  /** Solo sobre exactos con precio y si el usuario ve montos. */
  alertaPrecio: AlertaPrecio | null
  proveedorPreferido: ProveedorPreferidoMemoria | null
  claveSatValidada: ClaveSatValidada | null
  familia: FamiliaClasificacion | null
}

export interface RespuestaMemoriaOperativa {
  contextos: ContextoOperativo[]
  fuentesConsultadas: FuenteBusquedaIndice[]
  verPrecios: boolean
  /** true si Gemini o el índice fallaron y solo hubo empate exacto por llave contra `cotizaciones`. */
  degradado: boolean
  tiempoMs: number
}
