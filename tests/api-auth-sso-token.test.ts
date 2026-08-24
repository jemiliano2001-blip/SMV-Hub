import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockVerificarUsuarioAutorizado, mockCreateCustomToken } = vi.hoisted(() => ({
  mockVerificarUsuarioAutorizado: vi.fn(),
  mockCreateCustomToken: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({
  verificarUsuarioAutorizado: mockVerificarUsuarioAutorizado,
}))

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: {
    createCustomToken: mockCreateCustomToken,
  },
}))

import { POST } from "@/app/api/auth/sso-token/route"

describe("POST /api/auth/sso-token", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("retorna error de autenticación si el usuario no está autorizado", async () => {
    mockVerificarUsuarioAutorizado.mockResolvedValue({
      ok: false,
      response: Response.json({ error: "No autorizado" }, { status: 401 }),
    })

    const request = new Request("http://localhost/api/auth/sso-token", {
      method: "POST",
    })

    const res = await POST(request)
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBe("No autorizado")
    expect(mockCreateCustomToken).not.toHaveBeenCalled()
  })

  it("genera un custom token exitosamente para un usuario autorizado", async () => {
    mockVerificarUsuarioAutorizado.mockResolvedValue({
      ok: true,
      uid: "user-123",
      email: "operador@smv.com",
      token: "valid-id-token",
    })
    mockCreateCustomToken.mockResolvedValue("custom-jwt-token-xyz")

    const request = new Request("http://localhost/api/auth/sso-token", {
      method: "POST",
    })

    const res = await POST(request)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data).toEqual({
      ok: true,
      token: "custom-jwt-token-xyz",
    })
    expect(mockCreateCustomToken).toHaveBeenCalledWith("user-123")
  })

  it("retorna 500 si createCustomToken falla", async () => {
    mockVerificarUsuarioAutorizado.mockResolvedValue({
      ok: true,
      uid: "user-123",
      email: "operador@smv.com",
      token: "valid-id-token",
    })
    mockCreateCustomToken.mockRejectedValue(new Error("Error interno de Firebase"))

    const request = new Request("http://localhost/api/auth/sso-token", {
      method: "POST",
    })

    const res = await POST(request)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toContain("No se pudo generar el token de acceso")
  })
})
