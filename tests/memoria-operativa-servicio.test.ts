import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockGetClienteAuth } = vi.hoisted(() => ({ mockGetClienteAuth: vi.fn() }))
vi.mock("@/lib/firebase", () => ({ getClienteAuth: mockGetClienteAuth, db: {}, storage: {} }))

import { consultarMemoriaOperativa } from "@/lib/services/memoria-operativa"

const respuestaOk = {
  contextos: [{ indice: 0, llavePieza: "|x", numerosParte: [], comprasPrevias: [], cotizacionesPrevias: [], totalExactos: 0, totalParecidos: 0, familiaComprada: null, alertaPrecio: null, proveedorPreferido: null, claveSatValidada: null, familia: null }],
  fuentesConsultadas: ["orden-item", "cotizacion"],
  verPrecios: true,
  degradado: false,
  tiempoMs: 12,
}

function fetchQueResponde(status: number, body: unknown): typeof fetch {
  return vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as typeof fetch
}

describe("consultarMemoriaOperativa — cliente que nunca lanza", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetClienteAuth.mockReturnValue({ currentUser: { getIdToken: async () => "tok" } })
  })

  it("manda solo piezas con descripción, con token, y devuelve la respuesta tal cual", async () => {
    const fetchFn = fetchQueResponde(200, { ok: true, ...respuestaOk })
    const r = await consultarMemoriaOperativa(
      [{ descripcion: "  Fresa 1/4  ", precioUnitario: 12, moneda: "USD" }, { descripcion: "   " }],
      { fetchFn }
    )
    expect(r.ok).toBe(true)
    expect(r.piezasEnviadas).toEqual([{ descripcion: "Fresa 1/4", numeroParte: null, proveedor: null, proveedorId: null, precioUnitario: 12, moneda: "USD" }])
    const [url, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(url).toBe("/api/memoria-operativa/consultar")
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok")
    expect(JSON.parse(String(init.body))).toEqual({ piezas: r.piezasEnviadas })
    if (r.ok) expect(r.respuesta.contextos).toHaveLength(1)
  })

  it("sin piezas con descripción → ok vacío sin llamar a la red", async () => {
    const fetchFn = fetchQueResponde(200, respuestaOk)
    const r = await consultarMemoriaOperativa([{ descripcion: "" }], { fetchFn })
    expect(r.ok).toBe(true)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it("sin sesión → motivo sin_sesion sin llamar a la red", async () => {
    mockGetClienteAuth.mockReturnValue({ currentUser: null })
    const fetchFn = fetchQueResponde(200, respuestaOk)
    const r = await consultarMemoriaOperativa([{ descripcion: "x" }], { fetchFn })
    expect(r).toMatchObject({ ok: false, motivo: "sin_sesion" })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it("mapea 401/403/429/500 a motivos sin lanzar", async () => {
    for (const [status, motivo] of [[401, "sin_sesion"], [403, "sin_permiso"], [429, "limite"], [500, "servidor"]] as const) {
      const r = await consultarMemoriaOperativa([{ descripcion: "x" }], { fetchFn: fetchQueResponde(status, { error: "e" }) })
      expect(r, String(status)).toMatchObject({ ok: false, motivo })
    }
  })

  /** Como el fetch real: rechaza al abortar, y de inmediato si la señal ya venía abortada. */
  const fetchQueEsperaAbort = () =>
    vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_, reject) => {
        const fallar = () => reject(new DOMException("abort", "AbortError"))
        if (init.signal?.aborted) fallar()
        else init.signal?.addEventListener("abort", fallar)
      })
    }) as unknown as typeof fetch

  it("timeout → motivo timeout (criterio #6: la captura sigue)", async () => {
    const r = await consultarMemoriaOperativa([{ descripcion: "x" }], { fetchFn: fetchQueEsperaAbort(), timeoutMs: 10 })
    expect(r).toMatchObject({ ok: false, motivo: "timeout" })
  })

  it("cancelación externa → motivo cancelado; error de red → motivo red", async () => {
    const controller = new AbortController()
    const fetchFn = fetchQueEsperaAbort()
    const pendiente = consultarMemoriaOperativa([{ descripcion: "x" }], { fetchFn, signal: controller.signal })
    controller.abort()
    expect(await pendiente).toMatchObject({ ok: false, motivo: "cancelado" })

    const red = vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) as unknown as typeof fetch
    expect(await consultarMemoriaOperativa([{ descripcion: "x" }], { fetchFn: red })).toMatchObject({ ok: false, motivo: "red" })
  })

  it("recorta a 20 piezas", async () => {
    const fetchFn = fetchQueResponde(200, { ok: true, ...respuestaOk })
    const r = await consultarMemoriaOperativa(Array.from({ length: 25 }, (_, i) => ({ descripcion: `p${i}` })), { fetchFn })
    expect(r.piezasEnviadas).toHaveLength(20)
  })
})
