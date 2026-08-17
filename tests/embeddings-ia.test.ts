import { describe, it, expect, vi, afterEach } from "vitest"
import {
  similitudCoseno,
  generarEmbeddingTexto,
  generarEmbeddingsLote,
  buscarPorSimilitudSemantica,
  resolverModeloEmbedding,
  MODELO_EMBEDDING_DEFAULT,
  type ItemVectorizado,
} from "@/lib/embeddings-ia"
import { ErrorIA } from "@/lib/extraer-ia"

describe("resolverModeloEmbedding", () => {
  const originalEnv = process.env.GEMINI_MODEL_EMBEDDING

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.GEMINI_MODEL_EMBEDDING
    } else {
      process.env.GEMINI_MODEL_EMBEDDING = originalEnv
    }
  })

  it("devuelve gemini-embedding-2-preview por default", () => {
    delete process.env.GEMINI_MODEL_EMBEDDING
    expect(resolverModeloEmbedding()).toBe(MODELO_EMBEDDING_DEFAULT)
    expect(resolverModeloEmbedding()).toBe("gemini-embedding-2-preview")
  })

  it("respeta override de variable de entorno", () => {
    process.env.GEMINI_MODEL_EMBEDDING = "gemini-embedding-001"
    expect(resolverModeloEmbedding()).toBe("gemini-embedding-001")
  })
})

describe("similitudCoseno", () => {
  it("calcula 1 para vectores idénticos", () => {
    const v1 = [1, 2, 3]
    const v2 = [1, 2, 3]
    expect(similitudCoseno(v1, v2)).toBeCloseTo(1.0, 5)
  })

  it("calcula 0 para vectores ortogonales", () => {
    const v1 = [1, 0, 0]
    const v2 = [0, 1, 0]
    expect(similitudCoseno(v1, v2)).toBeCloseTo(0.0, 5)
  })

  it("calcula -1 para vectores opuestos", () => {
    const v1 = [1, 2, 3]
    const v2 = [-1, -2, -3]
    expect(similitudCoseno(v1, v2)).toBeCloseTo(-1.0, 5)
  })

  it("retorna 0 si algún vector está vacío", () => {
    expect(similitudCoseno([], [1, 2])).toBe(0)
    expect(similitudCoseno([1, 2], [])).toBe(0)
  })

  it("lanza error si las dimensiones no coinciden", () => {
    expect(() => similitudCoseno([1, 2], [1, 2, 3])).toThrow(/dimensión/)
  })
})

describe("generarEmbeddingTexto", () => {
  it("llama a la API de Gemini Embeddings y retorna el vector", async () => {
    const mockValues = [0.12, -0.45, 0.78, 0.05]
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        embedding: {
          values: mockValues,
        },
      }),
    } as unknown as Response)

    const resultado = await generarEmbeddingTexto("fresa de carburo 4 filos", {
      apiKey: "fake-key",
      modelo: "gemini-embedding-2-preview",
      fetchFn: mockFetch as unknown as typeof fetch,
    })

    expect(resultado).toEqual(mockValues)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const callUrl = mockFetch.mock.calls[0][0] as string
    expect(callUrl).toContain("gemini-embedding-2-preview:embedContent")
  })

  it("lanza ErrorIA si la consulta está vacía", async () => {
    await expect(generarEmbeddingTexto("   ", { apiKey: "fake-key" })).rejects.toThrow(ErrorIA)
  })

  it("lanza ErrorIA si la API retorna error", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    } as unknown as Response)

    await expect(
      generarEmbeddingTexto("endmill", {
        apiKey: "fake-key",
        fetchFn: mockFetch as unknown as typeof fetch,
      })
    ).rejects.toThrow(ErrorIA)
  })
})

describe("generarEmbeddingsLote", () => {
  it("procesa múltiples textos en lote", async () => {
    const mockEmbeddings = [
      { values: [0.1, 0.2] },
      { values: [0.3, 0.4] },
    ]
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        embeddings: mockEmbeddings,
      }),
    } as unknown as Response)

    const resultado = await generarEmbeddingsLote(["aluminio 6061", "acero 4140"], {
      apiKey: "fake-key",
      fetchFn: mockFetch as unknown as typeof fetch,
    })

    expect(resultado).toHaveLength(2)
    expect(resultado[0]).toEqual([0.1, 0.2])
    expect(resultado[1]).toEqual([0.3, 0.4])
  })
})

describe("buscarPorSimilitudSemantica", () => {
  it("ordena los resultados por similitud descendente y respeta topK y minScore", () => {
    const query = [1, 0, 0]
    const items: ItemVectorizado<{ nombre: string }>[] = [
      {
        id: "1",
        embedding: [0.9, 0.1, 0], // Similitud muy alta (~0.99)
        data: { nombre: "Coincidencia exacta" },
      },
      {
        id: "2",
        embedding: [0.5, 0.5, 0], // Similitud media (~0.70)
        data: { nombre: "Coincidencia media" },
      },
      {
        id: "3",
        embedding: [0, 1, 0], // Ortogonal (similitud 0)
        data: { nombre: "Sin relación" },
      },
    ]

    const resultados = buscarPorSimilitudSemantica(query, items, {
      topK: 2,
      minScore: 0.5,
    })

    expect(resultados).toHaveLength(2)
    expect(resultados[0].id).toBe("1")
    expect(resultados[0].porcentajeSimilitud).toBeGreaterThanOrEqual(95)
    expect(resultados[1].id).toBe("2")
    expect(resultados[1].porcentajeSimilitud).toBeGreaterThanOrEqual(70)
  })
})
