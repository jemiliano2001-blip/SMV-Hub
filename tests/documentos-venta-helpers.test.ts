import { describe, expect, it } from "vitest"
import {
  etiquetaEstadoSolicitudDocumento,
  filtrarSoPorTexto,
  ordenCompraEfectiva,
  ordenCompraSolicitud,
  particionarSolicitudesVentas,
  puedeTransicionarEstado,
  validarPartidasRemision,
} from "@/lib/documentos-venta-helpers"
import type { SolicitudDocumento, VentaOdooSo } from "@/lib/schemas"

const atendedor = { esAtendedor: true, esSolicitante: false }
const solicitante = { esAtendedor: false, esSolicitante: true }
const observador = { esAtendedor: false, esSolicitante: false }

describe("puedeTransicionarEstado", () => {
  it("rechaza transición al mismo estado", () => {
    expect(puedeTransicionarEstado("pendiente", "pendiente", atendedor)).toBe(false)
  })

  it("bloquea salidas desde completada o rechazada", () => {
    expect(puedeTransicionarEstado("completada", "en_proceso", atendedor)).toBe(false)
    expect(puedeTransicionarEstado("rechazada", "pendiente", atendedor)).toBe(false)
  })

  it("permite al solicitante rechazar desde pendiente", () => {
    expect(puedeTransicionarEstado("pendiente", "rechazada", solicitante)).toBe(true)
  })

  it("no permite al solicitante otras transiciones", () => {
    expect(puedeTransicionarEstado("pendiente", "en_proceso", solicitante)).toBe(false)
    expect(puedeTransicionarEstado("en_proceso", "completada", solicitante)).toBe(false)
  })

  it("permite al atendedor avanzar desde pendiente", () => {
    expect(puedeTransicionarEstado("pendiente", "en_proceso", atendedor)).toBe(true)
    expect(puedeTransicionarEstado("pendiente", "completada", atendedor)).toBe(true)
    expect(puedeTransicionarEstado("pendiente", "rechazada", atendedor)).toBe(true)
  })

  it("permite al atendedor cerrar desde en_proceso", () => {
    expect(puedeTransicionarEstado("en_proceso", "completada", atendedor)).toBe(true)
    expect(puedeTransicionarEstado("en_proceso", "rechazada", atendedor)).toBe(true)
    expect(puedeTransicionarEstado("en_proceso", "pendiente", atendedor)).toBe(false)
  })

  it("niega transiciones a observadores", () => {
    expect(puedeTransicionarEstado("pendiente", "en_proceso", observador)).toBe(false)
    expect(puedeTransicionarEstado("pendiente", "rechazada", observador)).toBe(false)
  })
})

function soBase(overrides: Partial<VentaOdooSo> = {}): VentaOdooSo {
  return {
    id: "1",
    odooId: 100,
    name: "SO001",
    clientOrderRef: "PO-123",
    ordenCompra: null,
    partnerId: 1,
    partnerName: "Acme Corp",
    dateOrder: "2026-07-01",
    state: "sale",
    invoiceStatus: "to invoice",
    lineas: [],
    remisiones: [],
    sincronizadoEn: new Date("2026-07-01"),
    ...overrides,
  }
}

describe("ordenCompraEfectiva / ordenCompraSolicitud", () => {
  it("ordenCompraEfectiva prefiere origin sobre clientOrderRef", () => {
    expect(ordenCompraEfectiva({ ordenCompra: "PO.1", clientOrderRef: "X" })).toBe("PO.1")
    expect(ordenCompraEfectiva({ ordenCompra: null, clientOrderRef: "X" })).toBe("X")
    expect(ordenCompraEfectiva({ ordenCompra: null, clientOrderRef: null })).toBeNull()
  })

  it("ordenCompraSolicitud reutiliza el mismo efectivo", () => {
    expect(ordenCompraSolicitud({ ordenCompra: "  A  ", clientOrderRef: "B" })).toBe("A")
  })
})

describe("filtrarSoPorTexto", () => {
  const sos = [
    soBase({ id: "1", name: "SO001", partnerName: "Acme Corp", clientOrderRef: "PO-123" }),
    soBase({ id: "2", name: "SO002", partnerName: "Beta SA", clientOrderRef: null }),
    soBase({
      id: "3",
      name: "2026/S01126",
      partnerName: "OHD",
      clientOrderRef: null,
      ordenCompra: "PO.20263330",
    }),
  ]

  it("devuelve copia completa con query vacía", () => {
    const result = filtrarSoPorTexto(sos, "  ")
    expect(result).toHaveLength(3)
    expect(result).not.toBe(sos)
  })

  it("filtra por nombre SO, cliente o referencia", () => {
    expect(filtrarSoPorTexto(sos, "acme")).toHaveLength(1)
    expect(filtrarSoPorTexto(sos, "po-123")).toHaveLength(1)
    expect(filtrarSoPorTexto(sos, "so002")).toHaveLength(1)
    expect(filtrarSoPorTexto(sos, "inexistente")).toHaveLength(0)
  })

  it("filtrarSoPorTexto matchea ordenCompra", () => {
    expect(filtrarSoPorTexto(sos, "20263330")).toHaveLength(1)
  })
})

describe("etiquetaEstadoSolicitudDocumento", () => {
  it("etiquetaEstadoSolicitudDocumento en español claro", () => {
    expect(etiquetaEstadoSolicitudDocumento("pendiente")).toBe("Por atender")
    expect(etiquetaEstadoSolicitudDocumento("en_proceso")).toBe("En proceso")
    expect(etiquetaEstadoSolicitudDocumento("completada")).toBe("Lista")
    expect(etiquetaEstadoSolicitudDocumento("rechazada")).toBe("Cancelada")
  })
})

describe("particionarSolicitudesVentas", () => {
  it("particionarSolicitudesVentas separa pendientes y hechas", () => {
    const base: Omit<SolicitudDocumento, "id" | "estado"> = {
      tipo: "remision",
      odooSoId: 1,
      odooSoName: "S1",
      clientOrderRef: null,
      ordenCompra: "PO.1",
      partnerName: "C",
      partidas: [],
      nota: "",
      folioOdoo: null,
      motivoRechazo: null,
      solicitadoPorUid: "u",
      solicitadoPorNombre: "U",
      atendidoPorUid: null,
      atendidoPorNombre: null,
      creadoEn: new Date("2026-07-01T00:00:00Z"),
      actualizadoEn: new Date("2026-07-01T00:00:00Z"),
    }
    const rows: SolicitudDocumento[] = [
      { ...base, id: "a", estado: "pendiente" },
      { ...base, id: "b", estado: "en_proceso" },
      { ...base, id: "c", estado: "completada" },
      { ...base, id: "d", estado: "rechazada" },
    ]
    const { pendientes, hechas } = particionarSolicitudesVentas(rows)
    expect(pendientes.map((s) => s.id).sort()).toEqual(["a", "b"])
    expect(hechas.map((s) => s.id).sort()).toEqual(["c", "d"])
  })
})

describe("validarPartidasRemision", () => {
  const lineas = [{ odooLineId: 10, qtyPending: 5 }]

  it("factura no exige partidas", () => {
    expect(validarPartidasRemision("factura", [], lineas)).toBeNull()
  })

  it("remisión exige al menos una partida", () => {
    expect(validarPartidasRemision("remision", [], lineas)).toBe(
      "Selecciona al menos una partida"
    )
  })

  it("rechaza línea que no pertenece a la SO", () => {
    expect(
      validarPartidasRemision("remision", [{ odooLineId: 99, qtySolicitada: 1 }], lineas)
    ).toBe("Línea 99 no pertenece a la SO")
  })

  it("rechaza cantidad mayor a pendiente", () => {
    expect(
      validarPartidasRemision("remision", [{ odooLineId: 10, qtySolicitada: 6 }], lineas)
    ).toBe("Cantidad inválida para 10")
  })

  it("acepta cantidad válida dentro del pendiente", () => {
    expect(
      validarPartidasRemision("remision", [{ odooLineId: 10, qtySolicitada: 5 }], lineas)
    ).toBeNull()
  })
})
