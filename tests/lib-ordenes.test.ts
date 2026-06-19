import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
  type DocumentReference,
  type QuerySnapshot,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import {
  crearOrden,
  crearOrdenesLote,
  listarOrdenes,
  obtenerOrden,
  actualizarOrden,
  eliminarOrden,
} from "@/lib/ordenes"
import type { NuevaOrdenPayload } from "@/lib/ordenes"

// Mock @/lib/firebase
vi.mock("@/lib/firebase", () => ({
  db: { type: "mocked-db" },
  storage: { type: "mocked-storage" },
}))

const { mockCollectionRef, mockDocRef, mockQueryRef, MockTimestamp, mockBatch } = vi.hoisted(() => {
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
      return new Timestamp(
        Math.floor(date.getTime() / 1000),
        (date.getTime() % 1000) * 1e6
      )
    }
  }

  const batch = {
    set: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  }

  return {
    mockCollectionRef: collectionRef,
    mockDocRef: docRef,
    mockQueryRef: queryRef,
    MockTimestamp: Timestamp,
    mockBatch: batch,
  }
})

// Mock firebase/firestore
vi.mock("firebase/firestore", () => {
  return {
    collection: vi.fn(() => mockCollectionRef),
    doc: vi.fn(() => mockDocRef),
    addDoc: vi.fn(),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
    updateDoc: vi.fn(),
    deleteDoc: vi.fn(),
    query: vi.fn(() => mockQueryRef),
    orderBy: vi.fn((field, direction) => ({ field, direction })),
    writeBatch: vi.fn(() => mockBatch),
    Timestamp: MockTimestamp,
  }
})

describe("lib/ordenes CRUD operations", () => {
  const mockPayload: NuevaOrdenPayload = {
    proveedor: "Acme Corp",
    numeroFactura: "INV-100",
    fechaFactura: "2026-06-16",
    moneda: "USD",
    subtotal: 500,
    impuestos: 80,
    total: 580,
    items: [
      { descripcion: "Artículo A", cantidad: 2, precioUnitario: 250, total: 500 },
    ],
    requisitor: "Jane Doe",
    ordenTrabajo: "OT-123",
    empresa: "Constructora Alfa",
    cuentaCargo: '',
    destino: '',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-16T12:00:00Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("crearOrden", () => {
    it("debe llamar a addDoc con la referencia correcta y los campos de la orden, devolviendo el ID generado y estableciendo estado 'pendiente' por defecto", async () => {
      vi.mocked(addDoc).mockResolvedValue({ id: "generado-123" } as unknown as DocumentReference)

      const id = await crearOrden(mockPayload)

      expect(collection).toHaveBeenCalledWith(db, "ordenes")
      expect(mockCollectionRef.withConverter).toHaveBeenCalled()
      expect(addDoc).toHaveBeenCalledWith(mockCollectionRef, {
        ...mockPayload,
        estado: "pendiente",
        creadoEn: new Date("2026-06-16T12:00:00Z"),
        actualizadoEn: new Date("2026-06-16T12:00:00Z"),
      })
      expect(id).toBe("generado-123")
    })

    it("debe respetar el estado si se pasa explícitamente en el payload", async () => {
      vi.mocked(addDoc).mockResolvedValue({ id: "generado-456" } as unknown as DocumentReference)
      const payloadAprobado: NuevaOrdenPayload = {
        ...mockPayload,
        estado: "aprobada",
      }

      const id = await crearOrden(payloadAprobado)

      expect(addDoc).toHaveBeenCalledWith(mockCollectionRef, {
        ...mockPayload,
        estado: "aprobada",
        creadoEn: new Date("2026-06-16T12:00:00Z"),
        actualizadoEn: new Date("2026-06-16T12:00:00Z"),
      })
      expect(id).toBe("generado-456")
    })
  })

  describe("crearOrdenesLote", () => {
    it("usa writeBatch: set por cada payload, commit del lote, y devuelve el total", async () => {
      const payloads: NuevaOrdenPayload[] = [
        { ...mockPayload, proveedor: "P1" },
        { ...mockPayload, proveedor: "P2" },
        { ...mockPayload, proveedor: "P3" },
      ]

      const creadas = await crearOrdenesLote(payloads)

      expect(mockBatch.set).toHaveBeenCalledTimes(3)
      expect(mockBatch.commit).toHaveBeenCalledTimes(1)
      expect(creadas).toBe(3)
    })

    it("invoca onProgreso con el total acumulado por lote", async () => {
      const payloads: NuevaOrdenPayload[] = [
        { ...mockPayload, proveedor: "P1" },
        { ...mockPayload, proveedor: "P2" },
      ]
      const progresos: number[] = []

      await crearOrdenesLote(payloads, (n) => progresos.push(n))

      expect(progresos).toEqual([2])
    })

    it("no hace commit si no hay payloads", async () => {
      const creadas = await crearOrdenesLote([])
      expect(mockBatch.commit).not.toHaveBeenCalled()
      expect(creadas).toBe(0)
    })
  })

  describe("listarOrdenes", () => {
    it("debe llamar a getDocs con la consulta y ordenamiento correcto, y retornar las ordenes mapeadas", async () => {
      const mockOrdenData1 = {
        proveedor: "Proveedor 1",
        estado: "pendiente",
        creadoEn: new Date("2026-06-16T10:00:00Z"),
        actualizadoEn: new Date("2026-06-16T10:00:00Z"),
      }
      const mockOrdenData2 = {
        proveedor: "Proveedor 2",
        estado: "aprobada",
        creadoEn: new Date("2026-06-16T11:00:00Z"),
        actualizadoEn: new Date("2026-06-16T11:00:00Z"),
      }

      const mockDocsSnapshot = [
        { id: "id-1", data: () => mockOrdenData1 },
        { id: "id-2", data: () => mockOrdenData2 },
      ]

      vi.mocked(getDocs).mockResolvedValue({
        docs: mockDocsSnapshot,
      } as unknown as QuerySnapshot)

      const result = await listarOrdenes()

      expect(collection).toHaveBeenCalledWith(db, "ordenes")
      expect(orderBy).toHaveBeenCalledWith("creadoEn", "desc")
      expect(query).toHaveBeenCalledWith(mockCollectionRef, { field: "creadoEn", direction: "desc" })
      expect(getDocs).toHaveBeenCalledWith(mockQueryRef)
      expect(result).toEqual([mockOrdenData1, mockOrdenData2])
    })
  })

  describe("obtenerOrden", () => {
    it("debe llamar a getDoc con la referencia correcta y retornar la orden mapeada si existe", async () => {
      const mockOrdenData = {
        id: "id-existe",
        proveedor: "Proveedor X",
        creadoEn: new Date("2026-06-16T09:00:00Z"),
        actualizadoEn: new Date("2026-06-16T09:00:00Z"),
      }

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => mockOrdenData,
      } as unknown as DocumentSnapshot)

      const result = await obtenerOrden("id-existe")

      expect(doc).toHaveBeenCalledWith(db, "ordenes", "id-existe")
      expect(mockDocRef.withConverter).toHaveBeenCalled()
      expect(getDoc).toHaveBeenCalledWith(mockDocRef)
      expect(result).toEqual(mockOrdenData)
    })

    it("debe retornar null si la orden no existe en Firestore", async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => false,
        data: () => null,
      } as unknown as DocumentSnapshot)

      const result = await obtenerOrden("id-no-existe")

      expect(doc).toHaveBeenCalledWith(db, "ordenes", "id-no-existe")
      expect(getDoc).toHaveBeenCalledWith(mockDocRef)
      expect(result).toBeNull()
    })
  })

  describe("actualizarOrden", () => {
    it("debe llamar a updateDoc con los cambios y la fecha de actualización correspondiente", async () => {
      vi.mocked(updateDoc).mockResolvedValue(undefined)
      const cambios = {
        estado: "rechazada" as const,
        total: 1000,
      }

      await actualizarOrden("id-a-actualizar", cambios)

      expect(doc).toHaveBeenCalledWith(db, "ordenes", "id-a-actualizar")
      expect(updateDoc).toHaveBeenCalledWith(mockDocRef, {
        estado: "rechazada",
        total: 1000,
        actualizadoEn: Timestamp.fromDate(new Date("2026-06-16T12:00:00Z")),
      })
    })
  })

  describe("eliminarOrden", () => {
    it("debe llamar a deleteDoc con la referencia del documento correcta", async () => {
      vi.mocked(deleteDoc).mockResolvedValue(undefined)

      await eliminarOrden("id-a-eliminar")

      expect(doc).toHaveBeenCalledWith(db, "ordenes", "id-a-eliminar")
      expect(deleteDoc).toHaveBeenCalledWith(mockDocRef)
    })
  })

  describe("ordenConverter", () => {
    beforeEach(async () => {
      vi.mocked(getDocs).mockResolvedValue({ docs: [] } as unknown as QuerySnapshot)
      await listarOrdenes()
    })

    it("toFirestore debe extraer y omitir id, creadoEn, actualizadoEn y convertir las fechas a Timestamp", () => {
      // Obtenemos el converter que fue registrado al llamar a conConverter
      const converter = vi.mocked(mockCollectionRef.withConverter).mock.calls[0][0]

      const inputOrden = {
        id: "id-converter",
        proveedor: "Test Converter",
        creadoEn: new Date("2026-06-16T09:00:00Z"),
        actualizadoEn: new Date("2026-06-16T10:00:00Z"),
        total: 123,
      }

      const result = converter.toFirestore(inputOrden)

      expect(result.id).toBeUndefined()
      expect(result.creadoEn).toBeInstanceOf(Timestamp)
      expect(result.actualizadoEn).toBeInstanceOf(Timestamp)
      expect(result.proveedor).toBe("Test Converter")
      expect(result.total).toBe(123)
    })

    it("fromFirestore debe retornar el objeto de orden agregando el id del snapshot y transformando los Timestamps a Date", () => {
      const converter = vi.mocked(mockCollectionRef.withConverter).mock.calls[0][0]

      const mockSnap = {
        id: "id-snap",
        data: () => ({
          proveedor: "Test Snap",
          creadoEn: Timestamp.fromDate(new Date("2026-06-16T09:00:00Z")),
          actualizadoEn: Timestamp.fromDate(new Date("2026-06-16T10:00:00Z")),
        }),
      }

      const result = converter.fromFirestore(mockSnap as unknown as QueryDocumentSnapshot)

      expect(result.id).toBe("id-snap")
      expect(result.proveedor).toBe("Test Snap")
      expect(result.creadoEn).toEqual(new Date("2026-06-16T09:00:00Z"))
      expect(result.actualizadoEn).toEqual(new Date("2026-06-16T10:00:00Z"))
    })

    it("fromFirestore debe usar fechas actuales si creadoEn o actualizadoEn no son instancias de Timestamp", () => {
      const converter = vi.mocked(mockCollectionRef.withConverter).mock.calls[0][0]

      const mockSnap = {
        id: "id-snap-sin-fechas",
        data: () => ({
          proveedor: "Test Sin Fechas",
          creadoEn: null,
          actualizadoEn: undefined,
        }),
      }

      const result = converter.fromFirestore(mockSnap as unknown as QueryDocumentSnapshot)

      expect(result.id).toBe("id-snap-sin-fechas")
      expect(result.creadoEn).toEqual(new Date("2026-06-16T12:00:00Z"))
      expect(result.actualizadoEn).toEqual(new Date("2026-06-16T12:00:00Z"))
    })
  })
})

