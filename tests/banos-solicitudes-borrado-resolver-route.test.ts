/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockVerificarSuperAdmin, mockRegistrarAuditoriaServer, mockEmitirNotificacionServer } = vi.hoisted(() => ({
  mockVerificarSuperAdmin: vi.fn(),
  mockRegistrarAuditoriaServer: vi.fn().mockResolvedValue(undefined),
  mockEmitirNotificacionServer: vi.fn().mockResolvedValue("notif-1"),
}))

vi.mock("@/lib/api-auth", () => ({ verificarSuperAdmin: mockVerificarSuperAdmin }))
vi.mock("@/lib/auditoria-server", () => ({ registrarAuditoriaServer: mockRegistrarAuditoriaServer }))
vi.mock("@/lib/notificaciones-server", () => ({ emitirNotificacionServer: mockEmitirNotificacionServer }))

function fakeSolicitudDoc(overrides: Record<string, unknown> = {}) {
  return {
    exists: true,
    data: () => ({
      registroId: "registro-1",
      registroResumen: {
        operador: "Juan Pérez",
        bano: "Baño #1",
        fecha: "2026-07-30",
        horaEntrada: "10:00",
        horaLlegada: "10:07",
        tiempoMinutos: 7,
      },
      motivo: "bano_equivocado",
      solicitadoPorUid: "user-1",
      solicitadoPorNombre: "juan@smv.com",
      estado: "pendiente",
      ...overrides,
    }),
  }
}

function makeFakeAdminDb(opts: { solicitudDoc?: ReturnType<typeof fakeSolicitudDoc> | { exists: false } }) {
  const solicitudDocRef = {
    get: vi.fn().mockResolvedValue(opts.solicitudDoc ?? fakeSolicitudDoc()),
    update: vi.fn().mockResolvedValue(undefined),
  }
  const registroDocRef = { delete: vi.fn().mockResolvedValue(undefined), update: vi.fn().mockResolvedValue(undefined) }

  return {
    collection: vi.fn((name: string) => {
      if (name === "solicitudes_borrado_banos") return { doc: vi.fn(() => solicitudDocRef) }
      if (name === "registros-bano") return { doc: vi.fn(() => registroDocRef) }
      throw new Error(`colección no mockeada en test: ${name}`)
    }),
    __solicitudDocRef: solicitudDocRef,
    __registroDocRef: registroDocRef,
  }
}

let fakeAdminDb: ReturnType<typeof makeFakeAdminDb>

vi.mock("@/lib/firebase-admin", () => ({
  get adminDb() {
    return fakeAdminDb
  },
}))

import { POST } from "@/app/api/banos/solicitudes-borrado/[id]/resolver/route"

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/banos/solicitudes-borrado/solicitud-1/resolver", {
    method: "POST",
    body: JSON.stringify(body),
  })
}
function ctx(id = "solicitud-1") {
  return { params: Promise.resolve({ id }) }
}

describe("POST /api/banos/solicitudes-borrado/[id]/resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerificarSuperAdmin.mockResolvedValue({ ok: true, uid: "admin-1", email: "emiliano@smv.com" })
    fakeAdminDb = makeFakeAdminDb({})
  })

  it("retorna 403 si no es súper admin", async () => {
    mockVerificarSuperAdmin.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: "Se requiere acceso de super-administrador" }, { status: 403 }),
    })
    const res = await POST(makeRequest({ decision: "aprobar" }), ctx())
    expect(res.status).toBe(403)
  })

  it("retorna 400 con una decisión inválida", async () => {
    const res = await POST(makeRequest({ decision: "tal-vez" }), ctx())
    expect(res.status).toBe(400)
  })

  it("retorna 404 si la solicitud no existe", async () => {
    fakeAdminDb = makeFakeAdminDb({ solicitudDoc: { exists: false } as any })
    const res = await POST(makeRequest({ decision: "aprobar" }), ctx())
    expect(res.status).toBe(404)
  })

  it("retorna 409 si la solicitud ya fue resuelta", async () => {
    fakeAdminDb = makeFakeAdminDb({ solicitudDoc: fakeSolicitudDoc({ estado: "rechazada" }) })
    const res = await POST(makeRequest({ decision: "aprobar" }), ctx())
    expect(res.status).toBe(409)
  })

  it("aprobar borra el registro y marca la solicitud como aprobada", async () => {
    const res = await POST(makeRequest({ decision: "aprobar" }), ctx())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ estado: "aprobada" })
    expect(fakeAdminDb.__registroDocRef.delete).toHaveBeenCalled()
    expect(fakeAdminDb.__solicitudDocRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ estado: "aprobada", resueltoPorUid: "admin-1" })
    )
    expect(mockRegistrarAuditoriaServer).toHaveBeenCalled()
    expect(mockEmitirNotificacionServer).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "banos_solicitud_resuelta" })
    )
  })

  it("rechazar conserva el registro y limpia el badge pendiente", async () => {
    const res = await POST(makeRequest({ decision: "rechazar" }), ctx())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ estado: "rechazada" })
    expect(fakeAdminDb.__registroDocRef.delete).not.toHaveBeenCalled()
    expect(fakeAdminDb.__registroDocRef.update).toHaveBeenCalled()
    expect(fakeAdminDb.__solicitudDocRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ estado: "rechazada" })
    )
  })
})
