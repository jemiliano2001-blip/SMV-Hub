import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  mockVerificarSuperAdmin,
  mockRegistrarAuditoriaServer,
  mockCollection,
  mockGetAll,
  mockBatch,
  mockServerTimestamp,
} = vi.hoisted(() => ({
  mockVerificarSuperAdmin: vi.fn(),
  mockRegistrarAuditoriaServer: vi.fn(),
  mockCollection: vi.fn(),
  mockGetAll: vi.fn(),
  mockBatch: vi.fn(),
  mockServerTimestamp: vi.fn(() => "server-timestamp"),
}))

vi.mock("@/lib/api-auth", () => ({ verificarSuperAdmin: mockVerificarSuperAdmin }))
vi.mock("@/lib/auditoria-server", () => ({ registrarAuditoriaServer: mockRegistrarAuditoriaServer }))
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: mockCollection,
    getAll: mockGetAll,
    batch: mockBatch,
  },
}))
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    serverTimestamp: mockServerTimestamp,
    arrayUnion: (...valores: unknown[]) => ({ arrayUnion: valores }),
  },
}))

import { POST } from "@/app/api/proveedores/vinculacion/route"

const accesoSuperAdmin = { ok: true as const, uid: "super-1", email: "super@smv.com", token: "token" }

function solicitud(payload: unknown) {
  return new Request("http://localhost/api/proveedores/vinculacion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

function documento(id: string, data: Record<string, unknown>) {
  return { id, data: () => data, exists: true }
}

function configurarBase({
  ordenes = [],
  cotizaciones = [],
  proveedores = [],
}: {
  ordenes?: ReturnType<typeof documento>[]
  cotizaciones?: ReturnType<typeof documento>[]
  proveedores?: ReturnType<typeof documento>[]
} = {}) {
  mockCollection.mockImplementation((nombre: string) => ({
    get: vi.fn().mockResolvedValue({
      docs: nombre === "ordenes" ? ordenes : nombre === "cotizaciones" ? cotizaciones : proveedores,
    }),
    doc: (id: string) => ({ coleccion: nombre, id }),
  }))
  mockBatch.mockImplementation(() => ({ update: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) }))
}

describe("POST /api/proveedores/vinculacion", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerificarSuperAdmin.mockResolvedValue(accesoSuperAdmin)
    configurarBase()
  })

  it("detiene la solicitud antes de tocar Firestore si no es super-admin", async () => {
    mockVerificarSuperAdmin.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: "Se requiere acceso de super-administrador" }, { status: 403 }),
    })

    const respuesta = await POST(solicitud({ accion: "analizar" }))

    expect(respuesta.status).toBe(403)
    expect(mockCollection).not.toHaveBeenCalled()
  })

  it("rechaza una vinculación manual que excede el lote máximo", async () => {
    const respuesta = await POST(
      solicitud({
        accion: "vincularManual",
        coleccion: "ordenes",
        idsDocs: Array.from({ length: 21 }, (_, indice) => `orden-${indice}`),
        proveedorId: "proveedor-1",
      })
    )

    expect(respuesta.status).toBe(400)
    expect(mockGetAll).not.toHaveBeenCalled()
  })

  it("aplica sólo vínculos exactos y registra la auditoría del lote", async () => {
    const actualizar = vi.fn()
    const confirmar = vi.fn().mockResolvedValue(undefined)
    configurarBase({
      ordenes: [documento("orden-1", { proveedor: "SHARS TOOL COMPANY", proveedorId: null })],
      proveedores: [documento("proveedor-shars", { nombre: "Shars Tool Company" })],
    })
    mockBatch.mockReturnValue({ update: actualizar, commit: confirmar })

    const respuesta = await POST(solicitud({ accion: "aplicarAutomaticas" }))

    expect(respuesta.status).toBe(200)
    expect(actualizar).toHaveBeenCalledWith(
      { coleccion: "ordenes", id: "orden-1" },
      expect.objectContaining({ proveedorId: "proveedor-shars", actualizadoEn: "server-timestamp" })
    )
    expect(confirmar).toHaveBeenCalledTimes(1)
    expect(mockRegistrarAuditoriaServer).toHaveBeenCalledWith(
      "super@smv.com",
      "EDITAR",
      "proveedores",
      "BACKFILL_PROVEEDOR_ID",
      expect.stringContaining("1 órdenes")
    )
  })

  it("vincula por alias en 'aplicarAutomaticas' (B1: los alias son exactos)", async () => {
    const actualizar = vi.fn()
    configurarBase({
      ordenes: [documento("orden-1", { proveedor: "MSC Industrial Supply", proveedorId: null })],
      proveedores: [
        documento("proveedor-msc", { nombre: "MSC Industrial Direct", aliases: ["MSC Industrial Supply"] }),
      ],
    })
    mockBatch.mockReturnValue({ update: actualizar, commit: vi.fn().mockResolvedValue(undefined) })

    const respuesta = await POST(solicitud({ accion: "aplicarAutomaticas" }))

    expect(respuesta.status).toBe(200)
    expect(actualizar).toHaveBeenCalledWith(
      { coleccion: "ordenes", id: "orden-1" },
      expect.objectContaining({ proveedorId: "proveedor-msc" })
    )
  })

  it("en 'analizar' los fantasmas traen sugerencia y los internos no aparecen", async () => {
    configurarBase({
      ordenes: [documento("orden-1", { proveedor: "Mouser", proveedorId: null })],
      cotizaciones: [
        documento("cot-1", { proveedor: "Almacén Automatización", proveedorId: null }),
        documento("cot-2", { proveedor: "EBAY", proveedorId: null }),
      ],
      proveedores: [documento("proveedor-mouser", { nombre: "MOUSER ELECTRONICS." })],
    })

    const respuesta = await POST(solicitud({ accion: "analizar" }))
    const body = (await respuesta.json()) as {
      cotizaciones: { ignoradosInternos?: number; sinMatch: number }
      fantasmas: Array<{ nombreLibre: string; sugerenciaCatalogo: { id: string } | null; marketplaceProbable: boolean }>
    }

    expect(respuesta.status).toBe(200)
    expect(body.cotizaciones.ignoradosInternos).toBe(1)
    expect(body.cotizaciones.sinMatch).toBe(1)
    const mouser = body.fantasmas.find((f) => f.nombreLibre === "Mouser")
    expect(mouser?.sugerenciaCatalogo?.id).toBe("proveedor-mouser")
    const ebay = body.fantasmas.find((f) => f.nombreLibre === "EBAY")
    expect(ebay?.marketplaceProbable).toBe(true)
    expect(body.fantasmas.some((f) => f.nombreLibre === "Almacén Automatización")).toBe(false)
  })

  it("vincularManual con guardarAlias aprende el nombre libre en el proveedor", async () => {
    const actualizarProveedor = vi.fn().mockResolvedValue(undefined)
    const proveedorRef = { coleccion: "proveedores", id: "proveedor-msc", update: actualizarProveedor }
    mockCollection.mockImplementation((nombre: string) => ({
      get: vi.fn().mockResolvedValue({ docs: [] }),
      doc: (id: string) => (nombre === "proveedores" ? proveedorRef : { coleccion: nombre, id }),
    }))
    mockGetAll.mockResolvedValueOnce([
      { exists: true, data: () => ({ nombre: "MSC Industrial Direct", aliases: [] }) },
      { exists: true },
    ])

    const respuesta = await POST(
      solicitud({
        accion: "vincularManual",
        coleccion: "ordenes",
        idsDocs: ["orden-1"],
        proveedorId: "proveedor-msc",
        nombreLibre: "MSC Industrial Supply",
        guardarAlias: true,
      })
    )

    expect(respuesta.status).toBe(200)
    expect(await respuesta.json()).toEqual({ ok: true, aliasAprendido: true })
    expect(actualizarProveedor).toHaveBeenCalledWith(
      expect.objectContaining({ actualizadoEn: "server-timestamp" })
    )
    expect(mockRegistrarAuditoriaServer).toHaveBeenCalledWith(
      "super@smv.com",
      "EDITAR",
      "ordenes",
      "VINCULACION_MANUAL",
      expect.stringContaining('Alias aprendido: "MSC Industrial Supply"')
    )
  })

  it("vincularManual no aprende un alias redundante (igual al nombre) ni repetido", async () => {
    const actualizarProveedor = vi.fn()
    const proveedorRef = { coleccion: "proveedores", id: "proveedor-msc", update: actualizarProveedor }
    mockCollection.mockImplementation((nombre: string) => ({
      get: vi.fn().mockResolvedValue({ docs: [] }),
      doc: (id: string) => (nombre === "proveedores" ? proveedorRef : { coleccion: nombre, id }),
    }))
    mockGetAll.mockResolvedValue([
      { exists: true, data: () => ({ nombre: "MSC Industrial Direct", aliases: ["msc industrial supply"] }) },
      { exists: true },
    ])

    for (const nombreLibre of ["msc industrial direct", "MSC Industrial Supply"]) {
      const respuesta = await POST(
        solicitud({
          accion: "vincularManual",
          coleccion: "ordenes",
          idsDocs: ["orden-1"],
          proveedorId: "proveedor-msc",
          nombreLibre,
          guardarAlias: true,
        })
      )
      expect(respuesta.status).toBe(200)
      expect(await respuesta.json()).toEqual({ ok: true, aliasAprendido: false })
    }
    expect(actualizarProveedor).not.toHaveBeenCalled()
  })

  it("altaYVincular crea el proveedor con defaults, sin alias redundante, y vincula", async () => {
    const setProveedor = vi.fn().mockResolvedValue(undefined)
    const actualizar = vi.fn()
    mockCollection.mockImplementation((nombre: string) => ({
      get: vi.fn().mockResolvedValue({ docs: [] }),
      doc: (id?: string) =>
        nombre === "proveedores" && id === undefined
          ? { id: "proveedor-nuevo", set: setProveedor }
          : { coleccion: nombre, id },
    }))
    mockGetAll.mockResolvedValueOnce([{ exists: true }, { exists: true }])
    mockBatch.mockReturnValue({ update: actualizar, commit: vi.fn().mockResolvedValue(undefined) })

    const respuesta = await POST(
      solicitud({
        accion: "altaYVincular",
        coleccion: "ordenes",
        idsDocs: ["orden-1", "orden-2"],
        nombre: "eBay",
        mercado: "usa",
        esMarketplace: true,
        nombreLibre: "EBAY",
      })
    )

    expect(respuesta.status).toBe(200)
    expect(await respuesta.json()).toEqual({ ok: true, proveedorId: "proveedor-nuevo" })
    expect(setProveedor).toHaveBeenCalledWith(
      expect.objectContaining({
        nombre: "eBay",
        esMarketplace: true,
        mercado: "usa",
        moneda: "USD",
        origenProveedor: "manual",
        odooPartnerId: null,
        aliases: [], // "EBAY" normaliza igual que "eBay": no es alias
        categorias: ["otros"],
        creadoEn: "server-timestamp",
      })
    )
    expect(actualizar).toHaveBeenCalledTimes(2)
    expect(actualizar).toHaveBeenCalledWith(
      { coleccion: "ordenes", id: "orden-1" },
      expect.objectContaining({ proveedorId: "proveedor-nuevo" })
    )
    expect(mockRegistrarAuditoriaServer).toHaveBeenCalledWith(
      "super@smv.com",
      "CREAR",
      "proveedores",
      "proveedor-nuevo",
      expect.stringContaining("marketplace")
    )
  })

  it("altaYVincular guarda el nombre libre como alias cuando difiere del nombre elegido", async () => {
    const setProveedor = vi.fn().mockResolvedValue(undefined)
    mockCollection.mockImplementation((nombre: string) => ({
      get: vi.fn().mockResolvedValue({ docs: [] }),
      doc: (id?: string) =>
        nombre === "proveedores" && id === undefined
          ? { id: "proveedor-nuevo", set: setProveedor }
          : { coleccion: nombre, id },
    }))
    mockGetAll.mockResolvedValueOnce([{ exists: true }])

    const respuesta = await POST(
      solicitud({
        accion: "altaYVincular",
        coleccion: "cotizaciones",
        idsDocs: ["cot-1"],
        nombre: "DigiKey Electronics",
        mercado: "usa",
        nombreLibre: "Digikey",
      })
    )

    expect(respuesta.status).toBe(200)
    expect(setProveedor).toHaveBeenCalledWith(
      expect.objectContaining({ aliases: ["Digikey"], moneda: "USD", pais: "Estados Unidos" })
    )
  })

  it("altaYVincular rechaza con 409 si ya existe un proveedor con ese nombre o alias", async () => {
    configurarBase({
      proveedores: [
        documento("proveedor-msc", { nombre: "MSC Industrial Direct", aliases: ["MSC Industrial Supply"] }),
      ],
    })

    const respuesta = await POST(
      solicitud({
        accion: "altaYVincular",
        coleccion: "ordenes",
        idsDocs: ["orden-1"],
        nombre: "msc industrial supply",
        mercado: "usa",
      })
    )

    expect(respuesta.status).toBe(409)
    expect(await respuesta.json()).toMatchObject({ proveedorExistenteId: "proveedor-msc" })
    expect(mockGetAll).not.toHaveBeenCalled()
    expect(mockRegistrarAuditoriaServer).not.toHaveBeenCalled()
  })

  it("rechaza una vinculación manual si el proveedor ya no existe", async () => {
    mockGetAll.mockResolvedValueOnce([{ exists: false }])

    const respuesta = await POST(
      solicitud({
        accion: "vincularManual",
        coleccion: "ordenes",
        idsDocs: ["orden-1"],
        proveedorId: "proveedor-inexistente",
      })
    )

    expect(respuesta.status).toBe(400)
    expect(mockRegistrarAuditoriaServer).not.toHaveBeenCalled()
  })
})
