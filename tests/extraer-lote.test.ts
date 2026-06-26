import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockExtraerRegistros, mockVerificarUsuarioAutorizado } = vi.hoisted(() => ({
  mockExtraerRegistros: vi.fn(),
  mockVerificarUsuarioAutorizado: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({
  verificarUsuarioAutorizado: mockVerificarUsuarioAutorizado,
}))

vi.mock("@/lib/extraer-ia", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/extraer-ia")>()
  return {
    ...real,
    extraerRegistros: mockExtraerRegistros,
  }
})

import { NextRequest } from "next/server"
import { POST } from "@/app/api/extraer-lote/route"
import { MODELO_EXTRACCION_ALTA } from "@/lib/extraer-ia"

function makeRequest(files: File[], calidad?: string): NextRequest {
  const form = new FormData()
  for (const f of files) form.append("imagenes", f)
  if (calidad) form.append("calidad", calidad)
  return new NextRequest("http://localhost/api/extraer-lote", { method: "POST", body: form })
}

function img(name = "f.jpg", type = "image/jpeg"): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type })
}

const REGISTRO = {
  proveedor: "Amazon",
  numeroFactura: null,
  fechaFactura: null,
  moneda: "USD",
  subtotal: null,
  impuestos: null,
  total: 50,
  items: [],
}

describe("POST /api/extraer-lote", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerificarUsuarioAutorizado.mockResolvedValue({
      ok: true,
      uid: "user-1",
      email: "ordenes@smv.com",
    })
  })

  it("retorna 401 si el usuario no está autorizado", async () => {
    mockVerificarUsuarioAutorizado.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: "No autorizado" }, { status: 401 }),
    })

    const res = await POST(makeRequest([img()]))
    expect(res.status).toBe(401)
    expect(mockExtraerRegistros).not.toHaveBeenCalled()
  })

  it("retorna 400 si no se envían imágenes", async () => {
    const res = await POST(makeRequest([]))
    expect(res.status).toBe(400)
  })

  it("retorna 400 si algún archivo no es válido", async () => {
    const txt = new File(["x"], "doc.txt", { type: "text/plain" })
    const res = await POST(makeRequest([img(), txt]))
    expect(res.status).toBe(400)
  })

  it("acepta PDF en el lote", async () => {
    mockExtraerRegistros.mockResolvedValueOnce([REGISTRO])
    const pdf = new File(["x"], "doc.pdf", { type: "application/pdf" })
    const res = await POST(makeRequest([pdf]))
    expect(res.status).toBe(200)
    expect(mockExtraerRegistros).toHaveBeenCalledWith(expect.any(String), "application/pdf", expect.any(String))
  })

  it("aplana los registros de varias imágenes en un solo array", async () => {
    mockExtraerRegistros
      .mockResolvedValueOnce([REGISTRO, { ...REGISTRO, proveedor: "B" }]) // tabla: 2 filas
      .mockResolvedValueOnce([{ ...REGISTRO, proveedor: "C" }]) // factura: 1 fila
    const res = await POST(makeRequest([img("a.jpg"), img("b.png", "image/png")]))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.extracciones).toHaveLength(3)
    expect(body.extracciones.map((e: { proveedor: string }) => e.proveedor)).toEqual(["Amazon", "B", "C"])
  })

  it("usa el modelo de alta precisión cuando calidad=alta", async () => {
    mockExtraerRegistros.mockResolvedValueOnce([REGISTRO])
    await POST(makeRequest([img()], "alta"))
    expect(mockExtraerRegistros).toHaveBeenCalledWith(
      expect.any(String),
      "image/jpeg",
      MODELO_EXTRACCION_ALTA
    )
  })

  it("retorna 502 si la extracción lanza error", async () => {
    mockExtraerRegistros.mockRejectedValueOnce(new Error("boom"))
    const res = await POST(makeRequest([img()]))
    expect(res.status).toBe(502)
  })
})
