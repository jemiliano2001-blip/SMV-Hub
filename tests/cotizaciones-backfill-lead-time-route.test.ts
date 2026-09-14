import { beforeEach, describe, expect, it, vi } from "vitest"
import { planBackfillLeadTime } from "@/lib/lead-time"

const { mockVerificarSuperAdmin, mockRegistrarAuditoriaServer, mockCollection, mockBatch } = vi.hoisted(() => ({
  mockVerificarSuperAdmin: vi.fn(),
  mockRegistrarAuditoriaServer: vi.fn(),
  mockCollection: vi.fn(),
  mockBatch: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({ verificarSuperAdmin: mockVerificarSuperAdmin }))
vi.mock("@/lib/auditoria-server", () => ({ registrarAuditoriaServer: mockRegistrarAuditoriaServer }))
vi.mock("@/lib/firebase-admin", () => ({ adminDb: { collection: mockCollection, batch: mockBatch } }))
vi.mock("firebase-admin/firestore", () => ({ FieldValue: { serverTimestamp: () => "server-timestamp" } }))

import { POST } from "@/app/api/cotizaciones/backfill-lead-time/route"

const accesoSuperAdmin = { ok: true as const, uid: "super-1", email: "super@smv.com", token: "token" }

function solicitud(payload: unknown) {
  return new Request("http://localhost/api/cotizaciones/backfill-lead-time", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

function documento(id: string, data: Record<string, unknown>) {
  return { id, data: () => data }
}

function configurar(cotizaciones: ReturnType<typeof documento>[]) {
  mockCollection.mockImplementation(() => ({
    select: () => ({ get: vi.fn().mockResolvedValue({ docs: cotizaciones }) }),
    doc: (id: string) => ({ coleccion: "cotizaciones", id }),
  }))
}

describe("planBackfillLeadTime (puro)", () => {
  it("propone solo lo que difiere; null explícito para lo no parseable; ignora sin texto", () => {
    const plan = planBackfillLeadTime([
      { id: "a", diasHabiles: "2 - 3 semanas" },
      { id: "b", diasHabiles: "5 dias", leadTimeMinDias: 5, leadTimeMaxDias: 5 }, // ya correcto
      { id: "c", diasHabiles: "precios 2026" }, // null pero aún no explícito → se escribe
      { id: "d", diasHabiles: "precios 2026", leadTimeMinDias: null, leadTimeMaxDias: null }, // ya explícito
      { id: "e", diasHabiles: null },
      { id: "f", diasHabiles: "$1,00", leadTimeMinDias: 99, leadTimeMaxDias: 99 }, // valor viejo distinto
    ])
    expect(plan.total).toBe(6)
    expect(plan.conTexto).toBe(5)
    expect(plan.yaCorrectos).toBe(2)
    expect(plan.parseadas).toBe(3)
    expect(plan.nulas).toBe(2)
    expect(plan.cambios.map((c) => c.id)).toEqual(["a", "c", "f"])
    expect(plan.cambios[0]).toEqual({ id: "a", diasHabiles: "2 - 3 semanas", leadTimeMinDias: 10, leadTimeMaxDias: 15, detalle: "semanas" })
    expect(plan.cambios[1]).toEqual({ id: "c", diasHabiles: "precios 2026", leadTimeMinDias: null, leadTimeMaxDias: null, detalle: "moneda" })
    expect(plan.cambios[2]).toMatchObject({ id: "f", leadTimeMinDias: 1, leadTimeMaxDias: 1, detalle: "moneda_formato" })
    expect(plan.porDetalle).toEqual({ semanas: 1, numero: 1, moneda: 2, moneda_formato: 1 })
  })
})

describe("POST /api/cotizaciones/backfill-lead-time", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerificarSuperAdmin.mockResolvedValue(accesoSuperAdmin)
    configurar([
      documento("a", { diasHabiles: "2 - 3 semanas" }),
      documento("b", { diasHabiles: "5 dias", leadTimeMinDias: 5, leadTimeMaxDias: 5 }),
      documento("c", { diasHabiles: "precios 2026" }),
      documento("e", { diasHabiles: null }),
    ])
  })

  it("exige super-admin antes de leer Firestore", async () => {
    mockVerificarSuperAdmin.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: "Se requiere acceso de super-administrador" }, { status: 403 }),
    })
    expect((await POST(solicitud({ accion: "previsualizar" }))).status).toBe(403)
    expect(mockCollection).not.toHaveBeenCalled()
  })

  it("previsualizar devuelve el plan sin escribir", async () => {
    const respuesta = await POST(solicitud({ accion: "previsualizar" }))
    const plan = (await respuesta.json()) as { cambios: Array<{ id: string }>; yaCorrectos: number; conTexto: number }
    expect(respuesta.status).toBe(200)
    expect(plan.conTexto).toBe(3)
    expect(plan.yaCorrectos).toBe(1)
    expect(plan.cambios.map((c) => c.id)).toEqual(["a", "c"])
    expect(mockBatch).not.toHaveBeenCalled()
  })

  it("aplicar escribe min/max (o null explícito) sin tocar diasHabiles, y audita", async () => {
    const actualizar = vi.fn()
    mockBatch.mockReturnValue({ update: actualizar, commit: vi.fn().mockResolvedValue(undefined) })

    const respuesta = await POST(solicitud({ accion: "aplicar" }))

    expect(respuesta.status).toBe(200)
    expect(await respuesta.json()).toEqual({ ok: true, aplicados: 2, parseadas: 1, nulas: 1, yaCorrectos: 1 })
    expect(actualizar).toHaveBeenCalledWith(
      { coleccion: "cotizaciones", id: "a" },
      { leadTimeMinDias: 10, leadTimeMaxDias: 15, actualizadoEn: "server-timestamp" }
    )
    expect(actualizar).toHaveBeenCalledWith(
      { coleccion: "cotizaciones", id: "c" },
      { leadTimeMinDias: null, leadTimeMaxDias: null, actualizadoEn: "server-timestamp" }
    )
    expect(actualizar).toHaveBeenCalledTimes(2)
    expect(mockRegistrarAuditoriaServer).toHaveBeenCalledWith(
      "super@smv.com",
      "EDITAR",
      "cotizaciones",
      "BACKFILL_LEAD_TIME",
      expect.stringContaining("1 parseadas")
    )
  })
})
