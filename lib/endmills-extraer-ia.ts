import * as XLSX from "xlsx"
import { configGeneracionJson } from "@/lib/gemini-generation-config"
import { ErrorIA, resolverModeloExtraccion } from "@/lib/extraer-ia"
import type { EndmillMedida } from "@/lib/schemas"

export interface ItemExtraidoEndmill {
  descripcionInput: string
  medidaPulgadas: string
  cantidadPedida: number
  precioUnitarioUSD: number
  medidaIdCoincidencia: string | null
  nivelCoincidencia: "exacto" | "aproximado" | "nuevo"
  notaMatch: string
  precioCatalogoUSD?: number
  diferenciaPrecio?: number
  specDetectada?: string
}

export interface ResultadoExtraccionEndmills {
  origen: "excel_tsv" | "excel_archivo" | "gemini_ia_vision" | "gemini_ia_texto"
  items: ItemExtraidoEndmill[]
  shippingUSD?: number
  aliCostUSD?: number
  folioCotizacion?: string | null
}

function obtenerApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim()
  if (!key) {
    throw new ErrorIA("Falta GEMINI_API_KEY en .env.local (crea una en Google AI Studio)")
  }
  return key
}

/**
 * Normaliza cadenas para comparación de texto (sin acentos, minúsculas, espacios extra).
 */
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/["'”’]/g, "")
    .trim()
}

/**
 * Intenta hacer match de una línea de texto contra el catálogo de endmills.
 */
export function buscarCoincidenciaCatalogo(
  textoBusqueda: string,
  catalogo: readonly EndmillMedida[]
): { medidaId: string | null; nivel: "exacto" | "aproximado" | "nuevo" } {
  const norm = normalizarTexto(textoBusqueda)
  if (!norm) return { medidaId: null, nivel: "nuevo" }

  // 1. Coincidencia exacta por medidaPulgadas o descripción
  const exacto = catalogo.find((m) => {
    const medNorm = normalizarTexto(m.medidaPulgadas)
    const descNorm = normalizarTexto(m.descripcion)
    const specNorm = normalizarTexto(m.specPropuesta)
    return (
      norm === medNorm ||
      norm === descNorm ||
      norm === specNorm ||
      norm === `${medNorm} ${descNorm}` ||
      norm === `${descNorm} ${medNorm}`
    )
  })
  if (exacto) return { medidaId: exacto.id, nivel: "exacto" }

  // 2. Coincidencia por sub-palabras clave (ej. "1/4" y "flat" o "ball")
  const candidato = catalogo.find((m) => {
    const medNorm = normalizarTexto(m.medidaPulgadas)
    const descNorm = normalizarTexto(m.descripcion)
    const specNorm = normalizarTexto(m.specPropuesta)
    return (
      (norm.includes(medNorm) && medNorm.length > 1 && (norm.includes("flat") || norm.includes("ball") || norm.includes("filos"))) ||
      (descNorm.length > 3 && norm.includes(descNorm)) ||
      (norm.length > 3 && descNorm.includes(norm)) ||
      (specNorm.length > 4 && norm.includes(specNorm))
    )
  })

  if (candidato) return { medidaId: candidato.id, nivel: "aproximado" }

  // 3. Coincidencia secundaria si solo coincide la medida exacta (ej. "1/4" en texto "1/4 4F")
  const candidatoPorMedida = catalogo.find((m) => {
    const medNorm = normalizarTexto(m.medidaPulgadas)
    return medNorm.length > 1 && norm.includes(medNorm)
  })

  if (candidatoPorMedida) return { medidaId: candidatoPorMedida.id, nivel: "aproximado" }

  return { medidaId: null, nivel: "nuevo" }
}

/**
 * Parsea celdas/filas copiadas directamente de Excel o texto tabular (TSV/CSV).
 */
export function parsearTextoExcelEndmills(
  texto: string,
  catalogo: readonly EndmillMedida[]
): ItemExtraidoEndmill[] {
  const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const resultados: ItemExtraidoEndmill[] = []

  for (const linea of lineas) {
    const columnas = linea.split(/\t|,|;/).map((c) => c.trim()).filter(Boolean)
    if (columnas.length === 0) continue

    let cantidad = 0
    let precio = 0
    const partesTexto: string[] = []

    for (const col of columnas) {
      if (/^\d+$/.test(col)) {
        if (cantidad === 0) cantidad = parseInt(col, 10)
        else if (precio === 0) precio = parseFloat(col)
      } else if (/^\d+\.\d+$/.test(col)) {
        if (precio === 0) precio = parseFloat(col)
        else if (cantidad === 0) cantidad = Math.trunc(parseFloat(col))
      } else {
        partesTexto.push(col)
      }
    }

    const textoMedida = partesTexto.join(" ") || columnas[0]
    if (cantidad <= 0 && columnas.length >= 2) cantidad = 1
    if (cantidad <= 0) continue

    const { medidaId, nivel } = buscarCoincidenciaCatalogo(textoMedida, catalogo)
    const medidaEncontrada = catalogo.find((m) => m.id === medidaId)
    const precioFinal = precio > 0 ? precio : (medidaEncontrada ? medidaEncontrada.precioActualUSD : 0)
    const precioCat = medidaEncontrada ? medidaEncontrada.precioActualUSD : undefined
    const diff = precioCat !== undefined && precioFinal > 0 ? Math.round((precioFinal - precioCat) * 100) / 100 : 0

    resultados.push({
      descripcionInput: linea,
      medidaPulgadas: medidaEncontrada ? medidaEncontrada.medidaPulgadas : textoMedida,
      cantidadPedida: cantidad,
      precioUnitarioUSD: precioFinal,
      medidaIdCoincidencia: medidaId,
      nivelCoincidencia: nivel,
      precioCatalogoUSD: precioCat,
      diferenciaPrecio: diff,
      notaMatch: medidaEncontrada
        ? `Coincidencia ${nivel} con ${medidaEncontrada.descripcion}`
        : "Sin coincidencia en catálogo (ítem nuevo)",
    })
  }

  return resultados
}

/**
 * Parsea un archivo binario de Excel (.xlsx, .xls, .csv) subido por el usuario.
 */
export function parsearArchivoExcelEndmills(
  buffer: ArrayBuffer | Uint8Array,
  catalogo: readonly EndmillMedida[]
): ResultadoExtraccionEndmills {
  const workbook = XLSX.read(buffer, { type: "array" })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) {
    throw new Error("El archivo de Excel no contiene hojas de datos")
  }

  const worksheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json<Array<string | number>>(worksheet, {
    header: 1,
    defval: "",
  })

  let shippingUSD = 0
  let aliCostUSD = 0
  let folioCotizacion: string | null = null
  const items: ItemExtraidoEndmill[] = []

  for (const row of rows) {
    if (!row || row.length === 0) continue
    const filaStr = row.map((cell) => String(cell).trim()).join(" ")
    if (!filaStr) continue

    // Detectar Folio de Proforma / Cotización
    const matchFolio = filaStr.match(/(?:PI\s*NO\.?|PROFORMA\s*INVOICE|PROFORMA|QUOTATION\s*NO\.?|COTIZACI[OÓ]N)\s*[:#]?\s*([A-Za-z0-9-_/]+)/i)
    if (matchFolio && matchFolio[1] && !folioCotizacion) {
      folioCotizacion = matchFolio[1].trim()
    }

    // Detectar Flete / Shipping
    const matchShipping = filaStr.match(/(?:SHIPPING|FREIGHT|DHL|FEDEX|FLETE)\s*(?:COST|FEE)?\s*[:$]?\s*(\d+(?:\.\d+)?)/i)
    if (matchShipping && matchShipping[1]) {
      shippingUSD = parseFloat(matchShipping[1])
    }

    // Detectar Ali Cost / Comisión
    const matchAli = filaStr.match(/(?:ALI(?:BABA)?\s*COST|PLATFORM\s*FEE|COMISI[OÓ]N)\s*[:$]?\s*(\d+(?:\.\d+)?)/i)
    if (matchAli && matchAli[1]) {
      aliCostUSD = parseFloat(matchAli[1])
    }

    // Intentar extraer partida
    let cantidad = 0
    let precio = 0
    const textoPartes: string[] = []

    for (const cell of row) {
      const str = String(cell).trim()
      if (!str) continue

      if (/^\d+$/.test(str)) {
        const num = parseInt(str, 10)
        if (cantidad === 0 && num > 0) cantidad = num
        else if (precio === 0 && num > 0) precio = num
      } else if (/^\d+\.\d+$/.test(str)) {
        const dec = parseFloat(str)
        if (precio === 0 && dec > 0) precio = dec
        else if (cantidad === 0 && dec > 0) cantidad = Math.trunc(dec)
      } else {
        textoPartes.push(str)
      }
    }

    const textoMedida = textoPartes.join(" ")
    // Ignorar filas de encabezados o de totales
    if (
      textoMedida.toLowerCase().includes("total") ||
      textoMedida.toLowerCase().includes("subtotal") ||
      textoMedida.toLowerCase().includes("description") ||
      textoMedida.toLowerCase().includes("item no")
    ) {
      continue
    }

    if (cantidad > 0 && textoMedida.length > 1) {
      const { medidaId, nivel } = buscarCoincidenciaCatalogo(textoMedida, catalogo)
      const medidaEncontrada = catalogo.find((m) => m.id === medidaId)
      const precioFinal = precio > 0 ? precio : (medidaEncontrada ? medidaEncontrada.precioActualUSD : 0)
      const precioCat = medidaEncontrada ? medidaEncontrada.precioActualUSD : undefined
      const diff = precioCat !== undefined && precioFinal > 0 ? Math.round((precioFinal - precioCat) * 100) / 100 : 0

      items.push({
        descripcionInput: filaStr,
        medidaPulgadas: medidaEncontrada ? medidaEncontrada.medidaPulgadas : textoMedida,
        cantidadPedida: cantidad,
        precioUnitarioUSD: precioFinal,
        medidaIdCoincidencia: medidaId,
        nivelCoincidencia: nivel,
        precioCatalogoUSD: precioCat,
        diferenciaPrecio: diff,
        notaMatch: medidaEncontrada
          ? `Coincidencia ${nivel} con ${medidaEncontrada.descripcion}`
          : "Sin coincidencia en catálogo (ítem nuevo)",
      })
    }
  }

  return {
    origen: "excel_archivo",
    items,
    shippingUSD: shippingUSD > 0 ? shippingUSD : undefined,
    aliCostUSD: aliCostUSD > 0 ? aliCostUSD : undefined,
    folioCotizacion,
  }
}

/**
 * Extracción e importación inteligente multimodal usando Gemini 3.7 / 3.5 Flash:
 * - Soporta imágenes (capturas de WeChat, WhatsApp, fotos)
 * - Soporta PDFs (proformas oficiales de ChangZhou/Rita)
 * - Soporta texto libre o correos
 */
export async function extraerPedidoEndmillsMultimodalIA(
  params: {
    texto?: string
    base64?: string
    mimeType?: string
  },
  catalogo: readonly EndmillMedida[]
): Promise<ResultadoExtraccionEndmills> {
  const apiKey = obtenerApiKey()
  const modelo = resolverModeloExtraccion()
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`

  const catalogoResumido = catalogo.map((m) => ({
    id: m.id,
    medidaPulgadas: m.medidaPulgadas,
    categoria: m.categoria,
    descripcion: m.descripcion,
    spec: m.specPropuesta,
    precioUSD: m.precioActualUSD,
  }))

  const promptInstrucciones = `Eres un asistente experto en compras técnicas de herramientas de corte CNC (Solid Carbide Endmills/Fresas) para SMV Maquinados.
Tu tarea es analizar la cotización, proforma, captura de pantalla de WeChat/WhatsApp o documento recibido de ChangZhou North Alloy Tool Co. (Rita).

LISTADO DE REFERENCIA DEL CATÁLOGO VIVO DE SMV (id, medidaPulgadas, categoria, descripcion, spec, precioUSD):
${JSON.stringify(catalogoResumido)}

INSTRUCCIONES:
1. Extrae todas las herramientas solicitadas/cotizadas:
   - descripcionInput: texto o línea original.
   - medidaPulgadas: diámetro de corte (ej. "1/4", "1/8", "1/2", "0.015", etc.).
   - cantidadPedida: número entero de piezas pedidas.
   - precioUnitarioUSD: precio unitario en USD cotizado (si no viene precio en el documento, usa 0 o el del catálogo).
   - specDetectada: especificación completa detectada (ej. D1/4*FL3/4*D1/4*2-1/2"L*4F).
2. Mapea cada ítem contra el catálogo vivo:
   - Si coincide claramente con una medida existente, asigna su "medidaIdCoincidencia" exacto y nivelCoincidencia="exacto".
   - Si la descripción varía un poco pero es la misma herramienta, asigna "medidaIdCoincidencia" y nivelCoincidencia="aproximado".
   - Si es una herramienta nueva o no existente en el catálogo, deja "medidaIdCoincidencia"=null y nivelCoincidencia="nuevo".
3. Extrae costos adicionales y folio si aparecen en el documento:
   - shippingUSD: costo de envío (DHL, FedEx, Freight, etc.).
   - aliCostUSD: comisión de Alibaba, Trade Assurance o platform fee.
   - folioCotizacion: número de proforma (PI NO, Quotation No, etc.).`

  const responseSchema = {
    type: "OBJECT",
    properties: {
      folioCotizacion: { type: "STRING", nullable: true },
      shippingUSD: { type: "NUMBER", nullable: true },
      aliCostUSD: { type: "NUMBER", nullable: true },
      items: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            descripcionInput: { type: "STRING" },
            medidaPulgadas: { type: "STRING" },
            cantidadPedida: { type: "NUMBER" },
            precioUnitarioUSD: { type: "NUMBER" },
            specDetectada: { type: "STRING" },
            medidaIdCoincidencia: { type: "STRING", nullable: true },
            nivelCoincidencia: { type: "STRING", enum: ["exacto", "aproximado", "nuevo"] },
            notaMatch: { type: "STRING" },
          },
          required: [
            "descripcionInput",
            "medidaPulgadas",
            "cantidadPedida",
            "precioUnitarioUSD",
            "nivelCoincidencia",
            "notaMatch",
          ],
        },
      },
    },
    required: ["items"],
  }

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
    { text: promptInstrucciones },
  ]

  if (params.base64 && params.mimeType) {
    parts.push({
      inlineData: {
        mimeType: params.mimeType,
        data: params.base64,
      },
    })
  }

  if (params.texto) {
    parts.push({
      text: `\n\nCONTENIDO EN TEXTO PROPORCIONADO:\n"""\n${params.texto}\n"""`,
    })
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: configGeneracionJson({ responseSchema }),
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new ErrorIA(`Error en IA Gemini (${response.status}): ${errorText}`)
  }

  const json = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text
  if (!rawText) throw new ErrorIA("Gemini no devolvió texto en la respuesta")

  const parsed = JSON.parse(rawText) as {
    folioCotizacion?: string | null
    shippingUSD?: number | null
    aliCostUSD?: number | null
    items: ItemExtraidoEndmill[]
  }

  const itemsEnriquecidos = parsed.items.map((item) => {
    const medidaEncontrada = catalogo.find((m) => m.id === item.medidaIdCoincidencia)
    const precioFinal = item.precioUnitarioUSD > 0
      ? item.precioUnitarioUSD
      : (medidaEncontrada ? medidaEncontrada.precioActualUSD : 0)
    const precioCat = medidaEncontrada ? medidaEncontrada.precioActualUSD : undefined
    const diff = precioCat !== undefined && precioFinal > 0 ? Math.round((precioFinal - precioCat) * 100) / 100 : 0

    return {
      ...item,
      cantidadPedida: Math.max(1, Math.trunc(item.cantidadPedida || 1)),
      precioUnitarioUSD: Math.max(0, Number(precioFinal) || 0),
      precioCatalogoUSD: precioCat,
      diferenciaPrecio: diff,
    }
  })

  return {
    origen: params.base64 ? "gemini_ia_vision" : "gemini_ia_texto",
    items: itemsEnriquecidos,
    shippingUSD: parsed.shippingUSD ? Math.max(0, Number(parsed.shippingUSD)) : undefined,
    aliCostUSD: parsed.aliCostUSD ? Math.max(0, Number(parsed.aliCostUSD)) : undefined,
    folioCotizacion: parsed.folioCotizacion ?? null,
  }
}
