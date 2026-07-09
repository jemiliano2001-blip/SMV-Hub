import { describe, expect, it } from "vitest"
import { clasificarAreaComprasSmv } from "@/lib/sat/perfil-compras-smv"

describe("clasificarAreaComprasSmv", () => {
  it("clasifica herramienta de corte como taller div 23/27/31", () => {
    const r = clasificarAreaComprasSmv(
      "1/4 Solid Carbide End Mill",
      "Shars Tool Company"
    )
    expect(r.area).toBe("taller")
    expect(r.divisiones).toEqual(expect.arrayContaining(["23", "31"]))
  })

  it("clasifica barra de acero como taller materiales div 30", () => {
    const r = clasificarAreaComprasSmv("304 Stainless Steel Round Bar 1 inch")
    expect(r.area).toBe("taller")
    expect(r.divisiones).toEqual(expect.arrayContaining(["30"]))
  })

  it("clasifica sensor como automatización div 26/32", () => {
    const r = clasificarAreaComprasSmv(
      "Proximity Sensor 12mm PNP",
      "Automation Direct"
    )
    expect(r.area).toBe("automatizacion")
    expect(r.divisiones).toEqual(expect.arrayContaining(["26", "32"]))
  })

  it("clasifica papel/toner como oficina div 14/41/55", () => {
    const r = clasificarAreaComprasSmv("HP 26A Black Toner Cartridge")
    expect(r.area).toBe("oficina")
    expect(r.divisiones).toEqual(expect.arrayContaining(["14", "55"]))
  })

  it("clasifica copy paper como oficina", () => {
    const r = clasificarAreaComprasSmv("Copy Paper Letter Size 500 sheets")
    expect(r.area).toBe("oficina")
    expect(r.confianza).not.toBe("baja")
  })
})
