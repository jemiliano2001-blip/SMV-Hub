import { describe, it, expect, vi } from "vitest"

const { mockAdminDb } = vi.hoisted(() => ({ mockAdminDb: { collection: vi.fn() } }))
vi.mock("@/lib/firebase-admin", () => ({ adminDb: mockAdminDb }))

import { buscarEnCatalogoSemantico } from "@/lib/busqueda-semantica-catalogo"

function fakeIndiceDocs(docs: Array<{ id: string; data: Record<string, unknown> }>) {
  const getMock = vi.fn().mockResolvedValue({ docs: docs.map((d) => ({ id: d.id, data: () => d.data })) })
  const whereMock = vi.fn().mockReturnValue({ get: getMock })
  mockAdminDb.collection.mockReturnValue({ where: whereMock })
  return { whereMock }
}

const VECTOR = new Array(768).fill(0.1)
function mockFetch(vector: number[] = VECTOR) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ embedding: { values: vector } }),
  } as unknown as Response)
}

describe("buscarEnCatalogoSemantico", () => {
  it("consulta busqueda_indice filtrado por fuentesPermitidas", async () => {
    const { whereMock } = fakeIndiceDocs([])
    await buscarEnCatalogoSemantico("resorte", {
      apiKey: "fake",
      fetchFn: mockFetch(),
      fuentesPermitidas: ["proveedor"],
    })
    expect(mockAdminDb.collection).toHaveBeenCalledWith("busqueda_indice")
    expect(whereMock).toHaveBeenCalledWith("fuente", "in", ["proveedor"])
  })

  it("no llama a Gemini ni a Firestore si fuentesPermitidas está vacío (usuario sin módulos)", async () => {
    const fetchFn = mockFetch()
    const res = await buscarEnCatalogoSemantico("resorte", { apiKey: "fake", fetchFn, fuentesPermitidas: [] })
    expect(res.resultados).toEqual([])
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it("no llama a Gemini si la query está en blanco", async () => {
    const fetchFn = mockFetch()
    const res = await buscarEnCatalogoSemantico("   ", { apiKey: "fake", fetchFn, fuentesPermitidas: ["proveedor"] })
    expect(res.resultados).toEqual([])
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it("rankea por similitud coseno real y respeta minScore", async () => {
    fakeIndiceDocs([
      {
        id: "a",
        data: { fuente: "proveedor", refPath: "/proveedores?id=a", titulo: "RYASA", metadata: {}, embedding: VECTOR },
      },
      {
        id: "b",
        data: {
          fuente: "proveedor",
          refPath: "/proveedores?id=b",
          titulo: "Opuesto",
          metadata: {},
          embedding: new Array(768).fill(-0.1), // anti-correlado con la query -> score negativo
        },
      },
    ])
    const res = await buscarEnCatalogoSemantico("rodamientos", {
      apiKey: "fake",
      fetchFn: mockFetch(VECTOR),
      fuentesPermitidas: ["proveedor"],
      minScore: 0.5,
    })
    expect(res.resultados).toHaveLength(1)
    expect(res.resultados[0].item.titulo).toBe("RYASA")
    expect(res.resultados[0].porcentajeSimilitud).toBe(100)
  })

  it("truena con ErrorIA si Gemini devuelve una dimensión distinta a la del índice", async () => {
    const fetchFn = mockFetch(new Array(3072).fill(0.1)) // default de la API si outputDimensionality se ignorara
    await expect(
      buscarEnCatalogoSemantico("resorte", { apiKey: "fake", fetchFn, fuentesPermitidas: ["proveedor"] })
    ).rejects.toThrow(/768/)
  })

  it("propaga el error en vez de tragárselo (el Route Handler decide 502 vs 500)", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Error",
      text: async () => "boom",
    } as unknown as Response)
    await expect(
      buscarEnCatalogoSemantico("resorte", { apiKey: "fake", fetchFn, fuentesPermitidas: ["proveedor"] })
    ).rejects.toThrow()
  })
})
