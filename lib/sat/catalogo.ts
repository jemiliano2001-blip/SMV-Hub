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

export type SatCatalogEntry = z.infer<typeof SatCatalogEntrySchema>

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

export function getSatCatalogEntries(): SatCatalogEntry[] {
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
