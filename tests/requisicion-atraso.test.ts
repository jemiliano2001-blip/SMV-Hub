import { describe, expect, it } from "vitest"
import { estadoAtraso, estadoAtrasoEntrega, hoyLocal } from "@/lib/requisicion-atraso"

const base = {
  estado: "no_comprado",
  prioridad: "3-5 dias",
  fechaPedido: "2026-07-01",
} as const

describe("estadoAtraso", () => {
  it("a_tiempo con días restantes antes del límite", () => {
    expect(estadoAtraso(base, "2026-07-03")).toEqual({ tipo: "a_tiempo", dias: 3 })
  })

  it("por_vencer exactamente el día del límite", () => {
    expect(estadoAtraso(base, "2026-07-06")).toEqual({ tipo: "por_vencer", dias: 0 })
  })

  it("atrasada con días de atraso después del límite", () => {
    expect(estadoAtraso(base, "2026-07-10")).toEqual({ tipo: "atrasada", dias: 4 })
  })

  it("en_proceso también corre el reloj", () => {
    expect(estadoAtraso({ ...base, estado: "en_proceso" }, "2026-07-10")).toEqual({
      tipo: "atrasada",
      dias: 4,
    })
  })

  it("comprado y recibido no llevan semáforo", () => {
    expect(estadoAtraso({ ...base, estado: "comprado" }, "2026-07-10")).toBeNull()
    expect(estadoAtraso({ ...base, estado: "recibido" }, "2026-07-10")).toBeNull()
  })

  it("'cuando se pueda' y sin prioridad nunca vencen", () => {
    expect(estadoAtraso({ ...base, prioridad: "cuando se pueda" }, "2027-01-01")).toBeNull()
    expect(estadoAtraso({ ...base, prioridad: null }, "2027-01-01")).toBeNull()
  })

  it("límites por prioridad: 1-2 dias → 2, 7-14 dias → 14", () => {
    expect(estadoAtraso({ ...base, prioridad: "1-2 dias" }, "2026-07-03")).toEqual({
      tipo: "por_vencer",
      dias: 0,
    })
    expect(
      estadoAtraso({ ...base, prioridad: "7-14 dias", fechaPedido: "2026-06-25" }, "2026-07-10")
    ).toEqual({ tipo: "atrasada", dias: 1 })
  })

  it("fecha inválida devuelve null en lugar de lanzar", () => {
    expect(estadoAtraso({ ...base, fechaPedido: "no-fecha" }, "2026-07-10")).toBeNull()
    expect(estadoAtraso(base, "")).toBeNull()
  })
})

describe("estadoAtrasoEntrega", () => {
  const auto = { estado: "en_proceso" as const, fechaEntregaEst: "2026-07-10" }

  it("a_tiempo antes de la fecha de entrega", () => {
    expect(estadoAtrasoEntrega(auto, "2026-07-06")).toEqual({ tipo: "a_tiempo", dias: 4 })
  })

  it("por_vencer el día de entrega", () => {
    expect(estadoAtrasoEntrega(auto, "2026-07-10")).toEqual({ tipo: "por_vencer", dias: 0 })
  })

  it("atrasada después de la fecha de entrega", () => {
    expect(estadoAtrasoEntrega(auto, "2026-07-15")).toEqual({ tipo: "atrasada", dias: 5 })
  })

  it("comprado no lleva semáforo", () => {
    expect(estadoAtrasoEntrega({ ...auto, estado: "comprado" }, "2026-07-15")).toBeNull()
  })
})

describe("hoyLocal", () => {
  it("devuelve YYYY-MM-DD", () => {
    expect(hoyLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
