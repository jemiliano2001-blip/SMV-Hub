import { describe, it, expect, vi } from "vitest"
import {
  construirTextoItem,
  buscarEnCatalogoSemantico,
  CATALOGO_BASE_SMV,
} from "@/lib/busqueda-semantica-catalogo"

describe("busqueda-semantica-catalogo", () => {
  it("construirTextoItem concatena títulos en español, inglés y especificaciones", () => {
    const item = CATALOGO_BASE_SMV[0]
    const texto = construirTextoItem(item)

    expect(texto).toContain(item.tituloES)
    expect(texto).toContain(item.tituloEN)
    expect(texto).toContain(item.categoria)
  })

  it("buscarEnCatalogoSemantico retorna resultados rankeados", async () => {
    // Mock para simular embeddings de longitud 4
    const mockVector = [0.5, 0.5, 0.5, 0.5]
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        embedding: { values: mockVector },
        embeddings: CATALOGO_BASE_SMV.map(() => ({ values: mockVector })),
      }),
    } as unknown as Response)

    const res = await buscarEnCatalogoSemantico("cortadores de carburo", {
      apiKey: "fake-key",
      fetchFn: mockFetch as unknown as typeof fetch,
      topK: 3,
      minScore: 0.2,
    })

    expect(res.query).toBe("cortadores de carburo")
    expect(res.totalEncontrados).toBeGreaterThan(0)
    expect(res.resultados.length).toBeLessThanOrEqual(3)
    expect(res.resultados[0].porcentajeSimilitud).toBeGreaterThan(0)
  })

  it("retorna lista vacía si la query está en blanco", async () => {
    const res = await buscarEnCatalogoSemantico("   ")
    expect(res.totalEncontrados).toBe(0)
    expect(res.resultados).toEqual([])
  })
})
