import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  mockVerificarAdmin,
  mockDocOrden,
  mockGetOrden,
  mockActualizarOrden,
  mockCargarMapeos,
  mockSugerirClaves,
} = vi.hoisted(() => ({
  mockVerificarAdmin: vi.fn(),
  mockDocOrden: vi.fn(),
  mockGetOrden: vi.fn(),
  mockActualizarOrden: vi.fn(),
  mockCargarMapeos: vi.fn(),
  mockSugerirClaves: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({
  verificarAdmin: mockVerificarAdmin,
}))

vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: mockDocOrden,
    })),
  },
}))

vi.mock("@/lib/sat/cargar-mapeos-firestore", () => ({
  cargarMapeosSatDesdeFirestore: mockCargarMapeos,
}))

vi.mock("@/lib/sat/sugerir-clave", () => ({
  construirHistorialSatDesdeEntradas: vi.fn(() => new Map()),
  combinarMapeosSmv: vi.fn(() => []),
  getMapeosSmv: vi.fn(() => []),
  sugerirClavesSatLote: mockSugerirClaves,
}))

import { NextRequest } from "next/server"
import { POST } from "@/app/api/retro-traducir-lote/route"

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/retro-traducir-lote", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

function documentoOrden() {
  return {
    exists: true,
    data: () => ({
      proveedor: "McMaster-Carr",
      items: [{
        descripcion: "Tornillo industrial",
        descripcionSimplificada: "Tornillo industrial",
        cantidad: 1,
        precioUnitario: 10,
        total: 10,
        claveProdServ: null,
        satPendiente: true,
      }],
    }),
    ref: { update: mockActualizarOrden },
  }
}

describe("POST /api/retro-traducir-lote", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerificarAdmin.mockResolvedValue({
      ok: true,
      uid: "usuario-1",
      email: "compras@smv.com",
    })
    mockCargarMapeos.mockResolvedValue([])
    mockDocOrden.mockImplementation((ordenId: string) => ({
      get: () => mockGetOrden(ordenId),
    }))
    mockGetOrden.mockResolvedValue(documentoOrden())
    mockSugerirClaves.mockResolvedValue([{
      claveProdServ: "31161500",
      descripcionSat: "Tornillos",
      confianza: "media",
      motivo: "Coincidencia validada",
      fuente: "local",
    }])
  })

  it("retorna 401 sin autorización antes de leer Firestore", async () => {
    mockVerificarAdmin.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: "No autorizado" }, { status: 401 }),
    })

    const res = await POST(makeRequest({ ordenesIds: ["orden-1"] }))

    expect(res.status).toBe(401)
    expect(mockGetOrden).not.toHaveBeenCalled()
  })

  it("actualiza la orden con una clave de confianza media", async () => {
    const res = await POST(makeRequest({
      ordenesIds: ["orden-1"],
      historialEntradas: [{ descripcion: "Tornillo previo", claveProdServ: "31161500" }],
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.resumen).toMatchObject({
      procesadas: 1,
      traducidas: 0,
      clavesAsignadas: 1,
      clavesPendientes: 0,
      ordenesFallidas: [],
    })
    expect(mockActualizarOrden).toHaveBeenCalledWith(expect.objectContaining({
      items: [expect.objectContaining({ claveProdServ: "31161500", satPendiente: false })],
      actualizadoEn: expect.any(Date),
    }))
  })

  it("deja una orden fallida sin detener el chunk", async () => {
    mockGetOrden.mockImplementation((ordenId: string) => {
      return Promise.resolve(ordenId === "orden-invalida"
        ? { exists: false }
        : documentoOrden())
    })

    const res = await POST(makeRequest({ ordenesIds: ["orden-1", "orden-invalida"] }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.resumen.procesadas).toBe(1)
    expect(body.resumen.ordenesFallidas).toEqual(["orden-invalida"])
  })

  it("acepta chunks legacy grandes pero solo procesa el limite seguro", async () => {
    const res = await POST(makeRequest({
      ordenesIds: ["orden-1", "orden-2", "orden-3"],
      historialEntradas: [
        { descripcion: "Historial valido", claveProdServ: "31161500" },
        { descripcion: "Historial invalido", claveProdServ: "ABC" },
      ],
    }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(mockGetOrden).toHaveBeenCalledTimes(2)
    expect(mockGetOrden).toHaveBeenCalledWith("orden-1")
    expect(mockGetOrden).toHaveBeenCalledWith("orden-2")
    expect(body.resumen).toMatchObject({
      procesadas: 2,
      ordenesOmitidas: ["orden-3"],
    })
  })
})
