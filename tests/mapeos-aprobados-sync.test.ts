/**
 * B2 — el sync de compras Odoo aplica los mapeos aprobados (`clasificacion_ia_mapeos`).
 *
 * Los fixtures de "acepta" / "rechaza" son las muestras reales de la calibración B0
 * (docs/superpowers/plans/2026-09-13-estructura-datos-normalizacion.md, regla D), no casos
 * inventados: fijan el comportamiento que se validó contra los 2,325 ítems de producción.
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { normalizarDescripcionMapeo as normalizarCliente } from "@/lib/compras-odoo/mapeos-clasificacion"
import {
  buscarMapeoAprobadoSync,
  esMapeoEspecifico,
  indexarMapeosAprobados,
  mapeoAprobadoDesdeDoc,
  normalizarDescripcionMapeo,
  type MapeoAprobadoSync,
} from "../functions/src/compras-odoo/mapeos-aprobados"
import {
  construirItemDesdeLinea,
  type LineaCompraInput,
} from "../functions/src/compras-odoo/construir-item"

const raiz = resolve(import.meta.dirname, "..")

function mapeo(
  ejemplo: string,
  categoriaId: string,
  extra: Partial<Pick<MapeoAprobadoSync, "tipoInsumo" | "medida">> = {}
): MapeoAprobadoSync {
  return {
    descripcionNormalizada: normalizarDescripcionMapeo(ejemplo),
    categoriaId,
    tipoInsumo: extra.tipoInsumo ?? null,
    medida: extra.medida ?? null,
  }
}

// ── Muestras reales de B0.1 ─────────────────────────────────────────────────

/** Regla D acepta: el mapeo (SKU / medida / frase específica) aparece completo dentro del ítem. */
const ACEPTA: Array<[mapeoEjemplo: string, categoria: string, itemDescripcion: string]> = [
  ["CDQ2B12-10DZ", "neumatica", "CDQ2B12-10DZ Cilindro neumatico compacto"],
  ["CDQ2B12-10DZ", "neumatica", "piston CDQ2B12-10DZ con sensores"],
  ["CDQ2A100-50DZ", "neumatica", "Sensor para piston CDQ2A100-50DZ"],
  ['M2 1/2 x 7/8 x 20”', "metals", 'Acero M2 1/2 x 7/8 x 20"'],
  ['M2 3/4 x 2-1/8 x 20”', "metals", 'Acero M2 - 3/4" x 2 1/8" x 20'],
  ['O-1 1 x 1-1/2 x 24”', "metals", 'O-1 1 x 1-1/2 x 24-1/4"'],
  ['Estructural 90 x 90"', "metals", "Estructural 90 x 90 x 6 mts"],
  ["Jabon liquido para manos", "quimicos", "Jabon liquido para manos. Porrón"],
  ["PJ1270-6", "neumatica", "Banda de 6 costillas (500J6) black gold. PJ1270/6"],
  ["LM20UU", "tools", "balero 20mm LM20UU"],
  ["LM12UU", "tools", "Balero 12mm LM12UU"],
]

/** Regla D rechaza: palabra genérica, mapeo hacia `otros`, o inclusión al revés (ítem más corto). */
const RECHAZA: Array<[mapeoEjemplo: string, categoria: string, itemDescripcion: string]> = [
  ["Extensión", "otros", "Cable conector codo hembra M12 4 hilos, sin led, extension 2 m"],
  ["Balero", "otros", "Balero R6ZZ ( tapas metalicas)"],
  ["Balero", "otros", "Baleros SDB12"],
  ["Balero", "otros", "Balero 6001 FAG tapas neopreno"],
  ["Cadena", "otros", "Cadena sencilla de rodillos 40-1R"],
  ['llanta 4" con freno giratoria', "otros", "Llanta"],
  ['D2 2.5 x 4 x 12.25" (FISICO 2.620")', "metals", "D2   2.5 x 4 x 12.25''"],
  ['Anclas 1/4" x 3" (o mas arriba)', "tornilleria", "Anclas"],
  ['Balero lineal 1/2" SDB', "otros", 'Balero lineal 1/2" SDB8'],
]

describe("paridad lib/ ↔ functions/ (copias espejo)", () => {
  it("mapeos-aprobados.ts y construir-item.ts son idénticos byte a byte", () => {
    for (const nombre of ["mapeos-aprobados.ts", "construir-item.ts"]) {
      const enLib = readFileSync(resolve(raiz, "lib/compras-odoo", nombre), "utf8")
      const enFunctions = readFileSync(resolve(raiz, "functions/src/compras-odoo", nombre), "utf8")
      expect(enLib, `${nombre} difiere entre lib/ y functions/`).toBe(enFunctions)
    }
  })

  it("normaliza igual que el cliente (mapeos-clasificacion.ts)", () => {
    const muestras = [
      "Acero M2 1/2 x 7/8 x 20\"",
      "Jabón líquido para manos. Porrón",
      "  CDQ2B12-10DZ   Cilindro   neumático  ",
      "Ñandú Ø12 mm — tornillería",
      "",
      "###",
    ]
    for (const m of muestras) expect(normalizarDescripcionMapeo(m)).toBe(normalizarCliente(m))
  })
})

describe("mapeoAprobadoDesdeDoc", () => {
  it("parsea el documento que escribe el cliente", () => {
    expect(
      mapeoAprobadoDesdeDoc({
        descripcionNormalizada: "acero m2 1 2 x 7 8 x 20",
        descripcionEjemplo: 'Acero M2 1/2 x 7/8 x 20"',
        categoriaId: "metals",
        tipoInsumo: "acero_m2",
        medida: '1/2 x 7/8 x 20"',
        aprobadoPor: "compras@smv.com",
      })
    ).toEqual({
      descripcionNormalizada: "acero m2 1 2 x 7 8 x 20",
      categoriaId: "metals",
      tipoInsumo: "acero_m2",
      medida: '1/2 x 7/8 x 20"',
    })
  })

  it("devuelve null sin descripción o sin categoría; vacíos → null en tipo/medida", () => {
    expect(mapeoAprobadoDesdeDoc({ categoriaId: "metals" })).toBeNull()
    expect(mapeoAprobadoDesdeDoc({ descripcionNormalizada: "x" })).toBeNull()
    expect(mapeoAprobadoDesdeDoc({ descripcionNormalizada: " ", categoriaId: "metals" })).toBeNull()
    expect(
      mapeoAprobadoDesdeDoc({ descripcionNormalizada: "lm20uu", categoriaId: "tools", tipoInsumo: "", medida: "  " })
    ).toEqual({ descripcionNormalizada: "lm20uu", categoriaId: "tools", tipoInsumo: null, medida: null })
  })
})

describe("indexarMapeosAprobados", () => {
  it("separa exactos de específicos y ordena los específicos del más largo al más corto", () => {
    const indice = indexarMapeosAprobados([
      mapeo("Balero", "otros"),
      mapeo("LM20UU", "tools"),
      mapeo("Jabon liquido para manos", "quimicos"),
      mapeo("Extensión", "otros"),
      mapeo("Cadena", "electronica"), // genérica sin dígitos y < 12: no califica para incluye
    ])
    expect(indice.total).toBe(5)
    expect(indice.exactos.size).toBe(5)
    expect(indice.especificos.map((m) => m.descripcionNormalizada)).toEqual([
      "jabon liquido para manos",
      "lm20uu",
    ])
  })

  it("con descripciones duplicadas gana la primera (determinista entre corridas)", () => {
    const indice = indexarMapeosAprobados([mapeo("LM20UU", "tools"), mapeo("LM20UU", "otros")])
    expect(indice.total).toBe(1)
    expect(indice.exactos.get("lm20uu")?.categoriaId).toBe("tools")
  })

  it("esMapeoEspecifico: ≥ 12 chars o con dígitos, ≥ 5 chars, y nunca hacia otros", () => {
    expect(esMapeoEspecifico(mapeo("LM20UU", "tools"))).toBe(true)
    expect(esMapeoEspecifico(mapeo("Jabon liquido para manos", "quimicos"))).toBe(true)
    expect(esMapeoEspecifico(mapeo("Balero", "tools"))).toBe(false) // genérica
    expect(esMapeoEspecifico(mapeo("M2", "metals"))).toBe(false) // < 5 chars aunque tenga dígito
    expect(esMapeoEspecifico(mapeo("Jabon liquido para manos", "otros"))).toBe(false)
  })
})

describe("buscarMapeoAprobadoSync — regla D calibrada en B0", () => {
  const indice = indexarMapeosAprobados([...ACEPTA, ...RECHAZA].map(([ej, cat]) => mapeo(ej, cat)))

  it.each(ACEPTA)("acepta %s [%s] ⇐ %s", (ej, cat, item) => {
    const r = buscarMapeoAprobadoSync(item, indice)
    expect(r).not.toBeNull()
    expect(r?.descripcionNormalizada).toBe(normalizarDescripcionMapeo(ej))
    expect(r?.categoriaId).toBe(cat)
  })

  it.each(RECHAZA)("rechaza %s [%s] ⇐ %s", (ej, _cat, item) => {
    const r = buscarMapeoAprobadoSync(item, indice)
    // Puede empatar con OTRO mapeo específico del índice, pero nunca con este genérico/inverso.
    expect(r?.descripcionNormalizada).not.toBe(normalizarDescripcionMapeo(ej))
  })

  it("la igualdad exacta aplica siempre, incluso hacia otros (es la decisión humana literal)", () => {
    const soloBalero = indexarMapeosAprobados([mapeo("Balero", "otros")])
    expect(buscarMapeoAprobadoSync("  BALERO ", soloBalero)?.categoriaId).toBe("otros")
    expect(buscarMapeoAprobadoSync("Balero R6ZZ", soloBalero)).toBeNull()
  })

  it("el límite de palabra evita empates parciales dentro de un token", () => {
    const indice2 = indexarMapeosAprobados([mapeo("LM20UU", "tools")])
    expect(buscarMapeoAprobadoSync("balero LM20UU", indice2)).not.toBeNull()
    expect(buscarMapeoAprobadoSync("balero XLM20UUX", indice2)).toBeNull()
  })

  it("gana el mapeo más específico cuando varios aplican", () => {
    const indice3 = indexarMapeosAprobados([
      mapeo("Acero M2", "metals"), // 8 chars, con dígito → específico
      mapeo('Acero M2 1/2 x 7/8 x 20"', "metals", { tipoInsumo: "acero_m2", medida: '1/2 x 7/8 x 20"' }),
    ])
    const r = buscarMapeoAprobadoSync('Barra Acero M2 1/2 x 7/8 x 20" rectificada', indice3)
    expect(r?.medida).toBe('1/2 x 7/8 x 20"')
  })

  it("descripción vacía → null", () => {
    expect(buscarMapeoAprobadoSync("   ", indice)).toBeNull()
  })
})

describe("construirItemDesdeLinea con mapeos aprobados", () => {
  const linea: LineaCompraInput = {
    fuente: "po",
    odooDocId: 10,
    odooLineId: 1,
    referenciaDoc: "P00010",
    descripcion: "balero 20mm LM20UU",
    cantidad: 2,
    precioUnitario: 120,
    subtotal: 240,
    moneda: "MXN",
    fecha: "2026-09-01",
    odooPartnerId: 77,
    proveedorNombre: "RYASA",
    claveProdServ: null,
  }

  it("sin mapeos se comporta como antes: heurística y sin marca de mapeo", () => {
    const item = construirItemDesdeLinea(linea)
    expect(item.clasificadoPorMapeo).toBe(false)
    expect(item.clasificadoPorIa).toBe(false)
    const item2 = construirItemDesdeLinea(linea, { mapeosAprobados: null })
    expect(item2).toEqual(item)
  })

  it("con mapeo: categoría y tipo del mapeo, marcas de mapeo e IA, llave consistente con la clasificación final", () => {
    const indice = indexarMapeosAprobados([mapeo("LM20UU", "tools", { tipoInsumo: "balero_lineal", medida: "20mm" })])
    const heuristico = construirItemDesdeLinea(linea)
    const item = construirItemDesdeLinea(linea, { mapeosAprobados: indice })
    expect(item.categoriaId).toBe("tools")
    expect(item.tipoInsumo).toBe("balero_lineal")
    expect(item.medida).toBe("20mm")
    expect(item.tipoMetal).toBeNull() // no es metals
    expect(item.clasificadoPorMapeo).toBe(true)
    expect(item.clasificadoPorIa).toBe(true)
    expect(item.id).toBe(heuristico.id) // el id no depende de la clasificación
    expect(item.llaveItem).not.toBe("") // la llave se calcula con la clasificación final
  })

  it("con mapeo a metals: tipoMetal = tipoInsumo del mapeo; campos que el mapeo no trae conservan la heurística", () => {
    const indice = indexarMapeosAprobados([mapeo('Acero M2 1/2 x 7/8 x 20"', "metals", { tipoInsumo: "acero_m2" })])
    const item = construirItemDesdeLinea(
      { ...linea, descripcion: 'Barra Acero M2 1/2 x 7/8 x 20" rectificada' },
      { mapeosAprobados: indice }
    )
    expect(item.categoriaId).toBe("metals")
    expect(item.tipoInsumo).toBe("acero_m2")
    expect(item.tipoMetal).toBe("acero_m2")
    expect(item.clasificadoPorMapeo).toBe(true)
  })

  it("un ítem sin mapeo aplicable en un índice poblado sigue siendo heurístico", () => {
    const indice = indexarMapeosAprobados([mapeo("LM20UU", "tools")])
    const item = construirItemDesdeLinea({ ...linea, descripcion: "Placa nylon 10mm" }, { mapeosAprobados: indice })
    expect(item.clasificadoPorMapeo).toBe(false)
    expect(item.clasificadoPorIa).toBe(false)
  })
})
