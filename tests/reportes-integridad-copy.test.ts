import { describe, expect, it } from "vitest"
import {
  integritySyncResultMessage,
  integrityUnavailableCopy,
} from "@/lib/reportes-integridad-copy"

describe("copy de disponibilidad de Integridad", () => {
  it("explica que los borradores de Odoo no habilitan el cálculo", () => {
    const copy = integrityUnavailableCopy({
      mode: "shadow",
      safeErrorCode: "SOURCE_SNAPSHOT_INVALID",
    })

    expect(copy.title).toBe("Fuente sin evidencia suficiente")
    expect(copy.description).toContain("facturas de proveedor publicadas")
    expect(copy.description).toContain("borrador")
  })

  it("distingue el modo apagado de una fuente inválida", () => {
    expect(
      integrityUnavailableCopy({ mode: "off", safeErrorCode: null })
    ).toEqual({
      title: "Integridad apagada",
      description:
        "El backend está desplegado de forma segura, pero el cálculo permanece apagado.",
    })
  })

  it("da feedback accionable al terminar un sync sin facturas posted", () => {
    expect(integritySyncResultMessage("SOURCE_SNAPSHOT_INVALID")).toContain(
      "deben estar publicadas"
    )
  })
})
