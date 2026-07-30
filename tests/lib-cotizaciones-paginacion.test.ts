import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  type QuerySnapshot,
} from "firebase/firestore"
import { obtenerPaginaCotizaciones } from "@/lib/cotizaciones"

vi.mock("@/lib/firebase", () => ({
  db: { type: "mocked-db" },
  getClienteAuth: vi.fn(() => ({ currentUser: { email: "test@example.com" } })),
}))

const { mockCollectionRef, mockQueryRef } = vi.hoisted(() => ({
  mockCollectionRef: {
    type: "collectionRef",
    withConverter: vi.fn().mockReturnThis(),
  },
  mockQueryRef: { type: "queryRef" },
}))

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => mockCollectionRef),
  doc: vi.fn(),
  addDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(() => mockQueryRef),
  orderBy: vi.fn((field, direction) => ({ field, direction })),
  limit: vi.fn((cantidad) => ({ cantidad })),
  startAfter: vi.fn((cursor) => ({ cursor })),
  serverTimestamp: vi.fn(),
}))

vi.mock("@/lib/auditoria", () => ({
  registrarAuditoria: vi.fn(),
}))

describe("obtenerPaginaCotizaciones", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("usa límite más uno para detectar cursor siguiente", async () => {
    const docs = [
      { id: "c1", data: () => ({ id: "c1" }) },
      { id: "c2", data: () => ({ id: "c2" }) },
      { id: "c3", data: () => ({ id: "c3" }) },
    ]
    vi.mocked(getDocs).mockResolvedValue({ docs } as unknown as QuerySnapshot)

    const pagina = await obtenerPaginaCotizaciones(2)

    expect(orderBy).toHaveBeenCalledWith("creadoEn", "desc")
    expect(limit).toHaveBeenCalledWith(3)
    expect(pagina.items).toHaveLength(2)
    expect(pagina.hayMas).toBe(true)
    expect(pagina.siguienteCursor).toBeTruthy()
  })

  it("no pide startAfter en la primera página", async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as unknown as QuerySnapshot)
    await obtenerPaginaCotizaciones(50)
    expect(startAfter).not.toHaveBeenCalled()
    expect(query).toHaveBeenCalled()
  })
})
