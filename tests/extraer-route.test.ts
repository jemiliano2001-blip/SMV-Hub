import { describe, it, expect, vi, beforeEach } from "vitest"

// Mockeamos el helper de extracción para no llamar a la API real de Claude.
const { mockExtraerFactura, mockVerificarUsuarioAutorizado } = vi.hoisted(() => ({
  mockExtraerFactura: vi.fn(),
  mockVerificarUsuarioAutorizado: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({
  verificarUsuarioAutorizado: mockVerificarUsuarioAutorizado,
}))

vi.mock("@/lib/extraer-ia", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/extraer-ia")>()
  return {
    ...real,
    extraerFactura: mockExtraerFactura,
  }
})

import { NextRequest } from "next/server"
import { POST } from "@/app/api/extraer/route"

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(file: File | null): NextRequest {
  const form = new FormData()
  if (file) form.append("imagen", file)
  return new NextRequest("http://localhost/api/extraer", { method: "POST", body: form })
}

function fakeImageFile(type = "image/jpeg"): File {
  return new File([new Uint8Array([1, 2, 3])], "factura.jpg", { type })
}

const VALID_EXTRACTION = {
  proveedor: "Amazon",
  numeroFactura: "INV-001",
  fechaFactura: "2024-06-01",
  moneda: "USD",
  subtotal: 100,
  impuestos: 8,
  total: 108,
  items: [{ descripcion: "Widget", cantidad: 2, precioUnitario: 50, total: 100 }],
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/extraer", () => {
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

    const res = await POST(makeRequest(fakeImageFile()))
    expect(res.status).toBe(401)
    expect(mockExtraerFactura).not.toHaveBeenCalled()
  })

  it("retorna 400 si no se envía imagen", async () => {
    const res = await POST(makeRequest(null))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/imagen/i)
  })

  it("retorna 400 si el archivo no es imagen ni PDF", async () => {
    const txt = new File(["content"], "doc.txt", { type: "text/plain" })
    const res = await POST(makeRequest(txt))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/PDF/i)
  })

  it("acepta PDF", async () => {
    mockExtraerFactura.mockResolvedValueOnce(VALID_EXTRACTION)
    const pdf = new File(["content"], "doc.pdf", { type: "application/pdf" })
    const res = await POST(makeRequest(pdf))
    expect(res.status).toBe(200)
    expect(mockExtraerFactura).toHaveBeenCalledWith(expect.any(String), "application/pdf")
  })

  it("retorna 200 con datos extraídos válidos", async () => {
    mockExtraerFactura.mockResolvedValueOnce(VALID_EXTRACTION)
    const res = await POST(makeRequest(fakeImageFile()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.proveedor).toBe("Amazon")
    expect(body.total).toBe(108)
    expect(body.items).toHaveLength(1)
  })

  it("acepta total null (IA no pudo leer el total)", async () => {
    mockExtraerFactura.mockResolvedValueOnce({ ...VALID_EXTRACTION, total: null })
    const res = await POST(makeRequest(fakeImageFile()))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.total).toBeNull()
  })

  it("retorna 502 si la extracción lanza error", async () => {
    mockExtraerFactura.mockRejectedValueOnce(new Error("Network error"))
    const res = await POST(makeRequest(fakeImageFile()))
    expect(res.status).toBe(502)
  })

  it("acepta imagen PNG", async () => {
    mockExtraerFactura.mockResolvedValueOnce(VALID_EXTRACTION)
    const res = await POST(makeRequest(fakeImageFile("image/png")))
    expect(res.status).toBe(200)
  })

  it("pasa el mimeType correcto al extractor", async () => {
    mockExtraerFactura.mockResolvedValueOnce(VALID_EXTRACTION)
    await POST(makeRequest(fakeImageFile("image/webp")))
    expect(mockExtraerFactura).toHaveBeenCalledWith(expect.any(String), "image/webp")
  })
})
