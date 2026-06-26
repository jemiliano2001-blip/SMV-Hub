import type { EstatusCotizacion, Ubicacion } from "@/lib/schemas"
import {
  parsearCSVTexto,
  normalizarFecha,
  sanitizarUrl,
  type FilaImport,
  type ResultadoImport,
} from "@/lib/importar"
import {
  crearCotizacionesLote,
  claveDedupCotizacion,
  type NuevaCotizacionPayload,
} from "@/lib/cotizaciones"

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type FilaCotizacion = FilaImport<NuevaCotizacionPayload>
export type ResultadoCSVCotizaciones = ResultadoImport<NuevaCotizacionPayload>

// ── Alias de columnas (header del Sheet → campo) ─────────────────────────────

const ALIAS: Record<string, string> = {
  "columna 1": "solicitante",
  "solicitante": "solicitante",
  "ingeniero": "solicitante",
  "quien pide": "solicitante",
  "quién pide": "solicitante",
  "fecha": "fecha",
  "estatus": "estatus",
  "estado": "estatus",
  "ubicacion": "ubicacion",
  "ubicación": "ubicacion",
  "proveedor": "proveedor",
  "descripcion": "descripcion",
  "descripción": "descripcion",
  "no. de parte": "numeroParte",
  "no de parte": "numeroParte",
  "numero de parte": "numeroParte",
  "número de parte": "numeroParte",
  "no. parte": "numeroParte",
  "parte": "numeroParte",
  "cantidad": "cantidad",
  "precio en dolares": "precioDolares",
  "precio en dólares": "precioDolares",
  "precio dolares": "precioDolares",
  "precio dólares": "precioDolares",
  "precio unit mx": "precioMx",
  "precio unitario mx": "precioMx",
  "precio mx": "precioMx",
  "total": "total",
  "dias habiles": "diasHabiles",
  "días hábiles": "diasHabiles",
  "dias hábiles": "diasHabiles",
  "días habiles": "diasHabiles",
  "link": "link",
  "notas": "notas",
}

const COLUMNAS_REQUERIDAS = ["proveedor", "descripcion"]

const MAPA_ESTATUS: Record<string, EstatusCotizacion> = {
  cotizado: "cotizado",
  cotizada: "cotizado",
  cancelado: "cancelado",
  cancelada: "cancelado",
  revisar: "revisar",
  "por revisar": "revisar",
  pendiente: "revisar",
}

export function erroresRequeridosCotizacion(datos: {
  proveedor: string
  descripcion: string
}): string[] {
  const errores: string[] = []
  if (!datos.proveedor.trim()) errores.push("Proveedor vacío")
  if (!datos.descripcion.trim()) errores.push("Descripción vacía")
  return errores
}

// ── Helpers de parseo ─────────────────────────────────────────────────────────

export function detectarColumnasCotizacion(headers: string[]): Record<string, number> {
  const resultado: Record<string, number> = {}
  headers.forEach((h, i) => {
    const campo = ALIAS[h.trim().toLowerCase()]
    if (campo) resultado[campo] = i
  })
  return resultado
}

// Convierte un monto del Sheet a número, tolerando símbolo de moneda y ambos
// formatos: es-MX ("$2.340,00" → 2340) y crudo del export CSV ("2340.5", "10").
// Es frontera de confianza financiera, por eso no se simplifica.
export function parsearMonto(raw: string): number | null {
  let s = (raw ?? "").replace(/[^\d.,-]/g, "").trim()
  if (!s) return null

  const tieneComa = s.includes(",")
  const tienePunto = s.includes(".")

  if (tieneComa && tienePunto) {
    // El separador más a la derecha es el decimal.
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".") // es-MX: punto=miles, coma=decimal
    } else {
      s = s.replace(/,/g, "") // en-US: coma=miles, punto=decimal
    }
  } else if (tieneComa) {
    const partes = s.split(",")
    // "130,00" (2 decimales) → decimal; "1,300" → miles.
    s = partes.length === 2 && partes[1].length === 2
      ? partes[0] + "." + partes[1]
      : s.replace(/,/g, "")
  }

  const n = Number(s)
  return isNaN(n) ? null : n
}

function redondear2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// ── mapearFilaCotizacion ──────────────────────────────────────────────────────

export function mapearFilaCotizacion(
  celdas: string[],
  colIdx: Record<string, number>,
  indice: number
): FilaCotizacion {
  const get = (campo: string) =>
    colIdx[campo] !== undefined ? (celdas[colIdx[campo]] ?? "").trim() : ""

  const advertencias: string[] = []

  const proveedor = get("proveedor")
  const descripcion = get("descripcion")
  const errores = erroresRequeridosCotizacion({ proveedor, descripcion })

  // Estatus
  const estatusRaw = get("estatus").toLowerCase()
  let estatus: EstatusCotizacion = "cotizado"
  if (estatusRaw) {
    const mapeado = MAPA_ESTATUS[estatusRaw]
    if (mapeado) estatus = mapeado
    else advertencias.push(`Estatus "${get("estatus")}" no reconocido — se usará "cotizado"`)
  }

  // Precios crudos de ambas columnas
  const precioDolares = parsearMonto(get("precioDolares"))
  const precioMx = parsearMonto(get("precioMx"))

  // Ubicación: explícita o inferida (si hay precio en dólares → USA, si no → MX)
  const ubicacionRaw = get("ubicacion").toUpperCase()
  let ubicacion: Ubicacion
  if (["USA", "US", "EUA", "EE.UU.", "USD"].includes(ubicacionRaw)) {
    ubicacion = "USA"
  } else if (["MX", "MEX", "MÉXICO", "MEXICO", "MXN"].includes(ubicacionRaw)) {
    ubicacion = "MX"
  } else {
    if (ubicacionRaw) advertencias.push(`Ubicación "${get("ubicacion")}" no reconocida — se infirió ${precioDolares !== null ? "USA" : "MX"}`)
    ubicacion = precioDolares !== null ? "USA" : "MX"
  }

  // Moneda estricta según ubicación; el precio se toma de la columna que coincide
  // con esa moneda. ponytail: sin fallback cruzado — meter pesos en un registro
  // USD rompería la regla de no mezclar monedas (y el monto saldría ~18× mal).
  const moneda: "USD" | "MXN" = ubicacion === "USA" ? "USD" : "MXN"
  const precioUnitario = ubicacion === "USA" ? precioDolares : precioMx

  // Cantidad: extrae el número aunque venga "1 pz."
  const cantidadRaw = get("cantidad")
  let cantidad: number | null = null
  if (cantidadRaw) {
    const m = cantidadRaw.match(/[\d.,]+/)
    const n = m ? parsearMonto(m[0]) : null
    if (n !== null) cantidad = n
    else advertencias.push(`Cantidad "${cantidadRaw}" no numérica — se usará null`)
  }

  // Total: se recalcula en la moneda canónica (se ignora la columna "Total" del
  // Sheet, que mezcla MXN aun en filas USA).
  const total =
    cantidad !== null && precioUnitario !== null
      ? redondear2(cantidad * precioUnitario)
      : null

  return {
    indice,
    datos: {
      solicitante: get("solicitante"),
      fecha: normalizarFecha(get("fecha")),
      estatus,
      ubicacion,
      proveedor,
      descripcion,
      numeroParte: get("numeroParte") || null,
      cantidad,
      precioUnitario,
      moneda,
      total,
      diasHabiles: get("diasHabiles") || null,
      link: sanitizarUrl(get("link")),
      notas: get("notas") || null,
    },
    errores,
    advertencias,
    seleccionada: errores.length === 0,
  }
}

// ── procesarCSVCotizaciones ───────────────────────────────────────────────────

export function procesarCSVCotizaciones(texto: string): ResultadoCSVCotizaciones {
  const matriz = parsearCSVTexto(texto)
  if (matriz.length < 2) {
    return {
      filas: [],
      error: "El CSV no tiene datos (se necesita al menos una fila de encabezado y una de datos)",
      columnasDetectadas: [],
    }
  }

  const [headers, ...filas] = matriz
  const colIdx = detectarColumnasCotizacion(headers)

  const faltantes = COLUMNAS_REQUERIDAS.filter((c) => colIdx[c] === undefined)
  if (faltantes.length > 0) {
    return {
      filas: [],
      error: `Columnas requeridas no encontradas: ${faltantes.join(", ")}`,
      columnasDetectadas: [],
    }
  }

  return {
    filas: filas.map((celdas, i) => mapearFilaCotizacion(celdas, colIdx, i)),
    error: null,
    columnasDetectadas: Object.keys(colIdx),
  }
}

// ── verificarDuplicadosCotizacion ─────────────────────────────────────────────

// Marca filas cuya clave (fecha+proveedor+descripción+no.parte) ya existe en
// Firestore. `claves` viene de clavesExistentes() en lib/cotizaciones.ts.
export function verificarDuplicadosCotizacion(
  filas: FilaCotizacion[],
  claves: Set<string>
): Array<{ indice: number; motivo: string }> {
  return filas
    .filter((f) => claves.has(claveDedupCotizacion(f.datos)))
    .map((f) => ({
      indice: f.indice,
      motivo: `${f.datos.proveedor} / ${f.datos.descripcion}`,
    }))
}

// ── importarCotizaciones ──────────────────────────────────────────────────────

export async function importarCotizaciones(
  filas: FilaCotizacion[],
  onProgreso?: (completadas: number, total: number) => void
): Promise<{ importadas: number }> {
  const validas = filas.filter((f) => f.seleccionada && f.errores.length === 0)
  const importadas = await crearCotizacionesLote(
    validas.map((f) => f.datos),
    onProgreso
  )
  return { importadas }
}
