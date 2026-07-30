import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from 'firebase/firestore'
import {
  contarRequisiciones,
  obtenerPaginaRequisiciones,
} from '@/lib/requisiciones'

vi.mock('@/lib/firebase', () => ({
  db: { type: 'mocked-db' },
  getClienteAuth: vi.fn(() => ({ currentUser: { email: 'test@example.com' } })),
}))

vi.mock('@/lib/notificaciones', () => ({
  emitirNotificacion: vi.fn(async () => 'notif-1'),
  tituloParaTipo: vi.fn((t: string) => t),
}))

vi.mock('@/lib/auditoria', () => ({
  registrarAuditoria: vi.fn(),
}))

const { mockCollectionRef, mockQueryRef, MockTimestamp, mockBatch } = vi.hoisted(() => {
  const collectionRef = {
    type: 'collectionRef',
    withConverter: vi.fn().mockReturnThis(),
  }
  const queryRef = { type: 'queryRef' }

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

  return {
    mockCollectionRef: collectionRef,
    mockQueryRef: queryRef,
    MockTimestamp: Timestamp,
    mockBatch: {
      delete: vi.fn(),
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    },
  }
})

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => mockCollectionRef),
  doc: vi.fn(() => ({ type: 'docRef' })),
  addDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(() => mockQueryRef),
  orderBy: vi.fn((field, direction) => ({ field, direction })),
  limit: vi.fn((cantidad) => ({ cantidad })),
  startAfter: vi.fn((cursor) => ({ cursor })),
  getCountFromServer: vi.fn(),
  updateDoc: vi.fn(),
  writeBatch: vi.fn(() => mockBatch),
  Timestamp: MockTimestamp,
  serverTimestamp: vi.fn(),
}))

describe('paginación de requisiciones', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('usa límite más uno para detectar y devolver el cursor siguiente', async () => {
    const docs = [
      { id: 'req-1', data: () => ({ id: 'req-1', descripcion: 'A' }) },
      { id: 'req-2', data: () => ({ id: 'req-2', descripcion: 'B' }) },
      { id: 'req-3', data: () => ({ id: 'req-3', descripcion: 'C' }) },
    ]
    vi.mocked(getDocs).mockResolvedValue({ docs } as unknown as QuerySnapshot)

    const pagina = await obtenerPaginaRequisiciones(2)

    expect(orderBy).toHaveBeenCalledWith('creadoEn', 'desc')
    expect(limit).toHaveBeenCalledWith(3)
    expect(query).toHaveBeenCalledWith(
      mockCollectionRef,
      { field: 'creadoEn', direction: 'desc' },
      { cantidad: 3 }
    )
    expect(pagina.items.map((requisicion) => requisicion.id)).toEqual(['req-1', 'req-2'])
    expect(pagina.hayMas).toBe(true)
    expect(pagina.siguienteCursor).toBe(docs[1])
  })

  it('continúa después del cursor y cierra la última página', async () => {
    const cursor = { id: 'cursor', data: () => ({ id: 'cursor' }) } as unknown as QueryDocumentSnapshot
    vi.mocked(getDocs).mockResolvedValue({
      docs: [{ id: 'final', data: () => ({ id: 'final', descripcion: 'Final' }) }],
    } as unknown as QuerySnapshot)

    const pagina = await obtenerPaginaRequisiciones(50, cursor as never)

    expect(startAfter).toHaveBeenCalledWith(cursor)
    expect(pagina.hayMas).toBe(false)
    expect(pagina.siguienteCursor).toBeNull()
  })

  it('limita tamaños inválidos y cuenta sin descargar la colección', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as unknown as QuerySnapshot)
    vi.mocked(getCountFromServer).mockResolvedValue({
      data: () => ({ count: 143 }),
    } as unknown as Awaited<ReturnType<typeof getCountFromServer>>)

    await obtenerPaginaRequisiciones(Number.POSITIVE_INFINITY)
    await expect(contarRequisiciones()).resolves.toBe(143)

    expect(limit).toHaveBeenCalledWith(51)
    expect(getCountFromServer).toHaveBeenCalledWith(mockCollectionRef)
  })
})
