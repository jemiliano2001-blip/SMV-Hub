import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  mockVerificarUsuarioAutorizado,
  mockObtenerUsuarioAdmin,
  mockRegistrarAuditoriaServer,
  mockEmitirNotificacionServer,
} = vi.hoisted(() => ({
  mockVerificarUsuarioAutorizado: vi.fn(),
  mockObtenerUsuarioAdmin: vi.fn(),
  mockRegistrarAuditoriaServer: vi.fn().mockResolvedValue(undefined),
  mockEmitirNotificacionServer: vi.fn().mockResolvedValue("notif-1"),
}))

vi.mock("@/lib/api-auth", () => ({ verificarUsuarioAutorizado: mockVerificarUsuarioAutorizado }))
vi.mock("@/lib/usuarios-admin", () => ({ obtenerUsuarioAdmin: mockObtenerUsuarioAdmin }))
vi.mock("@/lib/auditoria-server", () => ({ registrarAuditoriaServer: mockRegistrarAuditoriaServer }))
vi.mock("@/lib/notificaciones-server", () => ({ emitirNotificacionServer: mockEmitirNotificacionServer }))

type Ref = { kind: "doc"; collection: string; id: string }
type Query = { kind: "query"; collection: string; field: string; value: unknown }

function snap(exists: boolean, data: Record<string, unknown> = {}) {
  return { exists, data: () => data }
}

function makeFakeAdminDb(opts: {
  active?: Record<string, unknown>[]
  lockExists?: boolean
  so?: Record<string, unknown>
} = {}) {
  const writes = {
    set: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  }
  const transaction = {
    get: vi.fn(async (target: Ref | Query) => {
      if (target.kind === "query") return { docs: (opts.active ?? []).map((data) => ({ data: () => data })) }
      if (target.collection === "ventas_odoo_so") return snap(true, opts.so ?? {
        lineas: [{ odooLineId: 7, productName: "Resorte", qtyPending: 5 }],
      })
      if (target.collection === "solicitudes_documento_reservas") {
        return snap(Boolean(opts.lockExists), opts.lockExists ? { qtyReservada: 1 } : {})
      }
      return snap(false)
    }),
    ...writes,
  }
  const collection = (name: string) => ({
    doc: (id?: string) => ({
      kind: "doc" as const,
      collection: name,
      id: id ?? (name === "solicitudes_documento" ? "solicitud-1" : "reserva-1"),
    }),
    where: (field: string, _op: string, value: unknown) => ({
      kind: "query" as const,
      collection: name,
      field,
      value,
    }),
  })

  return {
    collection: vi.fn(collection),
    runTransaction: vi.fn(async (callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
    __transaction: transaction,
    __writes: writes,
  }
}

let fakeAdminDb: ReturnType<typeof makeFakeAdminDb>

vi.mock("@/lib/firebase-admin", () => ({
  get adminDb() {
    return fakeAdminDb
  },
}))

import { POST } from "@/app/api/documentos-venta/solicitudes/route"

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/documentos-venta/solicitudes", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

const payload = {
  tipo: "remision",
  estado: "pendiente",
  odooSoId: 10,
  odooSoName: "2026/S00010",
  clientOrderRef: null,
  ordenCompra: null,
  partnerName: "Cliente",
  partidas: [{ odooLineId: 7, productName: "Resorte", qtySolicitada: 2 }],
  nota: "",
  solicitadoPorUid: "user-1",
  solicitadoPorNombre: "Juan Pérez",
}

describe("POST /api/documentos-venta/solicitudes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fakeAdminDb = makeFakeAdminDb()
    mockVerificarUsuarioAutorizado.mockResolvedValue({ ok: true, uid: "user-1", email: "juan@smv.com" })
    mockObtenerUsuarioAdmin.mockResolvedValue({
      activo: true,
      esSuperAdmin: false,
      modulos: ["documentos-venta"],
    })
  })

  it("crea la solicitud y su reserva en una transacción", async () => {
    const response = await POST(makeRequest(payload))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.id).toBe("solicitud-1")
    expect(fakeAdminDb.__writes.set).toHaveBeenCalled()
    expect(fakeAdminDb.__writes.create).toHaveBeenCalledWith(
      expect.objectContaining({ collection: "solicitudes_documento_reservas", id: "10_7" }),
      expect.objectContaining({ odooLineId: 7, qtyReservada: 2 })
    )
    expect(mockRegistrarAuditoriaServer).toHaveBeenCalled()
    expect(mockEmitirNotificacionServer).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "solicitud_documento_creada" })
    )
  })

  it("rechaza una cantidad que ya fue reservada por otra solicitud activa", async () => {
    fakeAdminDb = makeFakeAdminDb({
      active: [{
        estado: "pendiente",
        partidas: [{ odooLineId: 7, qtySolicitada: 4 }],
      }],
    })

    const response = await POST(makeRequest(payload))
    expect(response.status).toBe(409)
    expect(fakeAdminDb.__writes.set).not.toHaveBeenCalled()
    expect(fakeAdminDb.__writes.create).not.toHaveBeenCalled()
  })

  it("rechaza un usuario que no tiene el módulo de documentos de venta", async () => {
    mockObtenerUsuarioAdmin.mockResolvedValueOnce({ activo: true, esSuperAdmin: false, modulos: [] })
    const response = await POST(makeRequest(payload))
    expect(response.status).toBe(403)
  })
})
