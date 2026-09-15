import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const {
  mockVerificarUsuarioAutorizado,
  mockObtenerUsuarioAdmin,
  mockListarMedidasEndmillsAdmin,
  mockExtraerPedidoEndmillsMultimodalIA,
} = vi.hoisted(() => ({
  mockVerificarUsuarioAutorizado: vi.fn(),
  mockObtenerUsuarioAdmin: vi.fn(),
  mockListarMedidasEndmillsAdmin: vi.fn(),
  mockExtraerPedidoEndmillsMultimodalIA: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({
  verificarUsuarioAutorizado: mockVerificarUsuarioAutorizado,
}))

vi.mock("@/lib/usuarios-admin", () => ({
  obtenerUsuarioAdmin: mockObtenerUsuarioAdmin,
}))

vi.mock("@/lib/endmills-admin", () => ({
  listarMedidasEndmillsAdmin: mockListarMedidasEndmillsAdmin,
}))

vi.mock("@/lib/endmills-extraer-ia", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/endmills-extraer-ia")>()
  return {
    ...real,
    extraerPedidoEndmillsMultimodalIA: mockExtraerPedidoEndmillsMultimodalIA,
  }
})

import { POST } from "@/app/api/endmills/extraer-pedido/route"

const MEDIDA = {
  id: "m1",
  orden: 1,
  categoria: "flat",
  medidaPulgadas: "1/4",
  descripcion: "Flat 4F",
  stockActual: 10,
  stockActualizadoEn: new Date("2026-01-01"),
  precioActualUSD: 7.92,
  cotizacionFecha: "2026-01-01",
  specPropuesta: 'D1/4*4F',
  requiereConfirmacion: false,
  notas: null,
  objetivoPar: 20,
  ultimoPedidoId: null,
  creadoEn: new Date("2026-01-01"),
  actualizadoEn: new Date("2026-01-01"),
}

function makeFormRequest(file: File): NextRequest {
  const form = new FormData()
  form.append("archivo", file)
  return new NextRequest("http://localhost/api/endmills/extraer-pedido", {
    method: "POST",
    body: form,
  })
}

describe("POST /api/endmills/extraer-pedido", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerificarUsuarioAutorizado.mockResolvedValue({
      ok: true,
      uid: "user-1",
      email: "compras@smv.com",
    })
    mockObtenerUsuarioAdmin.mockResolvedValue({
      activo: true,
      esSuperAdmin: false,
      modulos: ["endmills"],
    })
    mockListarMedidasEndmillsAdmin.mockResolvedValue([MEDIDA])
  })

  it("retorna 401 si el usuario no está autorizado", async () => {
    mockVerificarUsuarioAutorizado.mockResolvedValueOnce({
      ok: false,
      response: Response.json({ error: "No autorizado" }, { status: 401 }),
    })

    const res = await POST(
      makeFormRequest(new File([new Uint8Array([1, 2, 3])], "image.png", { type: "image/png" }))
    )
    expect(res.status).toBe(401)
    expect(mockListarMedidasEndmillsAdmin).not.toHaveBeenCalled()
  })

  it("retorna 403 si el usuario no tiene módulo endmills", async () => {
    mockObtenerUsuarioAdmin.mockResolvedValueOnce({
      activo: true,
      esSuperAdmin: false,
      modulos: ["ordenes"],
    })

    const res = await POST(
      makeFormRequest(new File([new Uint8Array([1, 2, 3])], "image.png", { type: "image/png" }))
    )
    expect(res.status).toBe(403)
    expect(mockListarMedidasEndmillsAdmin).not.toHaveBeenCalled()
  })

  it("usa Admin SDK para el catálogo y extrae imagen con IA", async () => {
    mockExtraerPedidoEndmillsMultimodalIA.mockResolvedValueOnce({
      origen: "gemini_ia_vision",
      items: [
        {
          descripcionInput: "1/4 Flat 4F",
          medidaPulgadas: "1/4",
          cantidadPedida: 10,
          precioUnitarioUSD: 7.92,
          medidaIdCoincidencia: "m1",
          nivelCoincidencia: "exacto",
          notaMatch: "ok",
        },
      ],
    })

    const res = await POST(
      makeFormRequest(new File([new Uint8Array([1, 2, 3])], "image.png", { type: "image/png" }))
    )
    expect(res.status).toBe(200)
    expect(mockListarMedidasEndmillsAdmin).toHaveBeenCalledOnce()
    expect(mockExtraerPedidoEndmillsMultimodalIA).toHaveBeenCalledOnce()
    const body = await res.json()
    expect(body.origen).toBe("gemini_ia_vision")
    expect(body.items).toHaveLength(1)
  })

  it("retorna 500 con el mensaje de Firestore si el catálogo Admin falla", async () => {
    mockListarMedidasEndmillsAdmin.mockRejectedValueOnce(
      new Error("Missing or insufficient permissions.")
    )

    const res = await POST(
      makeFormRequest(new File([new Uint8Array([1, 2, 3])], "image.png", { type: "image/png" }))
    )
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe("Missing or insufficient permissions.")
    expect(mockExtraerPedidoEndmillsMultimodalIA).not.toHaveBeenCalled()
  })
})
