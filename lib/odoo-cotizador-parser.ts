import type { PartidaCotizacionOdoo } from "@/lib/schemas"

export interface ValoresPorDefectoPartida {
  requisitor?: string
  empresa?: string
  uso?: string
  udm?: string
  impuesto?: string
  tasaIva?: number
}

export interface ResultadoParseoExcel {
  partidas: PartidaCotizacionOdoo[]
  totalFilasLeidas: number
  filasOmitidas: number
  advertencias: string[]
}

/**
 * Normaliza strings numéricos provenientes de Excel/Google Sheets.
 * Soporta formatos como "$1,234.50", "1234,50", "  $ 0.52 ", "(100)"
 */
export function limpiarNumero(valor: unknown): number {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : 0
  }
  if (!valor || typeof valor !== "string") {
    return 0
  }

  let limpio = valor.trim().replace(/[$ \t\r\n]/g, "")
  if (!limpio) return 0

  // Si tiene paréntesis ej. (50) considerar negativo o positivo según caso
  if (limpio.startsWith("(") && limpio.endsWith(")")) {
    limpio = `-${limpio.slice(1, -1)}`
  }

  // Detectar formato con comas de miles y punto decimal: "1,234.56"
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(limpio)) {
    limpio = limpio.replace(/,/g, "")
  } else if (/^-?\d+(,\d+)?$/.test(limpio) && !limpio.includes(".")) {
    // Caso "12,50" -> 12.50
    limpio = limpio.replace(/,/g, ".")
  } else {
    // Quitar comas residuales
    limpio = limpio.replace(/,/g, "")
  }

  const num = Number.parseFloat(limpio)
  return Number.isFinite(num) ? num : 0
}

const TERMINOS_ENCABEZADO = [
  "partida",
  "no",
  "no.",
  "pos",
  "item",
  "clave",
  "codigo",
  "código",
  "sku",
  "pn",
  "p/n",
  "descrip",
  "descripcion",
  "descripción",
  "concepto",
  "producto",
  "cant",
  "cantidad",
  "qty",
  "ctd",
  "precio",
  "unitario",
  "p.u.",
  "p.u",
  "costo",
  "importe",
  "subtotal",
  "total",
  "udm",
  "unidad",
  "uom",
  "requisitor",
  "solicitante",
  "empresa",
  "destino",
  "uso",
  "cuenta",
  "cargo",
]

/**
 * Detecta si una fila es de encabezados evaluando celda por celda.
 * Requiere al menos 2 coincidencias de términos de encabezado
 * y descarta la fila si 2 o más celdas son numéricas positivas (> 0).
 */
function esFilaEncabezado(celdas: string[]): boolean {
  if (!celdas || celdas.length === 0) return false

  // Refuerzo: si 2 o más celdas son números estrictos > 0, es fila de datos
  let conteoNumeros = 0
  for (const c of celdas) {
    const texto = c.trim()
    if (/^\$?\s*-?\d+(?:[.,]\d+)?\s*%?$/.test(texto)) {
      if (limpiarNumero(texto) > 0) {
        conteoNumeros++
      }
    }
  }
  if (conteoNumeros >= 2) {
    return false
  }

  // Evaluar coincidencias de encabezado celda por celda
  let coincidencias = 0
  for (const celda of celdas) {
    const normalizada = celda.trim().toLowerCase()
    if (!normalizada) continue

    const esTermino = TERMINOS_ENCABEZADO.some((t) => {
      return (
        normalizada === t ||
        normalizada.startsWith(`${t} `) ||
        normalizada.endsWith(` ${t}`) ||
        normalizada === `# ${t}` ||
        (t.length >= 5 && normalizada.includes(t))
      )
    })

    if (esTermino) {
      coincidencias++
    }
  }

  return coincidencias >= 2
}

interface MapeoColumnas {
  idxPartida: number
  idxClave: number
  idxDescripcion: number
  idxCantidad: number
  idxPrecio: number
  idxImporte: number
  idxUdm: number
  idxRequisitor: number
  idxEmpresa: number
  idxUso: number
}

function deducirMapeoPorEncabezados(encabezados: string[]): MapeoColumnas {
  const mapeo: MapeoColumnas = {
    idxPartida: -1,
    idxClave: -1,
    idxDescripcion: -1,
    idxCantidad: -1,
    idxPrecio: -1,
    idxImporte: -1,
    idxUdm: -1,
    idxRequisitor: -1,
    idxEmpresa: -1,
    idxUso: -1,
  }

  encabezados.forEach((raw, i) => {
    const h = raw.trim().toLowerCase()
    if (!h) return

    if (h === "#" || h === "no" || h === "no." || h.includes("partida") || h === "pos") {
      mapeo.idxPartida = i
    } else if (h.includes("clave") || h.includes("codigo") || h.includes("código") || h === "sku" || h === "pn" || h === "p/n") {
      mapeo.idxClave = i
    } else if (h.includes("descrip") || h.includes("concepto") || h.includes("producto") || h === "item") {
      mapeo.idxDescripcion = i
    } else if (h.includes("cant") || h === "qty" || h === "ctd") {
      mapeo.idxCantidad = i
    } else if (h.includes("precio") || h.includes("unitario") || h === "p.u." || h === "p.u" || h === "costo") {
      mapeo.idxPrecio = i
    } else if (h.includes("importe") || h.includes("subtotal") || h === "total") {
      mapeo.idxImporte = i
    } else if (h.includes("udm") || h.includes("unidad") || h === "uom") {
      mapeo.idxUdm = i
    } else if (h.includes("requisit") || h.includes("solicit")) {
      mapeo.idxRequisitor = i
    } else if (h.includes("empresa") || h.includes("destino")) {
      mapeo.idxEmpresa = i
    } else if (h.includes("uso") || h.includes("cuenta") || h.includes("cargo")) {
      mapeo.idxUso = i
    }
  })

  return mapeo
}

function deducirMapeoPorPosicion(numColumnas: number): MapeoColumnas {
  const mapeo: MapeoColumnas = {
    idxPartida: -1,
    idxClave: -1,
    idxDescripcion: -1,
    idxCantidad: -1,
    idxPrecio: -1,
    idxImporte: -1,
    idxUdm: -1,
    idxRequisitor: -1,
    idxEmpresa: -1,
    idxUso: -1,
  }

  if (numColumnas >= 6) {
    mapeo.idxPartida = 0
    mapeo.idxClave = 1
    mapeo.idxDescripcion = 2
    mapeo.idxCantidad = 3
    mapeo.idxPrecio = 4
    mapeo.idxImporte = 5
  } else if (numColumnas === 5) {
    mapeo.idxClave = 0
    mapeo.idxDescripcion = 1
    mapeo.idxCantidad = 2
    mapeo.idxPrecio = 3
    mapeo.idxImporte = 4
  } else if (numColumnas === 4) {
    mapeo.idxClave = 0
    mapeo.idxDescripcion = 1
    mapeo.idxCantidad = 2
    mapeo.idxPrecio = 3
  } else if (numColumnas === 3) {
    mapeo.idxDescripcion = 0
    mapeo.idxCantidad = 1
    mapeo.idxPrecio = 2
  } else if (numColumnas === 2) {
    mapeo.idxDescripcion = 0
    mapeo.idxCantidad = 1
  }

  return mapeo
}

/**
 * Parsea el texto copiado (TSV / CSV / texto plano) desde Excel o Google Sheets.
 */
export function parsearTextoExcel(
  texto: string,
  defaults?: ValoresPorDefectoPartida
): ResultadoParseoExcel {
  const advertencias: string[] = []
  const partidas: PartidaCotizacionOdoo[] = []

  if (!texto || !texto.trim()) {
    return { partidas: [], totalFilasLeidas: 0, filasOmitidas: 0, advertencias }
  }

  const lineas = texto
    .split(/\r?\n/)
    .filter((l, idx, arr) => {
      // Ignorar líneas totalmente vacías al inicio o final absoluto, pero conservar líneas interiores
      if ((idx === 0 || idx === arr.length - 1) && !l.trim()) {
        return false
      }
      return true
    })

  if (lineas.length === 0) {
    return { partidas: [], totalFilasLeidas: 0, filasOmitidas: 0, advertencias }
  }

  // Detectar delimitador (tabulador \t es el estándar al copiar de Excel/Sheets)
  const primerLinea = lineas[0]
  let delimitador = "\t"
  if (!primerLinea.includes("\t")) {
    if (primerLinea.includes(";")) delimitador = ";"
    else if (primerLinea.includes(",")) delimitador = ","
  }

  const filasCeldas = lineas.map((l) => l.split(delimitador).map((c) => c.trim()))
  const numColumnasRef = filasCeldas[0].length

  for (let idx = 0; idx < filasCeldas.length; idx++) {
    if (filasCeldas[idx].length !== numColumnasRef && filasCeldas[idx].some((c) => c)) {
      if (delimitador === ",") {
        advertencias.push(
          `La fila ${idx + 1} tiene ${filasCeldas[idx].length} columnas (esperadas ${numColumnasRef}). Es posible que contenga comas dentro de la descripción; se recomienda copiar y pegar directamente desde Excel (TSV).`
        )
      } else {
        advertencias.push(
          `La fila ${idx + 1} tiene ${filasCeldas[idx].length} columnas mientras que la fila inicial tiene ${numColumnasRef}.`
        )
      }
    }
  }

  let inicio = 0
  let mapeo: MapeoColumnas

  if (esFilaEncabezado(filasCeldas[0])) {
    mapeo = deducirMapeoPorEncabezados(filasCeldas[0])
    inicio = 1
  } else {
    mapeo = deducirMapeoPorPosicion(numColumnasRef)
    advertencias.push(
      "No se detectó fila de encabezados; se aplicó mapeo posicional según el número de columnas."
    )
  }

  // Si la descripción no quedó mapeada, fallback a la columna 1 o 0
  if (mapeo.idxDescripcion === -1) {
    mapeo.idxDescripcion = numColumnasRef > 1 ? 1 : 0
  }

  let filasOmitidas = 0

  for (let i = inicio; i < filasCeldas.length; i++) {
    const celdas = filasCeldas[i]
    if (celdas.length === 0 || celdas.every((c) => !c)) {
      filasOmitidas++
      advertencias.push(`Fila ${i + 1} omitida: fila vacía.`)
      continue
    }

    const desc = mapeo.idxDescripcion >= 0 ? celdas[mapeo.idxDescripcion] || "" : ""
    const clave = mapeo.idxClave >= 0 ? celdas[mapeo.idxClave] || "" : ""
    const partidaStr = mapeo.idxPartida >= 0 ? celdas[mapeo.idxPartida] : null

    // Si la descripción está vacía pero hay clave, usar clave como descripción
    const descripcionFinal = desc || clave
    if (!descripcionFinal) {
      filasOmitidas++
      advertencias.push(`Fila ${i + 1} omitida: sin descripción ni clave de producto.`)
      continue
    }

    const cantRaw = mapeo.idxCantidad >= 0 ? celdas[mapeo.idxCantidad] : "1"
    const precioRaw = mapeo.idxPrecio >= 0 ? celdas[mapeo.idxPrecio] : "0"

    const cantNum = limpiarNumero(cantRaw)
    const cantidad = cantNum <= 0 ? 0 : cantNum
    if (cantidad === 0) {
      advertencias.push(`Fila ${i + 1} ("${descripcionFinal}"): cantidad es 0 o no pudo determinarse.`)
    }

    const precioUnitario = Math.max(0, limpiarNumero(precioRaw))
    if (precioUnitario === 0) {
      advertencias.push(`Fila ${i + 1} ("${descripcionFinal}"): precio unitario es $0.00.`)
    }

    let subtotal = Math.round(cantidad * precioUnitario * 100) / 100
    if (mapeo.idxImporte >= 0 && celdas[mapeo.idxImporte]) {
      const importeArchivo = limpiarNumero(celdas[mapeo.idxImporte])
      if (importeArchivo > 0 && Math.abs(importeArchivo - subtotal) > 0.01) {
        advertencias.push(
          `Fila ${i + 1} ("${descripcionFinal}"): importe del archivo ($${importeArchivo.toFixed(2)}) difiere del cálculo cantidad * precio ($${subtotal.toFixed(2)}). Se utilizó el importe del archivo.`
        )
        subtotal = importeArchivo
      }
    }

    const udm =
      mapeo.idxUdm >= 0 && celdas[mapeo.idxUdm]
        ? celdas[mapeo.idxUdm]
        : defaults?.udm || "Pieza"

    const requisitor =
      mapeo.idxRequisitor >= 0 && celdas[mapeo.idxRequisitor]
        ? celdas[mapeo.idxRequisitor]
        : defaults?.requisitor || ""

    const empresa =
      mapeo.idxEmpresa >= 0 && celdas[mapeo.idxEmpresa]
        ? celdas[mapeo.idxEmpresa]
        : defaults?.empresa || ""

    const uso =
      mapeo.idxUso >= 0 && celdas[mapeo.idxUso]
        ? celdas[mapeo.idxUso]
        : defaults?.uso || ""

    const impuesto = defaults?.impuesto || "IVA 16%"
    const tasaIva = defaults?.tasaIva !== undefined ? defaults.tasaIva : 0.16

    partidas.push({
      id: `item_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 7)}`,
      partida: partidaStr ? Number.parseInt(partidaStr, 10) || partidaStr : i + 1,
      clave,
      descripcion: descripcionFinal,
      cantidad,
      udm,
      precioUnitario,
      subtotal,
      impuesto,
      tasaIva,
      requisitor,
      empresa,
      uso,
    })
  }

  return {
    partidas,
    totalFilasLeidas: filasCeldas.length - inicio,
    filasOmitidas,
    advertencias,
  }
}
