import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockAdd } = vi.hoisted(() => ({ mockAdd: vi.fn() }))

vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn(() => ({ add: mockAdd })),
  },
}))

import { emitirNotificacionServer } from "@/lib/notificaciones-server"

describe("emitirNotificacionServer", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("agrega el documento con timestamps de servidor y devuelve el id", async () => {
    mockAdd.mockResolvedValueOnce({ id: "notif-1" })
    const id = await emitirNotificacionServer({
      tipo: "banos_solicitud_creada",
      titulo: "Solicitud de borrado de baño",
      cuerpo: "Juan Pérez · Baño #1 (2026-07-30) — motivo: duplicado",
      origenModulo: "banos",
      origenId: "solicitud-1",
      href: "/banos",
      creadoPorUid: "uid-1",
      creadoPorNombre: "Juan Pérez",
    })
    expect(id).toBe("notif-1")
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "banos_solicitud_creada", origenModulo: "banos" })
    )
  })

  it("no lanza si falla la escritura; devuelve null", async () => {
    mockAdd.mockRejectedValueOnce(new Error("network"))
    const id = await emitirNotificacionServer({
      tipo: "banos_solicitud_resuelta",
      titulo: "x",
      cuerpo: "y",
      origenModulo: "banos",
      origenId: "solicitud-1",
      href: "/banos",
      creadoPorUid: "uid-1",
      creadoPorNombre: "Juan Pérez",
    })
    expect(id).toBeNull()
  })
})
