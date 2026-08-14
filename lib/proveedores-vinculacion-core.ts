import { normalizarNombreProveedor } from "@/lib/pieza-matching"

export interface DocumentoProveedorHistorico {
  id: string
  proveedor: string
  proveedorId?: string | null
}

export interface ProveedorCatalogoMinimo {
  id: string
  nombre: string
}

export interface ResultadoBackfill {
  revisados: number
  vinculados: number
  sinMatch: number
  yaTenianId: number
}

export interface ProveedorFantasma {
  nombreLibre: string
  origen: "orden" | "cotizacion"
  cantidadDocs: number
  /** Se limita a 20 para que una corrección manual sea una operación acotada. */
  idsDocs: string[]
  sugerenciaCatalogo: { id: string; nombre: string } | null
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
    const nombre = normalizarNombreProveedor(proveedor.nombre)
    if (!nombre) continue
    const coincidencias = indice.get(nombre) ?? []
    coincidencias.push(proveedor)
    indice.set(nombre, coincidencias)
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
  }
  const vinculos: VinculoProveedorPendiente[] = []

  for (const documento of documentos) {
    resultado.revisados++
    if (documento.proveedorId && idsCatalogo.has(documento.proveedorId)) {
      resultado.yaTenianId++
      continue
    }

    const match = proveedorExacto(documento.proveedor, indice)
    if (match) {
      resultado.vinculados++
      vinculos.push({ id: documento.id, proveedorId: match.id })
      continue
    }

    resultado.sinMatch++
    agregarFantasma(fantasmas, documento.proveedor, origen, documento.id, null)
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
  })
}
