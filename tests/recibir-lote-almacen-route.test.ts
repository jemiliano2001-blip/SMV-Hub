import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  mockVerificarUsuarioAutorizado,
  mockObtenerUsuarioAdmin,
  mockRecibirOrdenEnAlmacen,
} = vi.hoisted(() => ({
  mockVerificarUsuarioAutorizado: vi.fn(),
  mockObtenerUsuarioAdmin: vi.fn(),
  mockRecibirOrdenEnAlmacen: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({
  verificarUsuarioAutorizado: mockVerificarUsuarioAutorizado,
}))

vi.mock("@/lib/usuarios-admin", () => ({
  obtenerUsuarioAdmin: mockObtenerUsuarioAdmin,
}))

vi.mock("@/lib/abastecimiento-server", () => ({
  recibirOrdenEnAlmacen: mockRecibirOrdenEnAlmacen,
}))

import { NextRequest } from "next/server"
import { POST } from "@/app/api/ordenes/recibir-lote/route"

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ordenes/recibir-lote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

describe("POST /api/ordenes/recibir-lote", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerificarUsuarioAutorizado.mockResolvedValue({
      ok: true,
      uid: "usr-almacen-1",
      email: "jesus.almacen@smv.com",
    })
    mockObtenerUsuarioAdmin.mockResolvedValue({
      uid: "usr-almacen-1",
      email: "jesus.almacen@smv.com",
      esSuperAdmin: false,
      modulos: ["almacen"],
    })
  })

  it("retorna 403 si el usuario no tiene permisos de almacén ni compras", async () => {
    mockObtenerUsuarioAdmin.mockResolvedValueOnce({
      uid: "usr-sin-acceso",
      email: "visitante@smv.com",
      esSuperAdmin: false,
      modulos: ["banos"],
    })

    const req = makeRequest({ ordenIds: ["ord-1"] })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toMatch(/No tienes permisos/)
  })

  it("retorna 400 si el payload es inválido o el arreglo de IDs está vacío", async () => {
    const req = makeRequest({ ordenIds: [] })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/Payload inválido/)
  })

  it("procesa múltiples órdenes en lote y acumula éxitos y fallas sin cancelar el lote", async () => {
    mockRecibirOrdenEnAlmacen
      .mockResolvedValueOnce({ estadoRecepcion: "recibida", entradaAlmacenId: "ent-1" })
      .mockRejectedValueOnce(new Error("Esta orden de compra ya fue recibida en almacén"))
      .mockResolvedValueOnce({ estadoRecepcion: "recibida", entradaAlmacenId: "ent-3" })

    const req = makeRequest({
      ordenIds: ["ord-1", "ord-2", "ord-3"],
      notas: "Ubicado en estante B2",
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()

    expect(json.recibidas).toEqual(["ord-1", "ord-3"])
    expect(json.fallidas).toHaveLength(1)
    expect(json.fallidas[0]).toEqual({
      ordenId: "ord-2",
      error: "Esta orden de compra ya fue recibida en almacén",
    })

    expect(mockRecibirOrdenEnAlmacen).toHaveBeenCalledTimes(3)
    expect(mockRecibirOrdenEnAlmacen).toHaveBeenCalledWith(
      expect.objectContaining({
        ordenId: "ord-1",
        uid: "usr-almacen-1",
        notas: "Ubicado en estante B2",
      })
    )
  })
})
