import { describe, expect, it } from "vitest"
import { normalizarConfirmacion } from "@/lib/confirmacion"

describe("confirmación accesible", () => {
  it("aplica textos y variante seguros por defecto", () => {
    expect(normalizarConfirmacion({ title: " ", description: " " })).toEqual({
      title: "Confirmar acción",
      description: "Revisa la acción antes de continuar.",
      confirmLabel: "Confirmar",
      cancelLabel: "Cancelar",
      variant: "default",
    })
  })

  it("conserva una confirmación destructiva explícita", () => {
    expect(
      normalizarConfirmacion({
        title: "Eliminar orden",
        description: "Esta acción no se puede deshacer.",
        confirmLabel: "Eliminar",
        cancelLabel: "Conservar",
        variant: "destructive",
      })
    ).toMatchObject({
      title: "Eliminar orden",
      confirmLabel: "Eliminar",
      cancelLabel: "Conservar",
      variant: "destructive",
    })
  })
})
