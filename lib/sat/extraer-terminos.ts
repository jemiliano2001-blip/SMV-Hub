import { normalizarTexto } from "@/lib/sugerencias-compra"

/** Medidas, diámetros y códigos de parte que no aportan a la clasificación SAT. */
const PATRON_RUIDO = [
  /\b\d+(\.\d+)?\s*(mm|cm|m|in|inch|")\b/gi,
  /\(\s*\d+(\.\d+)?\s*(mm|in|inch|")?\s*\)/gi,
  /\b\d+\/\d+\b/g,
  /\b[A-Z]{1,3}\d{2,}[-\w]*/g,
  /\bLV\d+[-\w]*/gi,
  /\b\d{2,}[-/]\d{2,}[-/]\d+\b/g,
]

const STOPWORDS_INDUSTRIAL = new Set([
  "the", "and", "for", "with", "of", "in", "to", "a", "an",
  "x", "mm", "dia", "diameter", "length", "size", "type", "series",
  "grade", "class", "pack", "each", "pcs", "qty", "new", "used",
  "set", "kit", "assortment", "piece", "pieces", "flute", "flutes",
  "straight", "spiral", "stub", "se", "altin", "tiain", "coated",
  "solid", "hss", "lv", "li",
])

/** Sustantivos industriales EN que definen el tipo de producto. */
const TERMINOS_CLAVE_EN = new Set([
  "reamer", "drill", "endmill", "mill", "tap", "insert", "holder",
  "collet", "chuck", "bolt", "screw", "nut", "washer", "bearing",
  "spring", "gasket", "oring", "o-ring", "seal", "valve", "boring",
  "deburr", "deburring", "countersink", "counterbore", "counterbore",
  "carbide", "wrench", "gauge", "caliper", "micrometer", "blade",
  "abrasive", "filter", "pump", "motor", "sensor", "fitting",
  "coupling", "hose", "cable", "wire", "lubricant", "grease", "oil",
  "pin", "rivet", "clamp", "bracket", "plate", "bar", "rod", "tube",
  "pipe", "sheet",   "head", "indexable", "chucking", "compression",
  "extension", "hex", "socket", "flat", "lock", "needle", "ball",
  "thrust", "cutting", "tooling", "shank", "boring", "oring",
])

export type TerminosIndustriales = {
  /** Tokens EN relevantes tras limpiar ruido dimensional/SKU. */
  tokensEn: string[]
  /** Texto limpio para glosario / búsqueda (sin medidas ni SKU). */
  textoLimpio: string
  /** SKU o número de parte detectado, si existe. */
  sku: string | null
}

/** Extrae SKU típico de descripciones de proveedores industriales. */
export function extraerSku(descripcion: string): string | null {
  const patrones = [
    /\b([A-Z]{1,4}\d{2,}[-][\w.-]+)\b/i,
    /\b(LV\d{3,}[-\w]*)\b/i,
    /\b([A-Z]{2,}\d{2,})\b/i,
    /\b(\d{2,}[A-Z]\d{2,}[-\w]*)\b/,
  ]
  for (const re of patrones) {
    const m = descripcion.match(re)
    if (m?.[1]) return m[1].toUpperCase()
  }
  return null
}

/** Elimina medidas, diámetros y códigos de parte del texto. */
export function limpiarDescripcionIndustrial(descripcion: string): string {
  let texto = descripcion
  for (const re of PATRON_RUIDO) {
    texto = texto.replace(re, " ")
  }
  return texto.replace(/\s+/g, " ").trim()
}

/**
 * Extrae términos clave de una descripción industrial EN para búsqueda SAT.
 * Ignora medidas, SKU y stopwords; prioriza sustantivos de herramienta.
 */
export function extraerTerminosClaveIndustrial(descripcion: string): TerminosIndustriales {
  const sku = extraerSku(descripcion)
  const textoLimpio = limpiarDescripcionIndustrial(descripcion)
  const normalizado = normalizarTexto(textoLimpio)

  const tokensRaw = normalizado
    .replace(/[^a-z0-9\s./-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2)

  const tokensEn: string[] = []
  for (const token of tokensRaw) {
    if (STOPWORDS_INDUSTRIAL.has(token)) continue
    if (/^\d/.test(token)) continue
    if (TERMINOS_CLAVE_EN.has(token) || token.length >= 4) {
      tokensEn.push(token)
    }
  }

  return {
    tokensEn: [...new Set(tokensEn)],
    textoLimpio,
    sku,
  }
}

/** Similitud Jaccard entre dos conjuntos de tokens. */
export function similitudJaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1
  if (a.length === 0 || b.length === 0) return 0
  const setA = new Set(a)
  const setB = new Set(b)
  let interseccion = 0
  for (const t of setA) {
    if (setB.has(t)) interseccion++
  }
  const union = setA.size + setB.size - interseccion
  return union === 0 ? 0 : interseccion / union
}
