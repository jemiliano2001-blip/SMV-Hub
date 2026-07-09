import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import type { OrdenCompra } from "@/lib/schemas"
import * as buscarSat from "@/lib/sat/buscar"
import { clearSatSugerenciaCache } from "@/lib/sat/cache-sugerencias"
import { traducirConGlosario } from "@/lib/sat/glosario-industrial"
import {
  construirHistorialSat,
  esResultadoClaro,
  sugerirClaveSatItem,
  sugerirClavesSatLote,
  pareceDescripcionIngles,
} from "@/lib/sat/sugerir-clave"
import { getSatCatalogEntries } from "@/lib/sat/catalogo"

function ordenMock(
  id: string,
  items: OrdenCompra["items"],
  creadoEn = new Date("2026-06-01")
): OrdenCompra {
  return {
    id,
    proveedor: "Test",
    numeroFactura: null,
    fechaFactura: null,
    moneda: "USD",
    subtotal: 100,
    envio: null,
    impuestos: null,
    total: 100,
    requisitor: "Juan",
    ordenTrabajo: "",
    empresa: "SMV",
    cuentaCargo: "Stock",
    destino: "SMV",
    linkProveedor: null,
    fechaEntrega: null,
    estado: "pendiente",
    items,
    creadoEn,
    actualizadoEn: creadoEn,
  }
}

describe("traducirConGlosario", () => {
  it("traduce end mill y carbide a términos en español", () => {
    const r = traducirConGlosario("1/4 Solid Carbide End Mill")
    expect(r).not.toBeNull()
    expect(r?.terminosBusqueda).toMatch(/herramienta|corte|carburo/)
  })
})

describe("esResultadoClaro", () => {
  it("acepta score alto sin segundo candidato", () => {
    const entry = getSatCatalogEntries()[0]
    expect(
      esResultadoClaro([{ entry, score: 200, reasons: [] }])
    ).toBe(true)
  })

  it("acepta gap claro entre primero y segundo", () => {
    const e1 = getSatCatalogEntries()[0]
    const e2 = getSatCatalogEntries()[1]
    expect(
      esResultadoClaro([
        { entry: e1, score: 120, reasons: [] },
        { entry: e2, score: 70, reasons: [] },
      ])
    ).toBe(true)
  })

  it("rechaza scores ambiguos", () => {
    const e1 = getSatCatalogEntries()[0]
    const e2 = getSatCatalogEntries()[1]
    expect(
      esResultadoClaro([
        { entry: e1, score: 90, reasons: [] },
        { entry: e2, score: 85, reasons: [] },
      ])
    ).toBe(false)
  })
})

describe("construirHistorialSat", () => {
  it("indexa claves por descripción normalizada", () => {
    const ordenes = [
      ordenMock("a", [
        {
          descripcion: "1/4 End Mill Carbide",
          cantidad: 1,
          precioUnitario: 10,
          total: 10,
          claveProdServ: "23151500",
          satPendiente: false,
          empresa: "SMV",
          cuentaCargo: "Stock",
          requisitor: "Juan",
          ordenTrabajo: "",
        },
      ]),
    ]
    const mapa = construirHistorialSat(ordenes)
    expect(mapa.get("1/4 end mill carbide")?.claveProdServ).toBe("23151500")
  })
})

describe("pareceDescripcionIngles", () => {
  it("detecta end mill como inglés", () => {
    expect(
      pareceDescripcionIngles("1/4 SE 4 Flute STUB ALTIN Solid Carbide End Mill", "Shars Tool Company")
    ).toBe(true)
  })

  it("no marca tornillo en español", () => {
    expect(pareceDescripcionIngles("tornillo sujecion hexagonal")).toBe(false)
  })
})

describe("sugerirClaveSatItem", () => {
  beforeEach(() => {
    clearSatSugerenciaCache()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    clearSatSugerenciaCache()
    vi.restoreAllMocks()
  })

  function mockSinCoincidenciaLocal() {
    vi.spyOn(buscarSat, "sugerenciaSatBasicaPorDescripcion").mockReturnValue({
      claveSugerida: null,
      motivo: "Sin coincidencias",
    })
    vi.spyOn(buscarSat, "buscarClavesSat").mockReturnValue([])
  }

  const sinGemini = { traducirYElegir: vi.fn() }

  it("reutiliza clave del historial con confianza alta", async () => {
    const historial = construirHistorialSat([
      ordenMock("a", [
        {
          descripcion: "Hex Bolt 1/4-20",
          cantidad: 1,
          precioUnitario: 1,
          total: 1,
          claveProdServ: "31161500",
          satPendiente: false,
          empresa: "",
          cuentaCargo: "",
          requisitor: "",
          ordenTrabajo: "",
        },
      ]),
    ])

    const result = await sugerirClaveSatItem(
      { descripcion: "Hex Bolt 1/4-20" },
      historial,
      sinGemini
    )

    expect(result.claveProdServ).toBe("31161500")
    expect(result.confianza).toBe("alta")
    expect(result.fuente).toBe("historial")
    expect(sinGemini.traducirYElegir).not.toHaveBeenCalled()
  })

  it("encuentra tornillo/bolt por búsqueda local sin Gemini", async () => {
    const result = await sugerirClaveSatItem(
      { descripcion: "hex bolt sujecion" },
      new Map(),
      sinGemini
    )

    expect(result.claveProdServ).not.toBeNull()
    expect(result.fuente).toMatch(/^(local|glosario|mapeo_smv|historial_fuzzy)$/)
    expect(["alta", "media"]).toContain(result.confianza)
    expect(sinGemini.traducirYElegir).not.toHaveBeenCalled()
  })

  it("end mill en inglés usa glosario sin Gemini", async () => {
    const result = await sugerirClaveSatItem(
      {
        descripcion: "1/4 SE 4 Flute STUB ALTIN Solid Carbide End Mill",
        proveedor: "Shars Tool Company",
      },
      new Map(),
      sinGemini
    )

    expect(sinGemini.traducirYElegir).not.toHaveBeenCalled()
    expect(result.claveProdServ).not.toBeNull()
    expect(result.fuente).toMatch(/^(glosario|mapeo_smv|historial_fuzzy)$/)
    expect(result.descripcionSat).not.toMatch(/semilla|plantula/i)
  })

  it("usa traducción IA cuando glosario no alcanza umbral", async () => {
    mockSinCoincidenciaLocal()
    const entry = getSatCatalogEntries().find((e) => e.clave === "31161500")
    vi.mocked(buscarSat.buscarClavesSat).mockImplementation((query: string) => {
      if (query.includes("widget especial")) {
        return entry
          ? [{ entry, score: 240, reasons: ["Coincidencia traducida"] }]
          : []
      }
      return []
    })

    const traducirYElegir = vi.fn().mockResolvedValue({
      terminosBusqueda: "widget especial maquinado",
      clave: null,
      motivo: "Traducción por IA",
      confianzaIa: "media" as const,
    })

    const result = await sugerirClaveSatItem(
      { descripcion: "Mystery industrial widget XYZ-999" },
      new Map(),
      { traducirYElegir }
    )

    expect(traducirYElegir).toHaveBeenCalledTimes(1)
    expect(result.fuente).toBe("traduccion")
    expect(result.claveProdServ).toBe("31161500")
  })

  it("usa ia_rag cuando la llamada fusionada elige candidato", async () => {
    mockSinCoincidenciaLocal()
    const entry = getSatCatalogEntries().find((e) => e.clave === "31161500")
    vi.mocked(buscarSat.buscarClavesSat).mockImplementation((query: string) => {
      if (query.includes("xyzabc")) return []
      return entry ? [{ entry, score: 100, reasons: ["candidato"] }] : []
    })

    const traducirYElegir = vi.fn().mockResolvedValue({
      terminosBusqueda: "xyzabc123 noexiste",
      clave: "31161500",
      motivo: "Tornillo de sujeción más cercano",
      confianzaIa: "alta" as const,
    })

    const result = await sugerirClaveSatItem(
      { descripcion: "Mystery industrial widget XYZ-999" },
      new Map(),
      { traducirYElegir }
    )

    expect(traducirYElegir).toHaveBeenCalledTimes(1)
    expect(result.claveProdServ).toBe("31161500")
    expect(result.fuente).toBe("ia_rag")
  })

  it("rechaza claves inventadas fuera de candidatos", async () => {
    mockSinCoincidenciaLocal()
    const entry = getSatCatalogEntries().find((e) => e.clave === "31161500")
    const entry2 = getSatCatalogEntries().find((e) => e.clave !== "31161500")
    vi.mocked(buscarSat.buscarClavesSat).mockReturnValue(
      entry && entry2
        ? [
            { entry, score: 100, reasons: ["candidato"] },
            { entry: entry2, score: 95, reasons: ["candidato2"] },
          ]
        : []
    )

    const traducirYElegir = vi.fn().mockResolvedValue({
      terminosBusqueda: "unknown part",
      clave: "99999999",
      motivo: "Inventada",
      confianzaIa: "alta" as const,
    })

    const result = await sugerirClaveSatItem(
      { descripcion: "Unknown part" },
      new Map(),
      { traducirYElegir }
    )

    expect(traducirYElegir).toHaveBeenCalled()
    expect(result.claveProdServ).toBeNull()
    expect(result.confianza).toBe("baja")
  })

  it("cache evita segunda llamada a Gemini", async () => {
    mockSinCoincidenciaLocal()
    const entry = getSatCatalogEntries().find((e) => e.clave === "31161500")
    vi.mocked(buscarSat.buscarClavesSat).mockImplementation((query: string) => {
      if (query.includes("widget cache")) {
        return entry
          ? [{ entry, score: 240, reasons: ["ok"] }]
          : []
      }
      return entry ? [{ entry, score: 100, reasons: ["candidato"] }] : []
    })

    const traducirYElegir = vi.fn().mockResolvedValue({
      terminosBusqueda: "widget cache test",
      clave: null,
      motivo: "IA",
      confianzaIa: "media" as const,
    })

    const item = { descripcion: "Cached widget item ABC" }
    const deps = { traducirYElegir }

    await sugerirClaveSatItem(item, new Map(), deps)
    const segundo = await sugerirClaveSatItem(item, new Map(), deps)

    expect(traducirYElegir).toHaveBeenCalledTimes(1)
    expect(segundo.claveProdServ).toBe("31161500")
  })
})

describe("sugerirClavesSatLote", () => {
  beforeEach(() => {
    clearSatSugerenciaCache()
    vi.restoreAllMocks()
  })

  it("deduplica descripciones iguales en un solo llamado a Gemini", async () => {
    vi.spyOn(buscarSat, "sugerenciaSatBasicaPorDescripcion").mockReturnValue({
      claveSugerida: null,
      motivo: "Sin coincidencias",
    })
    vi.spyOn(buscarSat, "buscarClavesSat").mockImplementation((query: string) => {
      const entry = getSatCatalogEntries().find((e) => e.clave === "31161500")
      if (query.includes("widget lote")) {
        return entry ? [{ entry, score: 240, reasons: ["ok"] }] : []
      }
      return entry ? [{ entry, score: 100, reasons: ["candidato"] }] : []
    })

    const traducirYElegir = vi.fn().mockResolvedValue({
      terminosBusqueda: "widget lote dedup",
      clave: null,
      motivo: "IA",
      confianzaIa: "media" as const,
    })

    const items = [
      { descripcion: "Batch widget lote A" },
      { descripcion: "Batch widget lote A" },
      { descripcion: "Batch widget lote A" },
    ]

    const resultados = await sugerirClavesSatLote(items, new Map(), { traducirYElegir })

    expect(traducirYElegir).toHaveBeenCalledTimes(1)
    expect(resultados).toHaveLength(3)
    expect(resultados.every((r) => r.claveProdServ === "31161500")).toBe(true)
  })
})
