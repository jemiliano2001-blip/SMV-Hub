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

vi.mock("@/lib/abastecimiento-server", () => {
  class ErrorRecepcionOrdenMock extends Error {
    statusCode: number
    constructor(message: string, statusCode = 500) {
      super(message)
      this.name = "ErrorRecepcionOrden"
      this.statusCode = statusCode
    }
  }

  return {
    recibirOrdenEnAlmacen: mockRecibirOrdenEnAlmacen,
    ErrorRecepcionOrden: ErrorRecepcionOrdenMock,
  }
})

import { POST } from "@/app/api/ordenes/[id]/recibir/route"

describe("POST /api/ordenes/[id]/recibir", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("devuelve 401 si no está autenticado", async () => {
    mockVerificarUsuarioAutorizado.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "No autorizado" }, { status: 401 }),
    })

    const request = new Request("http://localhost/api/ordenes/ord-123/recibir", {
      method: "POST",
    })

    const response = await POST(request, { params: Promise.resolve({ id: "ord-123" }) })
    expect(response.status).toBe(401)
  })

  it("devuelve 403 si el usuario no tiene permisos de almacén o compras", async () => {
    mockVerificarUsuarioAutorizado.mockResolvedValue({
      ok: true,
      uid: "user-123",
      email: "diseno@smv.com",
      token: "tok",
    })

    mockObtenerUsuarioAdmin.mockResolvedValue({
      rol: "diseno",
      modulos: ["diseno"],
      esSuperAdmin: false,
      activo: true,
    })

    const request = new Request("http://localhost/api/ordenes/ord-123/recibir", {
      method: "POST",
    })

    const response = await POST(request, { params: Promise.resolve({ id: "ord-123" }) })
    expect(response.status).toBe(403)
    const json = await response.json()
    expect(json.error).toContain("No tienes permisos")
  })

  it("devuelve 409 si la orden ya fue recibida (idempotencia)", async () => {
    mockVerificarUsuarioAutorizado.mockResolvedValue({
      ok: true,
      uid: "almacen-123",
      email: "almacen@smv.com",
      token: "tok",
    })

    mockObtenerUsuarioAdmin.mockResolvedValue({
      rol: "almacen",
      modulos: ["almacen"],
      esSuperAdmin: false,
      activo: true,
    })

    const { ErrorRecepcionOrden } = await import("@/lib/abastecimiento-server")
    mockRecibirOrdenEnAlmacen.mockRejectedValue(
      new ErrorRecepcionOrden("Esta orden de compra ya fue recibida en almacén", 409)
    )

    const request = new Request("http://localhost/api/ordenes/ord-123/recibir", {
      method: "POST",
      body: JSON.stringify({ notas: "Recepción duplicada" }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: "ord-123" }) })
    expect(response.status).toBe(409)
    const json = await response.json()
    expect(json.error).toContain("ya fue recibida")
  })

  it("devuelve 200 y registra la recepción correctamente para usuario con módulo almacen", async () => {
    mockVerificarUsuarioAutorizado.mockResolvedValue({
      ok: true,
      uid: "almacen-123",
      email: "almacen@smv.com",
      token: "tok",
    })

    mockObtenerUsuarioAdmin.mockResolvedValue({
      rol: "almacen",
      modulos: ["almacen"],
      esSuperAdmin: false,
      activo: true,
    })

    mockRecibirOrdenEnAlmacen.mockResolvedValue({
      estadoRecepcion: "recibida",
      entradaAlmacenId: "ent-789",
    })

    const request = new Request("http://localhost/api/ordenes/ord-123/recibir", {
      method: "POST",
      body: JSON.stringify({ notas: "Material en perfectas condiciones" }),
    })

    const response = await POST(request, { params: Promise.resolve({ id: "ord-123" }) })
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json).toEqual({
      estadoRecepcion: "recibida",
      entradaAlmacenId: "ent-789",
    })
    expect(mockRecibirOrdenEnAlmacen).toHaveBeenCalledWith({
      ordenId: "ord-123",
      uid: "almacen-123",
      email: "almacen@smv.com",
      nombre: "almacen",
      notas: "Material en perfectas condiciones",
    })
  })
})
