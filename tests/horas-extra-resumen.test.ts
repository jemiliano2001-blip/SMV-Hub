import { describe, it, expect } from "vitest"
import {
  filtrarPorMes,
  totalesPorEmpleado,
  calcularKpisResumen,
  progresoSemana,
} from "@/lib/horas-extra-resumen"
import type { HorasExtra } from "@/lib/schemas"

function makeRegistro(overrides: Partial<HorasExtra> = {}): HorasExtra {
  const ahora = new Date("2026-07-01T12:00:00")
  return {
    id: "h1",
    empleado: "Oscar",
    departamento: "diseno",
    semanaInicio: "2026-07-01",
    miercoles: "2",
    jueves: "1",
    viernes: null,
    sabado: null,
    domingo: null,
    lunes: null,
    martes: null,
    totalHoras: 3,
    notas: null,
    creadoEn: ahora,
    actualizadoEn: ahora,
    ...overrides,
  }
}

describe("filtrarPorMes", () => {
  const registros = [
    makeRegistro({ id: "1", semanaInicio: "2026-07-01" }),
    makeRegistro({ id: "2", semanaInicio: "2026-06-24", empleado: "Victor" }),
    makeRegistro({
      id: "3",
      semanaInicio: "2026-07-08",
      departamento: "taller",
      empleado: "Chava",
    }),
  ]

  it("filtra por mes y departamento", () => {
    const julio = filtrarPorMes(registros, "2026-07", "diseno")
    expect(julio).toHaveLength(1)
    expect(julio[0].empleado).toBe("Oscar")
  })

  it("filtra solo por mes si no hay departamento", () => {
    const julio = filtrarPorMes(registros, "2026-07")
    expect(julio).toHaveLength(2)
  })
})

describe("totalesPorEmpleado", () => {
  it("agrupa y suma por empleado", () => {
    const registros = [
      makeRegistro({ empleado: "Oscar", miercoles: "2", jueves: "1" }),
      makeRegistro({
        id: "h2",
        empleado: "Oscar",
        semanaInicio: "2026-07-08",
        miercoles: "4",
        jueves: null,
      }),
      makeRegistro({
        id: "h3",
        empleado: "Victor",
        miercoles: "1",
        jueves: null,
      }),
    ]
    const resumen = totalesPorEmpleado(registros)
    expect(resumen[0].empleado).toBe("Oscar")
    expect(resumen[0].totalHoras).toBeCloseTo(7)
    expect(resumen[0].semanas).toHaveLength(2)
  })
})

describe("calcularKpisResumen", () => {
  it("calcula KPIs del mes", () => {
    const registros = [
      makeRegistro({ empleado: "Oscar", miercoles: "2", jueves: "2" }),
      makeRegistro({
        id: "h2",
        empleado: "Victor",
        miercoles: null,
        jueves: null,
        semanaInicio: "2026-07-01",
      }),
    ]
    const kpis = calcularKpisResumen(registros)
    expect(kpis.totalHoras).toBeCloseTo(4)
    expect(kpis.empleadosConHoras).toBe(1)
    expect(kpis.semanasIncompletas).toBe(1)
  })
})

describe("progresoSemana", () => {
  it("cuenta empleados con al menos un día capturado", () => {
    const registros = [
      makeRegistro({ miercoles: "2" }),
      makeRegistro({
        id: "h2",
        empleado: "Victor",
        miercoles: null,
        jueves: null,
        viernes: null,
        sabado: null,
        domingo: null,
        lunes: null,
        martes: null,
      }),
    ]
    expect(progresoSemana(registros)).toEqual({ conHoras: 1, total: 2 })
  })
})
