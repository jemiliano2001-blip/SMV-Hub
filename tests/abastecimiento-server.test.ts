import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  mockBatchSet,
  mockBatchUpdate,
  mockBatchCommit,
  mockDocRef,
  mockCollectionGet,
  mockDocGet,
  mockEmitirNotificacionServer,
  mockRegistrarAuditoriaServer,
} = vi.hoisted(() => ({
  mockBatchSet: vi.fn(),
  mockBatchUpdate: vi.fn(),
  mockBatchCommit: vi.fn(),
  mockDocRef: vi.fn(),
  mockCollectionGet: vi.fn(),
  mockDocGet: vi.fn(),
  mockEmitirNotificacionServer: vi.fn(),
  mockRegistrarAuditoriaServer: vi.fn(),
}))

vi.mock("@/lib/notificaciones-server", () => ({
  emitirNotificacionServer: mockEmitirNotificacionServer,
}))

vi.mock("@/lib/auditoria-server", () => ({
  registrarAuditoriaServer: mockRegistrarAuditoriaServer,
}))

vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    batch: () => ({
      set: mockBatchSet,
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    }),
    collection: (colName: string) => {
      if (colName === "almacen-entradas") {
        return {
          doc: () => ({ id: "entrada-mock-123" }),
        }
      }
      if (colName === "ordenes") {
        return {
          doc: (id: string) => ({
            id,
            get: mockDocGet,
          }),
        }
      }
      if (colName === "pedidos-almacen") {
        return {
          where: () => ({
            limit: () => ({
              get: mockCollectionGet,
            }),
          }),
        }
      }
      if (colName === "requisiciones") {
        return {
          doc: (id: string) => ({
            id,
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => ({ folio: "REQ-2026-001", solicitante: "Francisco" }),
            }),
          }),
        }
      }
      return {
        doc: mockDocRef,
      }
    },
  },
}))

import { recibirOrdenEnAlmacen, ErrorRecepcionOrden } from "@/lib/abastecimiento-server"

describe("recibirOrdenEnAlmacen (Server Cascade)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBatchCommit.mockResolvedValue(undefined)
  })

  it("lanza 404 si la orden no existe", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: false,
    })

    await expect(
      recibirOrdenEnAlmacen({
        ordenId: "ord-inexistente",
        uid: "uid-1",
        email: "almacen@smv.com",
      })
    ).rejects.toThrowError(ErrorRecepcionOrden)
  })

  it("lanza 409 si la orden ya fue recibida (idempotencia)", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: "ord-1",
        proveedor: "McMaster-Carr",
        estadoRecepcion: "recibida",
      }),
    })

    await expect(
      recibirOrdenEnAlmacen({
        ordenId: "ord-1",
        uid: "uid-1",
        email: "almacen@smv.com",
      })
    ).rejects.toThrowError("ya fue recibida en almacén")
  })

  it("ejecuta batch atómico y emite notificación cuando la orden tiene pedido vinculado", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        id: "ord-100",
        proveedor: "Shars Tool",
        items: [{ descripcion: "Fresa 1/2 pulgada", cantidad: 4, cuentaCargo: "CNC" }],
        estadoRecepcion: "pendiente",
      }),
    })

    mockCollectionGet.mockResolvedValueOnce({
      empty: false,
      docs: [
        {
          id: "ped-200",
          ref: { id: "ped-200" },
          data: () => ({
            solicitadoPorUid: "solicitante-uid-999",
            descripcion: "Fresa 1/2 pulgada",
          }),
        },
      ],
    })

    const resultado = await recibirOrdenEnAlmacen({
      ordenId: "ord-100",
      uid: "almacen-uid",
      email: "almacen@smv.com",
      nombre: "Jesus Almacen",
      notas: "Recepción conforme",
    })

    expect(resultado).toEqual({
      estadoRecepcion: "recibida",
      entradaAlmacenId: "entrada-mock-123",
    })

    expect(mockBatchSet).toHaveBeenCalled()
    expect(mockBatchUpdate).toHaveBeenCalled()
    expect(mockBatchCommit).toHaveBeenCalled()
    expect(mockEmitirNotificacionServer).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "orden_recibida_almacen",
        destinatarioUid: "solicitante-uid-999",
        audiencia: "pedidos-almacen",
      })
    )
    expect(mockRegistrarAuditoriaServer).toHaveBeenCalled()
  })
})
