import { describe, expect, it } from "vitest"
import {
  filtrarSoPorTexto,
  puedeTransicionarEstado,
  validarPartidasRemision,
} from "@/lib/documentos-venta-helpers"
import type { VentaOdooSo } from "@/lib/schemas"

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

describe("filtrarSoPorTexto", () => {
  const sos = [
    soBase({ id: "1", name: "SO001", partnerName: "Acme Corp", clientOrderRef: "PO-123" }),
    soBase({ id: "2", name: "SO002", partnerName: "Beta SA", clientOrderRef: null }),
  ]

  it("devuelve copia completa con query vacía", () => {
    const result = filtrarSoPorTexto(sos, "  ")
    expect(result).toHaveLength(2)
    expect(result).not.toBe(sos)
  })

  it("filtra por nombre SO, cliente o referencia", () => {
    expect(filtrarSoPorTexto(sos, "acme")).toHaveLength(1)
    expect(filtrarSoPorTexto(sos, "po-123")).toHaveLength(1)
    expect(filtrarSoPorTexto(sos, "so002")).toHaveLength(1)
    expect(filtrarSoPorTexto(sos, "inexistente")).toHaveLength(0)
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
