import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockVerificarAdmin, mockActualizar, mockResetear } = vi.hoisted(() => ({
  mockVerificarAdmin: vi.fn(),
  mockActualizar: vi.fn(),
  mockResetear: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({ verificarAdmin: mockVerificarAdmin }))
vi.mock("@/lib/usuarios-admin", () => ({
  actualizarUsuarioAdmin: mockActualizar,
  resetearPasswordAdmin: mockResetear,
}))

import { PATCH } from "@/app/api/usuarios/[uid]/route"
import { POST as resetPassword } from "@/app/api/usuarios/[uid]/reset-password/route"

function makeRequest(method: string, body?: unknown): Request {
  return new Request("http://localhost/api/usuarios/uid-1", {
    method,
    headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  })
}

const params = Promise.resolve({ uid: "uid-1" })

describe("PATCH /api/usuarios/[uid]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerificarAdmin.mockResolvedValue({ ok: true, uid: "admin-1", email: "jemiliano2001@gmail.com" })
  })

  it("retorna 403 si no es admin", async () => {
    mockVerificarAdmin.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Se requiere rol de administrador" }, { status: 403 }),
    })
    const res = await PATCH(makeRequest("PATCH", { rol: "diseno" }), { params })
    expect(res.status).toBe(403)
  })

  it("retorna 400 si el body no tiene rol ni activo", async () => {
    const res = await PATCH(makeRequest("PATCH", {}), { params })
    expect(res.status).toBe(400)
    expect(mockActualizar).not.toHaveBeenCalled()
  })

  it("actualiza el rol", async () => {
    const res = await PATCH(makeRequest("PATCH", { rol: "diseno" }), { params })
    expect(res.status).toBe(200)
    expect(mockActualizar).toHaveBeenCalledWith("uid-1", { rol: "diseno" })
  })

  it("actualiza activo", async () => {
    const res = await PATCH(makeRequest("PATCH", { activo: false }), { params })
    expect(res.status).toBe(200)
    expect(mockActualizar).toHaveBeenCalledWith("uid-1", { activo: false })
  })
})

describe("POST /api/usuarios/[uid]/reset-password", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerificarAdmin.mockResolvedValue({ ok: true, uid: "admin-1", email: "jemiliano2001@gmail.com" })
  })

  it("retorna 403 si no es admin", async () => {
    mockVerificarAdmin.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "Se requiere rol de administrador" }, { status: 403 }),
    })
    const res = await resetPassword(makeRequest("POST"), { params })
    expect(res.status).toBe(403)
  })

  it("resetea la contraseña y la retorna", async () => {
    mockResetear.mockResolvedValue("nueva-temp-123")
    const res = await resetPassword(makeRequest("POST"), { params })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ tempPassword: "nueva-temp-123" })
    expect(mockResetear).toHaveBeenCalledWith("uid-1")
  })
})
