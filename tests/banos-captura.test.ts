import { describe, it, expect } from "vitest"
import {
  fechaHoyLocal,
  horaAhoraLocal,
  formatIndicadorCapturaBano,
} from "@/lib/format"
import { resolverOperadorActivo } from "@/lib/banos-captura"
import type { Operador } from "@/lib/schemas"

const AHORA = new Date("2026-07-06T14:52:00")

function makeOperador(overrides: Partial<Operador> = {}): Operador {
  return {
    id: "op-1",
    nombre: "Juan Pérez",
    area: "taller",
    activo: true,
    creadoEn: AHORA,
    actualizadoEn: AHORA,
    ...overrides,
  }
}

describe("fechaHoyLocal", () => {
  it("devuelve YYYY-MM-DD en zona local", () => {
    expect(fechaHoyLocal(AHORA)).toBe("2026-07-06")
  })
})

describe("horaAhoraLocal", () => {
  it("devuelve HH:mm en zona local", () => {
    expect(horaAhoraLocal(AHORA)).toBe("14:52")
  })

  it("rellena con cero a la izquierda", () => {
    const d = new Date("2026-07-06T08:05:00")
    expect(horaAhoraLocal(d)).toBe("08:05")
  })
})

describe("formatIndicadorCapturaBano", () => {
  it("incluye Hoy y la hora", () => {
    const s = formatIndicadorCapturaBano(AHORA)
    expect(s).toMatch(/^Hoy, /)
    expect(s).toContain("14:52")
  })
})

describe("resolverOperadorActivo", () => {
  const ops = [makeOperador(), makeOperador({ id: "op-2", nombre: "María López" })]

  it("encuentra por nombre exacto", () => {
    expect(resolverOperadorActivo("Juan Pérez", ops)?.id).toBe("op-1")
  })

  it("ignora espacios alrededor", () => {
    expect(resolverOperadorActivo("  Juan Pérez  ", ops)?.id).toBe("op-1")
  })

  it("null si no existe", () => {
    expect(resolverOperadorActivo("Fantasma", ops)).toBeNull()
  })

  it("null si nombre vacío", () => {
    expect(resolverOperadorActivo("   ", ops)).toBeNull()
  })
})
