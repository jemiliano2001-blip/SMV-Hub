import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockVerificarSuperAdmin, mockRegistrarAuditoriaServer, mockCollection, mockBatch } = vi.hoisted(() => ({
  mockVerificarSuperAdmin: vi.fn(),
  mockRegistrarAuditoriaServer: vi.fn(),
  mockCollection: vi.fn(),
  mockBatch: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({ verificarSuperAdmin: mockVerificarSuperAdmin }))
vi.mock("@/lib/auditoria-server", () => ({ registrarAuditoriaServer: mockRegistrarAuditoriaServer }))
vi.mock("@/lib/firebase-admin", () => ({ adminDb: { collection: mockCollection, batch: mockBatch } }))
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "server-timestamp" } }))

import { POST } from "@/app/api/proveedores/backfill-mercado/route"

const accesoSuperAdmin = { ok: true as const, uid: "super-1", email: "super@smv.com", token: "token" }

function solicitud(payload: unknown) {
  return new Request("http://localhost/api/proveedores/backfill-mercado", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

function documento(id: string, data: Record<string, unknown>) {
  return { id, data: () => data }
}

function configurar(proveedores: ReturnType<typeof documento>[]) {
  mockCollection.mockImplementation(() => ({
    get: vi.fn().mockResolvedValue({ docs: proveedores }),
    doc: (id: string) => ({ coleccion: "proveedores", id }),
  }))
}

describe("POST /api/proveedores/backfill-mercado", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerificarSuperAdmin.mockResolvedValue(accesoSuperAdmin)
    configurar([
      documento("mcmaster", { nombre: "McMaster-Carr", mercado: "usa", origenProveedor: "semilla" }),
      documento("shars", { nombre: "Shars Tool Company" }),
      documento("higoh", { nombre: "HIGOH DISTRIBUCIONES", odooPartnerId: 4471, moneda: "USD" }),
      documento("sin-nombre", { odooPartnerId: 1 }),
    ])
  })

  it("exige super-admin antes de leer Firestore", async () => {
    mockVerificarSuperAdmin.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: "Se requiere acceso de super-administrador" }, { status: 403 }),
    })
    const respuesta = await POST(solicitud({ accion: "previsualizar" }))
    expect(respuesta.status).toBe(403)
    expect(mockCollection).not.toHaveBeenCalled()
  })

  it("previsualizar devuelve el plan sin escribir", async () => {
    const respuesta = await POST(solicitud({ accion: "previsualizar" }))
    const plan = (await respuesta.json()) as { total: number; sinCambio: number; cambios: Array<{ id: string; cambios: Record<string, string> }> }

    expect(respuesta.status).toBe(200)
    expect(plan.total).toBe(3) // el doc sin nombre se ignora
    expect(plan.sinCambio).toBe(1)
    expect(plan.cambios.map((c) => c.id)).toEqual(["shars", "higoh"])
    expect(plan.cambios[1].cambios).toEqual({ mercado: "mexico", origenProveedor: "odoo" })
    expect(mockBatch).not.toHaveBeenCalled()
    expect(mockRegistrarAuditoriaServer).not.toHaveBeenCalled()
  })

  it("aplicar escribe solo los campos faltantes, en batch, y audita", async () => {
    const actualizar = vi.fn()
    const confirmar = vi.fn().mockResolvedValue(undefined)
    mockBatch.mockReturnValue({ update: actualizar, commit: confirmar })

    const respuesta = await POST(solicitud({ accion: "aplicar" }))

    expect(respuesta.status).toBe(200)
    expect(await respuesta.json()).toEqual({ ok: true, aplicados: 2, conMercado: 2, conOrigen: 1, sinCambio: 1 })
    expect(actualizar).toHaveBeenCalledTimes(2)
    expect(actualizar).toHaveBeenCalledWith(
      { coleccion: "proveedores", id: "shars" },
      { mercado: "usa", actualizadoEn: "server-timestamp" }
    )
    expect(actualizar).toHaveBeenCalledWith(
      { coleccion: "proveedores", id: "higoh" },
      { mercado: "mexico", origenProveedor: "odoo", actualizadoEn: "server-timestamp" }
    )
    expect(confirmar).toHaveBeenCalledTimes(1)
    expect(mockRegistrarAuditoriaServer).toHaveBeenCalledWith(
      "super@smv.com",
      "EDITAR",
      "proveedores",
      "BACKFILL_MERCADO",
      expect.stringContaining("mercado en 2")
    )
  })

  it("rechaza acciones desconocidas", async () => {
    const respuesta = await POST(solicitud({ accion: "borrar-todo" }))
    expect(respuesta.status).toBe(400)
    expect(mockCollection).not.toHaveBeenCalled()
  })
})
