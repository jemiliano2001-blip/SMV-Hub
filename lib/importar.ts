import type { EstadoOrden, ItemFactura, ExtraccionInvoice } from "@/lib/schemas"
import { sincronizarCamposLegacyOrden } from "@/lib/schemas"
import { crearOrdenesLote, type NuevaOrdenPayload } from "@/lib/ordenes"
import { validarCuadreFactura, validarImpuestoTexas } from "@/lib/factura-montos"
import { normalizarClaveProdServ } from "@/lib/sat/normalizar"

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface FilaImport<T> {
  indice: number
  datos: T
  errores: string[]
  advertencias: string[]
  seleccionada: boolean
}

export interface ResultadoImport<T> {
  filas: FilaImport<T>[]
  error: string | null
  columnasDetectadas: string[]
}

export type FilaParseada = FilaImport<NuevaOrdenPayload & { estado: EstadoOrden }>
export type ResultadoCSV = ResultadoImport<NuevaOrdenPayload & { estado: EstadoOrden }>

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
  "id de pedido": "idPedido",
  "link": "linkProveedor",
  "fecha entrega": "fechaEntrega",
  "fecha de entrega": "fechaEntrega",
  "guia": "fechaEntrega",
  "guía": "fechaEntrega",
  "entrega": "fechaEntrega",
  "orden_trabajo": "ordenTrabajo",
  "precio_unitario": "precioUnitario",
  "precio por articulo": "precioUnitario",
  "precio por artículo": "precioUnitario",
  "total": "totalLinea",
  "total de linea": "totalLinea",
  "total de línea": "totalLinea",
  "moneda": "moneda",
  "requisitor": "requisitor",
  "orden de trabajo": "ordenTrabajo",
  "empresa": "empresa",
  "codigo": "claveProdServ",
  "código": "claveProdServ",
  "codigo sat": "claveProdServ",
  "código sat": "claveProdServ",
  "clave sat": "claveProdServ",
  "clave prod serv": "claveProdServ",
  "cuenta cargo": "cuentaCargo",
  "cuenta de cargo": "cuentaCargo",
  "destino": "destino",
}

const COLUMNAS_REQUERIDAS = ["proveedor", "requisitor", "empresa"]

// ── Validación de campos obligatorios (compartida por CSV y capturas) ─────────

// Recalcula los errores bloqueantes de una fila a partir de sus campos obligatorios.
// Usado por mapearFila, mapearExtraccion y la edición en vivo del preview.
export function erroresRequeridos(datos: {
  proveedor: string
  items: ItemFactura[]
}): string[] {
  const errores: string[] = []
  if (!datos.proveedor.trim()) errores.push("Proveedor vacío")
  if (datos.items.length === 0) {
    errores.push("Sin ítems")
    return errores
  }
  datos.items.forEach((item, i) => {
    const suf = datos.items.length > 1 ? ` (ítem ${i + 1})` : ""
    if (!item.requisitor?.trim()) errores.push(`Requisitor vacío${suf}`)
    if (!item.empresa?.trim()) errores.push(`Empresa vacía${suf}`)
  })
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
export function sanitizarUrl(raw: string): string | null {
  if (!raw) return null
  try {
    const proto = new URL(raw).protocol
    return /^https?:$/i.test(proto) ? raw : null
  } catch {
    return null
  }
}

// Infiere la empresa a partir del nombre del proveedor cuando el CSV no la trae.
// McMaster no tiene regla fija (se compra para varias empresas).
function inferirEmpresa(proveedor: string): string {
  const p = proveedor.toLowerCase()
  if (/digi.?key|mouser/.test(p)) return 'SilTech'
  return ''
}

// D/M/YYYY o DD/MM/YYYY (Gemini / Google Sheets) → YYYY-MM-DD (formato app)
export function normalizarFecha(f: string): string | null {
  if (!f) return null
  const m = f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`
  return f || null
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
  const empresa = get("empresa") || inferirEmpresa(proveedor)
  const cuentaCargo = get("cuentaCargo")
  const destinoRaw = get("destino")

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

  const parsearMonto = (campo: string): number | null => {
    const v = get(campo)
    if (!v) return null
    const n = Number(v)
    return isNaN(n) ? null : n
  }

  const precioUnitario = parsearMonto("precioUnitario")
  const totalLinea = parsearMonto("totalLinea")
  const moneda = get("moneda") || "USD"
  const claveProdServ = normalizarClaveProdServ(get("claveProdServ"))

  const items: ItemFactura[] = [
    {
      descripcion: get("descripcion"),
      cantidad,
      precioUnitario,
      total: totalLinea,
      claveProdServ,
      satPendiente: claveProdServ === null,
      requisitor,
      ordenTrabajo,
      empresa: empresa || destinoRaw,
      cuentaCargo,
    },
  ]

  const errores = erroresRequeridos({ proveedor, items })

  const datosBase = {
    proveedor,
    numeroFactura: null,
    fechaFactura: normalizarFecha(get("fechaFactura")),
    moneda,
    subtotal: totalLinea,
    envio: null,
    impuestos: null,
    total: totalLinea,
    items,
    requisitor: "",
    ordenTrabajo: "",
    empresa: "",
    cuentaCargo: "",
    destino: "",
    linkProveedor: sanitizarUrl(get("linkProveedor")),
    fechaEntrega: get("fechaEntrega") || null,
    estado,
  }

  return {
    indice,
    datos: sincronizarCamposLegacyOrden(datosBase),
    errores,
    advertencias,
    seleccionada: true,
  }
}

// ── mapearExtraccion (capturas) ───────────────────────────────────────────────

export function advertenciasMontosFactura(datos: {
  subtotal: number | null
  envio: number | null
  impuestos: number | null
  total: number | null
}): string[] {
  const adv: string[] = []
  const cuadre = validarCuadreFactura(datos)
  if (!cuadre.cuadra && cuadre.mensaje) {
    adv.push(`Montos no cuadran: ${cuadre.mensaje}`)
  }
  const tax = validarImpuestoTexas(datos)
  if (!tax.coherente && tax.mensaje) {
    adv.push(tax.mensaje)
  }
  return adv
}

// Convierte una extracción de IA en una FilaParseada lista para el preview.
// La IA puede llenar empresa/cuentaCargo por ítem (Your reference); requisitor
// queda vacío hasta que el usuario lo complete línea por línea.
export function mapearExtraccion(
  extraccion: ExtraccionInvoice,
  indice: number
): FilaParseada {
  const items = extraccion.items.map((item) => ({
    ...item,
    claveProdServ: normalizarClaveProdServ(item.claveProdServ),
    satPendiente: normalizarClaveProdServ(item.claveProdServ) === null,
    empresa: item.empresa ?? "",
    cuentaCargo: item.cuentaCargo ?? "",
    requisitor: item.requisitor ?? "",
    ordenTrabajo: item.ordenTrabajo ?? "",
  }))

  const datos = sincronizarCamposLegacyOrden({
    proveedor: extraccion.proveedor,
    numeroFactura: extraccion.numeroFactura,
    fechaFactura: extraccion.fechaFactura,
    moneda: extraccion.moneda,
    subtotal: extraccion.subtotal,
    envio: extraccion.envio ?? null,
    impuestos: extraccion.impuestos,
    total: extraccion.total,
    items,
    requisitor: "",
    ordenTrabajo: "",
    empresa: "",
    cuentaCargo: "",
    destino: "",
    linkProveedor: null,
    fechaEntrega: null,
    estado: "pendiente" as EstadoOrden,
  })

  const errores = erroresRequeridos(datos)
  const advertencias = advertenciasMontosFactura(datos)

  return {
    indice,
    datos,
    errores,
    advertencias,
    seleccionada: errores.length === 0,
  }
}

// ── procesarCSV ───────────────────────────────────────────────────────────────

export function procesarCSV(texto: string): ResultadoCSV {
  const matriz = parsearCSVTexto(texto)
  if (matriz.length < 2) {
    return { filas: [], error: "El CSV no tiene datos (se necesita al menos una fila de encabezado y una de datos)", columnasDetectadas: [] }
  }

  const [headers, ...filas] = matriz
  const colIdx = detectarColumnas(headers)

  const faltantes = COLUMNAS_REQUERIDAS.filter(c => colIdx[c] === undefined)
  if (faltantes.length > 0) {
    return { filas: [], error: `Columnas requeridas no encontradas: ${faltantes.join(", ")}`, columnasDetectadas: [] }
  }

  return {
    filas: filas.map((celdas, i) => mapearFila(celdas, colIdx, i)),
    error: null,
    columnasDetectadas: Object.keys(colIdx),
  }
}

// ── deduplicación por numeroFactura + proveedor ───────────────────────────────

export type ParFacturaProveedor = { numeroFactura: string | null; proveedor: string }

export function claveFacturaProveedor(numeroFactura: string, proveedor: string): string {
  return `${numeroFactura.trim().toLowerCase()}|${proveedor.trim().toLowerCase()}`
}

function clavesExistentesSet(existentes: ParFacturaProveedor[]): Set<string> {
  return new Set(
    existentes
      .filter((e) => e.numeroFactura !== null && e.numeroFactura.trim() !== "")
      .map((e) => claveFacturaProveedor(e.numeroFactura!, e.proveedor))
  )
}

export function esOrdenDuplicada(
  numeroFactura: string | null | undefined,
  proveedor: string,
  existentes: ParFacturaProveedor[]
): boolean {
  if (!numeroFactura?.trim()) return false
  const clave = claveFacturaProveedor(numeroFactura, proveedor)
  return clavesExistentesSet(existentes).has(clave)
}

export function verificarDuplicados(
  filas: FilaParseada[],
  existentes: ParFacturaProveedor[]
): Array<{ indice: number; motivo: string }> {
  const set = clavesExistentesSet(existentes)
  return filas
    .filter((f) => f.datos.numeroFactura !== null && f.datos.numeroFactura.trim() !== "")
    .filter((f) => set.has(claveFacturaProveedor(f.datos.numeroFactura!, f.datos.proveedor)))
    .map((f) => ({
      indice: f.indice,
      motivo: `${f.datos.proveedor} / factura ${f.datos.numeroFactura}`,
    }))
}

// Repeticiones dentro del mismo lote (misma factura+proveedor en varias filas).
export function verificarDuplicadosEnLote(
  filas: FilaParseada[]
): Array<{ indice: number; motivo: string }> {
  const visto = new Set<string>()
  const duplicados: Array<{ indice: number; motivo: string }> = []

  for (const fila of filas) {
    const nf = fila.datos.numeroFactura
    if (!nf?.trim()) continue
    const clave = claveFacturaProveedor(nf, fila.datos.proveedor)
    if (visto.has(clave)) {
      duplicados.push({
        indice: fila.indice,
        motivo: `${fila.datos.proveedor} / factura ${nf} (repetida en este lote)`,
      })
    } else {
      visto.add(clave)
    }
  }

  return duplicados
}

export function combinarDuplicados(
  ...listas: Array<Array<{ indice: number; motivo: string }>>
): Array<{ indice: number; motivo: string }> {
  const porIndice = new Map<number, string>()
  for (const lista of listas) {
    for (const dup of lista) {
      if (!porIndice.has(dup.indice)) porIndice.set(dup.indice, dup.motivo)
    }
  }
  return Array.from(porIndice.entries()).map(([indice, motivo]) => ({ indice, motivo }))
}

// ── importarOrdenes ───────────────────────────────────────────────────────────

export async function importarOrdenes(
  filas: FilaParseada[],
  onProgreso?: (completadas: number, total: number) => void
): Promise<{ importadas: number }> {
  const validas = filas.filter(f => f.seleccionada && f.errores.length === 0)
  const importadas = await crearOrdenesLote(
    validas.map(f => sincronizarCamposLegacyOrden(f.datos)),
    onProgreso
  )
  return { importadas }
}
