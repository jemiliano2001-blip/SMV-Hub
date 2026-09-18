import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockBatchSet, mockBatchCommit, mockDocRef } = vi.hoisted(() => ({
  mockBatchSet: vi.fn(),
  mockBatchCommit: vi.fn(),
  mockDocRef: vi.fn(() => ({ id: "mock-doc-id" })),
}))

vi.mock("@/lib/firebase", () => ({
  db: {},
}))

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => "mock-col"),
  doc: mockDocRef,
  writeBatch: vi.fn(() => ({
    set: mockBatchSet,
    commit: mockBatchCommit,
  })),
}))

import { registrarCorrecciones } from "@/lib/memoria-operativa/correcciones"

describe("registrarCorrecciones (Memoria Operativa)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBatchCommit.mockResolvedValue(undefined)
  })

  it("no hace nada si el arreglo está vacío", async () => {
    await registrarCorrecciones([])
    expect(mockBatchCommit).not.toHaveBeenCalled()
  })

  it("escribe en batch las correcciones proporcionadas", async () => {
    await registrarCorrecciones([
      {
        tipo: "campo_sugerido",
        contexto: { modulo: "nueva-compra", campo: "cuentaCargo" },
        sugerido: "CNC",
        elegido: "CNC",
        aceptado: true,
        usuario: "compras@smv.com",
      },
      {
        tipo: "alerta_precio",
        contexto: { modulo: "cotizaciones" },
        sugerido: "revisar",
        elegido: "$15.00",
        aceptado: false,
        usuario: "compras@smv.com",
      },
    ])

    expect(mockBatchSet).toHaveBeenCalledTimes(2)
    expect(mockBatchCommit).toHaveBeenCalledTimes(1)
  })

  it("atrapa errores sin lanzar y registra warning (best-effort)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    mockBatchCommit.mockRejectedValueOnce(new Error("Firestore offline"))

    await expect(
      registrarCorrecciones([
        {
          tipo: "proveedor_sugerido",
          contexto: { modulo: "nueva-compra" },
          sugerido: "McMaster-Carr",
          elegido: "McMaster-Carr",
          aceptado: true,
          usuario: "test@smv.com",
        },
      ])
    ).resolves.toBeUndefined()

    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
