import { describe, expect, it } from "vitest"
import { mergeNotificacionesConLeidas } from "@/lib/notificaciones"
import {
  armarFilasNotificaciones,
  generarCSVNotificaciones,
  COLUMNAS_EXCEL_NOTIFICACIONES,
} from "@/lib/notificaciones-export"
import type { Notificacion, NotificacionConLeida } from "@/lib/schemas"

describe("notificaciones descarte y export", () => {
  const fecha = new Date(2026, 7, 28, 11, 0, 0)
  const mockNotificaciones: Notificacion[] = [
    {
      id: "notif-1",
      tipo: "pedido_almacen_creado",
      titulo: "Nuevo pedido de almacén",
      cuerpo: "Se solicitó cortador 1/2",
      origenModulo: "pedidos-almacen",
      origenId: "ped-1",
      audiencia: "pedidos-almacen",
      destinatarioUid: null,
      href: "/pedidos-almacen",
      creadoPorUid: "uid-operador",
      creadoPorNombre: "Operador Taller",
      creadoEn: fecha,
      actualizadoEn: fecha,
    },
    {
      id: "notif-2",
      tipo: "endmills_stock_critico",
      titulo: "Stock crítico de Endmill",
      cuerpo: "1/4 4F ALTIN bajo mínimo",
      origenModulo: "endmills",
      origenId: "med-1",
      audiencia: "endmills",
      destinatarioUid: null,
      href: "/endmills",
      creadoPorUid: "uid-compras",
      creadoPorNombre: "Compras",
      creadoEn: fecha,
      actualizadoEn: fecha,
    },
    {
      id: "notif-3",
      tipo: "requisicion_creada",
      titulo: "Nueva requisición",
      cuerpo: "Tornillos M6",
      origenModulo: "requisiciones",
      origenId: "req-1",
      audiencia: "requisiciones",
      destinatarioUid: null,
      href: "/requisiciones",
      creadoPorUid: "uid-diseno",
      creadoPorNombre: "Diseño",
      creadoEn: fecha,
      actualizadoEn: fecha,
    },
  ]

  it("mergeNotificacionesConLeidas filtra notificaciones descartadas", () => {
    const leidas = new Set(["notif-1"])
    const descartadas = new Set(["notif-2"])

    const resultado = mergeNotificacionesConLeidas(mockNotificaciones, leidas, descartadas)
    expect(resultado).toHaveLength(2)
    expect(resultado.map((n) => n.id)).toEqual(["notif-1", "notif-3"])
    expect(resultado[0].leida).toBe(true)
    expect(resultado[1].leida).toBe(false)
  })

  it("exporta notificaciones a CSV", () => {
    const items: NotificacionConLeida[] = [
      {
        ...mockNotificaciones[0],
        leida: true,
      },
    ]

    expect(COLUMNAS_EXCEL_NOTIFICACIONES.length).toBeGreaterThan(5)
    const filas = armarFilasNotificaciones(items)
    expect(filas).toHaveLength(1)
    expect(filas[0][1]).toBe("Nuevo pedido de almacén")
    expect(filas[0][5]).toBe("LEÍDA")

    const csv = generarCSVNotificaciones(items)
    expect(csv).toContain('"Nuevo pedido de almacén"')
    expect(csv).toContain('"pedidos-almacen"')
  })
})
