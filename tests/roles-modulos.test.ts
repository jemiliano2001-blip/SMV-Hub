import { describe, it, expect } from "vitest"
import {
  esMatrizPersonalizada,
  esSuperAdminDesdeUsuarioLegacy,
  modulosDePlantilla,
  modulosDesdeUsuarioLegacy,
  plantillaDesdeUsuarioLegacy,
  tieneModulo,
  tienePermiso,
  tienePermisoPorRol,
} from "@/lib/roles"

describe("modulosDePlantilla", () => {
  it("admin incluye finanzas, usuarios y almacen", () => {
    const m = modulosDePlantilla("admin")
    expect(m).toContain("finanzas")
    expect(m).toContain("usuarios")
    expect(m).toContain("almacen")
  })

  it("compras incluye almacen y nueva-compra, sin finanzas", () => {
    const m = modulosDePlantilla("compras")
    expect(m).toContain("almacen")
    expect(m).toContain("nueva-compra")
    expect(m).not.toContain("finanzas")
    expect(m).not.toContain("usuarios")
  })

  it("almacen tiene entradas/salidas y pedidos, sin compras ni finanzas", () => {
    const m = modulosDePlantilla("almacen")
    expect(m).toContain("almacen")
    expect(m).toContain("pedidos-almacen")
    expect(m).not.toContain("nueva-compra")
    expect(m).not.toContain("finanzas")
  })

  it("diseno es mínimo", () => {
    expect(modulosDePlantilla("diseno")).toEqual([
      "cotizaciones",
      "requisiciones",
      "horas-extra",
    ])
  })
})

describe("tienePermiso (por módulos)", () => {
  it("null → false", () => {
    expect(tienePermiso(null, "/ordenes")).toBe(false)
  })

  it("home siempre true si hay módulos", () => {
    expect(tienePermiso(["almacen"], "/")).toBe(true)
  })

  it("ruta exacta y subruta", () => {
    const m = modulosDePlantilla("admin")
    expect(tienePermiso(m, "/finanzas")).toBe(true)
    expect(tienePermiso(m, "/finanzas/cobranza")).toBe(true)
  })

  it("almacen plantilla no abre finanzas", () => {
    expect(tienePermiso(modulosDePlantilla("almacen"), "/finanzas")).toBe(false)
  })

  it("compat tienePermisoPorRol", () => {
    expect(tienePermisoPorRol("compras", "/nueva-compra")).toBe(true)
    expect(tienePermisoPorRol("compras", "/ordenes")).toBe(false)
    expect(tienePermisoPorRol(null, "/")).toBe(false)
  })
})

describe("legacy helpers", () => {
  it("modulosDesdeUsuarioLegacy lee modulos[]", () => {
    expect(
      modulosDesdeUsuarioLegacy({ modulos: ["almacen", "banos"], rol: "compras" })
    ).toEqual(["almacen", "banos"])
  })

  it("modulosDesdeUsuarioLegacy deriva de rol si no hay modulos", () => {
    const m = modulosDesdeUsuarioLegacy({ rol: "almacen" })
    expect(m).toContain("almacen")
    expect(m).not.toContain("finanzas")
  })

  it("plantillaDesdeUsuarioLegacy", () => {
    expect(plantillaDesdeUsuarioLegacy({ plantilla: "diseno" })).toBe("diseno")
    expect(plantillaDesdeUsuarioLegacy({ rol: "compras" })).toBe("compras")
    expect(plantillaDesdeUsuarioLegacy({})).toBeNull()
  })

  it("esSuperAdminDesdeUsuarioLegacy", () => {
    expect(esSuperAdminDesdeUsuarioLegacy({ esSuperAdmin: true })).toBe(true)
    expect(esSuperAdminDesdeUsuarioLegacy({ rol: "admin" })).toBe(true)
    expect(esSuperAdminDesdeUsuarioLegacy({ rol: "compras" })).toBe(false)
  })

  it("esMatrizPersonalizada", () => {
    expect(esMatrizPersonalizada("almacen", modulosDePlantilla("almacen"))).toBe(false)
    expect(esMatrizPersonalizada("almacen", ["almacen", "reportes"])).toBe(true)
  })

  it("tieneModulo", () => {
    expect(tieneModulo(["almacen"], "finanzas")).toBe(false)
    expect(tieneModulo(["finanzas"], "finanzas")).toBe(true)
  })
})
