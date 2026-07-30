import { describe, expect, it } from "vitest"
import { buscarClavesSat } from "@/lib/sat/buscar"
import { getSatCatalogMeta } from "@/lib/sat/catalogo"

describe("buscarClavesSat con catálogo cargado", () => {
  it("tiene entradas en el catálogo local", () => {
    const meta = getSatCatalogMeta()
    expect(meta.total).toBeGreaterThan(1000)
  })

  it("encuentra una clave exacta por número", () => {
    const results = buscarClavesSat("31161500", 5)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]?.entry.clave).toBe("31161500")
  })

  it("encuentra tornillos por descripción", () => {
    const results = buscarClavesSat("tornillo sujecion", 5)
    expect(results.length).toBeGreaterThan(0)
    expect(results.some((result) => /TORNILLO|SUJECION|BOLT|SCREW/i.test(result.entry.descripcion))).toBe(true)
  })

  it("no confunde end mill con semillas por tokens cortos", () => {
    const desc = "1/4 SE 4 Flute STUB ALTIN Solid Carbide End Mill"
    const results = buscarClavesSat(desc, 5)
    expect(results.length).toBeGreaterThan(0)
    const top = results[0]
    expect(top?.entry.descripcion).not.toMatch(/semilla|plántula|plantula/i)
  })

  it("encuentra resortes por descripción", () => {
    const results = buscarClavesSat("resorte compresion", 5)
    expect(results.length).toBeGreaterThan(0)
    expect(results.some((result) => /RESORTE|SPRING|COMPRES/i.test(result.entry.descripcion))).toBe(true)
  })

  it("singular encuentra el mismo top result que plural (el catálogo dice 'Resortes')", () => {
    // Bug reportado: "resorte de compresión" (singular, como lo escribe la
    // gente) no encontraba la clave de "Resortes de compresión" (plural,
    // como está en el catálogo SAT) — "Tester del resorte tipo compresión"
    // salía primero por error.
    const singular = buscarClavesSat("resorte de compresion", 3)
    const plural = buscarClavesSat("resortes de compresion", 3)
    expect(singular[0]?.entry.clave).toBe(plural[0]?.entry.clave)
    expect(singular[0]?.entry.clave).toBe("31161904")
    expect(singular[0]?.entry.descripcion).toMatch(/^Resortes de compresión$/i)
    expect(singular[0]?.score).toBeGreaterThanOrEqual(400)
  })

  it("con filtro taller, 31161904 sigue primero y no ganan máquinas de forjado", () => {
    const results = buscarClavesSat("resorte de compresión", 5, {
      divisionPrefijos: ["23", "27", "31"],
    })
    expect(results[0]?.entry.clave).toBe("31161904")
    expect(results.map((r) => r.entry.clave)).not.toContain("23251710")
  })

  it("query solo 'resorte' prioriza el producto sobre máquina/herramienta", () => {
    const results = buscarClavesSat("resorte", 5, { divisionPrefijos: ["23", "27", "31"] })
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]?.entry.descripcion).toMatch(/^Resortes?\b/i)
    expect(results[0]?.entry.descripcion).not.toMatch(/máquina|forjado|tester|alicate/i)
  })
})
