import { describe, it, expect, vi, beforeEach } from "vitest"

const {
  mockDoc,
  mockGet,
  mockSet,
  mockUpdate,
  mockCreateUser,
  mockUpdateUser,
  mockOrderBy,
  mockCollectionGet,
} = vi.hoisted(() => ({
  mockDoc: vi.fn(),
  mockGet: vi.fn(),
  mockSet: vi.fn(),
  mockUpdate: vi.fn(),
  mockCreateUser: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockOrderBy: vi.fn(),
  mockCollectionGet: vi.fn(),
}))

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: {
    createUser: mockCreateUser,
    updateUser: mockUpdateUser,
  },
  adminDb: {
    collection: vi.fn(() => ({
      doc: mockDoc,
      orderBy: mockOrderBy,
    })),
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

import {
  crearUsuarioAdmin,
  actualizarUsuarioAdmin,
  resetearPasswordAdmin,
  listarUsuariosAdmin,
} from "@/lib/usuarios-admin"

describe("crearUsuarioAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDoc.mockReturnValue({ set: mockSet, update: mockUpdate })
  })

  it("crea la cuenta en Auth con emailVerified:true y el documento en Firestore", async () => {
    mockCreateUser.mockResolvedValue({ uid: "uid-nuevo" })
    const resultado = await crearUsuarioAdmin({
      email: "nuevo@ejemplo.com",
      rol: "compras",
      creadoPor: "jemiliano2001@gmail.com",
    })

    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "nuevo@ejemplo.com", emailVerified: true })
    )
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "nuevo@ejemplo.com",
        rol: "compras",
        activo: true,
        proveedor: "password",
        creadoPor: "jemiliano2001@gmail.com",
      })
    )
    expect(resultado.uid).toBe("uid-nuevo")
    expect(resultado.tempPassword).toHaveLength(16)
  })
})

describe("actualizarUsuarioAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDoc.mockReturnValue({ update: mockUpdate })
  })

  it("actualiza el rol en Firestore sin tocar Auth", async () => {
    await actualizarUsuarioAdmin("uid-1", { rol: "diseno" })
    expect(mockUpdateUser).not.toHaveBeenCalled()
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ rol: "diseno" }))
  })

  it("al desactivar, deshabilita la cuenta en Auth y activo:false en Firestore", async () => {
    await actualizarUsuarioAdmin("uid-1", { activo: false })
    expect(mockUpdateUser).toHaveBeenCalledWith("uid-1", { disabled: true })
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ activo: false }))
  })

  it("al reactivar, habilita la cuenta en Auth y activo:true en Firestore", async () => {
    await actualizarUsuarioAdmin("uid-1", { activo: true })
    expect(mockUpdateUser).toHaveBeenCalledWith("uid-1", { disabled: false })
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ activo: true }))
  })
})

describe("resetearPasswordAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDoc.mockReturnValue({ update: mockUpdate })
  })

  it("genera una nueva contraseña temporal y la aplica en Auth", async () => {
    const tempPassword = await resetearPasswordAdmin("uid-1")
    expect(tempPassword).toHaveLength(16)
    expect(mockUpdateUser).toHaveBeenCalledWith("uid-1", { password: tempPassword })
  })
})

describe("listarUsuariosAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockOrderBy.mockReturnValue({ get: mockCollectionGet })
  })

  it("mapea los documentos de Firestore a Usuario[]", async () => {
    const ahora = new Date("2026-07-08T12:00:00Z")
    mockCollectionGet.mockResolvedValue({
      docs: [
        {
          id: "uid-1",
          data: () => ({
            email: "compras@ejemplo.com",
            rol: "compras",
            activo: true,
            proveedor: "password",
            creadoPor: "jemiliano2001@gmail.com",
            creadoEn: { toDate: () => ahora },
            actualizadoEn: { toDate: () => ahora },
          }),
        },
      ],
    })

    const usuarios = await listarUsuariosAdmin()
    expect(usuarios).toHaveLength(1)
    expect(usuarios[0]).toMatchObject({ id: "uid-1", email: "compras@ejemplo.com", rol: "compras" })
  })
})
