import { describe, expect, expectTypeOf, it } from "vitest"
import { buscarClavesSat } from "@/lib/sat/buscar"
import {
  getSatCatalogEntries,
  getSatCatalogMeta,
  type SatCatalogEntry,
} from "@/lib/sat/catalogo"

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
    // Es la búsqueda más pesada del archivo: descripción larga (9 tokens, 16
    // frases) y el top score queda <300, así que el glosario dispara una
    // segunda pasada completa sobre las ~52k claves. Si vuelve a acercarse al
    // timeout, el costo está en el scan lineal de `lib/sat/buscar.ts`
    // (`scoreEntry`), no en la carga del catálogo: el JSON se importa una vez
    // por archivo y el parse Zod queda cacheado en `getParsedCatalog()`.
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

  it("query 'guardamotor' resuelve claves de breakers/interruptores de circuito vía glosario", () => {
    const results = buscarClavesSat("guardamotor", 5)
    expect(results.length).toBeGreaterThan(0)
    expect(results.some((r) => /breaker|circuito|interruptor/i.test(r.entry.descripcion))).toBe(true)
  })

  it("query 'balero' resuelve rodamientos vía glosario", () => {
    const results = buscarClavesSat("balero", 5)
    expect(results.length).toBeGreaterThan(0)
    expect(results.some((r) => /rodamiento|balinera/i.test(r.entry.descripcion))).toBe(true)
  })

  it("query en inglés 'Compression Spring' resuelve resortes de compresión sin fallar", () => {
    const results = buscarClavesSat("Compression Spring", 5)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]?.entry.clave).toBe("31161904")
  })
})

describe("las entradas del catálogo SAT son inmutables por tipo", () => {
  // Contrato del que depende el caché por identidad de lib/sat/buscar.ts
  // (`textoEntrada`): si una entrada pudiera mutar después de la primera
  // búsqueda, el texto cacheado quedaría obsoleto en silencio. La garantía es
  // de compilación (tsc cubre tests/), no de runtime — ver nota en catalogo.ts.
  it("getSatCatalogEntries devuelve un arreglo readonly de entradas Readonly", () => {
    const entries = getSatCatalogEntries()
    expectTypeOf(entries).toEqualTypeOf<readonly SatCatalogEntry[]>()
    expectTypeOf<SatCatalogEntry["palabrasClave"]>().toEqualTypeOf<readonly string[]>()
    expect(entries.length).toBeGreaterThan(1000)
  })

  it("mutar una entrada o sus palabrasClave no compila", () => {
    // Nunca se ejecuta: solo existe para que tsc verifique los errores esperados.
    // Ejecutarla mutaría el catálogo compartido por el resto de los tests.
    const intentarMutar = (entry: SatCatalogEntry, entries: readonly SatCatalogEntry[]) => {
      // @ts-expect-error `descripcion` es readonly
      entry.descripcion = "mutada"
      // @ts-expect-error `palabrasClave` es readonly string[]: no tiene push
      entry.palabrasClave.push("MUTADA")
      // @ts-expect-error el arreglo de entradas es readonly: no tiene splice
      entries.splice(0, 1)
    }
    expect(intentarMutar).toBeTypeOf("function")
  })
})
