import type { EstadoOrden, ItemFactura, ExtraccionInvoice } from "@/lib/schemas"
import { crearOrdenesLote, type NuevaOrdenPayload } from "@/lib/ordenes"

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface FilaParseada {
  indice: number
  datos: NuevaOrdenPayload & { estado: EstadoOrden }
  errores: string[]
  advertencias: string[]
  seleccionada: boolean
}

export interface ResultadoCSV {
  filas: FilaParseada[]
  error: string | null
}

// ── Alias de columnas → nombre de campo ──────────────────────────────────────

const ALIAS: Record<string, string> = {
  "estado": "estado",
  "estado del pedido": "estado",
  "fecha": "fechaFactura",
  "fecha del pedido": "fechaFactura",
  "proveedor": "proveedor",
  "cantidad": "cantidad",
  "descripcion": "descripcion",
  "descripción": "descripcion",
  "link": "linkProveedor",
  "fecha entrega": "fechaEntrega",
  "fecha de entrega": "fechaEntrega",
  "guia": "fechaEntrega",
  "guía": "fechaEntrega",
  "requisitor": "requisitor",
  "orden de trabajo": "ordenTrabajo",
  "empresa": "empresa",
  "cuenta cargo": "cuentaCargo",
  "cuenta de cargo": "cuentaCargo",
  "destino": "destino",
}

const COLUMNAS_REQUERIDAS = ["proveedor", "requisitor", "ordenTrabajo", "empresa"]

// ── Validación de campos obligatorios (compartida por CSV y capturas) ─────────

// Recalcula los errores bloqueantes de una fila a partir de sus campos obligatorios.
// Usado por mapearFila, mapearExtraccion y la edición en vivo del preview.
export function erroresRequeridos(datos: {
  proveedor: string
  requisitor: string
  ordenTrabajo: string
  empresa: string
}): string[] {
  const errores: string[] = []
  if (!datos.proveedor.trim()) errores.push("Proveedor vacío")
  if (!datos.requisitor.trim()) errores.push("Requisitor vacío")
  if (!datos.ordenTrabajo.trim()) errores.push("Orden de trabajo vacía")
  if (!datos.empresa.trim()) errores.push("Empresa vacía")
  return errores
}

// ── parsearCSVTexto ───────────────────────────────────────────────────────────

export function parsearCSVTexto(texto: string): string[][] {
  const lineas = texto.split(/\r?\n/).filter(l => l.trim() !== "")
  return lineas.map(linea => {
    const campos: string[] = []
    let i = 0
    while (i < linea.length) {
      if (linea[i] === '"') {
        let campo = ""
        i++
        while (i < linea.length) {
          if (linea[i] === '"' && linea[i + 1] === '"') {
            campo += '"'
            i += 2
          } else if (linea[i] === '"') {
            i++
            break
          } else {
            campo += linea[i++]
          }
        }
        campos.push(campo)
        if (linea[i] === ",") i++
      } else {
        const fin = linea.indexOf(",", i)
        if (fin === -1) {
          campos.push(linea.slice(i).trim())
          break
        }
        campos.push(linea.slice(i, fin).trim())
        i = fin + 1
      }
    }
    return campos
  })
}

// ── detectarColumnas ──────────────────────────────────────────────────────────

export function detectarColumnas(headers: string[]): Record<string, number> {
  const resultado: Record<string, number> = {}
  headers.forEach((h, i) => {
    const campo = ALIAS[h.trim().toLowerCase()]
    if (campo) resultado[campo] = i
  })
  return resultado
}

// ── Mapa de estado ────────────────────────────────────────────────────────────

const MAPA_ESTADO: Record<string, EstadoOrden> = {
  pendiente: "pendiente",
  pending: "pendiente",
  aprobada: "aprobada",
  aprobado: "aprobada",
  approved: "aprobada",
  rechazada: "rechazada",
  rechazado: "rechazada",
  rejected: "rechazada",
}

// Rechaza esquemas no-http(s) para prevenir XSS vía javascript: URIs
function sanitizarUrl(raw: string): string | null {
  if (!raw) return null
  try {
    const proto = new URL(raw).protocol
    return /^https?:$/i.test(proto) ? raw : null
  } catch {
    return null
  }
}

// ── mapearFila ────────────────────────────────────────────────────────────────

export function mapearFila(
  celdas: string[],
  colIdx: Record<string, number>,
  indice: number
): FilaParseada {
  const get = (campo: string) =>
    colIdx[campo] !== undefined ? (celdas[colIdx[campo]] ?? "").trim() : ""

  const advertencias: string[] = []

  const proveedor = get("proveedor")
  const requisitor = get("requisitor")
  const ordenTrabajo = get("ordenTrabajo")
  const empresa = get("empresa")

  const errores = erroresRequeridos({ proveedor, requisitor, ordenTrabajo, empresa })

  const estadoRaw = get("estado").toLowerCase()
  let estado: EstadoOrden = "pendiente"
  if (estadoRaw) {
    const mapeado = MAPA_ESTADO[estadoRaw]
    if (mapeado) {
      estado = mapeado
    } else {
      advertencias.push(`Estado "${get("estado")}" no reconocido — se usará "pendiente"`)
    }
  }

  const cantidadStr = get("cantidad")
  let cantidad: number | null = null
  if (cantidadStr !== "") {
    const n = Number(cantidadStr)
    if (isNaN(n)) {
      advertencias.push(`Cantidad "${cantidadStr}" no es un número — se usará null`)
    } else {
      cantidad = n
    }
  }

  const items: ItemFactura[] = [
    {
      descripcion: get("descripcion"),
      cantidad,
      precioUnitario: null,
      total: null,
    },
  ]

  return {
    indice,
    datos: {
      proveedor,
      numeroFactura: null,
      fechaFactura: get("fechaFactura") || null,
      moneda: "USD",
      subtotal: null,
      impuestos: null,
      total: null,
      items,
      requisitor,
      ordenTrabajo,
      empresa,
      cuentaCargo: get("cuentaCargo"),
      destino: get("destino"),
      linkProveedor: sanitizarUrl(get("linkProveedor")),
      fechaEntrega: get("fechaEntrega") || null,
      estado,
    },
    errores,
    advertencias,
    seleccionada: true,
  }
}

// ── mapearExtraccion (capturas) ───────────────────────────────────────────────

// Convierte una extracción de IA en una FilaParseada lista para el preview.
// Los campos manuales (requisitor, ordenTrabajo, empresa) no salen de una factura,
// por eso quedan vacíos y generan errores bloqueantes hasta que el usuario los
// complete (típicamente con "aplicar a todas").
export function mapearExtraccion(
  extraccion: ExtraccionInvoice,
  indice: number
): FilaParseada {
  const datos = {
    proveedor: extraccion.proveedor,
    numeroFactura: extraccion.numeroFactura,
    fechaFactura: extraccion.fechaFactura,
    moneda: extraccion.moneda,
    subtotal: extraccion.subtotal,
    impuestos: extraccion.impuestos,
    total: extraccion.total,
    items: extraccion.items,
    requisitor: "",
    ordenTrabajo: "",
    empresa: "",
    cuentaCargo: "",
    destino: "",
    linkProveedor: null,
    fechaEntrega: null,
    estado: "pendiente" as EstadoOrden,
  }

  const errores = erroresRequeridos(datos)

  return {
    indice,
    datos,
    errores,
    advertencias: [],
    seleccionada: errores.length === 0,
  }
}

// ── procesarCSV ───────────────────────────────────────────────────────────────

export function procesarCSV(texto: string): ResultadoCSV {
  const matriz = parsearCSVTexto(texto)
  if (matriz.length < 2) {
    return { filas: [], error: "El CSV no tiene datos (se necesita al menos una fila de encabezado y una de datos)" }
  }

  const [headers, ...filas] = matriz
  const colIdx = detectarColumnas(headers)

  const faltantes = COLUMNAS_REQUERIDAS.filter(c => colIdx[c] === undefined)
  if (faltantes.length > 0) {
    return { filas: [], error: `Columnas requeridas no encontradas: ${faltantes.join(", ")}` }
  }

  return {
    filas: filas.map((celdas, i) => mapearFila(celdas, colIdx, i)),
    error: null,
  }
}

// ── importarOrdenes ───────────────────────────────────────────────────────────

export async function importarOrdenes(
  filas: FilaParseada[],
  onProgreso?: (completadas: number, total: number) => void
): Promise<{ importadas: number }> {
  const validas = filas.filter(f => f.seleccionada && f.errores.length === 0)
  const importadas = await crearOrdenesLote(
    validas.map(f => f.datos),
    onProgreso
  )
  return { importadas }
}
