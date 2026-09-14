import { z } from "zod"
import catalogoData from "@/data/sat/catalogo.json"
import { normalizarTextoSat, tokenizarTextoSat } from "@/lib/sat/normalizar"

export const SatCatalogEntrySchema = z.object({
  clave: z.string().regex(/^\d{8}$/),
  descripcion: z.string().min(1),
  tipo: z.string().nullable().optional(),
  division: z.string().nullable().optional(),
  grupo: z.string().nullable().optional(),
  clase: z.string().nullable().optional(),
  palabrasClave: z.array(z.string()).default([]),
})

type SatCatalogEntryParsed = z.infer<typeof SatCatalogEntrySchema>

/**
 * Entrada del catálogo tal como se publica hacia afuera: **inmutable por tipo**.
 *
 * `lib/sat/buscar.ts` usa cada entrada como llave de un caché por identidad
 * (`textoEntrada`) que da por hecho que una entrada nunca cambia después de
 * creada; si alguien la mutara, el texto cacheado quedaría obsoleto en
 * silencio. Con este tipo, asignar a un campo o hacer `push` a `palabrasClave`
 * no compila (`tsc --noEmit` corre en CI y cubre `tests/`).
 *
 * La garantía es de compilación a propósito, no de runtime. Congelar con
 * `Object.freeze` / Zod `.readonly()` se midió el 2026-09-14 (Node 24, 52,513
 * entradas, patrón de acceso de `scoreEntry`): el arreglo `palabrasClave`
 * congelado sale del fast path de V8 (`PACKED_FROZEN_ELEMENTS`) y
 * `entry.palabrasClave.some(...)` pasa de ~20 ms a ~75 ms por pasada sobre el
 * catálogo (3–4×); congelar solo el objeto es gratis, pero protegería 5 de los 6
 * campos que forman el texto cacheado y no evitaría el caché obsoleto. Mejor una
 * sola garantía uniforme (el tipo) que una parcial en runtime.
 */
export type SatCatalogEntry = Readonly<
  Omit<SatCatalogEntryParsed, "palabrasClave"> & { palabrasClave: readonly string[] }
>

const SatCatalogFileSchema = z.object({
  version: z.string(),
  updatedAtUtc: z.string().nullable(),
  entries: z.array(SatCatalogEntrySchema),
})

type SatCatalogFile = z.infer<typeof SatCatalogFileSchema>

let parsedCatalogCache: SatCatalogFile | null = null

function getParsedCatalog(): SatCatalogFile {
  if (parsedCatalogCache) return parsedCatalogCache

  const parsed = SatCatalogFileSchema.safeParse(catalogoData)
  if (!parsed.success) {
    throw new Error(`Catálogo SAT inválido: ${parsed.error.issues.map((issue) => issue.message).join(", ")}`)
  }

  parsedCatalogCache = parsed.data
  return parsedCatalogCache
}

export function getSatCatalogEntries(): readonly SatCatalogEntry[] {
  return getParsedCatalog().entries
}

export function getSatCatalogMeta(): Pick<SatCatalogFile, "version" | "updatedAtUtc"> & { total: number } {
  const parsed = getParsedCatalog()
  return {
    version: parsed.version,
    updatedAtUtc: parsed.updatedAtUtc,
    total: parsed.entries.length,
  }
}

export function findSatCatalogEntryByKey(clave: string): SatCatalogEntry | null {
  return getSatCatalogEntries().find((entry) => entry.clave === clave) ?? null
}

export function buildSatCatalogEntry(input: {
  clave: string
  descripcion: string
  tipo?: string | null
  division?: string | null
  grupo?: string | null
  clase?: string | null
}): SatCatalogEntry {
  const palabrasClave = Array.from(
    new Set([
      ...tokenizarTextoSat(input.descripcion),
      ...tokenizarTextoSat([input.division, input.grupo, input.clase].filter(Boolean).join(" ")),
    ])
  )

  return SatCatalogEntrySchema.parse({
    clave: input.clave,
    descripcion: normalizarDescripcionCatalogo(input.descripcion),
    tipo: input.tipo ?? null,
    division: input.division ?? null,
    grupo: input.grupo ?? null,
    clase: input.clase ?? null,
    palabrasClave,
  })
}

function normalizarDescripcionCatalogo(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim()
  return normalized || normalizarTextoSat(value)
}
