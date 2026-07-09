import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockDoc, mockGet } = vi.hoisted(() => ({
  mockDoc: vi.fn(),
  mockGet: vi.fn(),
}))

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: {},
  adminDb: {
    collection: vi.fn(() => ({ doc: mockDoc })),
  },
}))

import { generarPasswordTemporal, obtenerUsuarioAdmin } from "@/lib/usuarios-admin"
import { CORREO_ADMIN_BREAK_GLASS } from "@/lib/authorized-emails"

describe("generarPasswordTemporal", () => {
  it("genera una contraseña de 16 caracteres por defecto", () => {
    expect(generarPasswordTemporal()).toHaveLength(16)
  })

  it("respeta la longitud solicitada", () => {
    expect(generarPasswordTemporal(24)).toHaveLength(24)
  })

  it("no genera dos contraseñas iguales seguidas", () => {
    const a = generarPasswordTemporal()
    const b = generarPasswordTemporal()
    expect(a).not.toBe(b)
  })
})

describe("obtenerUsuarioAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDoc.mockReturnValue({ get: mockGet })
  })

  it("devuelve rol admin para el correo break-glass sin consultar Firestore", async () => {
    const info = await obtenerUsuarioAdmin("uid-1", CORREO_ADMIN_BREAK_GLASS)
    expect(info).toEqual({ rol: "admin", activo: true })
    expect(mockGet).not.toHaveBeenCalled()
  })

  it("devuelve null si el documento no existe", async () => {
    mockGet.mockResolvedValue({ exists: false })
    const info = await obtenerUsuarioAdmin("uid-2", "compras@ejemplo.com")
    expect(info).toBeNull()
  })

  it("devuelve rol y activo desde Firestore", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ rol: "compras", activo: true }),
    })
    const info = await obtenerUsuarioAdmin("uid-3", "compras@ejemplo.com")
    expect(info).toEqual({ rol: "compras", activo: true })
  })

  it("devuelve activo:false si el documento tiene activo:false", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ rol: "compras", activo: false }),
    })
    const info = await obtenerUsuarioAdmin("uid-4", "compras@ejemplo.com")
    expect(info).toEqual({ rol: "compras", activo: false })
  })

  it("devuelve null si el rol guardado no es válido", () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ rol: "gerente", activo: true }),
    })
    return expect(obtenerUsuarioAdmin("uid-5", "raro@ejemplo.com")).resolves.toBeNull()
  })
})
