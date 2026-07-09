import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import * as buscarSat from "@/lib/sat/buscar"
import { clearSatSugerenciaCache } from "@/lib/sat/cache-sugerencias"
import { traducirConGlosario } from "@/lib/sat/glosario-industrial"
import { extraerTerminosClaveIndustrial } from "@/lib/sat/extraer-terminos"
import { buscarPorSku } from "@/lib/sat/historial-sat"
import { sugerirClaveSatItem } from "@/lib/sat/sugerir-clave"
import { findSatCatalogEntryByKey } from "@/lib/sat/catalogo"
import { CASOS_SMV_SAT } from "./sat-casos-smv.fixture"

const sinGemini = {
  traducirYElegir: vi.fn().mockResolvedValue({
    terminosBusqueda: "skip",
    clave: null,
    motivo: "skip",
    confianzaIa: "baja" as const,
  }),
}

describe("extraerTerminosClaveIndustrial", () => {
  it("extrae reamer y hss ignorando medidas", () => {
    const r = extraerTerminosClaveIndustrial(
      '9.6mm (.378") 6 Flute HSS Straight Flute Chucking Reamer LV533-3780'
    )
    expect(r.tokensEn).toContain("reamer")
    expect(r.sku).toBe("LV533-3780")
    expect(r.textoLimpio).not.toMatch(/9\.6mm/)
  })
})

describe("traducirConGlosario reamer", () => {
  it("traduce chucking reamer a escariador limador", () => {
    const r = traducirConGlosario("9.6mm HSS Straight Flute Chucking Reamer LV533-3780")
    expect(r).not.toBeNull()
    expect(r?.terminosBusqueda).toMatch(/escariador|limador/)
    expect(r?.terminosBusqueda).not.toMatch(/metal/)
  })
})

describe("CASOS_SMV_SAT sin Gemini", () => {
  beforeEach(() => {
    clearSatSugerenciaCache()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    clearSatSugerenciaCache()
    vi.restoreAllMocks()
  })

  for (const caso of CASOS_SMV_SAT) {
    it(`sugiere clave válida para: ${caso.descripcion.slice(0, 40)}`, async () => {
      const result = await sugerirClaveSatItem(
        { descripcion: caso.descripcion, proveedor: caso.proveedor },
        new Map(),
        sinGemini
      )

      expect(result.claveProdServ).not.toBeNull()

      if (caso.patronDescripcionSat && result.descripcionSat) {
        expect(result.descripcionSat).toMatch(new RegExp(caso.patronDescripcionSat, "i"))
      }

      if (caso.fuentesAceptables) {
        expect(caso.fuentesAceptables).toContain(result.fuente)
      }
    })
  }

  it("chucking reamer usa mapeo SMV por SKU", () => {
    const desc =
      '9.6mm (.378") 6 Flute HSS Straight Flute Chucking Reamer L&I LV533-3780'
    const match = buscarPorSku(desc, [])
    expect(match).not.toBeNull()
    if (match && "claveProdServ" in match) {
      expect(match.claveProdServ).toBe("23241645")
    }
  })

  it("chucking reamer glosario encuentra escariador en catálogo", () => {
    const terminos = traducirConGlosario("9.6mm HSS Chucking Reamer LV533-3780")?.terminosBusqueda
    expect(terminos).toBeTruthy()
    const results = buscarSat.buscarClavesSat(terminos!, 5, { divisionPrefijo: "23" })
    expect(results.length).toBeGreaterThan(0)
    expect(results.some((r) => /ESCARIADOR|LIMADOR/i.test(r.entry.descripcion))).toBe(true)
  })
})

describe("CASOS_SMV_SAT claves en catálogo", () => {
  const clavesUnicas = [...new Set(CASOS_SMV_SAT.map((c) => c.claveEsperada))]
  for (const clave of clavesUnicas) {
    it(`clave ${clave} existe`, () => {
      expect(findSatCatalogEntryByKey(clave)).not.toBeNull()
    })
  }
})
