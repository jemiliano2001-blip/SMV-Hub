import { describe, it, expect } from "vitest"
import { fechaHoyLocal, parseFechaLocal } from "@/lib/format"

describe("parseFechaLocal", () => {
  it("parsea YYYY-MM-DD a medianoche local, no UTC", () => {
    const d = parseFechaLocal("2026-08-01")
    expect(d).not.toBeNull()
    expect(d?.getFullYear()).toBe(2026)
    expect(d?.getMonth()).toBe(7) // agosto
    expect(d?.getDate()).toBe(1)
    expect(d?.getHours()).toBe(0)
  })

  it("no se corre un día hacia atrás como lo hace new Date(string)", () => {
    // `new Date("2026-08-01")` es medianoche UTC: en cualquier zona al oeste de
    // Greenwich cae el 31 de julio. Este helper existe justo para evitar eso.
    const local = parseFechaLocal("2026-08-01")
    expect(fechaHoyLocal(local as Date)).toBe("2026-08-01")
  })

  it("es el inverso exacto de fechaHoyLocal", () => {
    for (const fecha of ["2026-01-01", "2026-06-15", "2026-12-31"]) {
      expect(fechaHoyLocal(parseFechaLocal(fecha) as Date)).toBe(fecha)
    }
  })

  it("devuelve null para entradas vacías o con formato inesperado", () => {
    expect(parseFechaLocal(null)).toBeNull()
    expect(parseFechaLocal(undefined)).toBeNull()
    expect(parseFechaLocal("")).toBeNull()
    expect(parseFechaLocal("01/08/2026")).toBeNull()
    expect(parseFechaLocal("2026-08-01T10:00:00Z")).toBeNull()
  })
})
