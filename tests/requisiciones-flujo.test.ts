import { describe, it, expect } from "vitest"
import { DEMO_REQUISICIONES, DEMO_COTIZACIONES } from "../lib/requisiciones-flujo"

describe("Flujo Real de Compras Internas (Requisición -> Cotización -> OC)", () => {
  it("debe cargar al menos 3 requisiciones demo con ítems de herramental", () => {
    expect(DEMO_REQUISICIONES.length).toBeGreaterThanOrEqual(3)
    const req1 = DEMO_REQUISICIONES[0]
    expect(req1.folio).toBe("REQ-2026-881")
    expect(req1.prioridadFlujo).toBe("urgente")
    expect(req1.items?.length).toBe(2)
  })

  it("debe tener cotizaciones comparativas por proveedor para cada requisición", () => {
    expect(DEMO_COTIZACIONES.length).toBeGreaterThanOrEqual(4)
    const cot1 = DEMO_COTIZACIONES[0]
    expect(cot1.proveedorNombre).toBe("Shars Tool Company")
    expect(cot1.ganadora).toBe(true)
  })

  it("debe vincular la requisición aprobada con su proveedor ganador y orden de compra", () => {
    const reqAprobada = DEMO_REQUISICIONES.find((r) => r.estatusFlujo === "aprobada")
    expect(reqAprobada).toBeDefined()
    expect(reqAprobada?.proveedorGanadorNombre).toBe("Shars Tool Company")
    expect(reqAprobada?.ordenCompraFolio).toBe("OC-2026-904")
  })
})
