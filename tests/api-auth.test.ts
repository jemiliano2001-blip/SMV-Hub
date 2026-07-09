import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockVerifyIdToken, mockObtenerUsuarioAdmin } = vi.hoisted(() => ({
  mockVerifyIdToken: vi.fn(),
  mockObtenerUsuarioAdmin: vi.fn(),
}))

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: { verifyIdToken: mockVerifyIdToken },
  adminDb: {},
}))

vi.mock("@/lib/usuarios-admin", () => ({
  obtenerUsuarioAdmin: mockObtenerUsuarioAdmin,
}))

import { verificarUsuarioAutorizado, verificarAdmin } from "@/lib/api-auth"

function makeRequest(authHeader?: string): Request {
  return new Request("http://localhost/api/test", {
    headers: authHeader ? { Authorization: authHeader } : {},
  })
}

describe("verificarUsuarioAutorizado", () => {
  beforeEach(() => vi.clearAllMocks())

  it("retorna 401 si no hay header Authorization", async () => {
    const res = await verificarUsuarioAutorizado(makeRequest())
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(401)
  })

  it("retorna 403 si el correo no está verificado", async () => {
    mockVerifyIdToken.mockResolvedValue({ email: "a@b.com", email_verified: false, uid: "u1" })
    const res = await verificarUsuarioAutorizado(makeRequest("Bearer token"))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(403)
  })

  it("retorna 403 si el usuario no existe en Firestore", async () => {
    mockVerifyIdToken.mockResolvedValue({ email: "a@b.com", email_verified: true, uid: "u1" })
    mockObtenerUsuarioAdmin.mockResolvedValue(null)
    const res = await verificarUsuarioAutorizado(makeRequest("Bearer token"))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(403)
  })

  it("retorna 403 si el usuario está desactivado", async () => {
    mockVerifyIdToken.mockResolvedValue({ email: "a@b.com", email_verified: true, uid: "u1" })
    mockObtenerUsuarioAdmin.mockResolvedValue({ rol: "compras", activo: false })
    const res = await verificarUsuarioAutorizado(makeRequest("Bearer token"))
    expect(res.ok).toBe(false)
  })

  it("retorna ok:true con uid y email si el usuario está activo", async () => {
    mockVerifyIdToken.mockResolvedValue({ email: "a@b.com", email_verified: true, uid: "u1" })
    mockObtenerUsuarioAdmin.mockResolvedValue({ rol: "compras", activo: true })
    const res = await verificarUsuarioAutorizado(makeRequest("Bearer token"))
    expect(res).toEqual({ ok: true, uid: "u1", email: "a@b.com" })
  })

  it("retorna 401 si verifyIdToken lanza (token inválido/expirado)", async () => {
    mockVerifyIdToken.mockRejectedValue(new Error("invalid token"))
    const res = await verificarUsuarioAutorizado(makeRequest("Bearer token"))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(401)
  })
})

describe("verificarAdmin", () => {
  beforeEach(() => vi.clearAllMocks())

  it("retorna 403 si el usuario está activo pero no es admin", async () => {
    mockVerifyIdToken.mockResolvedValue({ email: "a@b.com", email_verified: true, uid: "u1" })
    mockObtenerUsuarioAdmin.mockResolvedValue({ rol: "compras", activo: true })
    const res = await verificarAdmin(makeRequest("Bearer token"))
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.response.status).toBe(403)
  })

  it("retorna ok:true si el usuario es admin activo", async () => {
    mockVerifyIdToken.mockResolvedValue({ email: "a@b.com", email_verified: true, uid: "u1" })
    mockObtenerUsuarioAdmin.mockResolvedValue({ rol: "admin", activo: true })
    const res = await verificarAdmin(makeRequest("Bearer token"))
    expect(res).toEqual({ ok: true, uid: "u1", email: "a@b.com" })
  })
})
