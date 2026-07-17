import { findSatCatalogEntryByKey, getSatCatalogEntries, type SatCatalogEntry } from "@/lib/sat/catalogo"
import {
  normalizarClaveProdServ,
  normalizarTextoSat,
  tokenizarTextoSat,
  stemPalabraSat,
  stemTextoSat,
} from "@/lib/sat/normalizar"

export interface SatSearchResult {
  entry: SatCatalogEntry
  score: number
  reasons: string[]
  /**
   * true si el primer término específico (no genérico) de la búsqueda
   * coincidió con esta entrada. Evita que un match que solo coincide por
   * material/acabado genérico (ej. "acero inoxidable") se trate como
   * confiable cuando el tipo de producto real (ej. "perno", "resorte") nunca
   * coincidió con nada del catálogo.
   */
  coincideTerminoPrincipal: boolean
}

export type BuscarClavesSatOpciones = {
  /** Limita a división UNSPSC (ej. "23" para herramientas de corte). */
  divisionPrefijo?: string
  /** Varias divisiones permitidas (ej. ["23","31"] para taller). */
  divisionPrefijos?: string[]
  limit?: number
}

const PALABRAS_GENERICAS = new Set([
  "METAL", "HERRAMIENTA", "ACERO", "CORTE", "DE", "PARA", "CON", "DEL", "LA",
  "EL", "LOS", "LAS", "SOLIDO", "SOLIDA", "INDUSTRIAL", "PRODUCTO", "OTROS",
  "RECTA", "ESPIRAL", "PRECISION",
])

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

function tokenMatchesHaystack(token: string, haystackStem: string): boolean {
  if (token.length < 3) return false
  const padded = ` ${haystackStem} `
  return padded.includes(` ${stemPalabraSat(token)} `)
}

function extraerFrasesQuery(query: string): string[] {
  const normalizado = normalizarTextoSat(query)
  const tokens = tokenizarTextoSat(query)
  const frases: string[] = []
  if (normalizado.includes(" ")) frases.push(normalizado)
  for (let i = 0; i < tokens.length - 1; i++) {
    frases.push(`${tokens[i]} ${tokens[i + 1]}`)
    if (i < tokens.length - 2) {
      frases.push(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`)
    }
  }
  return frases
}

function filtrarEntradas(opciones?: BuscarClavesSatOpciones): SatCatalogEntry[] {
  const todas = getSatCatalogEntries()
  const prefijos = opciones?.divisionPrefijos?.length
    ? opciones.divisionPrefijos
    : opciones?.divisionPrefijo?.trim()
      ? [opciones.divisionPrefijo.trim()]
      : []
  if (prefijos.length === 0) return todas
  return todas.filter((e) =>
    prefijos.some((p) => e.division?.startsWith(p) ?? e.clave.startsWith(p))
  )
}

function scoreEntry(entry: SatCatalogEntry, query: string): SatSearchResult | null {
  const normalizedKey = normalizarClaveProdServ(query)
  if (normalizedKey) {
    if (entry.clave !== normalizedKey) return null
    return {
      entry,
      score: 1000,
      reasons: ["Coincidencia exacta por clave"],
      coincideTerminoPrincipal: true,
    }
  }

  const normalizedQuery = normalizarTextoSat(query)
  const queryTokens = tokenizarTextoSat(query)
  if (!normalizedQuery || queryTokens.length === 0) return null

  const haystack = normalizarTextoSat(
    [entry.descripcion, entry.division, entry.grupo, entry.clase, ...entry.palabrasClave]
      .filter(Boolean)
      .join(" ")
  )
  // Estematizado (quita plurales simples) para que "resorte" encuentre
  // "Resortes de compresión" en el catálogo y viceversa.
  const haystackStem = stemTextoSat(haystack)

  let score = 0
  const reasons: string[] = []

  if (haystackStem.includes(stemTextoSat(normalizedQuery))) {
    score += 400
    reasons.push("La descripción contiene la búsqueda completa")
  }

  const frases = extraerFrasesQuery(query)
  for (const frase of frases) {
    if (frase.length >= 6 && haystackStem.includes(stemTextoSat(frase))) {
      score += 120
      reasons.push(`Coincide frase: ${frase}`)
      break
    }
  }

  const matchedTokens = queryTokens.filter((token) => tokenMatchesHaystack(token, haystackStem))
  const tokensEspecificos = matchedTokens.filter((t) => !PALABRAS_GENERICAS.has(t))
  const tokensGenericos = matchedTokens.filter((t) => PALABRAS_GENERICAS.has(t))

  const queryTokensEspecificos = queryTokens.filter((t) => !PALABRAS_GENERICAS.has(t))
  const primerTerminoEspecifico = queryTokensEspecificos[0]
  const coincideTerminoPrincipal =
    !primerTerminoEspecifico || tokensEspecificos.includes(primerTerminoEspecifico)

  if (tokensEspecificos.length > 0) {
    score += tokensEspecificos.length * 100
    reasons.push(
      `Coinciden ${tokensEspecificos.length} término(s) específico(s): ${unique(tokensEspecificos).join(", ")}`
    )
  }

  if (tokensGenericos.length > 0 && tokensEspecificos.length === 0) {
    score += tokensGenericos.length * 15
    reasons.push(`Solo términos genéricos: ${unique(tokensGenericos).join(", ")}`)
  } else if (tokensGenericos.length > 0) {
    score += tokensGenericos.length * 20
  }

  const exactKeywordMatches = queryTokens.filter(
    (token) =>
      token.length >= 2 &&
      entry.palabrasClave.some((kw) => stemPalabraSat(kw) === stemPalabraSat(token))
  )
  if (exactKeywordMatches.length > 0) {
    score += exactKeywordMatches.length * 40
    reasons.push(`Palabras clave del catálogo: ${unique(exactKeywordMatches).join(", ")}`)
  }

  if (score === 0) return null

  return { entry, score, reasons, coincideTerminoPrincipal }
}

export function buscarClavesSat(
  query: string,
  limit = 20,
  opciones?: BuscarClavesSatOpciones
): SatSearchResult[] {
  const cleaned = query.trim()
  if (!cleaned) return []

  const limite = opciones?.limit ?? limit

  const exactKey = normalizarClaveProdServ(cleaned)
  if (exactKey) {
    const exactEntry = findSatCatalogEntryByKey(exactKey)
    return exactEntry
      ? [
          {
            entry: exactEntry,
            score: 1000,
            reasons: ["Coincidencia exacta por clave"],
            coincideTerminoPrincipal: true,
          },
        ]
      : []
  }

  return filtrarEntradas(opciones)
    .map((entry) => scoreEntry(entry, cleaned))
    .filter((result): result is SatSearchResult => result !== null)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.entry.clave.localeCompare(b.entry.clave)
    })
    .slice(0, limite)
}

export function sugerenciaSatBasicaPorDescripcion(
  descripcion: string,
  opciones?: BuscarClavesSatOpciones
): { claveSugerida: string | null; motivo: string } {
  const normalized = normalizarTextoSat(descripcion)
  if (!normalized) {
    return { claveSugerida: null, motivo: "Sin descripción suficiente para sugerir una clave SAT" }
  }

  if (/\b(ENVIO|SHIP(?:PING)?|FLETE|FREIGHT)\b/.test(normalized)) {
    return { claveSugerida: null, motivo: "Concepto de envío/flete: requiere revisión manual en el catálogo SAT" }
  }

  if (/\b(IMPUESTO|TAX|IVA)\b/.test(normalized)) {
    return { claveSugerida: null, motivo: "Concepto de impuesto: requiere revisión manual en el catálogo SAT" }
  }

  const [topResult] = buscarClavesSat(descripcion, 1, opciones)
  if (!topResult) {
    return { claveSugerida: null, motivo: "No hubo coincidencias automáticas en el catálogo local" }
  }

  return {
    claveSugerida: topResult.entry.clave,
    motivo: topResult.reasons[0] ?? "Coincidencia por palabras clave",
  }
}
