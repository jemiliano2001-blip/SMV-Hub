import { describe, it, expect, vi } from "vitest"
import {
  generarEmbeddingsIndice,
  MODELO_EMBEDDING_INDICE,
  DIMENSIONES_EMBEDDING_INDICE,
} from "../functions/src/busqueda-indice-gemini"

describe("generarEmbeddingsIndice", () => {
  it("usa gemini-embedding-2 con prefijo de documento y outputDimensionality 768", async () => {
    const vector = new Array(DIMENSIONES_EMBEDDING_INDICE).fill(0.1)
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embeddings: [{ values: vector }] }),
    } as unknown as Response)

    const resultado = await generarEmbeddingsIndice(
      [{ id: "orden-1#0", texto: "fresa carburo 4 filos", titulo: "Fresa carburo" }],
      { apiKey: "fake-key", fetchFn: mockFetch as unknown as typeof fetch }
    )

    expect(resultado.get("orden-1#0")).toEqual(vector)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string) as {
      requests: Array<{
        model: string
        content: { parts: Array<{ text: string }> }
        embedContentConfig: { outputDimensionality: number }
      }>
    }
    expect(body.requests[0].model).toBe(`models/${MODELO_EMBEDDING_INDICE}`)
    expect(body.requests[0].content.parts[0].text).toBe(
      "title: Fresa carburo | text: fresa carburo 4 filos"
    )
    expect(body.requests[0].embedContentConfig.outputDimensionality).toBe(768)
    expect(MODELO_EMBEDDING_INDICE).toBe("gemini-embedding-2")
  })
})
