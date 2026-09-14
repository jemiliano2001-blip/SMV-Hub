/**
 * B1 · T1.3 — vinculación histórica con alias, internos ignorados y sugerencias.
 * Nombres tomados de la calibración B0.2 (fantasmas reales de órdenes y cotizaciones).
 */
import { describe, expect, it } from "vitest"
import {
  analizarVinculacionHistoricaEnMemoria,
  esMarketplaceProbable,
  esNombreInterno,
  NOMBRES_INTERNOS_IGNORADOS,
  type DocumentoProveedorHistorico,
  type ProveedorCatalogoMinimo,
} from "@/lib/proveedores-vinculacion-core"

const CATALOGO: ProveedorCatalogoMinimo[] = [
  { id: "mcmaster", nombre: "McMaster-Carr", aliases: ["MCMASTER"] },
  { id: "msc", nombre: "MSC Industrial Direct", aliases: ["MSC Industrial Supply"] },
  { id: "mouser", nombre: "MOUSER ELECTRONICS.", aliases: [] },
  { id: "higoh", nombre: "HIGOH DISTRIBUCIONES" },
]

function doc(id: string, proveedor: string, proveedorId: string | null = null): DocumentoProveedorHistorico {
  return { id, proveedor, proveedorId }
}

describe("análisis de vinculación con alias", () => {
  it("un alias empata como exacto y se aplica solo; el nombre canónico también", () => {
    const r = analizarVinculacionHistoricaEnMemoria(
      [doc("o1", "MSC Industrial Supply"), doc("o2", "McMaster-Carr"), doc("o3", "mcmaster")],
      [],
      CATALOGO
    )
    expect(r.ordenes.vinculados).toBe(3)
    expect(r.ordenes.sinMatch).toBe(0)
    expect(r.vinculosOrdenes).toEqual([
      { id: "o1", proveedorId: "msc" },
      { id: "o2", proveedorId: "mcmaster" },
      { id: "o3", proveedorId: "mcmaster" },
    ])
    expect(r.fantasmas).toHaveLength(0)
  })

  it("un nombre/alias compartido por dos proveedores no vincula solo: queda como fantasma con sugerencia", () => {
    const ambiguo: ProveedorCatalogoMinimo[] = [
      { id: "a", nombre: "Grainger MX", aliases: ["Grainger"] },
      { id: "b", nombre: "Grainger USA", aliases: ["Grainger"] },
    ]
    const r = analizarVinculacionHistoricaEnMemoria([doc("o1", "Grainger")], [], ambiguo)
    expect(r.ordenes.vinculados).toBe(0)
    expect(r.ordenes.sinMatch).toBe(1)
    expect(r.fantasmas[0].sugerenciaCatalogo?.id).toBe("a")
  })

  it("los fantasmas traen sugerencia por 'empieza con' / 'incluye' y marcan marketplaces probables", () => {
    const r = analizarVinculacionHistoricaEnMemoria(
      [doc("o1", "EBAY"), doc("o2", "EBAY"), doc("o3", "Mouser"), doc("o4", "Novotechnik")],
      [doc("c1", "Higoh"), doc("c2", "HIGO"), doc("c3", "Amazon USA")],
      CATALOGO
    )
    const porNombre = new Map(r.fantasmas.map((f) => [`${f.origen}:${f.nombreLibre}`, f]))

    const ebay = porNombre.get("orden:EBAY")
    expect(ebay?.cantidadDocs).toBe(2)
    expect(ebay?.marketplaceProbable).toBe(true)
    expect(ebay?.sugerenciaCatalogo).toBeNull()

    expect(porNombre.get("orden:Mouser")?.sugerenciaCatalogo?.id).toBe("mouser")
    expect(porNombre.get("orden:Mouser")?.marketplaceProbable).toBe(false)
    expect(porNombre.get("orden:Novotechnik")?.sugerenciaCatalogo).toBeNull()

    expect(porNombre.get("cotizacion:Higoh")?.sugerenciaCatalogo?.id).toBe("higoh")
    expect(porNombre.get("cotizacion:HIGO")?.sugerenciaCatalogo?.id).toBe("higoh")
    expect(porNombre.get("cotizacion:Amazon USA")?.marketplaceProbable).toBe(true)

    // Orden: por cantidad de docs, descendente.
    expect(r.fantasmas[0].nombreLibre).toBe("EBAY")
  })

  it("los nombres internos no se vinculan ni cuentan como fantasma", () => {
    const r = analizarVinculacionHistoricaEnMemoria(
      [],
      [doc("c1", "Almacén Automatización"), doc("c2", "Linea"), doc("c3", "AUTOMATION"), doc("c4", "Higoh")],
      CATALOGO
    )
    expect(r.cotizaciones.ignoradosInternos).toBe(3)
    expect(r.cotizaciones.sinMatch).toBe(1)
    expect(r.fantasmas.map((f) => f.nombreLibre)).toEqual(["Higoh"])
  })

  it("documentos ya vinculados a un proveedor del catálogo no se recalculan", () => {
    const r = analizarVinculacionHistoricaEnMemoria([doc("o1", "lo que sea", "msc")], [], CATALOGO)
    expect(r.ordenes.yaTenianId).toBe(1)
    expect(r.vinculosOrdenes).toHaveLength(0)
  })
})

describe("helpers", () => {
  it("esNombreInterno reconoce las tres etiquetas internas con cualquier capitalización/acento", () => {
    for (const n of ["Almacén Automatización", "ALMACEN AUTOMATIZACION", "Linea", "línea", "AUTOMATION"]) {
      expect(esNombreInterno(n), n).toBe(true)
    }
    expect(esNombreInterno("AutomationDirect")).toBe(false)
    expect(esNombreInterno("")).toBe(false)
    expect(NOMBRES_INTERNOS_IGNORADOS).toHaveLength(3)
  })

  it("esMarketplaceProbable detecta canales y no vendedores", () => {
    for (const n of ["EBAY", "Ebay", "Amazon", "Amazon USA", "ALI EXPRESS", "AliExpress", "Mercado Libre"]) {
      expect(esMarketplaceProbable(n), n).toBe(true)
    }
    for (const n of ["McMaster-Carr", "MSC Industrial Supply", "Amazonas Aceros"]) {
      expect(esMarketplaceProbable(n), n).toBe(false)
    }
  })
})
