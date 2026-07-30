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
  /**
   * Si true, también busca en el catálogo completo y fusiona matches de frase
   * casi exacta aunque el filtro de división los hubiera dejado fuera.
   */
  inyectarFraseExacta?: boolean
}

const PALABRAS_GENERICAS = new Set([
  "METAL", "HERRAMIENTA", "ACERO", "CORTE", "DE", "PARA", "CON", "DEL", "LA",
  "EL", "LOS", "LAS", "SOLIDO", "SOLIDA", "INDUSTRIAL", "PRODUCTO", "OTROS",
  "RECTA", "ESPIRAL", "PRECISION",
])

/** Modificadores de producto que deben pesar (no tirarlos ni tratarlos como ruido). */
const MODIFICADORES_PRODUCTO = new Set([
  "COMPRESION", "EXTENSION", "TRACCION", "TORSION", "HELICE", "HELICOIDAL",
  "COMPRESSION", "EXTENSION", "TORSION",
])

/**
 * Tipos de producto de la query → preferimos entradas cuyo título sea ese
 * producto, no herramientas/máquinas que solo lo mencionan.
 */
const TIPOS_PRODUCTO: Array<{
  query: RegExp
  titulo: RegExp
  ruido: RegExp
}> = [
  {
    query: /\b(resortes?|springs?)\b/i,
    titulo: /\bresortes?\b/i,
    ruido: /\b(maquina|máquina|forja|forjado|tester|alicate|compresor|tuerca|tuercas|arandela|arandelas|extensor|prensa)\b/i,
  },
  {
    query: /\b(tornillos?|screws?|bolts?)\b/i,
    titulo: /\btornillos?\b/i,
    ruido: /\b(maquina|máquina|extractor|juego)\b/i,
  },
  {
    query: /\b(insertos?|inserts?)\b/i,
    titulo: /\binsertos?\b/i,
    ruido: /\b(maquina|máquina|portaherramienta)\b/i,
  },
  {
    query: /\b(brocas?|drills?)\b/i,
    titulo: /\bbrocas?\b/i,
    ruido: /\b(maquina|máquina|afiladora)\b/i,
  },
]

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

function aplicarSesgoTipoProducto(
  entry: SatCatalogEntry,
  query: string,
  score: number,
  reasons: string[]
): number {
  const tokensEspecificosQuery = tokenizarTextoSat(query).filter(
    (t) => !PALABRAS_GENERICAS.has(t) || MODIFICADORES_PRODUCTO.has(t)
  )
  const primerTipo = tokensEspecificosQuery[0] ?? ""
  let adjusted = score
  const desc = entry.descripcion

  for (const tipo of TIPOS_PRODUCTO) {
    if (!tipo.query.test(query)) continue
  // Solo sesgar si el tipo es el núcleo de la query (primer término específico).
  // Evita que "perno de resorte…" se trate como producto "resorte".
  if (!tipo.query.test(primerTipo) && tokensEspecificosQuery.length > 1) {
    continue
  }
    if (tipo.titulo.test(desc) && !tipo.ruido.test(desc)) {
      adjusted += 220
      reasons.push("Coincide tipo de producto del catálogo")
    } else if (tipo.ruido.test(desc)) {
      adjusted -= 280
      reasons.push("Penalizado: menciona el tipo pero no es el producto")
    }
    break
  }
  return adjusted
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
  const descStem = stemTextoSat(normalizarTextoSat(entry.descripcion))

  let score = 0
  const reasons: string[] = []

  const queryStem = stemTextoSat(normalizedQuery)
  if (descStem === queryStem || haystackStem.includes(queryStem)) {
    // Preferir igualdad/contención en la descripción del producto, no en división/grupo.
    if (descStem === queryStem || descStem.includes(queryStem)) {
      score += 450
      reasons.push("La descripción contiene la búsqueda completa")
    } else {
      score += 200
      reasons.push("El haystack contiene la búsqueda completa")
    }
  }

  const frases = extraerFrasesQuery(query)
  for (const frase of frases) {
    if (frase.length >= 6 && descStem.includes(stemTextoSat(frase))) {
      score += 150
      reasons.push(`Coincide frase: ${frase}`)
      break
    }
  }

  const matchedTokens = queryTokens.filter((token) => tokenMatchesHaystack(token, haystackStem))
  const tokensEspecificos = matchedTokens.filter(
    (t) => !PALABRAS_GENERICAS.has(t) || MODIFICADORES_PRODUCTO.has(t)
  )
  const tokensGenericos = matchedTokens.filter(
    (t) => PALABRAS_GENERICAS.has(t) && !MODIFICADORES_PRODUCTO.has(t)
  )

  const queryTokensEspecificos = queryTokens.filter(
    (t) => !PALABRAS_GENERICAS.has(t) || MODIFICADORES_PRODUCTO.has(t)
  )
  const primerTerminoEspecifico = queryTokensEspecificos[0]
  const coincideTerminoPrincipal =
    !primerTerminoEspecifico || tokensEspecificos.includes(primerTerminoEspecifico)

  if (tokensEspecificos.length > 0) {
    score += tokensEspecificos.length * 100
    reasons.push(
      `Coinciden ${tokensEspecificos.length} término(s) específico(s): ${unique(tokensEspecificos).join(", ")}`
    )
  }

  // Modificadores de la query (compresión, extensión…) que también están en la descripción.
  const modsQuery = queryTokens.filter((t) => MODIFICADORES_PRODUCTO.has(t))
  const modsMatched = modsQuery.filter((t) => tokenMatchesHaystack(t, descStem))
  if (modsMatched.length > 0) {
    score += modsMatched.length * 120
    reasons.push(`Modificador de producto: ${unique(modsMatched).join(", ")}`)
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

  score = aplicarSesgoTipoProducto(entry, query, score, reasons)

  if (score <= 0) return null

  return { entry, score, reasons, coincideTerminoPrincipal }
}

function rankear(
  entries: SatCatalogEntry[],
  query: string,
  limite: number
): SatSearchResult[] {
  return entries
    .map((entry) => scoreEntry(entry, query))
    .filter((result): result is SatSearchResult => result !== null)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.entry.clave.localeCompare(b.entry.clave)
    })
    .slice(0, limite)
}

/**
 * Matches de frase casi exacta en todo el catálogo (sin filtro de división).
 * Garantiza que "Resortes de compresión" entre al top-N aunque el área taller
 * haya sesgado el pool.
 */
function matchesFraseExacta(query: string, limit: number): SatSearchResult[] {
  const normalizedQuery = normalizarTextoSat(query)
  if (!normalizedQuery || normalizedQuery.length < 6) return []
  const queryStem = stemTextoSat(normalizedQuery)
  const hits: SatSearchResult[] = []

  for (const entry of getSatCatalogEntries()) {
    const descStem = stemTextoSat(normalizarTextoSat(entry.descripcion))
    // Solo contención de la query en la descripción (no al revés: evita que
    // títulos cortos del catálogo "enganchen" queries largas no relacionadas).
    if (descStem === queryStem || (queryStem.length >= 8 && descStem.includes(queryStem))) {
      const scored = scoreEntry(entry, query)
      if (scored && scored.score >= 400) hits.push(scored)
    }
  }

  return hits
    .sort((a, b) => b.score - a.score || a.entry.clave.localeCompare(b.entry.clave))
    .slice(0, limit)
}

function fusionarResultados(
  primarios: SatSearchResult[],
  extras: SatSearchResult[],
  limite: number
): SatSearchResult[] {
  const mapa = new Map<string, SatSearchResult>()
  for (const r of [...extras, ...primarios]) {
    const prev = mapa.get(r.entry.clave)
    if (!prev || r.score > prev.score) mapa.set(r.entry.clave, r)
  }
  return [...mapa.values()]
    .sort((a, b) => b.score - a.score || a.entry.clave.localeCompare(b.entry.clave))
    .slice(0, limite)
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

  const ranked = rankear(filtrarEntradas(opciones), cleaned, limite)

  const hayFiltroDivision = Boolean(
    opciones?.divisionPrefijos?.length || opciones?.divisionPrefijo?.trim()
  )
  if (opciones?.inyectarFraseExacta !== false && hayFiltroDivision) {
    const extras = matchesFraseExacta(cleaned, limite)
    if (extras.length > 0) return fusionarResultados(ranked, extras, limite)
  }

  return ranked
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
