import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/firebase", () => ({
  db: { type: "mocked-db" },
  getClienteAuth: vi.fn(() => ({
    currentUser: { uid: "uid-1", email: "ana@smv.com", displayName: "Ana López" },
  })),
}))

vi.mock("@/lib/auditoria", () => ({
  registrarAuditoria: vi.fn().mockResolvedValue(undefined),
}))

const { mockAddDoc, mockOnSnapshot, mockWhere, mockCollectionRef } = vi.hoisted(() => ({
  mockAddDoc: vi.fn().mockResolvedValue({ id: "nuevo-1" }),
  mockOnSnapshot: vi.fn(),
  mockWhere: vi.fn(),
  mockCollectionRef: { withConverter: vi.fn().mockReturnThis() },
}))

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => mockCollectionRef),
  doc: vi.fn(() => ({})),
  addDoc: mockAddDoc,
  deleteDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn((...args: unknown[]) => ({ type: "query", args })),
  orderBy: vi.fn((...args: unknown[]) => ({ type: "orderBy", args })),
  where: mockWhere.mockImplementation((...args: unknown[]) => ({ type: "where", args })),
  onSnapshot: mockOnSnapshot,
}))

import { crearRegistroBano, suscribirSolicitudesBorradoBanosPendientes } from "@/lib/banos"

describe("crearRegistroBano", () => {
  beforeEach(() => vi.clearAllMocks())

  it("incluye creadoPorUid y creadoPorNombre del usuario actual", async () => {
    await crearRegistroBano({
      operador: "Juan Pérez",
      bano: "Baño #1",
      horaEntrada: "10:00",
      horaLlegada: null,
      fecha: "2026-07-30",
      tiempoMinutos: null,
    })

    expect(mockAddDoc).toHaveBeenCalledWith(
      mockCollectionRef,
      expect.objectContaining({
        creadoPorUid: "uid-1",
        creadoPorNombre: "Ana López",
      })
    )
  })
})

describe("suscribirSolicitudesBorradoBanosPendientes", () => {
  beforeEach(() => vi.clearAllMocks())

  it("consulta solo estado == pendiente", () => {
    mockOnSnapshot.mockReturnValue(() => {})
    const onData = vi.fn()
    suscribirSolicitudesBorradoBanosPendientes(onData)

    expect(mockWhere).toHaveBeenCalledWith("estado", "==", "pendiente")
    expect(mockOnSnapshot).toHaveBeenCalled()
  })
})
