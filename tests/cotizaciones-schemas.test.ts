import { describe, it, expect } from "vitest"
import {
  CotizacionSchema,
  EstatusCotizacionSchema,
  UbicacionSchema,
} from "@/lib/schemas"

// ── EstatusCotizacionSchema ──────────────────────────────────────────────────

describe("EstatusCotizacionSchema", () => {
  it.each(["cotizado", "cancelado", "revisar"])("acepta '%s'", (e) => {
    expect(EstatusCotizacionSchema.safeParse(e).success).toBe(true)
  })

  it("rechaza estatus desconocido", () => {
    expect(EstatusCotizacionSchema.safeParse("aprobado").success).toBe(false)
  })
})

// ── UbicacionSchema ──────────────────────────────────────────────────────────

describe("UbicacionSchema", () => {
  it.each(["MX", "USA"])("acepta '%s'", (u) => {
    expect(UbicacionSchema.safeParse(u).success).toBe(true)
  })

  it("rechaza ubicación desconocida", () => {
    expect(UbicacionSchema.safeParse("CANADA").success).toBe(false)
  })
})

// ── CotizacionSchema ─────────────────────────────────────────────────────────

describe("CotizacionSchema", () => {
  const OK = {
    id: "abc123",
    solicitante: "Francisco",
    fecha: "2026-06-19",
    estatus: "cotizado" as const,
    ubicacion: "USA" as const,
    proveedor: "Tri-City Tool Parts",
    descripcion: "E110576 Seal Husky C304H",
    numeroParte: "E110576",
    cantidad: 1,
    precioUnitario: 14.24,
    moneda: "USD" as const,
    total: 14.24,
    diasHabiles: "3 - 5 dias",
    link: "https://tricitytoolparts.com/products/e110576",
    notas: "Compresor Husky",
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  }

  it("valida una cotización completa", () => {
    expect(CotizacionSchema.safeParse(OK).success).toBe(true)
  })

  it("asigna estatus 'cotizado' por defecto", () => {
    const sin = { ...OK } as Partial<typeof OK>
    delete sin.estatus
    const r = CotizacionSchema.safeParse(sin)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.estatus).toBe("cotizado")
  })

  it("acepta nulls en campos opcionales (fecha, numeroParte, precios, link, notas)", () => {
    const r = CotizacionSchema.safeParse({
      ...OK,
      fecha: null,
      numeroParte: null,
      cantidad: null,
      precioUnitario: null,
      total: null,
      diasHabiles: null,
      link: null,
      notas: null,
    })
    expect(r.success).toBe(true)
  })

  it("acepta una cotización en MXN (ubicación MX)", () => {
    const r = CotizacionSchema.safeParse({
      ...OK,
      ubicacion: "MX",
      moneda: "MXN",
      precioUnitario: 7535.51,
      total: 7535.51,
    })
    expect(r.success).toBe(true)
  })

  it("rechaza moneda fuera de USD/MXN", () => {
    const r = CotizacionSchema.safeParse({ ...OK, moneda: "EUR" })
    expect(r.success).toBe(false)
  })

  it("rechaza ubicación inválida", () => {
    const r = CotizacionSchema.safeParse({ ...OK, ubicacion: "Texas" })
    expect(r.success).toBe(false)
  })

  it("rechaza creadoEn que no sea Date", () => {
    const r = CotizacionSchema.safeParse({ ...OK, creadoEn: "2026-06-19" })
    expect(r.success).toBe(false)
  })

  it("rechaza precioUnitario no numérico y no null", () => {
    const r = CotizacionSchema.safeParse({ ...OK, precioUnitario: "14.24" })
    expect(r.success).toBe(false)
  })
})
