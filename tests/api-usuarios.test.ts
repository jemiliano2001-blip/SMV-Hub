import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockVerificarAdmin, mockListar, mockCrear } = vi.hoisted(() => ({
  mockVerificarAdmin: vi.fn(),
  mockListar: vi.fn(),
  mockCrear: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({
  verificarAdmin: mockVerificarAdmin,
  verificarSuperAdmin: mockVerificarAdmin,
}))
vi.mock("@/lib/usuarios-admin", () => ({
  listarUsuariosAdmin: mockListar,
  crearUsuarioAdmin: mockCrear,
}))

import { GET, POST } from "@/app/api/usuarios/route"

function makeRequest(method: string, body?: unknown): Request {
  return new Request("http://localhost/api/usuarios", {
    method,
    headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe("GET /api/usuarios", () => {
  beforeEach(() => vi.clearAllMocks())

  it("retorna 403 si no es admin", async () => {
    mockVerificarAdmin.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Se requiere rol de administrador" }, { status: 403 }),
    })
    const res = await GET(makeRequest("GET"))
    expect(res.status).toBe(403)
    expect(mockListar).not.toHaveBeenCalled()
  })

  it("retorna la lista de usuarios si es admin", async () => {
    mockVerificarAdmin.mockResolvedValue({ ok: true, uid: "u1", email: "jemiliano2001@gmail.com" })
    mockListar.mockResolvedValue([
      {
        id: "uid-1",
        email: "compras@ejemplo.com",
        rol: "compras",
        activo: true,
        proveedor: "password",
        creadoPor: "jemiliano2001@gmail.com",
        creadoEn: new Date("2026-07-08T00:00:00Z"),
        actualizadoEn: new Date("2026-07-08T00:00:00Z"),
      },
    ])
    const res = await GET(makeRequest("GET"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.usuarios).toHaveLength(1)
    expect(body.usuarios[0].email).toBe("compras@ejemplo.com")
  })

  it("retorna 500 con mensaje claro si listarUsuariosAdmin falla", async () => {
    mockVerificarAdmin.mockResolvedValue({ ok: true, uid: "u1", email: "jemiliano2001@gmail.com" })
    mockListar.mockRejectedValue(new Error("Firestore no disponible"))
    const res = await GET(makeRequest("GET"))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/no se pudo cargar/i)
  })
})

describe("POST /api/usuarios", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerificarAdmin.mockResolvedValue({ ok: true, uid: "u1", email: "jemiliano2001@gmail.com" })
  })

  it("retorna 403 si no es admin", async () => {
    mockVerificarAdmin.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Se requiere rol de administrador" }, { status: 403 }),
    })
    const res = await POST(makeRequest("POST", { email: "a@b.com", rol: "compras" }))
    expect(res.status).toBe(403)
  })

  it("retorna 400 si el body es inválido", async () => {
    const res = await POST(makeRequest("POST", { email: "no-es-correo", rol: "compras" }))
    expect(res.status).toBe(400)
    expect(mockCrear).not.toHaveBeenCalled()
  })

  it("crea el usuario y retorna 201 con la contraseña temporal", async () => {
    mockCrear.mockResolvedValue({ uid: "uid-nuevo", tempPassword: "abc123" })
    const res = await POST(makeRequest("POST", { email: "nuevo@ejemplo.com", rol: "compras" }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toEqual({ uid: "uid-nuevo", tempPassword: "abc123" })
    expect(mockCrear).toHaveBeenCalledWith({
      email: "nuevo@ejemplo.com",
      plantilla: "compras",
      creadoPor: "jemiliano2001@gmail.com",
    })
  })

  it("retorna 409 con mensaje claro si el correo ya existe", async () => {
    mockCrear.mockRejectedValue(Object.assign(new Error("exists"), { code: "auth/email-already-exists" }))
    const res = await POST(makeRequest("POST", { email: "repetido@ejemplo.com", rol: "compras" }))
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/ya tiene cuenta/i)
  })

  it("crea el usuario con operador vinculado y retorna 201", async () => {
    mockCrear.mockResolvedValue({ uid: "uid-operador", tempPassword: "abc123" })
    const res = await POST(
      makeRequest("POST", {
        email: "operador@ejemplo.com",
        plantilla: "almacen",
        operadorId: "op-101",
        operadorNombre: "Juan Pérez",
      })
    )
    expect(res.status).toBe(201)
    expect(mockCrear).toHaveBeenCalledWith({
      email: "operador@ejemplo.com",
      plantilla: "almacen",
      operadorId: "op-101",
      operadorNombre: "Juan Pérez",
      creadoPor: "jemiliano2001@gmail.com",
    })
  })
})
