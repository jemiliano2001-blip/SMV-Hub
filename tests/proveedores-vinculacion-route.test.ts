import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  mockVerificarSuperAdmin,
  mockRegistrarAuditoriaServer,
  mockCollection,
  mockGetAll,
  mockBatch,
  mockServerTimestamp,
} = vi.hoisted(() => ({
  mockVerificarSuperAdmin: vi.fn(),
  mockRegistrarAuditoriaServer: vi.fn(),
  mockCollection: vi.fn(),
  mockGetAll: vi.fn(),
  mockBatch: vi.fn(),
  mockServerTimestamp: vi.fn(() => "server-timestamp"),
}))

vi.mock("@/lib/api-auth", () => ({ verificarSuperAdmin: mockVerificarSuperAdmin }))
vi.mock("@/lib/auditoria-server", () => ({ registrarAuditoriaServer: mockRegistrarAuditoriaServer }))
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: mockCollection,
    getAll: mockGetAll,
    batch: mockBatch,
  },
}))
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: mockServerTimestamp },
}))

import { POST } from "@/app/api/proveedores/vinculacion/route"

const accesoSuperAdmin = { ok: true as const, uid: "super-1", email: "super@smv.com", token: "token" }

function solicitud(payload: unknown) {
  return new Request("http://localhost/api/proveedores/vinculacion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

function documento(id: string, data: Record<string, unknown>) {
  return { id, data: () => data, exists: true }
}

function configurarBase({
  ordenes = [],
  cotizaciones = [],
  proveedores = [],
}: {
  ordenes?: ReturnType<typeof documento>[]
  cotizaciones?: ReturnType<typeof documento>[]
  proveedores?: ReturnType<typeof documento>[]
} = {}) {
  mockCollection.mockImplementation((nombre: string) => ({
    get: vi.fn().mockResolvedValue({
      docs: nombre === "ordenes" ? ordenes : nombre === "cotizaciones" ? cotizaciones : proveedores,
    }),
    doc: (id: string) => ({ coleccion: nombre, id }),
  }))
  mockBatch.mockImplementation(() => ({ update: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) }))
}

describe("POST /api/proveedores/vinculacion", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerificarSuperAdmin.mockResolvedValue(accesoSuperAdmin)
    configurarBase()
  })

  it("detiene la solicitud antes de tocar Firestore si no es super-admin", async () => {
    mockVerificarSuperAdmin.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: "Se requiere acceso de super-administrador" }, { status: 403 }),
    })

    const respuesta = await POST(solicitud({ accion: "analizar" }))

    expect(respuesta.status).toBe(403)
    expect(mockCollection).not.toHaveBeenCalled()
  })

  it("rechaza una vinculación manual que excede el lote máximo", async () => {
    const respuesta = await POST(
      solicitud({
        accion: "vincularManual",
        coleccion: "ordenes",
        idsDocs: Array.from({ length: 21 }, (_, indice) => `orden-${indice}`),
        proveedorId: "proveedor-1",
      })
    )

    expect(respuesta.status).toBe(400)
    expect(mockGetAll).not.toHaveBeenCalled()
  })

  it("aplica sólo vínculos exactos y registra la auditoría del lote", async () => {
    const actualizar = vi.fn()
    const confirmar = vi.fn().mockResolvedValue(undefined)
    configurarBase({
      ordenes: [documento("orden-1", { proveedor: "SHARS TOOL COMPANY", proveedorId: null })],
      proveedores: [documento("proveedor-shars", { nombre: "Shars Tool Company" })],
    })
    mockBatch.mockReturnValue({ update: actualizar, commit: confirmar })

    const respuesta = await POST(solicitud({ accion: "aplicarAutomaticas" }))

    expect(respuesta.status).toBe(200)
    expect(actualizar).toHaveBeenCalledWith(
      { coleccion: "ordenes", id: "orden-1" },
      expect.objectContaining({ proveedorId: "proveedor-shars", actualizadoEn: "server-timestamp" })
    )
    expect(confirmar).toHaveBeenCalledTimes(1)
    expect(mockRegistrarAuditoriaServer).toHaveBeenCalledWith(
      "super@smv.com",
      "EDITAR",
      "proveedores",
      "BACKFILL_PROVEEDOR_ID",
      expect.stringContaining("1 órdenes")
    )
  })

  it("rechaza una vinculación manual si el proveedor ya no existe", async () => {
    mockGetAll.mockResolvedValueOnce([{ exists: false }])

    const respuesta = await POST(
      solicitud({
        accion: "vincularManual",
        coleccion: "ordenes",
        idsDocs: ["orden-1"],
        proveedorId: "proveedor-inexistente",
      })
    )

    expect(respuesta.status).toBe(400)
    expect(mockRegistrarAuditoriaServer).not.toHaveBeenCalled()
  })
})
