import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  mockVerificarUsuarioAutorizado,
  mockObtenerUsuarioAdmin,
  mockExcedeLimite,
  mockGenerarEmbeddingsLote,
  mockLeerIndice,
  mockMapeosSat,
  mockMapeosAprobados,
  mockCollection,
} = vi.hoisted(() => ({
  mockVerificarUsuarioAutorizado: vi.fn(),
  mockObtenerUsuarioAdmin: vi.fn(),
  mockExcedeLimite: vi.fn(),
  mockGenerarEmbeddingsLote: vi.fn(),
  mockLeerIndice: vi.fn(),
  mockMapeosSat: vi.fn(),
  mockMapeosAprobados: vi.fn(),
  mockCollection: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({ verificarUsuarioAutorizado: mockVerificarUsuarioAutorizado }))
vi.mock("@/lib/usuarios-admin", () => ({ obtenerUsuarioAdmin: mockObtenerUsuarioAdmin }))
vi.mock("@/lib/rate-limit-memoria", () => ({ excedeLimite: mockExcedeLimite }))
vi.mock("@/lib/embeddings-ia", () => ({ generarEmbeddingsLote: mockGenerarEmbeddingsLote, similitudCoseno: similitudCosenoReal }))
vi.mock("@/lib/busqueda-semantica-catalogo", () => ({ leerIndiceVectorizado: mockLeerIndice }))
vi.mock("@/lib/sat/cargar-mapeos-firestore", () => ({ cargarMapeosSatDesdeFirestore: mockMapeosSat }))
vi.mock("@/lib/compras-odoo/mapeos-aprobados-admin", () => ({ cargarMapeosAprobadosAdmin: mockMapeosAprobados }))
vi.mock("@/lib/firebase-admin", () => ({ adminDb: { collection: mockCollection } }))

function similitudCosenoReal(a: readonly number[], b: readonly number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0
}

import { NextRequest } from "next/server"
import { POST } from "@/app/api/memoria-operativa/consultar/route"
import type { RespuestaMemoriaOperativa } from "@/lib/memoria-operativa/tipos"

const accesoOk = { ok: true as const, uid: "u-1", email: "u@smv.com", token: "token" }

/** Vector unitario de 768 dims con un 1 en la posición `eje`: dos con el mismo eje → coseno 1. */
function vector(eje: number): number[] {
  const v = new Array<number>(768).fill(0)
  v[eje] = 1
  return v
}

function entradaIndice(id: string, titulo: string, eje: number, metadata: Record<string, unknown>, fuente = "orden-item") {
  return { id, embedding: vector(eje), data: { id, fuente, refPath: "/ordenes?id=x", titulo, metadata } }
}

function solicitud(payload: unknown) {
  return new NextRequest("http://localhost/api/memoria-operativa/consultar", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
    body: JSON.stringify(payload),
  })
}

function usuario(modulos: string[], esSuperAdmin = false) {
  return { rol: "compras", plantilla: "compras", modulos, esSuperAdmin, activo: true }
}

type Cuerpo = RespuestaMemoriaOperativa & { ok?: boolean; error?: string }

describe("POST /api/memoria-operativa/consultar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerificarUsuarioAutorizado.mockResolvedValue(accesoOk)
    mockExcedeLimite.mockReturnValue(false)
    mockObtenerUsuarioAdmin.mockResolvedValue(usuario(["ordenes", "cotizaciones"]))
    mockMapeosSat.mockResolvedValue([])
    mockMapeosAprobados.mockResolvedValue(null)
    mockLeerIndice.mockResolvedValue([
      entradaIndice("ord-1#0", "Tool Balancer TECNA 9313", 0, { proveedorNombre: "Tool Balancers USA", precio: 200, moneda: "USD", fecha: "2026-05-01" }),
      entradaIndice("ord-2#0", "Compression Spring 9657K266", 1, { proveedorNombre: "McMaster-Carr", precio: 4.2, moneda: "USD", fecha: "2026-06-01" }),
      entradaIndice("cot#c-1", "Sensor IFM PN2271", 2, { proveedorNombre: "Acomee", precio: 850, moneda: "MXN", numeroParte: "PN2271" }, "cotizacion"),
    ])
    mockGenerarEmbeddingsLote.mockImplementation(async (textos: string[]) =>
      textos.map((t) => (t.includes("TECNA") ? vector(0) : t.includes("Spring") ? vector(1) : vector(2)))
    )
  })

  it("401 sin token válido; nada más se ejecuta", async () => {
    mockVerificarUsuarioAutorizado.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) })
    const res = await POST(solicitud({ piezas: [{ descripcion: "x" }] }))
    expect(res.status).toBe(401)
    expect(mockGenerarEmbeddingsLote).not.toHaveBeenCalled()
    expect(mockLeerIndice).not.toHaveBeenCalled()
  })

  it("429 por rate limit y 403 sin módulos de órdenes ni cotizaciones (proveedores no cuenta)", async () => {
    mockExcedeLimite.mockReturnValue(true)
    expect((await POST(solicitud({ piezas: [{ descripcion: "x" }] }))).status).toBe(429)

    mockExcedeLimite.mockReturnValue(false)
    mockObtenerUsuarioAdmin.mockResolvedValue(usuario(["proveedores", "almacen"]))
    const res = await POST(solicitud({ piezas: [{ descripcion: "x" }] }))
    expect(res.status).toBe(403)
    expect(mockGenerarEmbeddingsLote).not.toHaveBeenCalled()
  })

  it("400 con 0 piezas, con más de 20, o con JSON inválido", async () => {
    expect((await POST(solicitud({ piezas: [] }))).status).toBe(400)
    expect((await POST(solicitud({ piezas: Array.from({ length: 21 }, () => ({ descripcion: "x" })) }))).status).toBe(400)
    const rota = new NextRequest("http://localhost/api/memoria-operativa/consultar", {
      method: "POST",
      headers: { Authorization: "Bearer token" },
      body: "{no json",
    })
    expect((await POST(rota)).status).toBe(400)
  })

  it("criterio #7: sin módulo cotizaciones, el índice se lee solo con orden-item", async () => {
    mockObtenerUsuarioAdmin.mockResolvedValue(usuario(["ordenes"]))
    const res = await POST(solicitud({ piezas: [{ descripcion: "Sensor IFM PN2271" }] }))
    expect(res.status).toBe(200)
    expect(mockLeerIndice).toHaveBeenCalledWith(["orden-item"])
    const body = (await res.json()) as Cuerpo
    expect(body.fuentesConsultadas).toEqual(["orden-item"])
  })

  it("super-admin consulta orden-item + cotizacion, nunca proveedor", async () => {
    mockObtenerUsuarioAdmin.mockResolvedValue(usuario([], true))
    await POST(solicitud({ piezas: [{ descripcion: "x" }] }))
    expect(mockLeerIndice).toHaveBeenCalledWith(["orden-item", "cotizacion"])
  })

  it("camino feliz: exacto con alerta de precio, cotización previa y una sola llamada de embeddings", async () => {
    const res = await POST(
      solicitud({
        piezas: [
          { descripcion: "Tool Balancer TECNA 9313", precioUnitario: 300, moneda: "USD" },
          { descripcion: "Sensor IFM PN2271" },
        ],
      })
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as Cuerpo
    expect(body.ok).toBe(true)
    expect(body.degradado).toBe(false)
    expect(body.verPrecios).toBe(true)
    expect(body.contextos).toHaveLength(2)

    const [balancer, sensor] = body.contextos
    expect(balancer.totalExactos).toBe(1)
    expect(balancer.comprasPrevias[0]).toMatchObject({ refId: "ord-1#0", empate: "exacto", precioUnitario: 200 })
    expect(balancer.alertaPrecio?.tipo).toBe("caro")
    expect(balancer.proveedorPreferido?.proveedorNombre).toBe("Tool Balancers USA")

    expect(sensor.cotizacionesPrevias[0]).toMatchObject({ refId: "cot#c-1", empate: "exacto", precioUnitario: 850 })
    expect(sensor.comprasPrevias).toEqual([])

    expect(mockGenerarEmbeddingsLote).toHaveBeenCalledTimes(1)
    expect(mockGenerarEmbeddingsLote.mock.calls[0][0]).toEqual(["Tool Balancer TECNA 9313", "Sensor IFM PN2271"])
    expect(mockGenerarEmbeddingsLote.mock.calls[0][1]).toMatchObject({ taskType: "RETRIEVAL_QUERY", outputDimensionality: 768 })
  })

  it("20 piezas → una sola llamada de embeddings y 20 contextos en orden", async () => {
    const piezas = Array.from({ length: 20 }, (_, i) => ({ descripcion: `Pieza número ${i}` }))
    const res = await POST(solicitud({ piezas }))
    const body = (await res.json()) as Cuerpo
    expect(mockGenerarEmbeddingsLote).toHaveBeenCalledTimes(1)
    expect(body.contextos.map((c) => c.indice)).toEqual(piezas.map((_, i) => i))
  })

  it("criterio #6: Gemini caído → 200 degradado con solo exactos (nunca 502)", async () => {
    mockGenerarEmbeddingsLote.mockRejectedValue(new Error("Gemini 503"))
    const res = await POST(solicitud({ piezas: [{ descripcion: "Tool Balancer TECNA 9313" }, { descripcion: "Algo sin historial" }] }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as Cuerpo
    expect(body.degradado).toBe(true)
    expect(body.contextos[0].totalExactos).toBe(1)
    expect(body.contextos[0].totalParecidos).toBe(0)
    expect(body.contextos[1].comprasPrevias).toEqual([])
  })

  it("índice caído → 200 degradado con empate exacto por llavePieza contra cotizaciones", async () => {
    mockLeerIndice.mockRejectedValue(new Error("Firestore índice"))
    const getMock = vi.fn().mockResolvedValue({
      docs: [
        {
          id: "c-9",
          data: () => ({
            descripcion: "Sensor IFM PN2271",
            numeroParte: "PN2271",
            proveedor: "Acomee",
            precioUnitario: 850,
            moneda: "MXN",
            fecha: "2026-08-20",
            ubicacion: "MX",
            estatus: "cotizado",
            llavePieza: "PN2271|sensor ifm pn2271",
          }),
        },
        {
          id: "c-10",
          data: () => ({
            descripcion: "Sensor IFM PN2271",
            numeroParte: "PN2271",
            proveedor: "ifm",
            precioUnitario: 900,
            moneda: "MXN",
            origen: "compra",
            ordenIdOrigen: "ord-77",
            llavePieza: "PN2271|sensor ifm pn2271",
          }),
        },
      ],
    })
    const whereMock = vi.fn().mockReturnValue({ get: getMock })
    mockCollection.mockReturnValue({ where: whereMock })

    const res = await POST(solicitud({ piezas: [{ descripcion: "Sensor IFM PN2271", numeroParte: "PN2271" }] }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as Cuerpo
    expect(body.degradado).toBe(true)
    expect(mockCollection).toHaveBeenCalledWith("cotizaciones")
    expect(whereMock).toHaveBeenCalledWith("llavePieza", "in", ["PN2271|sensor ifm pn2271"])
    const [ctx] = body.contextos
    expect(ctx.cotizacionesPrevias.map((r) => r.refId)).toEqual(["cot#c-9"])
    expect(ctx.comprasPrevias[0]).toMatchObject({ refPath: "/ordenes?id=ord-77", empate: "exacto", precioUnitario: 900 })
  })

  it("los mapeos son best-effort: si fallan, la respuesta sigue siendo 200 sin familia ni clave SAT", async () => {
    mockMapeosSat.mockRejectedValue(new Error("sat caído"))
    mockMapeosAprobados.mockRejectedValue(new Error("mapeos caídos"))
    const res = await POST(solicitud({ piezas: [{ descripcion: "Sensor IFM PN2271" }] }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as Cuerpo
    expect(body.degradado).toBe(false)
    expect(body.contextos[0].familia).toBeNull()
    expect(body.contextos[0].claveSatValidada).toBeNull()
  })
})
