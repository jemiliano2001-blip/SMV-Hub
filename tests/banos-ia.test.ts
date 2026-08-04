import { afterEach, describe, expect, it, vi } from "vitest"
import {
  evaluarSolicitudBorradoConIa,
  MODELO_BANOS_DEFAULT,
  resolverModeloBanos,
} from "@/lib/banos-ia"
import type { RegistroBano } from "@/lib/schemas"

const registro = {
  id: "registro-1",
  operador: "Ana",
  bano: "Baño #1",
  horaEntrada: "10:00",
  horaLlegada: "10:07",
  fecha: "2026-07-31",
  tiempoMinutos: 7,
  creadoEn: new Date("2026-07-31T10:00:00Z"),
  actualizadoEn: new Date("2026-07-31T10:07:00Z"),
  creadoPorUid: "user-1",
  creadoPorNombre: "Ana",
} as RegistroBano

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  delete process.env.GEMINI_API_KEY
  delete process.env.GEMINI_MODEL_BANOS
})

describe("Gemini para solicitudes de Baños", () => {
  it("usa el modelo estable documentado cuando no hay override", () => {
    expect(resolverModeloBanos()).toBe(MODELO_BANOS_DEFAULT)
    expect(resolverModeloBanos("  gemini-custom  ")).toBe("gemini-custom")
  })

  it("reintenta con el modelo estable si el override ya no existe", async () => {
    process.env.GEMINI_API_KEY = "test-key"
    process.env.GEMINI_MODEL_BANOS = "modelo-retirado"
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("modelo no encontrado", { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify({
          decision: "revision",
          confianza: 0.4,
          motivo: "Faltan datos",
        }) }] } }],
      }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await evaluarSolicitudBorradoConIa({
      registro,
      motivo: "duplicado",
      relacionados: [registro],
    })

    expect(result.decision).toBe("revision")
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1]?.[0]).toContain(`/models/${MODELO_BANOS_DEFAULT}:generateContent`)
  })

  it("corta una solicitud que excede el timeout", async () => {
    process.env.GEMINI_API_KEY = "test-key"
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))
    }))
    vi.stubGlobal("fetch", fetchMock)
    vi.useFakeTimers()

    const pending = evaluarSolicitudBorradoConIa({
      registro,
      motivo: "duplicado",
      relacionados: [registro],
    })
    const assertion = expect(pending).rejects.toThrow("tardo demasiado")
    await vi.advanceTimersByTimeAsync(15_000)

    await assertion
  })
})
