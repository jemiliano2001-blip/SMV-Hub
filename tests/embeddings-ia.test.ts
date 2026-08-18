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
import { prefijarTextoEmbedding } from "@/lib/embeddings-prefijos"
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

  it("devuelve gemini-embedding-2 por default", () => {
    delete process.env.GEMINI_MODEL_EMBEDDING
    expect(resolverModeloEmbedding()).toBe(MODELO_EMBEDDING_DEFAULT)
    expect(resolverModeloEmbedding()).toBe("gemini-embedding-2")
  })

  it("respeta override de variable de entorno", () => {
    process.env.GEMINI_MODEL_EMBEDDING = "gemini-embedding-001"
    expect(resolverModeloEmbedding()).toBe("gemini-embedding-001")
  })

  it("migra gemini-embedding-2-preview al GA", () => {
    process.env.GEMINI_MODEL_EMBEDDING = "gemini-embedding-2-preview"
    expect(resolverModeloEmbedding()).toBe("gemini-embedding-2")
  })
})

describe("prefijarTextoEmbedding", () => {
  it("prefija consultas de búsqueda", () => {
    expect(prefijarTextoEmbedding("RETRIEVAL_QUERY", "fresa carburo")).toBe(
      "task: search result | query: fresa carburo"
    )
  })

  it("prefija documentos con título", () => {
    expect(prefijarTextoEmbedding("RETRIEVAL_DOCUMENT", "aluminio 6061", "Placa")).toBe(
      "title: Placa | text: aluminio 6061"
    )
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
  it("llama a la API de Gemini Embeddings con prefijo de consulta y retorna el vector", async () => {
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
      modelo: "gemini-embedding-2",
      fetchFn: mockFetch as unknown as typeof fetch,
    })

    expect(resultado).toEqual(mockValues)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const callUrl = mockFetch.mock.calls[0][0] as string
    expect(callUrl).toContain("gemini-embedding-2:embedContent")
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string) as {
      content: { parts: Array<{ text: string }> }
    }
    expect(body.content.parts[0].text).toBe("task: search result | query: fresa de carburo 4 filos")
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

  it("no reintenta con otro modelo en 404 — lanza ErrorIA", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "model not found",
    } as unknown as Response)

    await expect(
      generarEmbeddingTexto("fresa de carburo", {
        apiKey: "fake-key",
        fetchFn: mockFetch as unknown as typeof fetch,
      })
    ).rejects.toThrow(ErrorIA)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("usa taskType en embedContentConfig para gemini-embedding-001", async () => {
    const mockValues = [0.1, 0.2]
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embedding: { values: mockValues } }),
    } as unknown as Response)

    await generarEmbeddingTexto("endmill", {
      apiKey: "fake-key",
      modelo: "gemini-embedding-001",
      fetchFn: mockFetch as unknown as typeof fetch,
      taskType: "RETRIEVAL_QUERY",
    })

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string) as {
      content: { parts: Array<{ text: string }> }
      embedContentConfig: { taskType: string }
    }
    expect(body.content.parts[0].text).toBe("endmill")
    expect(body.embedContentConfig.taskType).toBe("RETRIEVAL_QUERY")
  })

  it("no cae al fallback en errores que no son 404 (p.ej. 429)", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 429, text: async () => "rate limited" } as unknown as Response)

    await expect(
      generarEmbeddingTexto("endmill", { apiKey: "fake-key", fetchFn: mockFetch as unknown as typeof fetch })
    ).rejects.toThrow(ErrorIA)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

describe("generarEmbeddingsLote", () => {
  it("procesa múltiples textos en lote con embedContentConfig", async () => {
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
      outputDimensionality: 768,
    })

    expect(resultado).toHaveLength(2)
    expect(resultado[0]).toEqual([0.1, 0.2])
    expect(resultado[1]).toEqual([0.3, 0.4])
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string) as {
      requests: Array<{ embedContentConfig: { outputDimensionality: number } }>
    }
    expect(body.requests[0].embedContentConfig.outputDimensionality).toBe(768)
  })

  it("un 429 NO dispara N peticiones individuales — lanza ErrorIA", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "rate limited",
    } as unknown as Response)

    await expect(
      generarEmbeddingsLote(["a", "b", "c"], { apiKey: "fake-key", fetchFn: mockFetch as unknown as typeof fetch })
    ).rejects.toThrow(ErrorIA)
    // Solo el intento de batch, nunca N llamadas individuales de más.
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("un timeout NO dispara N peticiones individuales — lanza ErrorIA", async () => {
    const mockFetch = vi.fn().mockImplementation(() => {
      const err = new Error("aborted")
      err.name = "AbortError"
      return Promise.reject(err)
    })

    await expect(
      generarEmbeddingsLote(["a", "b", "c"], {
        apiKey: "fake-key",
        fetchFn: mockFetch as unknown as typeof fetch,
        timeoutMs: 10,
      })
    ).rejects.toThrow(/Tiempo de espera agotado/)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("un 400 (batch no soportado) SÍ degrada a peticiones individuales", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 400, text: async () => "batch not supported" } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ embedding: { values: [0.1] } }) } as unknown as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ embedding: { values: [0.2] } }) } as unknown as Response)

    const resultado = await generarEmbeddingsLote(["a", "b"], {
      apiKey: "fake-key",
      fetchFn: mockFetch as unknown as typeof fetch,
    })

    expect(resultado).toEqual([[0.1], [0.2]])
    expect(mockFetch).toHaveBeenCalledTimes(3) // 1 intento batch + 2 individuales
  })

  it("lanza ErrorIA si la respuesta 200 no trae la misma cantidad de embeddings que textos", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embeddings: [{ values: [0.1] }] }), // solo 1, se pidieron 2
    } as unknown as Response)

    await expect(
      generarEmbeddingsLote(["a", "b"], { apiKey: "fake-key", fetchFn: mockFetch as unknown as typeof fetch })
    ).rejects.toThrow(ErrorIA)
  })

  it("parte un lote grande en chunks en vez de mandar un solo request gigante", async () => {
    const textos = Array.from({ length: 250 }, (_, i) => `item-${i}`)
    const mockFetch = vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { requests: unknown[] }
      return {
        ok: true,
        json: async () => ({ embeddings: body.requests.map(() => ({ values: [0.1] })) }),
      } as unknown as Response
    })

    const resultado = await generarEmbeddingsLote(textos, {
      apiKey: "fake-key",
      fetchFn: mockFetch as unknown as typeof fetch,
    })

    expect(resultado).toHaveLength(250)
    // 250 textos / 100 por chunk = 3 llamadas (100 + 100 + 50), ninguna con los 250 juntos.
    expect(mockFetch).toHaveBeenCalledTimes(3)
    for (const call of mockFetch.mock.calls) {
      const body = JSON.parse((call[1] as RequestInit).body as string) as { requests: unknown[] }
      expect(body.requests.length).toBeLessThanOrEqual(100)
    }
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

  it("omite ítems cuya dimensión no coincide con la consulta", () => {
    const query = [1, 0, 0]
    const items: ItemVectorizado<{ nombre: string }>[] = [
      {
        id: "ok",
        embedding: [1, 0, 0],
        data: { nombre: "Compatible" },
      },
      {
        id: "mal",
        embedding: [1, 0, 0, 0],
        data: { nombre: "Dimensión distinta" },
      },
    ]

    const resultados = buscarPorSimilitudSemantica(query, items, { topK: 5, minScore: 0.5 })
    expect(resultados).toHaveLength(1)
    expect(resultados[0].id).toBe("ok")
  })
})
