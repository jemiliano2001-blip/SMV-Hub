import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  mockVerificarUsuarioAutorizado,
  mockCargarMapeos,
  mockSugerirClaves,
} = vi.hoisted(() => ({
  mockVerificarUsuarioAutorizado: vi.fn(),
  mockCargarMapeos: vi.fn(),
  mockSugerirClaves: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({
  verificarUsuarioAutorizado: mockVerificarUsuarioAutorizado,
}))

vi.mock("@/lib/sat/cargar-mapeos-firestore", () => ({
  cargarMapeosSatDesdeFirestore: mockCargarMapeos,
}))

vi.mock("@/lib/sat/sugerir-clave", () => ({
  construirHistorialSat: vi.fn(() => new Map()),
  construirHistorialSatDesdeEntradas: vi.fn(() => new Map()),
  combinarMapeosSmv: vi.fn(() => []),
  getMapeosSmv: vi.fn(() => []),
  sugerirClavesSatLote: mockSugerirClaves,
}))

import { NextRequest } from "next/server"
import { POST } from "@/app/api/sugerir-clave-sat/route"

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/sugerir-clave-sat", {
    method: "POST",
    body: JSON.stringify(body),
  })
}

describe("POST /api/sugerir-clave-sat", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerificarUsuarioAutorizado.mockResolvedValue({
      ok: true,
      uid: "usuario-1",
      email: "compras@smv.com",
    })
    mockCargarMapeos.mockResolvedValue([])
    mockSugerirClaves.mockResolvedValue([])
  })

  it("preserves previous normalized terms sent by the interface", async () => {
    const res = await POST(makeRequest({
      items: [{
        descripcion: "Compression spring",
        proveedor: "McMaster-Carr",
        terminosPrevios: "resorte de compresion",
      }],
    }))

    expect(res.status).toBe(200)
    expect(mockSugerirClaves).toHaveBeenCalledWith(
      [expect.objectContaining({ terminosPrevios: "resorte de compresion" })],
      expect.any(Map),
      expect.objectContaining({ mapeos: [] })
    )
  })
})
