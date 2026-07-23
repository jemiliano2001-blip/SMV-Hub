import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
} from "firebase/firestore"
import {
  obtenerPaginaProveedores,
  obtenerResumenProveedores,
  type CursorProveedor,
} from "../lib/proveedores/repositorio"

const { referenciaColeccion, referenciaConsulta, MockTimestamp } = vi.hoisted(() => {
  class Timestamp {
    toDate() {
      return new Date("2026-07-22T00:00:00.000Z")
    }
  }
  return {
    referenciaColeccion: { tipo: "coleccion" },
    referenciaConsulta: { tipo: "consulta" },
    MockTimestamp: Timestamp,
  }
})

vi.mock("@/lib/firebase", () => ({ db: { tipo: "db" } }))

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => referenciaColeccion),
  query: vi.fn(() => referenciaConsulta),
  where: vi.fn((campo, operador, valor) => ({ campo, operador, valor })),
  orderBy: vi.fn((campo, direccion) => ({ campo, direccion })),
  startAfter: vi.fn((cursor) => ({ cursor })),
  limit: vi.fn((cantidad) => ({ cantidad })),
  getDocs: vi.fn(),
  getCountFromServer: vi.fn(),
  doc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  Timestamp: MockTimestamp,
}))

function documento(
  id: string,
  nombre: string,
  cambios: Record<string, unknown> = {}
): QueryDocumentSnapshot<DocumentData> {
  return {
    id,
    data: () => ({
      nombre,
      mercado: "usa",
      categorias: ["tooling"],
      marcas: [],
      prioridad: "media",
      creadoEn: "2026-07-22T00:00:00.000Z",
      actualizadoEn: "2026-07-22T00:00:00.000Z",
      ...cambios,
    }),
  } as unknown as QueryDocumentSnapshot<DocumentData>
}

describe("repositorio paginado de proveedores", () => {
  beforeEach(() => vi.clearAllMocks())

  it("solicita un elemento adicional para detectar la siguiente página", async () => {
    const docs = [documento("a", "Alpha"), documento("b", "Beta"), documento("c", "Charlie")]
    vi.mocked(getDocs).mockResolvedValue({ docs } as QuerySnapshot<DocumentData>)

    const pagina = await obtenerPaginaProveedores({ mercado: "usa", tamano: 2 })

    expect(orderBy).toHaveBeenCalledWith("nombre", "asc")
    expect(limit).toHaveBeenCalledWith(3)
    expect(pagina.items.map((proveedor) => proveedor.id)).toEqual(["a", "b"])
    expect(pagina.hayMas).toBe(true)
    expect(pagina.siguienteCursor).toBe(docs[1])
  })

  it("continúa después del cursor recibido y cierra la última página", async () => {
    const cursor = documento("anterior", "Anterior") as CursorProveedor
    vi.mocked(getDocs).mockResolvedValue({
      docs: [documento("final", "Final")],
    } as QuerySnapshot<DocumentData>)

    const pagina = await obtenerPaginaProveedores({ mercado: "mexico", tamano: 18, cursor })

    expect(startAfter).toHaveBeenCalledWith(cursor)
    expect(pagina.hayMas).toBe(false)
    expect(pagina.siguienteCursor).toBeNull()
  })

  it("conserva proveedores legados sin campo mercado mediante la inferencia existente", async () => {
    vi.mocked(getDocs).mockResolvedValue({
      docs: [documento("odoo-legado", "Proveedor Odoo", { mercado: undefined, odooPartnerId: 42 })],
    } as QuerySnapshot<DocumentData>)

    const pagina = await obtenerPaginaProveedores({ mercado: "mexico", tamano: 18 })

    expect(pagina.items.map((proveedor) => proveedor.id)).toEqual(["odoo-legado"])
  })

  it("obtiene conteos agregados sin descargar documentos", async () => {
    vi.mocked(getCountFromServer)
      .mockResolvedValueOnce(
        { data: () => ({ count: 23 }) } as unknown as Awaited<ReturnType<typeof getCountFromServer>>
      )
      .mockResolvedValueOnce(
        { data: () => ({ count: 12 }) } as unknown as Awaited<ReturnType<typeof getCountFromServer>>
      )
      .mockResolvedValueOnce(
        { data: () => ({ count: 8 }) } as unknown as Awaited<ReturnType<typeof getCountFromServer>>
      )

    await expect(obtenerResumenProveedores()).resolves.toEqual({
      usa: 12,
      mexico: 8,
      total: 23,
      sinMercado: 3,
    })
    expect(getCountFromServer).toHaveBeenCalledTimes(3)
  })
})
