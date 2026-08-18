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
}

export interface ResultadoExtraccionEndmills {
  origen: "excel_tsv" | "gemini_ia"
  items: ItemExtraidoEndmill[]
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
function normalizarTexto(texto: string): string {
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
    return norm === medNorm || norm === descNorm || norm === specNorm || norm === `${medNorm} ${descNorm}`
  })
  if (exacto) return { medidaId: exacto.id, nivel: "exacto" }

  // 2. Coincidencia por sub-palabra clave (ej. "1/4" y "flat")
  const candidato = catalogo.find((m) => {
    const medNorm = normalizarTexto(m.medidaPulgadas)
    const descNorm = normalizarTexto(m.descripcion)
    const specNorm = normalizarTexto(m.specPropuesta)
    return (
      (norm.includes(medNorm) && medNorm.length > 1) ||
      descNorm.includes(norm) ||
      norm.includes(descNorm) ||
      specNorm.includes(norm)
    )
  })

  if (candidato) return { medidaId: candidato.id, nivel: "aproximado" }

  return { medidaId: null, nivel: "nuevo" }
}

/**
 * Parsea celdas/filas copiadas directamente de Excel (TSV/CSV).
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
      // Si la columna es puramente numerica entero o decimal puro (ej. "10", "7.92")
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

    resultados.push({
      descripcionInput: linea,
      medidaPulgadas: medidaEncontrada ? medidaEncontrada.medidaPulgadas : textoMedida,
      cantidadPedida: cantidad,
      precioUnitarioUSD: precio > 0 ? precio : (medidaEncontrada ? medidaEncontrada.precioActualUSD : 0),
      medidaIdCoincidencia: medidaId,
      nivelCoincidencia: nivel,
      notaMatch: medidaEncontrada
        ? `Coincidencia ${nivel} con ${medidaEncontrada.descripcion}`
        : "Sin coincidencia en catálogo (ítem nuevo)",
    })
  }

  return resultados
}

/**
 * Extracción e importación inteligente usando Gemini 3.5 Flash cuando el texto
 * no viene formateado como tabla de Excel estricta (ej. correos, WhatsApp, PDFs).
 */
export async function extraerPedidoEndmillsIA(
  textoEntrada: string,
  catalogo: readonly EndmillMedida[]
): Promise<ResultadoExtraccionEndmills> {
  // 1. Probar parser nativo TSV primero (si viene de copiar celdas de Excel)
  const nativo = parsearTextoExcelEndmills(textoEntrada, catalogo)
  if (nativo.length > 0 && nativo.some((i) => i.medidaIdCoincidencia !== null)) {
    return { origen: "excel_tsv", items: nativo }
  }

  // 2. Si no es tabla estricta, invocar Gemini AI
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

  const prompt = `Analiza la siguiente solicitud de fresas/endmills para un pedido de compras.

LISTADO DE REFERENCIA DEL CATÁLOGO VIVO (id, medidaPulgadas, categoria, descripcion, spec, precioUSD):
${JSON.stringify(catalogoResumido)}

SOLICITUD O TEXTO RECIBIDO PARA ANALIZAR:
"""
${textoEntrada}
"""

INSTRUCCIONES:
1. Extrae cada ítem solicitado con su cantidadPedida (número de piezas), precioUnitarioUSD (si aparece en el texto, o usa el del catálogo si no), y descripcionInput.
2. Compara cada ítem contra el listado de referencia del catálogo.
   - Si coincide con una medida del catálogo, devuelve su "medidaIdCoincidencia" exacto.
   - Si no coincide exactamente pero hay una alternativa muy cercana, usa esa "medidaIdCoincidencia" y nivelCoincidencia="aproximado".
   - Si no existe en el catálogo, deja "medidaIdCoincidencia" en null y nivelCoincidencia="nuevo".
3. Devuelve los ítems en un arreglo "items".`

  const responseSchema = {
    type: "OBJECT",
    properties: {
      items: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            descripcionInput: { type: "STRING" },
            medidaPulgadas: { type: "STRING" },
            cantidadPedida: { type: "NUMBER" },
            precioUnitarioUSD: { type: "NUMBER" },
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

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
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

  const parsed = JSON.parse(rawText) as { items: ItemExtraidoEndmill[] }
  return {
    origen: "gemini_ia",
    items: parsed.items.map((item) => ({
      ...item,
      cantidadPedida: Math.max(1, Math.trunc(item.cantidadPedida || 1)),
      precioUnitarioUSD: Math.max(0, Number(item.precioUnitarioUSD) || 0),
    })),
  }
}
