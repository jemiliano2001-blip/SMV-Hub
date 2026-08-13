import { describe, it, expect, vi, beforeEach } from "vitest"

const {
  mockDoc,
  mockGet,
  mockSet,
  mockUpdate,
  mockDelete,
  mockCreateUser,
  mockUpdateUser,
  mockDeleteUser,
  mockSetCustomUserClaims,
  mockOrderBy,
  mockCollectionGet,
} = vi.hoisted(() => ({
  mockDoc: vi.fn(),
  mockGet: vi.fn(),
  mockSet: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockCreateUser: vi.fn(),
  mockUpdateUser: vi.fn(),
  mockDeleteUser: vi.fn(),
  mockSetCustomUserClaims: vi.fn(),
  mockOrderBy: vi.fn(),
  mockCollectionGet: vi.fn(),
}))

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: {
    createUser: mockCreateUser,
    updateUser: mockUpdateUser,
    deleteUser: mockDeleteUser,
    setCustomUserClaims: mockSetCustomUserClaims,
  },
  adminDb: {
    collection: vi.fn(() => ({
      doc: mockDoc,
      orderBy: mockOrderBy,
      get: mockCollectionGet,
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
    expect(info).toMatchObject({
      rol: "admin",
      plantilla: "admin",
      esSuperAdmin: true,
      activo: true,
    })
    expect(info?.modulos).toContain("finanzas")
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
    expect(info).toMatchObject({
      rol: "compras",
      plantilla: "compras",
      activo: true,
      esSuperAdmin: false,
    })
    expect(info?.modulos).toContain("nueva-compra")
    expect(info?.modulos).toContain("almacen")
  })

  it("devuelve activo:false si el documento tiene activo:false", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ rol: "compras", activo: false }),
    })
    const info = await obtenerUsuarioAdmin("uid-4", "compras@ejemplo.com")
    expect(info).toMatchObject({ rol: "compras", activo: false })
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
  eliminarUsuarioAdmin,
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
        plantilla: "compras",
        esSuperAdmin: false,
        activo: true,
        proveedor: "password",
        creadoPor: "jemiliano2001@gmail.com",
        creadoEn: expect.any(Date),
        actualizadoEn: expect.any(Date),
      })
    )
    const payload = mockSet.mock.calls[0][0] as { modulos: string[] }
    expect(payload.modulos).toContain("almacen")
    expect(resultado.uid).toBe("uid-nuevo")
    expect(resultado.tempPassword).toHaveLength(16)
  })

  it("usa la contraseña que mande el admin en vez de generar una temporal", async () => {
    mockCreateUser.mockResolvedValue({ uid: "uid-nuevo" })
    const resultado = await crearUsuarioAdmin({
      email: "nuevo@ejemplo.com",
      rol: "compras",
      creadoPor: "jemiliano2001@gmail.com",
      password: "miPasswordElegida",
    })

    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ password: "miPasswordElegida" })
    )
    expect(resultado.tempPassword).toBeNull()
  })

  it("sincroniza estado y módulos en los claims usados por Storage", async () => {
    mockCreateUser.mockResolvedValue({ uid: "uid-nuevo" })
    await crearUsuarioAdmin({
      email: "nuevo@ejemplo.com",
      rol: "compras",
      creadoPor: "jemiliano2001@gmail.com",
    })

    expect(mockSetCustomUserClaims).toHaveBeenCalledWith("uid-nuevo", {
      smvHubActivo: true,
      smvHubModulos: expect.arrayContaining(["caja-chica", "proveedores"]),
      smvHubEsSuperAdmin: false,
    })
  })

  it("estampa el claim privado al crear un super-admin", async () => {
    mockCreateUser.mockResolvedValue({ uid: "uid-super" })
    await crearUsuarioAdmin({
      email: "super@ejemplo.com",
      rol: "admin",
      esSuperAdmin: true,
      creadoPor: "jemiliano2001@gmail.com",
    })

    expect(mockSetCustomUserClaims).toHaveBeenCalledWith("uid-super", expect.objectContaining({
      smvHubActivo: true,
      smvHubEsSuperAdmin: true,
    }))
  })
})

describe("actualizarUsuarioAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDoc.mockReturnValue({ get: mockGet, update: mockUpdate, delete: mockDelete })
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ rol: "compras", plantilla: "compras", activo: true, esSuperAdmin: false }),
    })
    mockCollectionGet.mockResolvedValue({ docs: [] })
  })

  it("actualiza la plantilla en Firestore y sincroniza sus módulos en Auth", async () => {
    await actualizarUsuarioAdmin("uid-1", { rol: "diseno" })
    expect(mockUpdateUser).not.toHaveBeenCalled()
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith("uid-1", {
      smvHubActivo: true,
      smvHubModulos: expect.arrayContaining(["cotizaciones", "requisiciones"]),
      smvHubEsSuperAdmin: false,
    })
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        rol: "diseno",
        plantilla: "diseno",
        modulos: expect.arrayContaining(["cotizaciones"]),
      })
    )
  })

  it("al desactivar, deshabilita la cuenta en Auth, apaga el claim y activo:false en Firestore", async () => {
    await actualizarUsuarioAdmin("uid-1", { activo: false })
    expect(mockUpdateUser).toHaveBeenCalledWith("uid-1", { disabled: true })
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith("uid-1", {
      smvHubActivo: false,
      smvHubModulos: expect.arrayContaining(["caja-chica"]),
      smvHubEsSuperAdmin: false,
    })
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ activo: false }))
  })

  it("al reactivar, habilita la cuenta en Auth, prende el claim y activo:true en Firestore", async () => {
    await actualizarUsuarioAdmin("uid-1", { activo: true })
    expect(mockUpdateUser).toHaveBeenCalledWith("uid-1", { disabled: false })
    expect(mockSetCustomUserClaims).toHaveBeenCalledWith("uid-1", {
      smvHubActivo: true,
      smvHubModulos: expect.arrayContaining(["caja-chica"]),
      smvHubEsSuperAdmin: false,
    })
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ activo: true }))
  })

  it("bloquea quitar el último super-admin activo", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ rol: "admin", plantilla: "admin", activo: true, esSuperAdmin: true }),
    })
    mockCollectionGet.mockResolvedValue({
      docs: [
        {
          id: "uid-1",
          data: () => ({ rol: "admin", activo: true, esSuperAdmin: true }),
        },
      ],
    })
    await expect(actualizarUsuarioAdmin("uid-1", { esSuperAdmin: false })).rejects.toThrow(
      /último super-admin/
    )
  })

  it("retira caja chica del claim cuando el admin quita ese módulo", async () => {
    await actualizarUsuarioAdmin("uid-1", { modulos: ["cotizaciones"] })

    expect(mockSetCustomUserClaims).toHaveBeenCalledWith("uid-1", {
      smvHubActivo: true,
      smvHubModulos: ["cotizaciones"],
      smvHubEsSuperAdmin: false,
    })
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

  it("usa la contraseña que mande el admin y no retorna nada para mostrar", async () => {
    const resultado = await resetearPasswordAdmin("uid-1", "miPasswordElegida")
    expect(resultado).toBeNull()
    expect(mockUpdateUser).toHaveBeenCalledWith("uid-1", { password: "miPasswordElegida" })
  })
})

describe("eliminarUsuarioAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDoc.mockReturnValue({ get: mockGet, delete: mockDelete })
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({ rol: "compras", activo: true, esSuperAdmin: false }),
    })
    mockCollectionGet.mockResolvedValue({ docs: [] })
  })

  it("elimina la cuenta de Auth y el documento de Firestore", async () => {
    await eliminarUsuarioAdmin("uid-1")
    expect(mockDeleteUser).toHaveBeenCalledWith("uid-1")
    expect(mockDelete).toHaveBeenCalled()
  })

  it("borra el documento huérfano aunque la cuenta de Auth ya no exista", async () => {
    mockDeleteUser.mockRejectedValue(Object.assign(new Error("no user"), { code: "auth/user-not-found" }))
    await eliminarUsuarioAdmin("uid-huerfano")
    expect(mockDelete).toHaveBeenCalled()
  })

  it("propaga cualquier otro error de Auth sin borrar el documento", async () => {
    mockDeleteUser.mockRejectedValue(Object.assign(new Error("permission denied"), { code: "auth/insufficient-permission" }))
    await expect(eliminarUsuarioAdmin("uid-1")).rejects.toThrow("permission denied")
    expect(mockDelete).not.toHaveBeenCalled()
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
    expect(usuarios[0]).toMatchObject({
      id: "uid-1",
      email: "compras@ejemplo.com",
      rol: "compras",
      plantilla: "compras",
      esSuperAdmin: false,
    })
    expect(usuarios[0].modulos).toContain("nueva-compra")
    expect(usuarios[0].creadoEn).toEqual(ahora)
    expect(usuarios[0].actualizadoEn).toEqual(ahora)
  })

  it("omite documentos con un rol inválido o corrupto", async () => {
    const ahora = new Date("2026-07-08T12:00:00Z")
    mockCollectionGet.mockResolvedValue({
      docs: [
        {
          id: "uid-valido",
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
        {
          id: "uid-corrupto",
          data: () => ({
            email: "raro@ejemplo.com",
            rol: "gerente",
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
    expect(usuarios[0].id).toBe("uid-valido")
  })
})
