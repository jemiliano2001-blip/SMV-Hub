import { describe, expect, it } from "vitest"
import { TipoNotificacionSchema } from "@/lib/schemas"
import { tituloParaTipo } from "@/lib/notificaciones"

describe("documentos-venta — titulos de notificación", () => {
  it("TipoNotificacionSchema acepta los tipos de solicitud de documento", () => {
    for (const t of [
      "solicitud_documento_creada",
      "solicitud_documento_estado",
      "solicitud_documento_mensaje",
    ] as const) {
      expect(TipoNotificacionSchema.parse(t)).toBe(t)
    }
  })

  it("tituloParaTipo devuelve títulos legibles para documentos de venta", () => {
    expect(tituloParaTipo("solicitud_documento_creada")).toBe("Nueva solicitud de documento")
    expect(tituloParaTipo("solicitud_documento_estado")).toBe(
      "Solicitud de documento actualizada"
    )
    expect(tituloParaTipo("solicitud_documento_mensaje")).toBe("Nuevo mensaje en solicitud")
  })
})
