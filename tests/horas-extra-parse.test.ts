import { describe, it, expect } from "vitest"
import {
  parseHoras,
  parseHorasConEstado,
  calcularTotalHoras,
  calcularTotalHorasPersistible,
  registroTieneHoras,
  getMiercolesSemana,
  formatSemanaISO,
  offsetSemana,
  getDiaSemanaActual,
  estadoCelda,
  etiquetaDia,
  getSemanaActualISO,
  esSemanaActual,
  intensidadHeatmap,
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

  it("limpia el total persistido cuando se borra la ultima hora", () => {
    expect(calcularTotalHorasPersistible({ miercoles: "0", jueves: null })).toBeNull()
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

describe("formatSemanaISO", () => {
  it("conserva la fecha local al formatear semanas", () => {
    expect(formatSemanaISO(new Date(2026, 6, 29, 18, 0, 0))).toBe("2026-07-29")
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

describe("etiquetaDia y semanas", () => {
  it("retorna etiquetas abreviadas para cada día", () => {
    expect(etiquetaDia("miercoles")).toBe("Mié")
    expect(etiquetaDia("jueves")).toBe("Jue")
    expect(etiquetaDia("viernes")).toBe("Vie")
    expect(etiquetaDia("sabado")).toBe("Sáb")
    expect(etiquetaDia("domingo")).toBe("Dom")
    expect(etiquetaDia("lunes")).toBe("Lun")
    expect(etiquetaDia("martes")).toBe("Mar")
  })

  it("calcula la semana actual y comprueba esSemanaActual", () => {
    const actual = getSemanaActualISO()
    expect(actual).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(esSemanaActual(actual)).toBe(true)
    expect(esSemanaActual("2000-01-01")).toBe(false)
  })

  it("calcula la clase de intensidad del heatmap según las horas", () => {
    expect(intensidadHeatmap(0)).toBe("")
    expect(intensidadHeatmap(-1)).toBe("")
    expect(intensidadHeatmap(1.5)).toBe("bg-sky-50")
    expect(intensidadHeatmap(3)).toBe("bg-sky-100")
    expect(intensidadHeatmap(5.5)).toBe("bg-sky-200")
    expect(intensidadHeatmap(8)).toBe("bg-sky-300")
  })
})

describe("horas-extra-resumen", () => {
  const mockRegistros = [
    {
      id: "r1",
      empleado: "Juan Pérez",
      departamento: "taller" as const,
      semanaInicio: "2026-08-05",
      miercoles: "2",
      jueves: "3",
      viernes: null,
      sabado: null,
      domingo: null,
      lunes: "1",
      martes: null,
      totalHoras: 6,
      notas: null,
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    },
    {
      id: "r2",
      empleado: "María Gómez",
      departamento: "taller" as const,
      semanaInicio: "2026-08-05",
      miercoles: null,
      jueves: null,
      viernes: null,
      sabado: null,
      domingo: null,
      lunes: null,
      martes: null,
      totalHoras: null,
      notas: null,
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    },
    {
      id: "r3",
      empleado: "Juan Pérez",
      departamento: "taller" as const,
      semanaInicio: "2026-07-29",
      miercoles: "4",
      jueves: null,
      viernes: null,
      sabado: null,
      domingo: null,
      lunes: null,
      martes: null,
      totalHoras: 4,
      notas: null,
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    },
    {
      id: "r4",
      empleado: "Carlos Ruiz",
      departamento: "diseno" as const,
      semanaInicio: "2026-08-05",
      miercoles: "5",
      jueves: null,
      viernes: null,
      sabado: null,
      domingo: null,
      lunes: null,
      martes: null,
      totalHoras: 5,
      notas: null,
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    },
  ]

  it("filtra registros por mes y departamento opcional", async () => {
    const { filtrarPorMes } = await import("@/lib/horas-extra-resumen")
    const agostoTaller = filtrarPorMes(mockRegistros, "2026-08", "taller")
    expect(agostoTaller).toHaveLength(2)
    expect(agostoTaller.map((r) => r.id)).toEqual(["r1", "r2"])

    const julioTodos = filtrarPorMes(mockRegistros, "2026-07")
    expect(julioTodos).toHaveLength(1)
    expect(julioTodos[0].id).toBe("r3")
  })

  it("calcula totales por empleado y KPIs del resumen", async () => {
    const { totalesPorEmpleado, calcularKpisResumen } = await import("@/lib/horas-extra-resumen")
    const totales = totalesPorEmpleado(mockRegistros)
    expect(totales).toHaveLength(3)
    expect(totales[0].empleado).toBe("Juan Pérez")
    expect(totales[0].totalHoras).toBe(10) // 6 + 4

    const kpis = calcularKpisResumen(mockRegistros)
    expect(kpis.totalHoras).toBe(15) // 10 (Juan) + 5 (Carlos)
    expect(kpis.empleadosConHoras).toBe(2) // Juan y Carlos
    expect(kpis.promedioPorEmpleado).toBe(7.5)
    expect(kpis.semanasIncompletas).toBe(1) // en 2026-08-05 hay 1 con horas y 1 sin
  })

  it("calcula progreso de la semana y suma por día", async () => {
    const { progresoSemana, sumarHorasDia } = await import("@/lib/horas-extra-resumen")
    const prog = progresoSemana(mockRegistros.slice(0, 2))
    expect(prog.total).toBe(2)
    expect(prog.conHoras).toBe(1)

    const sumaMiercoles = sumarHorasDia(mockRegistros, "miercoles")
    expect(sumaMiercoles).toBe(11) // 2 + 0 + 4 + 5
  })

  it("genera exportaciones CSV limpias", async () => {
    const { totalesPorEmpleado, exportarCsvResumen, detalleSemanasCsv } = await import(
      "@/lib/horas-extra-resumen"
    )
    const totales = totalesPorEmpleado(mockRegistros)
    const csvResumen = exportarCsvResumen(totales, "2026-08", "taller")
    expect(csvResumen).toContain("Juan Pérez")
    expect(csvResumen).toContain("Resumen Horas Extra - taller - 2026-08")

    const csvDetalle = detalleSemanasCsv(mockRegistros)
    expect(csvDetalle).toContain("Empleado,Semana,Departamento,mie,jue,vie,sab,dom,lun,mar,Total")
    expect(csvDetalle).toContain("Juan Pérez,2026-08-05,taller")
  })
})
