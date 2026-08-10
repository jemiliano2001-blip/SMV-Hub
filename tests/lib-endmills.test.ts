import { beforeEach, describe, expect, it, vi } from "vitest"
import { runTransaction } from "firebase/firestore"
import { registrarAuditoria } from "@/lib/auditoria"

const mocks = vi.hoisted(() => {
  const medidas = {
    ref: vi.fn(() => ({ coleccion: "endmills-medidas" })),
    listar: vi.fn(),
    actualizar: vi.fn(),
    obtener: vi.fn(),
    crear: vi.fn(),
  }
  const pedidos = {
    ref: vi.fn(() => ({ coleccion: "endmills-pedidos" })),
    listar: vi.fn(),
    actualizar: vi.fn(),
    obtener: vi.fn(),
  }
  const partidas = {
    ref: vi.fn(() => ({ coleccion: "endmills-pedido-partidas" })),
    listar: vi.fn(),
    actualizar: vi.fn(),
    obtener: vi.fn(),
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

vi.mock("@/lib/notificaciones", () => ({
  emitirNotificacion: vi.fn(async () => "notif-1"),
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

import { emitirNotificacion } from "@/lib/notificaciones"
import {
  actualizarStockBatchEndmills,
  actualizarStockEndmill,
  crearEndmillMedida,
  registrarPedidoEndmills,
  registrarRecepcionPedidoEndmills,
  reordenarMedidasEndmills,
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
  tipoCambioUSD: null,
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
      fechaRecepcionCompleta: null,
      diasLeadTime: null,
      tipoCambioUSD: null,
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
      recepciones: [],
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

  describe("payload de recepción", () => {
    const pedidoBase: PedidoEndmills = {
      id: "pedido-2",
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
      fechaRecepcionCompleta: null,
      diasLeadTime: null,
      tipoCambioUSD: null,
      creadoPorUid: "uid-compras",
      creadoPorNombre: "Compras",
      creadoEn: fecha,
      actualizadoEn: fecha,
    }
    const partidaBase: PartidaPedidoEndmills = {
      id: "partida-2",
      pedidoId: pedidoBase.id,
      fechaPedido: pedidoBase.fecha,
      tipo: "catalogada",
      medidaId: medida.id,
      categoria: medida.categoria,
      medidaPulgadas: medida.medidaPulgadas,
      descripcion: medida.descripcion,
      spec: medida.specPropuesta,
      stockAntesPedido: medida.stockActual,
      cantidadPedida: 10,
      cantidadRecibida: 0,
      recepciones: [],
      precioUnitarioUSD: medida.precioActualUSD,
      subtotalUSD: 38.2,
      objetivoPar: 14,
      requiereConfirmacionAlCrear: false,
      confirmacionResuelta: true,
      creadoEn: fecha,
      actualizadoEn: fecha,
    }

    /** Firestore rechaza `undefined` en cualquier nivel del documento. */
    function rutasConUndefined(valor: unknown, ruta = ""): string[] {
      if (valor === undefined) return [ruta || "(raíz)"]
      if (Array.isArray(valor)) {
        return valor.flatMap((item, i) => rutasConUndefined(item, `${ruta}[${i}]`))
      }
      if (valor instanceof Date || valor === null || typeof valor !== "object") return []
      return Object.entries(valor as Record<string, unknown>).flatMap(([clave, item]) =>
        rutasConUndefined(item, ruta ? `${ruta}.${clave}` : clave)
      )
    }

    function montarTransaccion() {
      mocks.partidas.listar.mockResolvedValue([partidaBase])
      const update = vi.fn()
      const transaction = {
        get: vi.fn(async (ref: { parent: { coleccion: string }; id: string }) => {
          const data = ref.parent.coleccion === "endmills-pedidos"
            ? pedidoBase
            : ref.parent.coleccion === "endmills-medidas"
              ? medida
              : partidaBase
          return { id: ref.id, exists: () => true, data: () => data }
        }),
        set: vi.fn(),
        update,
      }
      vi.mocked(runTransaction).mockImplementation(async (_db, callback) =>
        callback(transaction as never)
      )
      return update
    }

    function payloadDe(update: ReturnType<typeof vi.fn>, id: string): Record<string, unknown> {
      const llamada = update.mock.calls.find(
        ([ref]) => (ref as { id: string }).id === id
      )
      if (!llamada) throw new Error(`No hubo update para ${id}`)
      return llamada[1] as Record<string, unknown>
    }

    it("omite la llave `notas` cuando el borrador no la trae, sin escribir undefined", async () => {
      const update = montarTransaccion()

      await registrarRecepcionPedidoEndmills(pedidoBase.id, {
        fechaRecepcion: "2026-08-20",
        partidas: [{ partidaId: partidaBase.id, cantidadRecibida: 4 }],
      })

      const partidaPayload = payloadDe(update, partidaBase.id)
      expect(partidaPayload.recepciones).toEqual([{ cantidad: 4, fecha: "2026-08-20" }])
      const [primera] = partidaPayload.recepciones as Array<Record<string, unknown>>
      expect("notas" in primera).toBe(false)

      for (const [ref, payload] of update.mock.calls) {
        expect(
          rutasConUndefined(payload),
          `update(${(ref as { id: string }).id}) escribió undefined`
        ).toEqual([])
      }
    })

    it("conserva las notas cuando sí se capturan", async () => {
      const update = montarTransaccion()

      await registrarRecepcionPedidoEndmills(pedidoBase.id, {
        fechaRecepcion: "2026-08-20",
        partidas: [
          { partidaId: partidaBase.id, cantidadRecibida: 4, notas: "  llegaron rayadas  " },
        ],
      })

      expect(payloadDe(update, partidaBase.id).recepciones).toEqual([
        { cantidad: 4, fecha: "2026-08-20", notas: "llegaron rayadas" },
      ])
    })

    it("rechaza una recepción fechada antes del pedido en vez de reportar 0 días", async () => {
      const update = montarTransaccion()

      await expect(
        registrarRecepcionPedidoEndmills(pedidoBase.id, {
          fechaRecepcion: "2026-08-01", // el pedido es del 2026-08-06
          partidas: [{ partidaId: partidaBase.id, cantidadRecibida: 10 }],
        })
      ).rejects.toThrow(/no puede ser anterior a la del pedido/)

      expect(
        update.mock.calls.some(([ref]) => (ref as { id: string }).id === pedidoBase.id)
      ).toBe(false)
    })

    it("cierra el pedido con lead time cuando la recepción es completa", async () => {
      const update = montarTransaccion()

      await registrarRecepcionPedidoEndmills(pedidoBase.id, {
        fechaRecepcion: "2026-08-20",
        partidas: [{ partidaId: partidaBase.id, cantidadRecibida: 10 }],
      })

      expect(payloadDe(update, pedidoBase.id)).toMatchObject({
        estado: "recibido",
        fechaRecepcionCompleta: "2026-08-20",
        diasLeadTime: 14,
      })
    })
  })

  describe("conteo masivo y alertas de stock crítico", () => {
    // Con objetivoPar 20 el umbral crítico es ceil(20 * 0.25) = 5 pzas.
    function medidaCon(id: string, stockActual: number, objetivoPar: number | null): EndmillMedida {
      return { ...medida, id, descripcion: `FLAT ${id}`, stockActual, objetivoPar }
    }

    function montarCatalogo(catalogo: Record<string, EndmillMedida>) {
      const update = vi.fn()
      const transaction = {
        get: vi.fn(async (ref: { id: string }) => ({
          id: ref.id,
          exists: () => Boolean(catalogo[ref.id]),
          data: () => catalogo[ref.id],
        })),
        set: vi.fn(),
        update,
      }
      vi.mocked(runTransaction).mockImplementation(async (_db, callback) =>
        callback(transaction as never)
      )
      return update
    }

    it("aborta el conteo completo si alguien más movió el stock mientras tanto", async () => {
      const update = montarCatalogo({
        "endmill-001": medidaCon("endmill-001", 4, 20),
        // El usuario vio 5, pero otra persona ya lo dejó en 9.
        "endmill-002": medidaCon("endmill-002", 9, 20),
      })

      await expect(
        actualizarStockBatchEndmills([
          { id: "endmill-001", stockActual: 3, stockEsperado: 4 },
          { id: "endmill-002", stockActual: 6, stockEsperado: 5 },
        ])
      ).rejects.toThrow(/movió el stock mientras contabas/)

      // Nada se guarda: ni siquiera la medida que sí venía sin conflicto.
      expect(update).not.toHaveBeenCalled()
      expect(vi.mocked(emitirNotificacion)).not.toHaveBeenCalled()
    })

    it("guarda el conteo y alerta solo las medidas que entran a crítico", async () => {
      const update = montarCatalogo({
        "endmill-001": medidaCon("endmill-001", 10, 20), // bajo → crítico
        "endmill-002": medidaCon("endmill-002", 2, 20), // ya estaba crítico
      })

      await actualizarStockBatchEndmills([
        { id: "endmill-001", stockActual: 3, stockEsperado: 10 },
        { id: "endmill-002", stockActual: 1, stockEsperado: 2 },
      ])

      expect(update).toHaveBeenCalledTimes(2)
      expect(vi.mocked(emitirNotificacion)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(emitirNotificacion)).toHaveBeenCalledWith(
        expect.objectContaining({
          tipo: "endmills_stock_critico",
          origenModulo: "endmills",
          audiencia: "endmills",
          origenId: "endmill-001",
          destinatarioUid: null,
        })
      )
    })

    it("deja en la bitácora el antes→después de cada medida contada", async () => {
      montarCatalogo({
        "endmill-001": medidaCon("endmill-001", 10, 20),
        "endmill-002": medidaCon("endmill-002", 4, 20),
      })

      await actualizarStockBatchEndmills([
        { id: "endmill-001", stockActual: 7, stockEsperado: 10 },
        // Sin cambio real: no debe aparecer en la bitácora.
        { id: "endmill-002", stockActual: 4, stockEsperado: 4 },
      ])

      expect(vi.mocked(registrarAuditoria)).toHaveBeenCalledWith(
        expect.anything(),
        "EDITAR",
        "endmills-medidas",
        "conteo-masivo",
        "Conteo masivo de 1 endmills: endmill-001 10→7"
      )
    })

    it("no repite la alerta de una medida que ya venía en crítico", async () => {
      mocks.medidas.obtener.mockResolvedValue(medidaCon("endmill-003", 2, 20))
      await actualizarStockEndmill("endmill-003", 1)
      expect(vi.mocked(emitirNotificacion)).not.toHaveBeenCalled()

      mocks.medidas.obtener.mockResolvedValue(medidaCon("endmill-004", 10, 20))
      await actualizarStockEndmill("endmill-004", 3)
      expect(vi.mocked(emitirNotificacion)).toHaveBeenCalledTimes(1)
      expect(vi.mocked(emitirNotificacion)).toHaveBeenCalledWith(
        expect.objectContaining({ origenId: "endmill-004" })
      )
    })
  })

  describe("crearEndmillMedida y reordenarMedidasEndmills", () => {
    it("crea una nueva medida al final asignando orden max + 1", async () => {
      mocks.medidas.listar.mockResolvedValue([
        { id: "m-1", orden: 1 },
        { id: "m-2", orden: 5 },
      ])
      mocks.medidas.crear.mockResolvedValue("m-nueva")

      const id = await crearEndmillMedida({
        categoria: "BALL",
        medidaPulgadas: "1/4",
        descripcion: "BALL 2 FILOS 1/4",
        specPropuesta: "D1/4*FL1/2*L50",
        stockInicial: 5,
        precioActualUSD: 6.5,
        requiereConfirmacion: false,
        objetivoPar: null,
        notas: null,
      })

      expect(id).toBe("m-nueva")
      expect(mocks.medidas.crear).toHaveBeenCalledWith(
        expect.objectContaining({
          orden: 6,
          categoria: "BALL",
          medidaPulgadas: "1/4",
          descripcion: "BALL 2 FILOS 1/4",
          stockActual: 5,
          precioActualUSD: 6.5,
        }),
        expect.stringContaining("Creó nueva medida de endmill")
      )
    })

    it("reordena la lista actualizando el campo orden en transacción", async () => {
      const update = vi.fn()
      const transaction = { update }
      vi.mocked(runTransaction).mockImplementation(async (_db, callback) =>
        callback(transaction as never)
      )

      await reordenarMedidasEndmills([
        { id: "m-2", orden: 1 },
        { id: "m-1", orden: 2 },
      ])

      expect(update).toHaveBeenCalledTimes(2)
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ id: "m-2" }),
        expect.objectContaining({ orden: 1 })
      )
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ id: "m-1" }),
        expect.objectContaining({ orden: 2 })
      )
    })
  })
})
