import { describe, expect, it, vi } from "vitest"
import { sugerirClaveSatItem } from "@/lib/sat/sugerir-clave"
import { traducirConGlosario } from "@/lib/sat/glosario-industrial"

describe("Sugerencias SAT para componentes de moldes / ejector pin", () => {
  it("glosario-industrial traduce ejector pin a términos de moldes y expulsores", () => {
    const res = traducirConGlosario("P14-14 PCS Company's Ejector Pin")
    expect(res).not.toBeNull()
    expect(res?.terminosBusqueda).toMatch(/expulsor|botador|molde/)
    // No debe colapsar a solo "pasador"
    expect(res?.terminosBusqueda).not.toBe("pasador")
  })

  it("sugerirClaveSatItem no secuestra la descripción en inglés con un pasador genérico local", async () => {
    const mockTraducirYElegir = vi.fn().mockResolvedValue({
      terminosBusqueda: "ejector pin botador molde",
      clave: "31163220",
      motivo: "Pin expulsor para moldes",
      confianzaIa: "alta",
    })

    const res = await sugerirClaveSatItem(
      {
        descripcion: "P14-14 PCS Company's Ejector Pin",
        proveedor: "PCS Company",
      },
      new Map(),
      { traducirYElegir: mockTraducirYElegir }
    )

    // Debe invocar a la IA en lugar de secuestrar con pasador paralelo 27111558
    expect(mockTraducirYElegir).toHaveBeenCalled()
    expect(res.claveProdServ).toBe("31163220")
    expect(res.fuente).toBe("ia_rag")
  })
})
