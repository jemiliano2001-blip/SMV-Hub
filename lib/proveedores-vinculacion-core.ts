import { matchProveedorPorNombre, normalizarNombreProveedor } from "@/lib/pieza-matching"

export interface DocumentoProveedorHistorico {
  id: string
  proveedor: string
  proveedorId?: string | null
}

export interface ProveedorCatalogoMinimo {
  id: string
  nombre: string
  /** Nombres con los que aparece en facturas; empatan como exacto igual que `nombre`. */
  aliases?: string[]
}

export interface ResultadoBackfill {
  revisados: number
  vinculados: number
  sinMatch: number
  yaTenianId: number
  /**
   * Documentos cuyo "proveedor" es un origen interno (almacén, línea) y no un vendedor: no se
   * vinculan ni cuentan como fantasma. Opcional por compatibilidad con respuestas previas.
   */
  ignoradosInternos?: number
}

export interface ProveedorFantasma {
  nombreLibre: string
  origen: "orden" | "cotizacion"
  cantidadDocs: number
  /** Se limita a 20 para que una corrección manual sea una operación acotada. */
  idsDocs: string[]
  /** Mejor candidato del catálogo por "empieza con" / "incluye" (nunca exacto: eso ya vinculó). */
  sugerenciaCatalogo: { id: string; nombre: string } | null
  /** Parece un canal de compra (eBay, Amazon…): el alta se prellena con `esMarketplace`. */
  marketplaceProbable: boolean
}

/**
 * Valores del campo `proveedor` que no son proveedores sino origen interno del Excel de
 * automatización (decisión de Emiliano, 2026-09-13). Normalizados con `normalizarNombreProveedor`.
 */
export const NOMBRES_INTERNOS_IGNORADOS: readonly string[] = [
  "almacen automatizacion",
  "linea",
  "automation",
]

export function esNombreInterno(nombreLibre: string): boolean {
  const norm = normalizarNombreProveedor(nombreLibre)
  return norm !== "" && NOMBRES_INTERNOS_IGNORADOS.includes(norm)
}

const MARKETPLACE_RE = /\b(ebay|amazon|ali\s?express|alibaba|mercado\s?libre|walmart|temu)\b/i

export function esMarketplaceProbable(nombreLibre: string): boolean {
  return MARKETPLACE_RE.test(nombreLibre)
}

export interface VinculoProveedorPendiente {
  id: string
  proveedorId: string
}

export interface AnalisisVinculacionHistorica {
  ordenes: ResultadoBackfill
  cotizaciones: ResultadoBackfill
  fantasmas: ProveedorFantasma[]
  vinculosOrdenes: VinculoProveedorPendiente[]
  vinculosCotizaciones: VinculoProveedorPendiente[]
}

type IndiceProveedores = Map<string, ProveedorCatalogoMinimo[]>

function crearIndiceProveedores(catalogo: ProveedorCatalogoMinimo[]): IndiceProveedores {
  const indice: IndiceProveedores = new Map()
  for (const proveedor of catalogo) {
    // Nombre y alias entran al mismo índice: un alias empata como exacto. Si dos proveedores
    // comparten un nombre/alias, `proveedorExacto` ve > 1 coincidencia y no vincula solo.
    const claves = new Set(
      [proveedor.nombre, ...(proveedor.aliases ?? [])].map(normalizarNombreProveedor).filter(Boolean)
    )
    for (const clave of claves) {
      const coincidencias = indice.get(clave) ?? []
      coincidencias.push(proveedor)
      indice.set(clave, coincidencias)
    }
  }
  return indice
}

function proveedorExacto(
  nombre: string,
  indice: IndiceProveedores
): ProveedorCatalogoMinimo | null {
  const normalizado = normalizarNombreProveedor(nombre)
  if (!normalizado) return null
  const coincidencias = indice.get(normalizado) ?? []
  return coincidencias.length === 1 ? coincidencias[0] : null
}

function analizarColeccion(
  documentos: DocumentoProveedorHistorico[],
  catalogo: ProveedorCatalogoMinimo[],
  indice: IndiceProveedores,
  origen: "orden" | "cotizacion",
  fantasmas: Map<string, ProveedorFantasma>
): { resultado: ResultadoBackfill; vinculos: VinculoProveedorPendiente[] } {
  const idsCatalogo = new Set(catalogo.map((proveedor) => proveedor.id))
  const resultado: ResultadoBackfill = {
    revisados: 0,
    vinculados: 0,
    sinMatch: 0,
    yaTenianId: 0,
    ignoradosInternos: 0,
  }
  const vinculos: VinculoProveedorPendiente[] = []

  for (const documento of documentos) {
    resultado.revisados++
    if (documento.proveedorId && idsCatalogo.has(documento.proveedorId)) {
      resultado.yaTenianId++
      continue
    }

    if (esNombreInterno(documento.proveedor)) {
      resultado.ignoradosInternos = (resultado.ignoradosInternos ?? 0) + 1
      continue
    }

    const match = proveedorExacto(documento.proveedor, indice)
    if (match) {
      resultado.vinculados++
      vinculos.push({ id: documento.id, proveedorId: match.id })
      continue
    }

    resultado.sinMatch++
    // Sugerencia por "empieza con" / "incluye": solo orienta al humano, nunca se aplica sola.
    const sugerido = matchProveedorPorNombre(documento.proveedor, catalogo)
    agregarFantasma(
      fantasmas,
      documento.proveedor,
      origen,
      documento.id,
      sugerido ? { id: sugerido.id, nombre: sugerido.nombre } : null
    )
  }

  return { resultado, vinculos }
}

export function analizarVinculacionHistoricaEnMemoria(
  ordenes: DocumentoProveedorHistorico[],
  cotizaciones: DocumentoProveedorHistorico[],
  catalogo: ProveedorCatalogoMinimo[]
): AnalisisVinculacionHistorica {
  const fantasmas = new Map<string, ProveedorFantasma>()
  const indice = crearIndiceProveedores(catalogo)
  const ordenesAnalisis = analizarColeccion(ordenes, catalogo, indice, "orden", fantasmas)
  const cotizacionesAnalisis = analizarColeccion(cotizaciones, catalogo, indice, "cotizacion", fantasmas)

  return {
    ordenes: ordenesAnalisis.resultado,
    cotizaciones: cotizacionesAnalisis.resultado,
    fantasmas: Array.from(fantasmas.values()).sort((a, b) => b.cantidadDocs - a.cantidadDocs),
    vinculosOrdenes: ordenesAnalisis.vinculos,
    vinculosCotizaciones: cotizacionesAnalisis.vinculos,
  }
}

export function detectarFantasmasEnMemoria(
  ordenes: DocumentoProveedorHistorico[],
  cotizaciones: DocumentoProveedorHistorico[],
  catalogo: ProveedorCatalogoMinimo[]
): ProveedorFantasma[] {
  return analizarVinculacionHistoricaEnMemoria(ordenes, cotizaciones, catalogo).fantasmas
}

function agregarFantasma(
  mapa: Map<string, ProveedorFantasma>,
  nombreLibre: string,
  origen: "orden" | "cotizacion",
  idDoc: string,
  sugerencia: { id: string; nombre: string } | null
) {
  const key = `${origen}::${nombreLibre.trim().toLowerCase()}`
  const previo = mapa.get(key)
  if (previo) {
    previo.cantidadDocs++
    if (previo.idsDocs.length < 20) previo.idsDocs.push(idDoc)
    return
  }

  mapa.set(key, {
    nombreLibre: nombreLibre.trim(),
    origen,
    cantidadDocs: 1,
    idsDocs: [idDoc],
    sugerenciaCatalogo: sugerencia,
    marketplaceProbable: esMarketplaceProbable(nombreLibre),
  })
}
