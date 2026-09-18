import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockVerificarUsuarioAutorizado } = vi.hoisted(() => ({
  mockVerificarUsuarioAutorizado: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({
  verificarUsuarioAutorizado: mockVerificarUsuarioAutorizado,
}))

import { NextRequest } from "next/server"
import { POST } from "@/app/api/claves-sat/validar/route"

function makeRequest(body: unknown, raw = false): NextRequest {
  return new NextRequest("http://localhost/api/claves-sat/validar", {
    method: "POST",
    body: raw ? (body as string) : JSON.stringify(body),
  })
}

describe("POST /api/claves-sat/validar", () => {
  beforeEach(() => {
    mockVerificarUsuarioAutorizado.mockReset()
    mockVerificarUsuarioAutorizado.mockResolvedValue({
      ok: true,
      uid: "uid-1",
      email: "compras@smv.test",
      token: "token",
    })
  })

  it("devuelve la respuesta de auth cuando el usuario no está autorizado", async () => {
    const denegado = new Response(JSON.stringify({ error: "No autorizado" }), { status: 401 })
    mockVerificarUsuarioAutorizado.mockResolvedValue({ ok: false, response: denegado })

    const res = await POST(makeRequest({ claves: ["31161904"] }))

    expect(res.status).toBe(401)
  })

  it("responde 400 si el body no es JSON", async () => {
    const res = await POST(makeRequest("esto no es json", true))

    expect(res.status).toBe(400)
  })

  it("responde 400 si faltan claves o hay demasiadas", async () => {
    expect((await POST(makeRequest({ claves: [] }))).status).toBe(400)
    expect((await POST(makeRequest({}))).status).toBe(400)
    expect((await POST(makeRequest({ claves: Array.from({ length: 201 }, () => "31161904") }))).status).toBe(400)
  })

  it("devuelve sólo las claves existentes, normalizadas, con descripción y sin duplicados", async () => {
    const res = await POST(
      makeRequest({ claves: ["31161904", "31-1619-04", "99999999", "1234", "", " 31161904 "] })
    )

    expect(res.status).toBe(200)
    expect(res.headers.get("Cache-Control")).toBe("no-store")
    const data = (await res.json()) as { validas: Array<{ clave: string; descripcion: string }> }
    expect(data.validas).toHaveLength(1)
    expect(data.validas[0].clave).toBe("31161904")
    expect(data.validas[0].descripcion.length).toBeGreaterThan(0)
  })

  it("devuelve lista vacía cuando ninguna clave existe", async () => {
    const res = await POST(makeRequest({ claves: ["99999999", "abc"] }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ validas: [] })
  })
})
