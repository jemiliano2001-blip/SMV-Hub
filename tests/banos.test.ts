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

const { mockAddDoc, mockUpdateDoc, mockDeleteDoc, mockOnSnapshot, mockWhere, mockCollectionRef } = vi.hoisted(() => ({
  mockAddDoc: vi.fn().mockResolvedValue({ id: "nuevo-1" }),
  mockUpdateDoc: vi.fn().mockResolvedValue(undefined),
  mockDeleteDoc: vi.fn().mockResolvedValue(undefined),
  mockOnSnapshot: vi.fn(),
  mockWhere: vi.fn(),
  mockCollectionRef: { withConverter: vi.fn().mockReturnThis() },
}))

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => mockCollectionRef),
  doc: vi.fn((_db, _col, id) => ({ path: `registros-bano/${id}`, id })),
  addDoc: mockAddDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  getDocs: vi.fn(),
  query: vi.fn((...args: unknown[]) => ({ type: "query", args })),
  orderBy: vi.fn((...args: unknown[]) => ({ type: "orderBy", args })),
  where: mockWhere.mockImplementation((...args: unknown[]) => ({ type: "where", args })),
  onSnapshot: mockOnSnapshot,
  serverTimestamp: vi.fn(() => new Date()),
  Timestamp: {
    fromDate: vi.fn((d) => d),
    now: vi.fn(() => new Date()),
  },
}))

import {
  crearRegistroBano,
  actualizarRegistroBano,
  eliminarRegistroBano,
  suscribirSolicitudesBorradoBanosPendientes,
} from "@/lib/banos"

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

describe("actualizarRegistroBano", () => {
  beforeEach(() => vi.clearAllMocks())

  it("actualiza campos específicos de un registro de baño", async () => {
    await actualizarRegistroBano("reg-123", {
      operador: "Carlos Mendoza",
      bano: "CNC",
      horaEntrada: "11:00",
      horaLlegada: "11:15",
      tiempoMinutos: 15,
    })

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: "reg-123" }),
      expect.objectContaining({
        operador: "Carlos Mendoza",
        bano: "CNC",
        horaEntrada: "11:00",
        horaLlegada: "11:15",
        tiempoMinutos: 15,
      })
    )
  })
})

describe("eliminarRegistroBano", () => {
  beforeEach(() => vi.clearAllMocks())

  it("elimina un registro de baño por su ID", async () => {
    await eliminarRegistroBano("reg-123")
    expect(mockDeleteDoc).toHaveBeenCalledWith(
      expect.objectContaining({ id: "reg-123" })
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
