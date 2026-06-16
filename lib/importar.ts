import type { EstadoOrden, ItemFactura } from "@/lib/schemas"
import { crearOrden, type NuevaOrdenPayload } from "@/lib/ordenes"

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
}

const COLUMNAS_REQUERIDAS = ["proveedor", "requisitor", "ordenTrabajo", "empresa"]

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

  const errores: string[] = []
  const advertencias: string[] = []

  const proveedor = get("proveedor")
  const requisitor = get("requisitor")
  const ordenTrabajo = get("ordenTrabajo")
  const empresa = get("empresa")

  if (!proveedor) errores.push("Proveedor vacío")
  if (!requisitor) errores.push("Requisitor vacío")
  if (!ordenTrabajo) errores.push("Orden de trabajo vacía")
  if (!empresa) errores.push("Empresa vacía")

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
      linkProveedor: sanitizarUrl(get("linkProveedor")),
      fechaEntrega: get("fechaEntrega") || null,
      estado,
    },
    errores,
    advertencias,
    seleccionada: true,
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
  const LOTE = 10
  let importadas = 0

  for (let i = 0; i < validas.length; i += LOTE) {
    const lote = validas.slice(i, i + LOTE)
    await Promise.all(lote.map(f => crearOrden(f.datos)))
    importadas += lote.length
    onProgreso?.(importadas, validas.length)
  }

  return { importadas }
}
