import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  Timestamp,
  type DocumentReference,
  type QuerySnapshot,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import {
  crearPedidoAlmacen,
  listarPedidosAlmacen,
  marcarPedidoAlmacenComprado,
  cancelarPedidoAlmacen,
} from "@/lib/pedidos-almacen"
import type { NuevoPedidoAlmacen } from "@/lib/schemas"

// Mock @/lib/firebase
vi.mock("@/lib/firebase", () => ({
  db: { type: "mocked-db" },
  storage: { type: "mocked-storage" },
  getClienteAuth: vi.fn(() => ({ currentUser: { email: "test@example.com" } })),
}))

const { mockCollectionRef, mockDocRef, mockQueryRef, MockTimestamp } = vi.hoisted(() => {
  const collectionRef = {
    type: "collectionRef",
    withConverter: vi.fn().mockReturnThis(),
  }

  const docRef = {
    type: "docRef",
    withConverter: vi.fn().mockReturnThis(),
  }

  const queryRef = {
    type: "queryRef",
  }

  class Timestamp {
    constructor(public seconds: number, public nanoseconds: number) {}
    toDate() {
      return new Date(this.seconds * 1000 + this.nanoseconds / 1e6)
    }
    static fromDate(date: Date) {
      return new Timestamp(Math.floor(date.getTime() / 1000), (date.getTime() % 1000) * 1e6)
    }
  }

  return {
    mockCollectionRef: collectionRef,
    mockDocRef: docRef,
    mockQueryRef: queryRef,
    MockTimestamp: Timestamp,
  }
})

// Mock firebase/firestore
vi.mock("firebase/firestore", () => {
  return {
    collection: vi.fn(() => mockCollectionRef),
    doc: vi.fn(() => mockDocRef),
    addDoc: vi.fn(),
    getDocs: vi.fn(),
    updateDoc: vi.fn(),
    query: vi.fn(() => mockQueryRef),
    orderBy: vi.fn((field, direction) => ({ field, direction })),
    Timestamp: MockTimestamp,
  }
})

// Mock auditoria — no es el foco de estas pruebas, y evita el addDoc real de la colección auditoria.
vi.mock("@/lib/auditoria", () => ({
  registrarAuditoria: vi.fn(),
}))

describe("lib/pedidos-almacen CRUD operations", () => {
  const mockPayload: NuevoPedidoAlmacen = {
    descripcion: "5 brocas de 3/8",
    urgente: false,
    solicitadoPorUid: "uid-almacen-1",
    solicitadoPorNombre: "Encargado Almacén",
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-20T12:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("crearPedidoAlmacen", () => {
    it("guarda el pedido con estado pendiente y sin orden vinculada por defecto", async () => {
      vi.mocked(addDoc).mockResolvedValue({ id: "pedido-1" } as unknown as DocumentReference)

      const id = await crearPedidoAlmacen(mockPayload)

      expect(collection).toHaveBeenCalledWith(db, "pedidos-almacen")
      expect(addDoc).toHaveBeenCalledWith(mockCollectionRef, {
        ...mockPayload,
        estado: "pendiente",
        ordenIdVinculada: null,
        creadoEn: new Date("2026-07-20T12:00:00Z"),
        actualizadoEn: new Date("2026-07-20T12:00:00Z"),
      })
      expect(id).toBe("pedido-1")
    })
  })

  describe("listarPedidosAlmacen", () => {
    it("consulta ordenado por creadoEn desc y devuelve los pedidos mapeados", async () => {
      const pedido1 = { descripcion: "Brocas", estado: "pendiente" }
      const pedido2 = { descripcion: "Guantes", estado: "comprado" }

      vi.mocked(getDocs).mockResolvedValue({
        docs: [
          { id: "id-1", data: () => pedido1 },
          { id: "id-2", data: () => pedido2 },
        ],
      } as unknown as QuerySnapshot)

      const result = await listarPedidosAlmacen()

      expect(orderBy).toHaveBeenCalledWith("creadoEn", "desc")
      expect(query).toHaveBeenCalledWith(mockCollectionRef, { field: "creadoEn", direction: "desc" })
      expect(getDocs).toHaveBeenCalledWith(mockQueryRef)
      expect(result).toEqual([pedido1, pedido2])
    })
  })

  describe("marcarPedidoAlmacenComprado", () => {
    it("actualiza estado a comprado y guarda el id de la orden vinculada", async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined)

      await marcarPedidoAlmacenComprado("pedido-1", "orden-99")

      expect(doc).toHaveBeenCalledWith(db, "pedidos-almacen", "pedido-1")
      expect(updateDoc).toHaveBeenCalledWith(mockDocRef, {
        estado: "comprado",
        ordenIdVinculada: "orden-99",
        actualizadoEn: Timestamp.fromDate(new Date("2026-07-20T12:00:00Z")),
      })
    })
  })

  describe("cancelarPedidoAlmacen", () => {
    it("actualiza estado a cancelado", async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined)

      await cancelarPedidoAlmacen("pedido-1")

      expect(doc).toHaveBeenCalledWith(db, "pedidos-almacen", "pedido-1")
      expect(updateDoc).toHaveBeenCalledWith(mockDocRef, {
        estado: "cancelado",
        actualizadoEn: Timestamp.fromDate(new Date("2026-07-20T12:00:00Z")),
      })
    })
  })
})
