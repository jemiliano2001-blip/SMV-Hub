import { describe, expect, it } from "vitest"
import {
  calcularCantidadSugerida,
  calcularObjetivoPar,
  calcularTotalesPedidoEndmills,
  clasificarStockEndmill,
  redondearUSD,
} from "@/lib/endmills-calculos"
import { PartidaPedidoEndmillsSchema, PedidoEndmillsSchema } from "@/lib/schemas"

describe("cálculos de Endmills China", () => {
  it("calcula PAR y sugerido con la fórmula aprobada", () => {
    expect(calcularObjetivoPar(8, 12)).toBe(20)
    expect(calcularCantidadSugerida(20, 7)).toBe(13)
  })

  it("conserva null cuando falta la base histórica", () => {
    expect(calcularObjetivoPar(null, 12)).toBeNull()
    expect(calcularCantidadSugerida(null, 7)).toBeNull()
  })

  it("nunca sugiere cantidades negativas", () => {
    expect(calcularCantidadSugerida(20, 26)).toBe(0)
  })

  it("clasifica sin base, crítico, bajo y ok sin fingir un ROP", () => {
    expect(clasificarStockEndmill(10, null)).toBe("sin_base")
    expect(clasificarStockEndmill(5, 20)).toBe("critico")
    expect(clasificarStockEndmill(6, 20)).toBe("bajo")
    expect(clasificarStockEndmill(20, 20)).toBe("ok")
    expect(clasificarStockEndmill(0, 0)).toBe("ok")
  })

  it("redondea subtotales y separa adicionales", () => {
    expect(redondearUSD(4.8529 * 20)).toBe(97.06)
    expect(calcularTotalesPedidoEndmills([
      { cantidadPedida: 20, precioUnitarioUSD: 4.8529 },
      { cantidadPedida: 5, precioUnitarioUSD: 7.35 },
      { cantidadPedida: 0, precioUnitarioUSD: 999 },
    ], 40, 198)).toEqual({
      costoItemsUSD: 133.81,
      aliCostUSD: 40,
      shippingUSD: 198,
      totalUSD: 371.81,
      numeroPartidas: 2,
      numeroPiezas: 25,
    })
  })

  it("rechaza moneda distinta de USD", () => {
    const resultado = PedidoEndmillsSchema.safeParse({
      id: "pedido-1",
      fecha: "2026-08-06",
      numeroProveedor: null,
      estado: "confirmado",
      proveedor: { nombre: "Proveedor", contacto: "Rita", email: "rita@example.com", origen: "China" },
      moneda: "MXN",
      costoItemsUSD: 10,
      aliCostUSD: 0,
      shippingUSD: 0,
      totalUSD: 10,
      costosAdicionalesConfirmados: false,
      numeroPartidas: 1,
      numeroPiezas: 1,
      origen: "manual",
      motivoCancelacion: null,
      creadoPorUid: "u1",
      creadoPorNombre: "Usuario",
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    })
    expect(resultado.success).toBe(false)
  })

  it("rechaza recepción superior a lo pedido", () => {
    const resultado = PartidaPedidoEndmillsSchema.safeParse({
      id: "linea-1",
      pedidoId: "pedido-1",
      fechaPedido: "2026-08-06",
      tipo: "catalogada",
      medidaId: "endmill-001",
      categoria: "FLAT",
      medidaPulgadas: "1/8",
      descripcion: "Endmill",
      spec: "spec",
      stockAntesPedido: 5,
      cantidadPedida: 10,
      cantidadRecibida: 11,
      precioUnitarioUSD: 5,
      subtotalUSD: 50,
      objetivoPar: 15,
      requiereConfirmacionAlCrear: false,
      confirmacionResuelta: true,
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    })
    expect(resultado.success).toBe(false)
  })
})

