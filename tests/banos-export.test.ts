import { describe, it, expect } from "vitest"
import type { RegistroBano } from "@/lib/schemas"
import {
  calcularEstadisticasDiarias,
  calcularEstadisticasMensuales,
  formatearHorasMinutos,
  formatearHorasReloj,
  generarTextoResumenDiario,
  generarExcelReporteDiario,
  generarExcelResumenMensual,
} from "@/lib/banos-export"

describe("banos-export", () => {
  const registrosEjemplo: RegistroBano[] = [
    {
      id: "reg-1",
      fecha: "2026-08-25",
      operador: "Juan Perez",
      bano: "Baño #1",
      horaEntrada: "09:00",
      horaLlegada: "09:08",
      tiempoMinutos: 8,
      creadoEn: new Date("2026-08-25T09:00:00Z"),
      actualizadoEn: new Date("2026-08-25T09:08:00Z"),
    },
    {
      id: "reg-2",
      fecha: "2026-08-25",
      operador: "Juan Perez",
      bano: "Baño #1",
      horaEntrada: "13:30",
      horaLlegada: "13:42",
      tiempoMinutos: 12,
      creadoEn: new Date("2026-08-25T13:30:00Z"),
      actualizadoEn: new Date("2026-08-25T13:42:00Z"),
    },
    {
      id: "reg-3",
      fecha: "2026-08-25",
      operador: "Maria Lopez",
      bano: "CNC",
      horaEntrada: "10:15",
      horaLlegada: "10:35",
      tiempoMinutos: 20, // Prolongada >= 15 min
      creadoEn: new Date("2026-08-25T10:15:00Z"),
      actualizadoEn: new Date("2026-08-25T10:35:00Z"),
    },
    {
      id: "reg-4",
      fecha: "2026-08-25",
      operador: "Carlos Gomez",
      bano: "Automatizacion",
      horaEntrada: "11:00",
      horaLlegada: null,
      tiempoMinutos: null, // En curso
      creadoEn: new Date("2026-08-25T11:00:00Z"),
      actualizadoEn: new Date("2026-08-25T11:00:00Z"),
    },
    {
      id: "reg-5",
      fecha: "2026-08-24", // Día anterior
      operador: "Juan Perez",
      bano: "Baño #2",
      horaEntrada: "08:30",
      horaLlegada: "08:40",
      tiempoMinutos: 10,
      creadoEn: new Date("2026-08-24T08:30:00Z"),
      actualizadoEn: new Date("2026-08-24T08:40:00Z"),
    },
  ]

  it("formatearHorasMinutos y formatearHorasReloj convierten correctamente", () => {
    expect(formatearHorasMinutos(45)).toBe("45 min")
    expect(formatearHorasMinutos(75)).toBe("1h 15m")
    expect(formatearHorasMinutos(130)).toBe("2h 10m")

    expect(formatearHorasReloj(45)).toBe("0:45:00")
    expect(formatearHorasReloj(75)).toBe("1:15:00")
    expect(formatearHorasReloj(130)).toBe("2:10:00")
  })

  it("calcularEstadisticasDiarias calcula métricas correctas del día seleccionado", () => {
    const stats = calcularEstadisticasDiarias(registrosEjemplo, "2026-08-25")

    expect(stats.fecha).toBe("2026-08-25")
    expect(stats.totalVisitas).toBe(4)
    expect(stats.operadoresDistintos).toBe(3)
    // 8 + 12 + 20 = 40 min totales completados
    expect(stats.tiempoTotalMinutos).toBe(40)
    // 40 min / 3 visitas completadas = 13.33 -> 13 min promedio
    expect(stats.promedioMinutosPorVisita).toBe(13)
    expect(stats.visitasProlongadas).toBe(1) // Maria (20m)
    expect(stats.visitasEnCurso).toBe(1) // Carlos (sin llegada)

    // Desglose por operador
    expect(stats.porOperador.length).toBe(3)
    const juan = stats.porOperador.find((o) => o.operador === "Juan Perez")
    expect(juan).toBeDefined()
    expect(juan?.visitas).toBe(2)
    expect(juan?.tiempoTotalMinutos).toBe(20)
    expect(juan?.tiempoPromedioMinutos).toBe(10)

    const maria = stats.porOperador.find((o) => o.operador === "Maria Lopez")
    expect(maria).toBeDefined()
    expect(maria?.visitas).toBe(1)
    expect(maria?.tiempoTotalMinutos).toBe(20)
    expect(maria?.visitasProlongadas).toBe(1)

    // Mayor tiempo: tanto Juan como Maria tienen 20m, pero está definido
    expect(stats.personaMayorTiempo?.minutos).toBe(20)
  })

  it("calcularEstadisticasMensuales agrega correctamente los registros de todo el mes", () => {
    const statsMes = calcularEstadisticasMensuales(registrosEjemplo, "2026-08")

    expect(statsMes.mes).toBe("2026-08")
    expect(statsMes.totalVisitas).toBe(5)
    expect(statsMes.operadoresDistintos).toBe(3)
    // 8 + 12 + 20 + 10 = 50 min
    expect(statsMes.tiempoTotalMinutos).toBe(50)
    expect(statsMes.formatoHorasTotal).toBe("50 min")

    const juan = statsMes.operadores.find((o) => o.operador === "Juan Perez")
    expect(juan).toBeDefined()
    expect(juan?.totalVisitas).toBe(3)
    expect(juan?.totalMinutos).toBe(30)
    expect(juan?.diasConVisita).toBe(2) // 2026-08-24 y 2026-08-25
  })

  it("generarTextoResumenDiario produce un texto listo para WhatsApp con formato limpio", () => {
    const stats = calcularEstadisticasDiarias(registrosEjemplo, "2026-08-25")
    const texto = generarTextoResumenDiario(stats)

    expect(texto).toContain("*📊 REPORTE DIARIO DE CONTROL DE BAÑOS — SMV*")
    expect(texto).toContain("25/08/2026")
    expect(texto).toContain("Total visitas:* 4")
    expect(texto).toContain("Juan Perez")
    expect(texto).toContain("Maria Lopez")
    expect(texto).toContain("Visitas prolongadas")
  })

  it("generarExcelReporteDiario y generarExcelResumenMensual retornan un ArrayBuffer válido", async () => {
    const statsDiarias = calcularEstadisticasDiarias(registrosEjemplo, "2026-08-25")
    const bufferDiario = await generarExcelReporteDiario(statsDiarias)
    expect(bufferDiario.byteLength).toBeGreaterThan(1000)

    const statsMensual = calcularEstadisticasMensuales(registrosEjemplo, "2026-08")
    const bufferMensual = await generarExcelResumenMensual(statsMensual)
    expect(bufferMensual.byteLength).toBeGreaterThan(1000)
  })
})
