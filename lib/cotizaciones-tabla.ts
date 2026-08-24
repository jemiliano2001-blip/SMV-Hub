import type { Cotizacion, EstatusCotizacion } from "@/lib/schemas"
import { normalizar } from "@/lib/format"

export type FiltroUbicacion = "todas" | "MX" | "USA"
export type FiltroEstatus = "todos" | EstatusCotizacion
export type FiltroOrigenCotizacion = "todas" | "cotizacion" | "compra"

export type FiltrosCotizacion = {
  busqueda: string
  ubicacion: FiltroUbicacion
  estatus: FiltroEstatus
  origen?: FiltroOrigenCotizacion
}

export type ColumnaOrdenCotizacion =
  | "fecha"
  | "solicitante"
  | "proveedor"
  | "descripcion"
  | "numeroParte"
  | "cantidad"
  | "precioUnitario"
  | "total"
  | "estatus"

export type DireccionOrden = "asc" | "desc"

export type ResultadoPaginacion<T> = {
  filas: T[]
  paginaActual: number
  totalPaginas: number
  totalFilas: number
  indiceInicio: number
  indiceFin: number
}

export const TAMANO_PAGINA_COTIZACIONES = 50

const CAMPOS_BUSQUEDA = ["descripcion", "numeroParte", "proveedor", "solicitante", "notas"] as const

const ORDEN_ESTATUS: Record<EstatusCotizacion, number> = {
  cotizado: 0,
  revisar: 1,
  cancelado: 2,
}

const DIRECCION_DEFAULT: Record<ColumnaOrdenCotizacion, DireccionOrden> = {
  fecha: "desc",
  solicitante: "asc",
  proveedor: "asc",
  descripcion: "asc",
  numeroParte: "asc",
  cantidad: "desc",
  precioUnitario: "desc",
  total: "desc",
  estatus: "asc",
}

export function tokenizarBusqueda(busqueda: string): string[] {
  return busqueda
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(normalizar)
}

export function hayTokens(busqueda: string): boolean {
  return tokenizarBusqueda(busqueda).length > 0
}

function camposNormalizados(c: Cotizacion): string[] {
  return CAMPOS_BUSQUEDA.map((campo) => normalizar(c[campo] ?? ""))
}

export function filtrarCotizaciones(
  cotizaciones: Cotizacion[],
  filtros: FiltrosCotizacion
): Cotizacion[] {
  const tokens = tokenizarBusqueda(filtros.busqueda)

  return cotizaciones.filter((c) => {
    if (filtros.ubicacion !== "todas" && c.ubicacion !== filtros.ubicacion) return false
    if (filtros.estatus !== "todos" && c.estatus !== filtros.estatus) return false
    if (filtros.origen && filtros.origen !== "todas") {
      const origen = c.origen === "compra" ? "compra" : "cotizacion"
      if (origen !== filtros.origen) return false
    }

    if (tokens.length === 0) return true

    const campos = camposNormalizados(c)
    return tokens.every((token) => campos.some((campo) => campo.includes(token)))
  })
}

export function direccionDefaultColumna(columna: ColumnaOrdenCotizacion): DireccionOrden {
  return DIRECCION_DEFAULT[columna]
}

export function puntuacionRelevancia(cotizacion: Cotizacion, busqueda: string): number {
  const busquedaNorm = normalizar(busqueda.trim())
  if (!busquedaNorm) return 3

  const parte = normalizar(cotizacion.numeroParte ?? "")
  const descripcion = normalizar(cotizacion.descripcion)
  const primerToken = tokenizarBusqueda(busqueda)[0] ?? ""

  if (parte && parte === busquedaNorm) return 0
  if (parte && parte.startsWith(busquedaNorm)) return 1
  if (primerToken && descripcion.startsWith(primerToken)) return 2
  return 3
}

function compararTexto(a: string | null, b: string | null, dir: DireccionOrden): number {
  const sa = a ?? ""
  const sb = b ?? ""
  if (!sa && !sb) return 0
  if (!sa) return 1
  if (!sb) return -1
  const cmp = sa.localeCompare(sb, "es")
  return dir === "asc" ? cmp : -cmp
}

function compararNumero(
  a: number | null,
  b: number | null,
  dir: DireccionOrden
): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return dir === "asc" ? a - b : b - a
}

function compararMoneda(a: string, b: string): number {
  if (a === b) return 0
  if (a === "USD") return -1
  if (b === "USD") return 1
  return a.localeCompare(b)
}

function compararPrecio(
  a: Cotizacion,
  b: Cotizacion,
  campo: "precioUnitario" | "total",
  dir: DireccionOrden
): number {
  const monedaCmp = compararMoneda(a.moneda, b.moneda)
  if (monedaCmp !== 0) return monedaCmp
  return compararNumero(a[campo], b[campo], dir)
}

function compararPorColumna(
  a: Cotizacion,
  b: Cotizacion,
  columna: ColumnaOrdenCotizacion,
  dir: DireccionOrden
): number {
  switch (columna) {
    case "fecha":
      return compararTexto(a.fecha, b.fecha, dir)
    case "solicitante":
      return compararTexto(a.solicitante, b.solicitante, dir)
    case "proveedor":
      return compararTexto(a.proveedor, b.proveedor, dir)
    case "descripcion":
      return compararTexto(a.descripcion, b.descripcion, dir)
    case "numeroParte":
      return compararTexto(a.numeroParte, b.numeroParte, dir)
    case "cantidad":
      return compararNumero(a.cantidad, b.cantidad, dir)
    case "precioUnitario":
      return compararPrecio(a, b, "precioUnitario", dir)
    case "total":
      return compararPrecio(a, b, "total", dir)
    case "estatus": {
      const cmp = ORDEN_ESTATUS[a.estatus] - ORDEN_ESTATUS[b.estatus]
      return dir === "asc" ? cmp : -cmp
    }
    default: {
      const _exhaustive: never = columna
      return _exhaustive
    }
  }
}

export function ordenarCotizaciones(
  cotizaciones: Cotizacion[],
  columna: ColumnaOrdenCotizacion,
  direccion: DireccionOrden,
  opts?: { busqueda?: string; usarRelevancia?: boolean }
): Cotizacion[] {
  const copia = [...cotizaciones]

  copia.sort((a, b) => {
    if (opts?.usarRelevancia && opts.busqueda) {
      const rel =
        puntuacionRelevancia(a, opts.busqueda) - puntuacionRelevancia(b, opts.busqueda)
      if (rel !== 0) return rel
      const fechaDesempate = compararTexto(a.fecha, b.fecha, "desc")
      if (fechaDesempate !== 0) return fechaDesempate
    }

    return compararPorColumna(a, b, columna, direccion)
  })

  return copia
}

export function paginarCotizaciones<T>(
  items: T[],
  pagina: number,
  tamanoPagina: number
): ResultadoPaginacion<T> {
  const totalFilas = items.length

  if (totalFilas === 0) {
    return {
      filas: [],
      paginaActual: 1,
      totalPaginas: 0,
      totalFilas: 0,
      indiceInicio: 0,
      indiceFin: 0,
    }
  }

  const totalPaginas = Math.ceil(totalFilas / tamanoPagina)
  const paginaActual = Math.min(Math.max(1, pagina), totalPaginas)
  const inicio = (paginaActual - 1) * tamanoPagina
  const fin = Math.min(inicio + tamanoPagina, totalFilas)

  return {
    filas: items.slice(inicio, fin),
    paginaActual,
    totalPaginas,
    totalFilas,
    indiceInicio: inicio + 1,
    indiceFin: fin,
  }
}
