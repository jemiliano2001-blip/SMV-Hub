import type { OrdenCompra } from "@/lib/schemas"
import type { SugerenciaClaveSat } from "@/lib/sat/sugerir-clave"

export type ResumenProcesamientoContableIa = {
  procesadas: number
  traducidas: number
  clavesAsignadas: number
  clavesPendientes: number
  ordenesFallidas: string[]
  ordenesOmitidas: string[]
}

export type ResultadoReglaSat = Pick<SugerenciaClaveSat, "claveProdServ"> & {
  satPendiente: boolean
}

export type ChunkOrdenes = OrdenCompra[]

const EJEMPLOS_TRADUCCION = [
  "Terminales de crimpado tipo ferrul blanco 22 AWG (1000 pzas)",
  "Punzón para lámina de acero",
  "Juego de destornilladores de precisión",
]

/** Prompt consistente para normalizar descripciones de compra sin inventar datos. */
export function construirPromptTraduccionLote(descripciones: string[]): string {
  return `Eres un traductor técnico industrial para un taller de maquinados en México.
Traduce y simplifica cada descripción de compra al español para uso contable.

Reglas:
- Identifica primero el objeto principal. No te desvíes por palabras secundarias: "HARFINGTON Sheet Metal Punch" es un punzón, no una lámina; "Wiha Screwdriver Set" es un juego de destornilladores, no "precisión".
- Conserva especificaciones útiles como medida, calibre, material, tipo y cantidad de empaque cuando ayuden a distinguir el producto.
- Elimina marcas, códigos internos, SKU, texto comercial y cantidades masivas que no describan el artículo.
- No inventes características. No incluyas explicación, clave SAT ni texto adicional.
- Usa una descripción clara en español, con formato estándar de taller.

Ejemplos de formato:
${EJEMPLOS_TRADUCCION.map((ejemplo) => `- ${ejemplo}`).join("\n")}

Devuelve estrictamente un arreglo JSON de strings, en el mismo orden y con exactamente ${descripciones.length} elementos.
Descripciones:
${JSON.stringify(descripciones)}`
}

/** Valida que Gemini respetó el contrato de salida y el orden solicitado. */
export function parsearRespuestaTraduccion(texto: string, esperadas: number): string[] {
  let valor: unknown
  try {
    valor = JSON.parse(texto)
  } catch {
    throw new Error("La IA no devolvió un arreglo JSON válido")
  }

  if (!Array.isArray(valor) || valor.length !== esperadas) {
    throw new Error(`La IA devolvió ${Array.isArray(valor) ? valor.length : 0} traducciones; se esperaban ${esperadas}`)
  }

  return valor.map((entrada) => {
    if (typeof entrada !== "string" || !entrada.trim()) {
      throw new Error("La IA devolvió una traducción vacía o inválida")
    }
    return entrada.trim()
  })
}

/** Solo se persisten claves que el pipeline considera suficientemente confiables. */
export function aplicarReglaConfianza(
  sugerencia: SugerenciaClaveSat | null | undefined
): ResultadoReglaSat {
  if (
    sugerencia?.claveProdServ &&
    (sugerencia.confianza === "alta" || sugerencia.confianza === "media")
  ) {
    return { claveProdServ: sugerencia.claveProdServ, satPendiente: false }
  }

  return { claveProdServ: null, satPendiente: true }
}

function ordenTieneFaltantes(orden: OrdenCompra): boolean {
  return orden.items.some(
    (item) => !item.descripcionSimplificada?.trim() || !item.claveProdServ
  )
}

/** Agrupa órdenes completas para que una orden nunca compita consigo misma. */
export function armarChunksOrdenes(
  ordenes: OrdenCompra[],
  maxOrdenes = 2,
  maxLineas = 6
): ChunkOrdenes[] {
  if (maxOrdenes < 1 || maxLineas < 1) {
    throw new Error("Los límites de chunks deben ser mayores que cero")
  }

  const chunks: ChunkOrdenes[] = []
  let actual: ChunkOrdenes = []
  let lineasActuales = 0

  for (const orden of ordenes.filter(ordenTieneFaltantes)) {
    const lineas = Math.max(orden.items.length, 1)
    const excedeLimite =
      actual.length > 0 &&
      (actual.length >= maxOrdenes || lineasActuales + lineas > maxLineas)

    if (excedeLimite) {
      chunks.push(actual)
      actual = []
      lineasActuales = 0
    }

    actual.push(orden)
    lineasActuales += lineas

    if (actual.length >= maxOrdenes) {
      chunks.push(actual)
      actual = []
      lineasActuales = 0
    }
  }

  if (actual.length > 0) chunks.push(actual)
  return chunks
}

export function crearResumenProcesamiento(): ResumenProcesamientoContableIa {
  return {
    procesadas: 0,
    traducidas: 0,
    clavesAsignadas: 0,
    clavesPendientes: 0,
    ordenesFallidas: [],
    ordenesOmitidas: [],
  }
}

export function acumularResumenProcesamiento(
  base: ResumenProcesamientoContableIa,
  siguiente: ResumenProcesamientoContableIa
): ResumenProcesamientoContableIa {
  return {
    procesadas: base.procesadas + siguiente.procesadas,
    traducidas: base.traducidas + siguiente.traducidas,
    clavesAsignadas: base.clavesAsignadas + siguiente.clavesAsignadas,
    clavesPendientes: base.clavesPendientes + siguiente.clavesPendientes,
    ordenesFallidas: [...base.ordenesFallidas, ...siguiente.ordenesFallidas],
    ordenesOmitidas: [...base.ordenesOmitidas, ...siguiente.ordenesOmitidas],
  }
}
