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
})
