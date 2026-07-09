import { describe, it, expect } from "vitest"
import {
  parseHoras,
  parseHorasConEstado,
  calcularTotalHoras,
  registroTieneHoras,
  getMiercolesSemana,
  offsetSemana,
  getDiaSemanaActual,
  estadoCelda,
} from "@/lib/horas-extra-parse"

describe("parseHorasConEstado", () => {
  it("parsea números enteros y decimales", () => {
    expect(parseHorasConEstado("2")).toEqual({ valor: 2, advertencia: false })
    expect(parseHoras("2.5")).toBe(2.5)
  })

  it("parsea horas y minutos con espacio", () => {
    expect(parseHoras("2 30")).toBeCloseTo(2.5)
    expect(parseHoras("5 30")).toBeCloseTo(5.5)
  })

  it("trata vacaciones y permiso sin advertencia", () => {
    expect(parseHorasConEstado("vacaciones")).toEqual({ valor: 0, advertencia: false })
    expect(parseHorasConEstado("Vac")).toEqual({ valor: 0, advertencia: false })
    expect(parseHorasConEstado("permiso")).toEqual({ valor: 0, advertencia: false })
    expect(parseHorasConEstado("-")).toEqual({ valor: 0, advertencia: false })
  })

  it("marca advertencia en texto no reconocido", () => {
    expect(parseHorasConEstado("11pm")).toEqual({ valor: 0, advertencia: true })
    expect(parseHorasConEstado("abc")).toEqual({ valor: 0, advertencia: true })
  })

  it("null y vacío son cero sin advertencia", () => {
    expect(parseHorasConEstado(null)).toEqual({ valor: 0, advertencia: false })
    expect(parseHorasConEstado("  ")).toEqual({ valor: 0, advertencia: false })
  })
})

describe("calcularTotalHoras", () => {
  it("suma los siete días", () => {
    const total = calcularTotalHoras({
      miercoles: "2",
      jueves: "1.5",
      viernes: null,
      sabado: null,
      domingo: null,
      lunes: "3",
      martes: null,
    })
    expect(total).toBeCloseTo(6.5)
  })
})

describe("registroTieneHoras", () => {
  it("detecta si hay al menos un día con valor", () => {
    expect(registroTieneHoras({ miercoles: null, jueves: "" })).toBe(false)
    expect(registroTieneHoras({ miercoles: "2" })).toBe(true)
    expect(registroTieneHoras({ jueves: "vacaciones" })).toBe(true)
  })
})

describe("semana miércoles", () => {
  it("calcula el miércoles de una semana", () => {
    const miercoles = getMiercolesSemana(new Date("2026-07-09T12:00:00"))
    expect(miercoles.toISOString().slice(0, 10)).toBe("2026-07-08")
  })

  it("desplaza semanas", () => {
    expect(offsetSemana("2026-07-01", 1)).toBe("2026-07-08")
    expect(offsetSemana("2026-07-08", -1)).toBe("2026-07-01")
  })
})

describe("estadoCelda", () => {
  it("clasifica pendiente, capturado y vacaciones", () => {
    expect(estadoCelda(null)).toBe("pendiente")
    expect(estadoCelda("3")).toBe("capturado")
    expect(estadoCelda("vacaciones")).toBe("vacaciones")
  })
})

describe("getDiaSemanaActual", () => {
  it("mapea jueves correctamente", () => {
    expect(getDiaSemanaActual(new Date("2026-07-09T12:00:00"))).toBe("jueves")
  })
})
