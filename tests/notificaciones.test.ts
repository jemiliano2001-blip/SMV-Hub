import { describe, it, expect } from "vitest"
import { NotificacionSchema, TipoNotificacionSchema } from "@/lib/schemas"
import {
  contarNoLeidas,
  mergeNotificacionesConLeidas,
  ordenarParaDropdown,
  tituloParaTipo,
} from "@/lib/notificaciones"
import type { Notificacion } from "@/lib/schemas"

function fakeNotif(partial: Partial<Notificacion> & Pick<Notificacion, "id" | "tipo">): Notificacion {
  const ahora = new Date("2026-07-30T12:00:00Z")
  return {
    titulo: tituloParaTipo(partial.tipo),
    cuerpo: "detalle",
    origenModulo: partial.tipo.startsWith("pedido") ? "pedidos-almacen" : "requisiciones",
    origenId: "abc",
    href: "/pedidos-almacen",
    creadoEn: ahora,
    actualizadoEn: ahora,
    creadoPorUid: "u1",
    creadoPorNombre: "Test",
    ...partial,
  }
}

describe("TipoNotificacionSchema", () => {
  it("acepta los 4 tipos v1", () => {
    for (const t of [
      "pedido_almacen_creado",
      "pedido_almacen_estado",
      "requisicion_creada",
      "requisicion_estado",
    ]) {
      expect(TipoNotificacionSchema.parse(t)).toBe(t)
    }
  })
})

describe("NotificacionSchema", () => {
  it("valida un documento completo", () => {
    const n = fakeNotif({ id: "n1", tipo: "pedido_almacen_creado" })
    expect(NotificacionSchema.parse(n).id).toBe("n1")
  })
})

describe("tituloParaTipo", () => {
  it("devuelve títulos legibles", () => {
    expect(tituloParaTipo("pedido_almacen_creado")).toBe("Nuevo pedido de almacén")
    expect(tituloParaTipo("requisicion_estado")).toBe("Requisición actualizada")
  })

  it("devuelve títulos legibles para los tipos de baños", () => {
    expect(tituloParaTipo("banos_solicitud_creada")).toBe("Nueva solicitud de eliminación de registro de baño")
    expect(tituloParaTipo("banos_solicitud_resuelta")).toBe("Solicitud de eliminación de baño resuelta")
  })
})

describe("merge y conteo", () => {
  it("marca leídas según el set", () => {
    const lista = [
      fakeNotif({ id: "a", tipo: "pedido_almacen_creado" }),
      fakeNotif({ id: "b", tipo: "requisicion_creada" }),
    ]
    const merged = mergeNotificacionesConLeidas(lista, new Set(["a"]))
    expect(merged[0].leida).toBe(true)
    expect(merged[1].leida).toBe(false)
    expect(contarNoLeidas(merged)).toBe(1)
  })

  it("ordenarParaDropdown pone no leídas primero", () => {
    const vieja = fakeNotif({
      id: "old",
      tipo: "pedido_almacen_creado",
      creadoEn: new Date("2026-07-01T00:00:00Z"),
      actualizadoEn: new Date("2026-07-01T00:00:00Z"),
    })
    const nuevaLeida = fakeNotif({
      id: "new",
      tipo: "requisicion_creada",
      creadoEn: new Date("2026-07-29T00:00:00Z"),
      actualizadoEn: new Date("2026-07-29T00:00:00Z"),
    })
    const merged = mergeNotificacionesConLeidas([nuevaLeida, vieja], new Set(["new"]))
    const orden = ordenarParaDropdown(merged)
    expect(orden[0].id).toBe("old")
    expect(orden[1].id).toBe("new")
  })
})
