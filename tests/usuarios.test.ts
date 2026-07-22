import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockGetDoc } = vi.hoisted(() => ({ mockGetDoc: vi.fn() }))

vi.mock("@/lib/firebase", () => ({ db: { type: "mocked-db" } }))

vi.mock("firebase/firestore", () => ({
  doc: vi.fn((...args: unknown[]) => ({ type: "docRef", args })),
  getDoc: mockGetDoc,
}))

import { obtenerRolUsuario, obtenerPermisosUsuario } from "@/lib/usuarios"

describe("obtenerRolUsuario", () => {
  beforeEach(() => vi.clearAllMocks())

  it("devuelve admin para el correo break-glass sin leer Firestore", async () => {
    const rol = await obtenerRolUsuario("uid-1", "jemiliano2001@gmail.com")
    expect(rol).toBe("admin")
    expect(mockGetDoc).not.toHaveBeenCalled()
  })

  it("devuelve null si el documento no existe", async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false })
    const rol = await obtenerRolUsuario("uid-2", "compras@ejemplo.com")
    expect(rol).toBeNull()
  })

  it("devuelve null si el usuario está desactivado", async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ rol: "compras", activo: false }),
    })
    const rol = await obtenerRolUsuario("uid-3", "compras@ejemplo.com")
    expect(rol).toBeNull()
  })

  it("devuelve el rol si el usuario está activo", async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ rol: "diseno", activo: true }),
    })
    const rol = await obtenerRolUsuario("uid-4", "diseno@ejemplo.com")
    expect(rol).toBe("diseno")
  })
})

describe("obtenerPermisosUsuario", () => {
  beforeEach(() => vi.clearAllMocks())

  it("break-glass es super-admin con plantilla admin", async () => {
    const p = await obtenerPermisosUsuario("uid-1", "jemiliano2001@gmail.com")
    expect(p?.esSuperAdmin).toBe(true)
    expect(p?.modulos).toContain("usuarios")
  })

  it("deriva módulos desde rol legacy", async () => {
    mockGetDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ rol: "almacen", activo: true }),
    })
    const p = await obtenerPermisosUsuario("uid-2", "almacen@ejemplo.com")
    expect(p?.plantilla).toBe("almacen")
    expect(p?.modulos).toContain("almacen")
    expect(p?.modulos).not.toContain("reabastecimiento-rop")
    expect(p?.esSuperAdmin).toBe(false)
  })
})
