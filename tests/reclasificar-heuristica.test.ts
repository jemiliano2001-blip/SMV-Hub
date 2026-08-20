import { describe, expect, it } from "vitest"
import {
  calcularClasificacionHeuristica,
  evaluarReclasificacionHeuristica,
  type ItemReclasificable,
} from "@/lib/compras-odoo/reclasificar-heuristica"

function itemOtros(
  overrides: Partial<ItemReclasificable> & Pick<ItemReclasificable, "id" | "descripcion">,
): ItemReclasificable {
  return {
    categoriaId: "otros",
    claveProdServ: null,
    odooCategoria: null,
    tipoInsumo: null,
    tipoMetal: null,
    medida: null,
    ...overrides,
  }
}

describe("reclasificar-heuristica", () => {
  it("saca cable M12 de otros hacia electronica", () => {
    const cambio = calcularClasificacionHeuristica(
      itemOtros({ id: "1", descripcion: "Cable recto M-12 macho 5 metros" }),
    )
    expect(cambio?.categoriaId).toBe("electronica")
  })

  it("saca tungsteno de otros hacia consumibles", () => {
    const cambio = calcularClasificacionHeuristica(
      itemOtros({ id: "2", descripcion: "Tungsteno de carburo para EDM" }),
    )
    expect(cambio?.categoriaId).toBe("consumibles")
  })

  it("no propone cambio si sigue en otros", () => {
    const cambio = calcularClasificacionHeuristica(
      itemOtros({ id: "3", descripcion: "Servicio de mensajería express" }),
    )
    expect(cambio).toBeNull()
  })

  it("evalúa lote completo", () => {
    const items = [
      itemOtros({ id: "1", descripcion: "Tornillo socket head M8" }),
      itemOtros({ id: "2", descripcion: "Servicio administrativo" }),
    ]
    const res = evaluarReclasificacionHeuristica(items)
    expect(res).toHaveLength(1)
    expect(res[0].itemId).toBe("1")
    expect(res[0].categoriaId).toBe("tornilleria")
  })
})
