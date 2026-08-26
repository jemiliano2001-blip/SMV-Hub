import { describe, it, expect } from "vitest"
import type { RegistroBano } from "@/lib/schemas"
import { calcularEstadisticasDiarias } from "@/lib/banos-export"
import { generarImagenReporteDiario, descargarYCopiarImagenDiaria } from "@/lib/banos-imagen-export"

describe("banos-imagen-export", () => {
  const registrosEjemplo: RegistroBano[] = [
    {
      id: "reg-1",
      fecha: "2026-08-26",
      operador: "Daniel",
      bano: "Baño #1",
      horaEntrada: "08:45",
      horaLlegada: "09:02",
      tiempoMinutos: 17, // Prolongada
      creadoEn: new Date("2026-08-26T08:45:00Z"),
      actualizadoEn: new Date("2026-08-26T09:02:00Z"),
    },
    {
      id: "reg-2",
      fecha: "2026-08-26",
      operador: "Pedro",
      bano: "Baño #2",
      horaEntrada: "09:50",
      horaLlegada: "10:03",
      tiempoMinutos: 13,
      creadoEn: new Date("2026-08-26T09:50:00Z"),
      actualizadoEn: new Date("2026-08-26T10:03:00Z"),
    },
    {
      id: "reg-3",
      fecha: "2026-08-26",
      operador: "Juan Antonio",
      bano: "CNC",
      horaEntrada: "11:03",
      horaLlegada: null,
      tiempoMinutos: null, // En curso
      creadoEn: new Date("2026-08-26T11:03:00Z"),
      actualizadoEn: new Date("2026-08-26T11:03:00Z"),
    },
  ]

  it("calcula estadísticas diarias consistentes para la imagen", () => {
    const stats = calcularEstadisticasDiarias(registrosEjemplo, "2026-08-26")
    expect(stats.totalVisitas).toBe(3)
    expect(stats.operadoresDistintos).toBe(3)
    expect(stats.visitasProlongadas).toBe(1)
    expect(stats.visitasEnCurso).toBe(1)
    expect(stats.tiempoTotalMinutos).toBe(30)
  })

  it("exporta funciones necesarias y maneja guardias en entorno sin DOM", async () => {
    expect(typeof generarImagenReporteDiario).toBe("function")
    expect(typeof descargarYCopiarImagenDiaria).toBe("function")

    const stats = calcularEstadisticasDiarias(registrosEjemplo, "2026-08-26")

    // En entorno Node / Vitest sin document real, debe lanzar un error descriptivo
    if (typeof document === "undefined") {
      await expect(generarImagenReporteDiario(stats)).rejects.toThrow(
        "La generación de imagen solo está disponible en el navegador."
      )
    }
  })
})
