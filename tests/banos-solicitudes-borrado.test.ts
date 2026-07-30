import { describe, it, expect } from "vitest"
import {
  MOTIVOS_SOLICITUD_BORRADO_BANO,
  evaluarReglaAutoAprobacion,
  construirResumenRegistro,
} from "@/lib/banos-solicitudes-borrado"
import type { RegistroBano } from "@/lib/schemas"

function registro(overrides: Partial<RegistroBano> = {}): RegistroBano {
  return {
    id: "r1",
    operador: "Juan Pérez",
    bano: "Baño #1",
    horaEntrada: "10:00",
    horaLlegada: "10:07",
    fecha: "2026-07-30",
    tiempoMinutos: 7,
    creadoEn: new Date("2026-07-30T10:00:00Z"),
    actualizadoEn: new Date("2026-07-30T10:07:00Z"),
    ...overrides,
  }
}

describe("MOTIVOS_SOLICITUD_BORRADO_BANO", () => {
  it("trae las 6 opciones", () => {
    expect(MOTIVOS_SOLICITUD_BORRADO_BANO).toHaveLength(6)
    expect(MOTIVOS_SOLICITUD_BORRADO_BANO.map((m) => m.value)).toContain("otro")
  })
})

describe("evaluarReglaAutoAprobacion — duplicado_10min", () => {
  it("auto-aprueba si hay otro registro del mismo operador/baño/día a 10 min o menos", () => {
    const objetivo = registro({ id: "r1", horaEntrada: "10:00" })
    const relacionado = registro({ id: "r2", horaEntrada: "10:10" })
    const resultado = evaluarReglaAutoAprobacion(
      objetivo,
      [objetivo, relacionado],
      new Date("2026-07-30T14:00:00Z")
    )
    expect(resultado).toBe("duplicado_10min")
  })

  it("no aplica si el otro registro está a más de 10 min", () => {
    const objetivo = registro({ id: "r1", horaEntrada: "10:00" })
    const lejano = registro({ id: "r2", horaEntrada: "10:11" })
    const resultado = evaluarReglaAutoAprobacion(
      objetivo,
      [objetivo, lejano],
      new Date("2026-07-30T14:00:00Z")
    )
    expect(resultado).toBeNull()
  })

  it("ignora el propio registro al buscar duplicados", () => {
    const objetivo = registro({ id: "r1", horaEntrada: "10:00" })
    const resultado = evaluarReglaAutoAprobacion(
      objetivo,
      [objetivo],
      new Date("2026-07-30T14:00:00Z")
    )
    expect(resultado).toBeNull()
  })
})

describe("evaluarReglaAutoAprobacion — arrepentimiento_2min", () => {
  it("auto-aprueba si la solicitud se crea dentro de los 2 minutos de creadoEn", () => {
    const objetivo = registro({ creadoEn: new Date("2026-07-30T10:00:00Z") })
    const resultado = evaluarReglaAutoAprobacion(
      objetivo,
      [objetivo],
      new Date("2026-07-30T10:01:30Z")
    )
    expect(resultado).toBe("arrepentimiento_2min")
  })

  it("no aplica si pasaron más de 2 minutos y no hay duplicado", () => {
    const objetivo = registro({ creadoEn: new Date("2026-07-30T10:00:00Z") })
    const resultado = evaluarReglaAutoAprobacion(
      objetivo,
      [objetivo],
      new Date("2026-07-30T10:05:00Z")
    )
    expect(resultado).toBeNull()
  })
})

describe("construirResumenRegistro", () => {
  it("copia solo los campos relevantes para el snapshot", () => {
    const r = registro()
    expect(construirResumenRegistro(r)).toEqual({
      operador: "Juan Pérez",
      bano: "Baño #1",
      fecha: "2026-07-30",
      horaEntrada: "10:00",
      horaLlegada: "10:07",
      tiempoMinutos: 7,
    })
  })
})
