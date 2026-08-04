import { describe, it, expect } from "vitest"
import {
  esMatrizPersonalizada,
  esSuperAdminDesdeUsuarioLegacy,
  modulosDePlantilla,
  modulosDesdeUsuarioLegacy,
  plantillaDesdeUsuarioLegacy,
  puedeEditarHorasExtra,
  puedeVerNotificaciones,
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

  it("almacen tiene entradas/salidas, pedidos y notificaciones", () => {
    const m = modulosDePlantilla("almacen")
    expect(m).toContain("almacen")
    expect(m).toContain("pedidos-almacen")
    expect(m).toContain("notificaciones")
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

  it("automatizacion es diseno + notificaciones", () => {
    expect(modulosDePlantilla("automatizacion")).toEqual([
      "cotizaciones",
      "requisiciones",
      "horas-extra",
      "notificaciones",
    ])
  })
})

describe("puedeVerNotificaciones", () => {
  it("true con un módulo de audiencia, pero no con el módulo genérico", () => {
    expect(puedeVerNotificaciones(["notificaciones"])).toBe(false)
    expect(puedeVerNotificaciones(["pedidos-almacen"])).toBe(true)
    expect(puedeVerNotificaciones(["requisiciones"])).toBe(true)
    expect(puedeVerNotificaciones(["documentos-venta"])).toBe(true)
    expect(puedeVerNotificaciones(["banos"])).toBe(true)
    expect(puedeVerNotificaciones(["reportes"])).toBe(false)
    expect(puedeVerNotificaciones(null)).toBe(false)
  })

  it("diseño entra a /notificaciones vía requisiciones", () => {
    expect(tienePermiso(modulosDePlantilla("diseno"), "/notificaciones")).toBe(true)
  })
})

describe("puedeEditarHorasExtra", () => {
  it("admin, compras y automatización editan por plantilla", () => {
    expect(puedeEditarHorasExtra({ plantilla: "admin" })).toBe(true)
    expect(puedeEditarHorasExtra({ plantilla: "compras" })).toBe(true)
    expect(puedeEditarHorasExtra({ plantilla: "automatizacion" })).toBe(true)
  })

  it("diseño y almacén no editan sin flag", () => {
    expect(puedeEditarHorasExtra({ plantilla: "diseno" })).toBe(false)
    expect(puedeEditarHorasExtra({ plantilla: "almacen" })).toBe(false)
  })

  it("el flag editaHorasExtra habilita sin importar plantilla (automatización/contabilidad)", () => {
    expect(puedeEditarHorasExtra({ plantilla: "diseno", editaHorasExtra: true })).toBe(true)
    expect(puedeEditarHorasExtra({ plantilla: "almacen", editaHorasExtra: true })).toBe(true)
  })

  it("super-admin siempre edita", () => {
    expect(puedeEditarHorasExtra({ plantilla: "diseno", esSuperAdmin: true })).toBe(true)
  })

  it("null/undefined → false", () => {
    expect(puedeEditarHorasExtra(null)).toBe(false)
    expect(puedeEditarHorasExtra(undefined)).toBe(false)
    expect(puedeEditarHorasExtra({})).toBe(false)
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
    expect(plantillaDesdeUsuarioLegacy({ plantilla: "automatizacion" })).toBe("automatizacion")
    expect(plantillaDesdeUsuarioLegacy({})).toBeNull()
  })

  it("esSuperAdminDesdeUsuarioLegacy", () => {
    expect(esSuperAdminDesdeUsuarioLegacy({ esSuperAdmin: true })).toBe(true)
    expect(esSuperAdminDesdeUsuarioLegacy({ rol: "admin" })).toBe(true)
    expect(esSuperAdminDesdeUsuarioLegacy({ rol: "compras" })).toBe(false)
    // El booleano explícito manda sobre el fallback legacy: permite revocar
    // super-admin a un usuario con plantilla/rol "admin" (P1 auditoría 2026-07-23).
    expect(esSuperAdminDesdeUsuarioLegacy({ esSuperAdmin: false, rol: "admin" })).toBe(false)
    expect(esSuperAdminDesdeUsuarioLegacy({ esSuperAdmin: false, plantilla: "admin" })).toBe(false)
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
