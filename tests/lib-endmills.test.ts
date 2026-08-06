import { beforeEach, describe, expect, it, vi } from "vitest"
import { runTransaction } from "firebase/firestore"
import { registrarAuditoria } from "@/lib/auditoria"

const mocks = vi.hoisted(() => {
  const medidas = {
    ref: vi.fn(() => ({ coleccion: "endmills-medidas" })),
    listar: vi.fn(),
    actualizar: vi.fn(),
  }
  const pedidos = {
    ref: vi.fn(() => ({ coleccion: "endmills-pedidos" })),
    listar: vi.fn(),
    actualizar: vi.fn(),
  }
  const partidas = {
    ref: vi.fn(() => ({ coleccion: "endmills-pedido-partidas" })),
    listar: vi.fn(),
    actualizar: vi.fn(),
  }
  return { medidas, pedidos, partidas }
})

vi.mock("@/lib/firebase", () => ({
  db: { nombre: "mock-db" },
  getClienteAuth: vi.fn(() => ({ currentUser: { email: "compras@smv.mx" } })),
}))

vi.mock("@/lib/auditoria", () => ({
  registrarAuditoria: vi.fn(),
}))

vi.mock("@/lib/firestore-helpers", () => ({
  makeDateConverter: vi.fn(() => ({
    toFirestore: (valor: unknown) => valor,
    fromFirestore: (snapshot: { data: () => unknown }) => snapshot.data(),
  })),
}))

vi.mock("@/lib/repositorio", () => ({
  crearRepositorio: vi.fn(({ coleccion }: { coleccion: string }) => {
    if (coleccion === "endmills-medidas") return mocks.medidas
    if (coleccion === "endmills-pedidos") return mocks.pedidos
    return mocks.partidas
  }),
}))

vi.mock("firebase/firestore", () => {
  class Timestamp {
    toDate() {
      return new Date("2026-08-06T12:00:00Z")
    }
  }
  return {
    Timestamp,
    doc: vi.fn((parent: { coleccion: string }, id?: string) => ({
      parent,
      id: id ?? "pedido-nuevo",
    })),
    limit: vi.fn((cantidad: number) => ({ tipo: "limit", cantidad })),
    onSnapshot: vi.fn(),
    orderBy: vi.fn((campo: string, direccion: string) => ({
      tipo: "orderBy",
      campo,
      direccion,
    })),
    query: vi.fn((...argumentos: unknown[]) => ({ argumentos })),
    runTransaction: vi.fn(),
    where: vi.fn((campo: string, operador: string, valor: string) => ({
      tipo: "where",
      campo,
      operador,
      valor,
    })),
  }
})

import {
  actualizarStockEndmill,
  registrarPedidoEndmills,
  registrarRecepcionPedidoEndmills,
} from "@/lib/endmills"
import type {
  EndmillMedida,
  PartidaPedidoEndmills,
  PedidoEndmills,
  RegistrarPedidoEndmillsInput,
} from "@/lib/schemas"

const fecha = new Date("2026-08-06T12:00:00Z")

const medida: EndmillMedida = {
  id: "endmill-001",
  orden: 1,
  categoria: "FLAT",
  medidaPulgadas: "1/8",
  descripcion: "FLAT 4 FILOS 1/8",
  stockActual: 4,
  stockActualizadoEn: fecha,
  precioActualUSD: 3.82,
  cotizacionFecha: "2026-08-01",
  specPropuesta: "D1/8*FL1/2",
  requiereConfirmacion: false,
  notas: null,
  objetivoPar: null,
  ultimoPedidoId: null,
  creadoEn: fecha,
  actualizadoEn: fecha,
}

const inputPedido: RegistrarPedidoEndmillsInput = {
  fecha: "2026-08-06",
  numeroProveedor: null,
  proveedor: {
    nombre: "ChangZhou North Alloy Tool Co.,Ltd",
    contacto: "Rita",
    email: "bfl9@bfltool.com",
    origen: "China",
  },
  aliCostUSD: 4,
  shippingUSD: 19.8,
  costosAdicionalesConfirmados: true,
  partidas: [{
    medidaId: medida.id,
    stockRevisado: medida.stockActual,
    cantidadPedida: 10,
    precioUnitarioUSD: medida.precioActualUSD,
    confirmacionResuelta: true,
  }],
}

describe("lib/endmills", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.medidas.listar.mockResolvedValue([])
    mocks.pedidos.listar.mockResolvedValue([])
    mocks.partidas.listar.mockResolvedValue([])
  })

  it("rechaza stock negativo y normaliza enteros antes de guardar", async () => {
    await expect(actualizarStockEndmill(medida.id, -1)).rejects.toThrow("entero no negativo")
    await actualizarStockEndmill(medida.id, 7.9)

    expect(mocks.medidas.actualizar).toHaveBeenCalledWith(
      medida.id,
      expect.objectContaining({ stockActual: 7 }),
      "Actualizó stock de endmill a 7 pzas"
    )
  })

  it("registra cabecera, partida y objetivo sin aumentar el stock", async () => {
    const set = vi.fn()
    const update = vi.fn()
    const transaction = {
      get: vi.fn(async () => ({ exists: () => true, data: () => medida })),
      set,
      update,
    }
    vi.mocked(runTransaction).mockImplementation(async (_db, callback) =>
      callback(transaction as never)
    )

    await expect(
      registrarPedidoEndmills(inputPedido, { uid: "uid-compras", nombre: "Compras" })
    ).resolves.toBe("pedido-nuevo")

    expect(set).toHaveBeenCalledTimes(2)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ id: medida.id }),
      expect.objectContaining({ objetivoPar: 14, ultimoPedidoId: "pedido-nuevo" })
    )
    expect(update.mock.calls[0][1]).not.toHaveProperty("stockActual")
  })

  it("aborta el pedido si el stock cambió después de la revisión", async () => {
    const transaction = {
      get: vi.fn(async () => ({
        exists: () => true,
        data: () => ({ ...medida, stockActual: medida.stockActual + 1 }),
      })),
      set: vi.fn(),
      update: vi.fn(),
    }
    vi.mocked(runTransaction).mockImplementation(async (_db, callback) =>
      callback(transaction as never)
    )

    await expect(
      registrarPedidoEndmills(inputPedido, { uid: "uid-compras", nombre: "Compras" })
    ).rejects.toThrow("cambió")
    expect(transaction.set).not.toHaveBeenCalled()
  })

  it("no ofrece reintentar un pedido ya confirmado si falla solo la auditoría", async () => {
    const transaction = {
      get: vi.fn(async () => ({ exists: () => true, data: () => medida })),
      set: vi.fn(),
      update: vi.fn(),
    }
    vi.mocked(runTransaction).mockImplementation(async (_db, callback) =>
      callback(transaction as never)
    )
    vi.mocked(registrarAuditoria).mockRejectedValueOnce(new Error("auditoría no disponible"))
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)

    await expect(
      registrarPedidoEndmills(inputPedido, { uid: "uid-compras", nombre: "Compras" })
    ).resolves.toBe("pedido-nuevo")
    expect(consoleError).toHaveBeenCalledOnce()
    consoleError.mockRestore()
  })

  it("una recepción parcial suma solo el delta real al stock", async () => {
    const pedido: PedidoEndmills = {
      id: "pedido-1",
      fecha: "2026-08-06",
      numeroProveedor: null,
      estado: "confirmado",
      proveedor: inputPedido.proveedor,
      moneda: "USD",
      costoItemsUSD: 38.2,
      aliCostUSD: 4,
      shippingUSD: 19.8,
      totalUSD: 62,
      costosAdicionalesConfirmados: true,
      numeroPartidas: 1,
      numeroPiezas: 10,
      origen: "manual",
      motivoCancelacion: null,
      creadoPorUid: "uid-compras",
      creadoPorNombre: "Compras",
      creadoEn: fecha,
      actualizadoEn: fecha,
    }
    const partida: PartidaPedidoEndmills = {
      id: "partida-1",
      pedidoId: pedido.id,
      fechaPedido: pedido.fecha,
      tipo: "catalogada",
      medidaId: medida.id,
      categoria: medida.categoria,
      medidaPulgadas: medida.medidaPulgadas,
      descripcion: medida.descripcion,
      spec: medida.specPropuesta,
      stockAntesPedido: medida.stockActual,
      cantidadPedida: 10,
      cantidadRecibida: 2,
      precioUnitarioUSD: medida.precioActualUSD,
      subtotalUSD: 38.2,
      objetivoPar: 14,
      requiereConfirmacionAlCrear: false,
      confirmacionResuelta: true,
      creadoEn: fecha,
      actualizadoEn: fecha,
    }
    mocks.partidas.listar.mockResolvedValue([partida])
    const update = vi.fn()
    const transaction = {
      get: vi.fn(async (ref: { parent: { coleccion: string }; id: string }) => {
        const data = ref.parent.coleccion === "endmills-pedidos"
          ? pedido
          : ref.parent.coleccion === "endmills-medidas"
            ? medida
            : partida
        return { id: ref.id, exists: () => true, data: () => data }
      }),
      set: vi.fn(),
      update,
    }
    vi.mocked(runTransaction).mockImplementation(async (_db, callback) =>
      callback(transaction as never)
    )

    await registrarRecepcionPedidoEndmills(pedido.id, {
      partidas: [{ partidaId: partida.id, cantidadRecibida: 5 }],
    })

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ id: medida.id }),
      expect.objectContaining({ stockActual: 7 })
    )
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ id: partida.id }),
      expect.objectContaining({ cantidadRecibida: 5 })
    )
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ id: pedido.id }),
      expect.objectContaining({ estado: "confirmado" })
    )
  })
})
