import mapeosData from "@/data/sat/mapeos-smv.json"
import { z } from "zod"
import type { MapeoSmvEntry } from "@/lib/sat/types"
import {
  extraerSku,
  extraerTerminosClaveIndustrial,
  similitudJaccard,
} from "@/lib/sat/extraer-terminos"
import { normalizarTexto } from "@/lib/sugerencias-compra"
import { normalizarClaveProdServ } from "@/lib/sat/normalizar"
import type { HistorialSatEntry } from "@/lib/sat/types"

const MapeoSmvSchema = z.object({
  version: z.string(),
  entries: z.array(
    z.object({
      tokensNormalizados: z.array(z.string()),
      sku: z.string().nullable().optional(),
      claveProdServ: z.string().regex(/^\d{8}$/),
      descripcionEjemplo: z.string(),
    })
  ),
})

const UMBRAL_JACCARD = 0.6

let mapeosCache: MapeoSmvEntry[] | null = null

export function getMapeosSmv(): MapeoSmvEntry[] {
  if (mapeosCache) return mapeosCache
  const parsed = MapeoSmvSchema.safeParse(mapeosData)
  if (!parsed.success) return []
  mapeosCache = parsed.data.entries.map((e) => ({ ...e, origen: "json" as const }))
  return mapeosCache
}

function claveMapeo(entry: MapeoSmvEntry): string {
  if (entry.sku) return `sku:${entry.sku.toUpperCase()}`
  return `tok:${entry.tokensNormalizados.slice(0, 6).join("-")}::${entry.claveProdServ}`
}

/** Combina mapeos JSON del repo con validaciones de Firestore (Firestore gana en duplicados). */
export function combinarMapeosSmv(
  estaticos: MapeoSmvEntry[],
  firestore: MapeoSmvEntry[]
): MapeoSmvEntry[] {
  const mapa = new Map<string, MapeoSmvEntry>()
  for (const entry of estaticos) {
    mapa.set(claveMapeo(entry), entry)
  }
  for (const entry of firestore) {
    mapa.set(claveMapeo(entry), entry)
  }
  return Array.from(mapa.values())
}

export function getMapeosParaBusqueda(extraFirestore: MapeoSmvEntry[] = []): MapeoSmvEntry[] {
  return combinarMapeosSmv(getMapeosSmv(), extraFirestore)
}

export function enriquecerHistorialEntry(
  descripcion: string,
  claveProdServ: string,
  creadoEn: Date
): HistorialSatEntry {
  const { tokensEn } = extraerTerminosClaveIndustrial(descripcion)
  return {
    descripcionNormalizada: normalizarTexto(descripcion),
    claveProdServ,
    creadoEn,
    tokensNormalizados: tokensEn,
    sku: extraerSku(descripcion),
  }
}

export function fuenteDesdeMapeo(entry: HistorialSatEntry | MapeoSmvEntry): "historial_sku" | "mapeo_smv" | "mapeo_validado" {
  if ("descripcionNormalizada" in entry) return "historial_sku"
  return entry.origen === "firestore" ? "mapeo_validado" : "mapeo_smv"
}

export function motivoDesdeMapeo(
  entry: HistorialSatEntry | MapeoSmvEntry,
  tipo: "sku" | "fuzzy",
  similitudPct?: number
): string {
  if ("descripcionNormalizada" in entry) {
    return tipo === "sku"
      ? "SKU coincide con asignación previa en historial"
      : `Historial por similitud de términos (${similitudPct ?? 0}%)`
  }
  if (entry.origen === "firestore") {
    return tipo === "sku"
      ? "SKU coincide con clave validada por el equipo"
      : `Clave validada por el equipo — similitud ${similitudPct ?? 0}%`
  }
  return tipo === "sku"
    ? "SKU coincide con mapeo SMV curado"
    : `Mapeo SMV por similitud de términos (${similitudPct ?? 0}%)`
}

export function buscarPorSku(
  descripcion: string,
  historial: HistorialSatEntry[],
  mapeos: MapeoSmvEntry[] = getMapeosParaBusqueda()
): HistorialSatEntry | MapeoSmvEntry | null {
  const sku = extraerSku(descripcion)
  if (!sku) return null

  const skuNorm = sku.toUpperCase()
  for (const entry of historial) {
    if (entry.sku?.toUpperCase() === skuNorm) return entry
  }
  for (const mapeo of mapeos) {
    if (mapeo.sku?.toUpperCase() === skuNorm) return mapeo
  }
  return null
}

export function buscarPorSimilitudTokens(
  descripcion: string,
  historial: HistorialSatEntry[],
  mapeos: MapeoSmvEntry[] = getMapeosParaBusqueda()
): { entry: HistorialSatEntry | MapeoSmvEntry; similitud: number } | null {
  const { tokensEn } = extraerTerminosClaveIndustrial(descripcion)
  if (tokensEn.length === 0) return null

  let mejor: { entry: HistorialSatEntry | MapeoSmvEntry; similitud: number } | null = null

  const candidatos: Array<HistorialSatEntry | MapeoSmvEntry> = [...historial, ...mapeos]
  for (const entry of candidatos) {
    const tokensEntry = entry.tokensNormalizados ?? []
    if (tokensEntry.length === 0) continue
    const sim = similitudJaccard(tokensEn, tokensEntry)
    if (sim >= UMBRAL_JACCARD && (!mejor || sim > mejor.similitud)) {
      mejor = { entry, similitud: sim }
    }
  }

  return mejor
}

export function historialMapToArray(mapa: Map<string, HistorialSatEntry>): HistorialSatEntry[] {
  return Array.from(mapa.values())
}

export function construirEntradaMapeoSmv(
  descripcion: string,
  claveProdServ: string
): MapeoSmvEntry | null {
  const clave = normalizarClaveProdServ(claveProdServ)
  if (!clave) return null
  const { tokensEn } = extraerTerminosClaveIndustrial(descripcion)
  return {
    tokensNormalizados: tokensEn,
    sku: extraerSku(descripcion),
    claveProdServ: clave,
    descripcionEjemplo: descripcion.trim(),
  }
}
