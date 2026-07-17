import type { OrdenCompra } from "@/lib/schemas"
import { normalizarTexto, esProbableHerramienta } from "@/lib/sugerencias-compra"
import {
  buscarClavesSat,
  sugerenciaSatBasicaPorDescripcion,
  type BuscarClavesSatOpciones,
  type SatSearchResult,
} from "@/lib/sat/buscar"
import { findSatCatalogEntryByKey } from "@/lib/sat/catalogo"
import { normalizarClaveProdServ } from "@/lib/sat/normalizar"
import { traducirConGlosario } from "@/lib/sat/glosario-industrial"
import { extraerTerminosClaveIndustrial } from "@/lib/sat/extraer-terminos"
import { clasificarAreaComprasSmv } from "@/lib/sat/perfil-compras-smv"
import {
  enriquecerHistorialEntry,
  buscarPorSku,
  buscarPorSimilitudTokens,
  historialMapToArray,
  fuenteDesdeMapeo,
  motivoDesdeMapeo,
} from "@/lib/sat/historial-sat"
import {
  getSatSugerenciaCache,
  setSatSugerenciaCache,
  claveCacheSat,
} from "@/lib/sat/cache-sugerencias"
import {
  traducirYElegirClaveSat,
  type GeminiSatDeps,
} from "@/lib/sat/gemini-sat"
import type {
  AlternativaSat,
  ConfianzaSat,
  FuenteSugerenciaSat,
  SugerenciaClaveSat,
  ItemParaSugerirSat,
  HistorialSatEntry,
  MapeoSmvEntry,
} from "@/lib/sat/types"

export type {
  AlternativaSat,
  ConfianzaSat,
  FuenteSugerenciaSat,
  SugerenciaClaveSat,
  ItemParaSugerirSat,
  HistorialSatEntry,
  MapeoSmvEntry,
} from "@/lib/sat/types"
export type { GeminiSatDeps } from "@/lib/sat/gemini-sat"
export { construirEntradaMapeoSmv, getMapeosSmv, combinarMapeosSmv } from "@/lib/sat/historial-sat"

export type SugerirClaveSatDeps = GeminiSatDeps & {
  /** Mapeos adicionales (p. ej. desde Firestore sat_asignaciones). */
  mapeos?: MapeoSmvEntry[]
}

const UMBRAL_SCORE_ALTO = 160
const UMBRAL_SCORE_MEDIO = 80
const UMBRAL_GAP_SCORE = 40
const CONCURRENCIA_LOTE_SAT = 3

function resolverMaxCandidatosGemini(): number {
  const raw = process.env.SAT_MAX_CANDIDATOS?.trim()
  const n = raw ? Number.parseInt(raw, 10) : 10
  return Number.isFinite(n) && n > 0 ? Math.min(n, 20) : 10
}

const PATRONES_DESCRIPCION_INGLES = [
  /\b(end\s*mill|endmill|carbide|flute|flutes|drill|reamer|tap|insert|holder|collet)\b/i,
  /\b(solid|stub|coated|altin|tiain|hss|cobalt|shank|cutting|tooling)\b/i,
  /\b(bolt|screw|washer|nut|bearing|spring|gauge|caliper)\b/i,
  /\b(mill|milling|boring|countersink|counterbore|deburr)\b/i,
]

/** Descripciones de compras USA: evitar falso positivo del catálogo en español. */
export function pareceDescripcionIngles(descripcion: string, proveedor = ""): boolean {
  const d = descripcion.trim()
  if (!d) return false

  const tieneEspanolIndustrial =
    /\b(tornillo|tuerca|arandela|fresa|broca|machuelo|resorte|sujecion|sujeción|herramienta|empaque|valvula|válvula|rodamiento|inserto)\b/i.test(
      d
    )
  if (tieneEspanolIndustrial) return false

  if (PATRONES_DESCRIPCION_INGLES.some((re) => re.test(d))) return true
  if (esProbableHerramienta(d, proveedor)) return true
  const tieneEspanol = /\b(de|del|la|las|el|los|para|con)\b/i.test(d)
  if (tieneEspanol) return false
  const palabras = d.split(/\s+/).filter((p) => p.length >= 3)
  const latinBasico = palabras.filter((p) => /^[a-z0-9./-]+$/i.test(p)).length
  return palabras.length >= 2 && latinBasico / palabras.length >= 0.8
}

function opcionesBusqueda(descripcion: string, proveedor?: string): BuscarClavesSatOpciones | undefined {
  const clasificacion = clasificarAreaComprasSmv(descripcion, proveedor ?? "")
  if (clasificacion.divisiones.length > 0) {
    return { divisionPrefijos: clasificacion.divisiones }
  }
  if (
    esProbableHerramienta(descripcion, proveedor ?? "") ||
    pareceDescripcionIngles(descripcion, proveedor)
  ) {
    return { divisionPrefijos: ["23", "27", "31"] }
  }
  return undefined
}

/** Construye mapa descripción→clave desde órdenes con clave ya asignada. */
export function construirHistorialSat(ordenes: OrdenCompra[]): Map<string, HistorialSatEntry> {
  const mapa = new Map<string, HistorialSatEntry>()
  for (const orden of ordenes) {
    const creadoEn = orden.creadoEn instanceof Date ? orden.creadoEn : new Date(orden.creadoEn)
    for (const item of orden.items ?? []) {
      const clave = normalizarClaveProdServ(item.claveProdServ)
      if (!clave || !item.descripcion?.trim()) continue
      const key = normalizarTexto(item.descripcion)
      const entry = enriquecerHistorialEntry(item.descripcion, clave, creadoEn)
      const existente = mapa.get(key)
      if (!existente || creadoEn > existente.creadoEn) {
        mapa.set(key, entry)
      }
    }
  }
  return mapa
}

/** Entradas ligeras enviadas desde el cliente (ya autenticado en Firestore). */
export function extraerEntradasHistorialSat(
  ordenes: OrdenCompra[]
): Array<{ descripcion: string; claveProdServ: string }> {
  const entradas: Array<{ descripcion: string; claveProdServ: string }> = []
  for (const orden of ordenes) {
    for (const item of orden.items ?? []) {
      const clave = normalizarClaveProdServ(item.claveProdServ)
      if (!clave || !item.descripcion?.trim()) continue
      entradas.push({ descripcion: item.descripcion, claveProdServ: clave })
    }
  }
  return entradas
}

export function construirHistorialSatDesdeEntradas(
  entradas: Array<{ descripcion: string; claveProdServ: string }>
): Map<string, HistorialSatEntry> {
  const mapa = new Map<string, HistorialSatEntry>()
  const ahora = new Date()
  for (const entrada of entradas) {
    const clave = normalizarClaveProdServ(entrada.claveProdServ)
    if (!clave || !entrada.descripcion.trim()) continue
    const key = normalizarTexto(entrada.descripcion)
    mapa.set(key, enriquecerHistorialEntry(entrada.descripcion, clave, ahora))
  }
  return mapa
}

function resultadoDesdeClave(
  clave: string,
  confianza: ConfianzaSat,
  motivo: string,
  fuente: FuenteSugerenciaSat,
  extra?: Partial<SugerenciaClaveSat>
): SugerenciaClaveSat {
  const entry = findSatCatalogEntryByKey(clave)
  return {
    claveProdServ: clave,
    descripcionSat: entry?.descripcion ?? null,
    confianza,
    motivo,
    fuente,
    ...extra,
  }
}

function confianzaDesdeScore(score: number): ConfianzaSat {
  if (score >= UMBRAL_SCORE_ALTO) return "alta"
  if (score >= UMBRAL_SCORE_MEDIO) return "media"
  return "baja"
}

function confianzaDesdeIa(valor: "alta" | "media" | "baja"): ConfianzaSat {
  return valor
}

function alternativasDesdeResults(results: SatSearchResult[], excluirClave?: string): AlternativaSat[] {
  return results
    .filter((r) => r.entry.clave !== excluirClave)
    .slice(0, 3)
    .map((r) => ({
      clave: r.entry.clave,
      descripcionSat: r.entry.descripcion,
      score: r.score,
    }))
}

/** Si el top candidato supera umbral absoluto o tiene gap claro vs el segundo, no hace falta Gemini. */
export function esResultadoClaro(results: SatSearchResult[]): boolean {
  const top = results[0]
  if (!top) return false
  // El término principal (tipo de producto) nunca coincidió — el score alto
  // suele deberse solo a material/acabado genérico (ej. "acero inoxidable"),
  // no a que el catálogo tenga el producto real. Mejor no sugerir nada que
  // sugerir con confianza algo equivocado.
  if (!top.coincideTerminoPrincipal) return false
  if (top.score >= UMBRAL_SCORE_ALTO) return true
  const segundo = results[1]
  if (top.score >= UMBRAL_SCORE_MEDIO && segundo) {
    return top.score - segundo.score >= UMBRAL_GAP_SCORE
  }
  return top.score >= UMBRAL_SCORE_MEDIO && !segundo
}

function claveDesdeEntry(entry: HistorialSatEntry | MapeoSmvEntry): string {
  return entry.claveProdServ
}

function buscarPorHistorial(
  descripcion: string,
  historial: Map<string, HistorialSatEntry>
): SugerenciaClaveSat | null {
  const key = normalizarTexto(descripcion)
  const entry = historial.get(key)
  if (!entry) return null
  return resultadoDesdeClave(
    entry.claveProdServ,
    "alta",
    "Misma descripción ya tiene clave asignada en el historial",
    "historial"
  )
}

function buscarPorHistorialExtendido(
  descripcion: string,
  historial: Map<string, HistorialSatEntry>,
  mapeos?: MapeoSmvEntry[]
): SugerenciaClaveSat | null {
  const lista = historialMapToArray(historial)

  const porSku = buscarPorSku(descripcion, lista, mapeos)
  if (porSku) {
    const clave = claveDesdeEntry(porSku)
    const esMapeo = !("descripcionNormalizada" in porSku)
    return resultadoDesdeClave(
      clave,
      "alta",
      motivoDesdeMapeo(porSku, "sku"),
      esMapeo ? fuenteDesdeMapeo(porSku) : "historial_sku"
    )
  }

  const porTokens = buscarPorSimilitudTokens(descripcion, lista, mapeos)
  if (porTokens) {
    const clave = claveDesdeEntry(porTokens.entry)
    const esMapeo = !("descripcionNormalizada" in porTokens.entry)
    const pct = Math.round(porTokens.similitud * 100)
    return resultadoDesdeClave(
      clave,
      pct >= 80 ? "alta" : "media",
      motivoDesdeMapeo(porTokens.entry, "fuzzy", pct),
      esMapeo ? fuenteDesdeMapeo(porTokens.entry) : "historial_fuzzy"
    )
  }

  return null
}

function buscarLocal(
  descripcion: string,
  opciones?: BuscarClavesSatOpciones
): SugerenciaClaveSat | null {
  const basica = sugerenciaSatBasicaPorDescripcion(descripcion, opciones)
  if (!basica.claveSugerida) return null

  const results = buscarClavesSat(descripcion, 5, opciones)
  const top = results[0]
  if (!top || !esResultadoClaro(results)) return null

  return resultadoDesdeClave(
    basica.claveSugerida,
    confianzaDesdeScore(top.score),
    basica.motivo,
    "local",
    { alternativas: alternativasDesdeResults(results, basica.claveSugerida) }
  )
}

function buscarDesdeTerminos(
  terminos: string,
  fuente: FuenteSugerenciaSat,
  prefijoMotivo: string,
  opciones?: BuscarClavesSatOpciones
): SugerenciaClaveSat | null {
  const results = buscarClavesSat(terminos, 5, opciones)
  const top = results[0]
  if (!top || !esResultadoClaro(results)) return null

  return resultadoDesdeClave(
    top.entry.clave,
    confianzaDesdeScore(top.score),
    `${prefijoMotivo}"${terminos}" → ${top.reasons[0] ?? "coincidencia en catálogo"}`,
    fuente,
    {
      terminosBusqueda: terminos,
      alternativas: alternativasDesdeResults(results, top.entry.clave),
    }
  )
}

function buscarConGlosario(
  descripcion: string,
  opciones?: BuscarClavesSatOpciones
): SugerenciaClaveSat | null {
  const traduccion = traducirConGlosario(descripcion)
  if (!traduccion) return null
  const resultado = buscarDesdeTerminos(
    traduccion.terminosBusqueda,
    "glosario",
    "Glosario: ",
    opciones
  )
  if (!resultado) return null
  return { ...resultado, terminosBusqueda: traduccion.terminosBusqueda }
}

function obtenerQueriesCandidatos(descripcion: string, terminosPrevios?: string): string[] {
  const { tokensEn } = extraerTerminosClaveIndustrial(descripcion)
  const terminosClave = tokensEn.join(" ")
  const glosario = traducirConGlosario(descripcion)?.terminosBusqueda

  return [
    terminosPrevios,
    glosario,
    terminosClave,
    extraerTerminosClaveIndustrial(descripcion).textoLimpio,
  ].filter((q): q is string => Boolean(q?.trim()))
}

function obtenerCandidatosParaGemini(
  descripcion: string,
  terminosPrevios: string | undefined,
  opciones?: BuscarClavesSatOpciones
): { candidatos: Array<{ clave: string; descripcion: string }>; scores: SatSearchResult[] } {
  const max = resolverMaxCandidatosGemini()
  const queries = obtenerQueriesCandidatos(descripcion, terminosPrevios)

  const vistos = new Set<string>()
  const scores: SatSearchResult[] = []
  const candidatos: Array<{ clave: string; descripcion: string }> = []

  for (const query of queries) {
    const results = buscarClavesSat(query, max, opciones)
    for (const r of results) {
      if (vistos.has(r.entry.clave)) continue
      vistos.add(r.entry.clave)
      scores.push(r)
      candidatos.push({ clave: r.entry.clave, descripcion: r.entry.descripcion })
      if (candidatos.length >= max) {
        return { candidatos, scores }
      }
    }
  }

  return { candidatos, scores }
}

function sinSugerencia(motivo: string, terminosBusqueda?: string): SugerenciaClaveSat {
  return {
    claveProdServ: null,
    descripcionSat: null,
    confianza: "baja",
    motivo,
    fuente: "manual",
    terminosBusqueda,
  }
}

function guardarEnCache(
  descripcion: string,
  proveedor: string | undefined,
  sugerencia: SugerenciaClaveSat
): SugerenciaClaveSat {
  setSatSugerenciaCache(descripcion, proveedor, sugerencia)
  return sugerencia
}

export async function sugerirClaveSatItem(
  item: ItemParaSugerirSat,
  historial: Map<string, HistorialSatEntry>,
  deps: SugerirClaveSatDeps = {}
): Promise<SugerenciaClaveSat> {
  const descripcion = item.descripcion?.trim() ?? ""
  if (!descripcion) {
    return sinSugerencia("Sin descripción suficiente para sugerir una clave SAT")
  }

  const cached = getSatSugerenciaCache(descripcion, item.proveedor)
  if (cached) return cached

  const traducirYElegir = deps.traducirYElegir ?? traducirYElegirClaveSat
  const opciones = opcionesBusqueda(descripcion, item.proveedor)
  const terminosGlosario = traducirConGlosario(descripcion)?.terminosBusqueda

  const desdeHistorial = buscarPorHistorial(descripcion, historial)
  if (desdeHistorial) return guardarEnCache(descripcion, item.proveedor, desdeHistorial)

  const desdeHistorialExt = buscarPorHistorialExtendido(descripcion, historial, deps.mapeos)
  if (desdeHistorialExt) return guardarEnCache(descripcion, item.proveedor, desdeHistorialExt)

  const omitirBusquedaLocal = pareceDescripcionIngles(descripcion, item.proveedor)
  const desdeLocal = omitirBusquedaLocal ? null : buscarLocal(descripcion, opciones)
  if (desdeLocal) return guardarEnCache(descripcion, item.proveedor, desdeLocal)

  // Si ya hay una traducción limpia en español (ej. descripcionSimplificada de
  // reportes-contables-ia), búscala directo en el catálogo antes de pedirle a
  // Gemini que elija — el mismo buscador que usa /claves-sat ya la encuentra
  // bien; no hace falta que la IA "adivine" entre candidatos.
  if (item.terminosPrevios?.trim()) {
    const desdeTerminosPrevios = buscarDesdeTerminos(
      item.terminosPrevios.trim(),
      "local",
      "Descripción traducida: ",
      opciones
    )
    if (desdeTerminosPrevios) return guardarEnCache(descripcion, item.proveedor, desdeTerminosPrevios)
  }

  const desdeGlosario = buscarConGlosario(descripcion, opciones)
  if (desdeGlosario) return guardarEnCache(descripcion, item.proveedor, desdeGlosario)

  const { candidatos, scores } = obtenerCandidatosParaGemini(
    descripcion,
    item.terminosPrevios?.trim() || terminosGlosario,
    opciones
  )

  try {
    const fusion = await traducirYElegir(descripcion, candidatos, item.proveedor, scores)

    if (fusion.clave && candidatos.some((c) => c.clave === fusion.clave)) {
      const resultsIa = buscarClavesSat(fusion.terminosBusqueda, 5, opciones)
      const desdeIa = resultadoDesdeClave(
        fusion.clave,
        confianzaDesdeIa(fusion.confianzaIa),
        fusion.motivo,
        "ia_rag",
        {
          terminosBusqueda: fusion.terminosBusqueda,
          alternativas: alternativasDesdeResults(resultsIa.length > 0 ? resultsIa : scores, fusion.clave),
        }
      )
      return guardarEnCache(descripcion, item.proveedor, desdeIa)
    }

    const desdeTerminosIa = buscarDesdeTerminos(
      fusion.terminosBusqueda,
      "traduccion",
      "Traducción IA: ",
      opciones
    )
    if (desdeTerminosIa) {
      return guardarEnCache(descripcion, item.proveedor, {
        ...desdeTerminosIa,
        terminosBusqueda: fusion.terminosBusqueda,
      })
    }
  } catch {
    // Sin sugerencia por IA
  }

  if (desdeLocal && !omitirBusquedaLocal) return desdeLocal

  return sinSugerencia(
    "No hubo coincidencias automáticas en el catálogo local ni con IA",
    terminosGlosario
  )
}

export async function sugerirClavesSatLote(
  items: ItemParaSugerirSat[],
  historial: Map<string, HistorialSatEntry>,
  deps: SugerirClaveSatDeps = {}
): Promise<SugerenciaClaveSat[]> {
  const resultados: SugerenciaClaveSat[] = new Array(items.length)
  const grupos = new Map<string, number[]>()

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const key = claveCacheSat(item.descripcion, item.proveedor ?? "")
    const indices = grupos.get(key) ?? []
    indices.push(i)
    grupos.set(key, indices)
  }

  const gruposPendientes = [...grupos.values()]
  let siguienteGrupo = 0
  const workers = Array.from(
    { length: Math.min(CONCURRENCIA_LOTE_SAT, gruposPendientes.length) },
    async () => {
      while (siguienteGrupo < gruposPendientes.length) {
        const indices = gruposPendientes[siguienteGrupo++]
        const item = items[indices[0]]
        const sugerencia = await sugerirClaveSatItem(item, historial, deps)
        for (const i of indices) {
          resultados[i] = sugerencia
        }
      }
    }
  )

  await Promise.all(workers)

  return resultados
}
