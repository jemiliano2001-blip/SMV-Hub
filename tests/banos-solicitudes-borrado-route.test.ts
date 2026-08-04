/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  mockVerificarUsuarioAutorizado,
  mockObtenerUsuarioAdmin,
  mockRegistrarAuditoriaServer,
  mockEmitirNotificacionServer,
  mockEvaluarSolicitudBorradoConIa,
} = vi.hoisted(() => ({
  mockVerificarUsuarioAutorizado: vi.fn(),
  mockObtenerUsuarioAdmin: vi.fn(),
  mockRegistrarAuditoriaServer: vi.fn().mockResolvedValue(undefined),
  mockEmitirNotificacionServer: vi.fn().mockResolvedValue("notif-1"),
  mockEvaluarSolicitudBorradoConIa: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({ verificarUsuarioAutorizado: mockVerificarUsuarioAutorizado }))
vi.mock("@/lib/usuarios-admin", () => ({ obtenerUsuarioAdmin: mockObtenerUsuarioAdmin }))
vi.mock("@/lib/auditoria-server", () => ({ registrarAuditoriaServer: mockRegistrarAuditoriaServer }))
vi.mock("@/lib/notificaciones-server", () => ({ emitirNotificacionServer: mockEmitirNotificacionServer }))
vi.mock("@/lib/banos-ia", () => ({ evaluarSolicitudBorradoConIa: mockEvaluarSolicitudBorradoConIa }))

class FakeTimestamp {
  constructor(private fecha: Date) {}
  toDate() {
    return this.fecha
  }
}

function fakeRegistroDoc(id: string, overrides: Record<string, unknown> = {}) {
  return {
    exists: true,
    id,
    data: () => ({
      operador: "Juan Pérez",
      bano: "Baño #1",
      horaEntrada: "10:00",
      horaLlegada: "10:07",
      fecha: "2026-07-30",
      tiempoMinutos: 7,
      creadoEn: new FakeTimestamp(new Date("2026-07-30T10:00:00Z")),
      actualizadoEn: new FakeTimestamp(new Date("2026-07-30T10:07:00Z")),
      creadoPorUid: "user-1",
      creadoPorNombre: "Juan Pérez",
      ...overrides,
    }),
  }
}

function makeQueryChain(result: { empty: boolean; docs?: unknown[] }) {
  const chain: any = {
    get: vi.fn().mockResolvedValue({ empty: result.empty, docs: result.docs ?? [] }),
  }
  chain.where = vi.fn(() => chain)
  chain.limit = vi.fn(() => chain)
  return chain
}

function makeFakeAdminDb(opts: {
  registroDoc?: ReturnType<typeof fakeRegistroDoc> | { exists: false }
  relacionados?: ReturnType<typeof fakeRegistroDoc>[]
  yaPendiente?: boolean
  iaRechazada?: boolean
}) {
  const registroDocRef = {
    get: vi.fn().mockResolvedValue(opts.registroDoc ?? fakeRegistroDoc("registro-1")),
    delete: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
  }
  const nuevaSolicitudRef = { id: "solicitud-1", set: vi.fn().mockResolvedValue(undefined) }
  const batch = {
    set: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    commit: vi.fn().mockResolvedValue(undefined),
  }
  const relacionadosChain = makeQueryChain({ empty: !(opts.relacionados && opts.relacionados.length > 0), docs: opts.relacionados })
  const pendienteChain = makeQueryChain({ empty: !opts.yaPendiente })
  const previasChain = makeQueryChain({
    empty: !opts.iaRechazada,
    docs: opts.iaRechazada
      ? [{ data: () => ({ estado: "rechazada", reglaAutoAplicada: "ia_rechazada" }) }]
      : [],
  })
  let consultasSolicitudes = 0

  return {
    collection: vi.fn((name: string) => {
      if (name === "registros-bano") {
        return { doc: vi.fn(() => registroDocRef), where: relacionadosChain.where }
      }
      if (name === "solicitudes_borrado_banos") {
        return {
          doc: vi.fn(() => nuevaSolicitudRef),
          where: vi.fn(() => {
            consultasSolicitudes += 1
            return consultasSolicitudes === 1 ? pendienteChain : previasChain
          }),
        }
      }
      throw new Error(`colección no mockeada en test: ${name}`)
    }),
    batch: vi.fn(() => batch),
    __registroDocRef: registroDocRef,
    __nuevaSolicitudRef: nuevaSolicitudRef,
    __batch: batch,
  }
}

let fakeAdminDb: ReturnType<typeof makeFakeAdminDb>

vi.mock("@/lib/firebase-admin", () => ({
  get adminDb() {
    return fakeAdminDb
  },
}))

import { POST } from "@/app/api/banos/solicitudes-borrado/route"

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/banos/solicitudes-borrado", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

describe("POST /api/banos/solicitudes-borrado", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerificarUsuarioAutorizado.mockResolvedValue({ ok: true, uid: "user-1", email: "juan@smv.com" })
    mockObtenerUsuarioAdmin.mockResolvedValue({ activo: true, esSuperAdmin: false, modulos: ["banos"] })
    mockEvaluarSolicitudBorradoConIa.mockResolvedValue({ decision: "revision", confianza: 0.4, motivo: "Requiere revisión" })
    fakeAdminDb = makeFakeAdminDb({})
  })

  it("retorna 401 si no está autorizado", async () => {
    mockVerificarUsuarioAutorizado.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: "No autorizado" }, { status: 401 }),
    })
    const res = await POST(makeRequest({ registroId: "registro-1", motivo: "duplicado" }))
    expect(res.status).toBe(401)
  })

  it("retorna 400 si el motivo es 'otro' sin nota", async () => {
    const res = await POST(makeRequest({ registroId: "registro-1", motivo: "otro" }))
    expect(res.status).toBe(400)
  })

  it("retorna 404 si el registro no existe", async () => {
    fakeAdminDb = makeFakeAdminDb({ registroDoc: { exists: false } as any })
    const res = await POST(makeRequest({ registroId: "registro-1", motivo: "duplicado" }))
    expect(res.status).toBe(404)
  })

  it("retorna 403 si quien solicita no es el creador ni súper admin", async () => {
    fakeAdminDb = makeFakeAdminDb({ registroDoc: fakeRegistroDoc("registro-1", { creadoPorUid: "otro-uid" }) })
    const res = await POST(makeRequest({ registroId: "registro-1", motivo: "duplicado" }))
    expect(res.status).toBe(403)
  })

  it("permite a un súper admin solicitar el borrado de un registro que no creó", async () => {
    mockObtenerUsuarioAdmin.mockResolvedValueOnce({ activo: true, esSuperAdmin: true, modulos: ["banos"] })
    fakeAdminDb = makeFakeAdminDb({ registroDoc: fakeRegistroDoc("registro-1", { creadoPorUid: "otro-uid" }) })
    const res = await POST(makeRequest({ registroId: "registro-1", motivo: "bano_equivocado" }))
    expect(res.status).toBe(201)
  })

  it("retorna 409 si ya hay una solicitud pendiente para ese registro", async () => {
    fakeAdminDb = makeFakeAdminDb({ yaPendiente: true })
    const res = await POST(makeRequest({ registroId: "registro-1", motivo: "duplicado" }))
    expect(res.status).toBe(409)
  })

  it("bloquea reenvios despues de un rechazo de IA", async () => {
    fakeAdminDb = makeFakeAdminDb({ iaRechazada: true })
    const res = await POST(makeRequest({ registroId: "registro-1", motivo: "duplicado" }))

    expect(res.status).toBe(409)
    expect(mockEvaluarSolicitudBorradoConIa).not.toHaveBeenCalled()
  })

  it("auto-aprueba y borra cuando hay un duplicado a menos de 10 min", async () => {
    fakeAdminDb = makeFakeAdminDb({
      relacionados: [
        fakeRegistroDoc("registro-1"),
        fakeRegistroDoc("registro-2", { horaEntrada: "10:05" }),
      ],
    })
    mockEvaluarSolicitudBorradoConIa.mockResolvedValue({ decision: "aprobar", confianza: 0.95, motivo: "Duplicado claro" })
    const res = await POST(makeRequest({ registroId: "registro-1", motivo: "duplicado" }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.estado).toBe("auto_aprobada")
    expect(body.regla).toBe("ia_aprobada")
    expect(fakeAdminDb.__batch.delete).toHaveBeenCalled()
    expect(mockRegistrarAuditoriaServer).toHaveBeenCalled()
    expect(mockEmitirNotificacionServer).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "banos_solicitud_resuelta", origenModulo: "banos" })
    )
  })

  it("auto-aprueba por arrepentimiento inmediato (registro creado hace segundos)", async () => {
    fakeAdminDb = makeFakeAdminDb({
      registroDoc: fakeRegistroDoc("registro-1", { creadoEn: new FakeTimestamp(new Date()) }),
    })
    mockEvaluarSolicitudBorradoConIa.mockResolvedValue({ decision: "aprobar", confianza: 0.95, motivo: "Arrepentimiento inmediato" })
    const res = await POST(makeRequest({ registroId: "registro-1", motivo: "accidental" }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.estado).toBe("auto_aprobada")
    expect(body.regla).toBe("ia_aprobada")
    expect(fakeAdminDb.__batch.delete).toHaveBeenCalled()
  })

  it("deja pendiente cuando ninguna regla aplica, y marca el registro", async () => {
    const res = await POST(makeRequest({ registroId: "registro-1", motivo: "bano_equivocado" }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toEqual({ estado: "pendiente" })
    expect(fakeAdminDb.__registroDocRef.delete).not.toHaveBeenCalled()
    expect(fakeAdminDb.__batch.update).toHaveBeenCalledWith(
      expect.anything(),
      { solicitudBorradoEstado: "pendiente" }
    )
    expect(fakeAdminDb.__batch.commit).toHaveBeenCalled()
    expect(mockEmitirNotificacionServer).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "banos_solicitud_creada" })
    )
  })
})
