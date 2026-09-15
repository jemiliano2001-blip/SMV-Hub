import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockVerificarUsuarioAutorizado, mockObtenerUsuarioAdmin, mockBuscar, mockExcedeLimite } = vi.hoisted(
  () => ({
    mockVerificarUsuarioAutorizado: vi.fn(),
    mockObtenerUsuarioAdmin: vi.fn(),
    mockBuscar: vi.fn(),
    mockExcedeLimite: vi.fn(),
  })
)

vi.mock("@/lib/api-auth", () => ({ verificarUsuarioAutorizado: mockVerificarUsuarioAutorizado }))
vi.mock("@/lib/usuarios-admin", () => ({ obtenerUsuarioAdmin: mockObtenerUsuarioAdmin }))
vi.mock("@/lib/busqueda-semantica-catalogo", () => ({ buscarEnCatalogoSemantico: mockBuscar }))
vi.mock("@/lib/rate-limit-memoria", () => ({ excedeLimite: mockExcedeLimite }))

import { NextRequest } from "next/server"
import { POST } from "@/app/api/busqueda-semantica/route"

const accesoOk = { ok: true as const, uid: "u-1", email: "u@smv.com", token: "token" }

function solicitud(payload: unknown) {
  return new NextRequest("http://localhost/api/busqueda-semantica", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
    body: JSON.stringify(payload),
  })
}

function usuario(modulos: string[], esSuperAdmin = false) {
  return { rol: "compras", plantilla: "compras", modulos, esSuperAdmin, activo: true }
}

describe("POST /api/busqueda-semantica — permisos por fuente (tabla compartida con la memoria operativa)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerificarUsuarioAutorizado.mockResolvedValue(accesoOk)
    mockExcedeLimite.mockReturnValue(false)
    mockBuscar.mockResolvedValue({ query: "q", tiempoMs: 1, totalEncontrados: 0, resultados: [] })
  })

  it("401 cuando no hay token válido", async () => {
    mockVerificarUsuarioAutorizado.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) })
    const res = await POST(solicitud({ query: "fresa" }))
    expect(res.status).toBe(401)
    expect(mockBuscar).not.toHaveBeenCalled()
  })

  it("criterio #7: sin módulo cotizaciones, la fuente cotizacion nunca llega al catálogo", async () => {
    mockObtenerUsuarioAdmin.mockResolvedValue(usuario(["ordenes", "proveedores"]))
    const res = await POST(solicitud({ query: "sensor de proximidad" }))
    expect(res.status).toBe(200)
    expect(mockBuscar).toHaveBeenCalledTimes(1)
    const opciones = mockBuscar.mock.calls[0][1] as { fuentesPermitidas: string[] }
    expect(opciones.fuentesPermitidas).toEqual(["orden-item", "proveedor"])
    expect(opciones.fuentesPermitidas).not.toContain("cotizacion")
  })

  it("con módulo cotizaciones sí recibe la fuente (y solo esa si no tiene los otros)", async () => {
    mockObtenerUsuarioAdmin.mockResolvedValue(usuario(["cotizaciones"]))
    await POST(solicitud({ query: "pistón neumático SMC" }))
    const opciones = mockBuscar.mock.calls[0][1] as { fuentesPermitidas: string[] }
    expect(opciones.fuentesPermitidas).toEqual(["cotizacion"])
  })

  it("super-admin recibe las tres fuentes", async () => {
    mockObtenerUsuarioAdmin.mockResolvedValue(usuario([], true))
    await POST(solicitud({ query: "resortes" }))
    const opciones = mockBuscar.mock.calls[0][1] as { fuentesPermitidas: string[] }
    expect(opciones.fuentesPermitidas).toEqual(["orden-item", "proveedor", "cotizacion"])
  })

  it("403 sin tocar el catálogo cuando el usuario no tiene ningún módulo con fuente", async () => {
    mockObtenerUsuarioAdmin.mockResolvedValue(usuario(["almacen", "banos"]))
    const res = await POST(solicitud({ query: "fresa" }))
    expect(res.status).toBe(403)
    expect(mockBuscar).not.toHaveBeenCalled()
  })

  it("429 cuando el rate limit por uid se excede", async () => {
    mockExcedeLimite.mockReturnValue(true)
    const res = await POST(solicitud({ query: "fresa" }))
    expect(res.status).toBe(429)
    expect(mockBuscar).not.toHaveBeenCalled()
  })
})
