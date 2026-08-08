import { describe, expect, it } from "vitest"
import {
  calcularCantidadSugerida,
  calcularLeadTimePromedio,
  calcularObjetivoPar,
  calcularTotalesPedidoEndmills,
  clasificarStockEndmill,
  diferenciaEnDias,
  generarTextoWeChat,
  redondearUSD,
} from "@/lib/endmills-calculos"
import { EndmillMedidaSchema, PartidaPedidoEndmillsSchema, PedidoEndmillsSchema } from "@/lib/schemas"

function medidaDePrueba(id: string, medidaPulgadas: string, descripcion: string) {
  return EndmillMedidaSchema.parse({
    id,
    orden: 1,
    categoria: "FLAT",
    medidaPulgadas,
    descripcion,
    stockActual: 2,
    stockActualizadoEn: new Date(),
    precioActualUSD: 5.5,
    cotizacionFecha: "2026-08-01",
    specPropuesta: `D${medidaPulgadas}*FL3/4`,
    requiereConfirmacion: false,
    notas: null,
    objetivoPar: 10,
    ultimoPedidoId: null,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  })
}

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

  it("calcula diferencia en días y lead time promedio correctamente", () => {
    expect(diferenciaEnDias("2026-08-01", "2026-08-25")).toBe(24)
    expect(diferenciaEnDias("2026-08-10", "2026-08-10")).toBe(0)
    // Un rango invertido o una fecha inválida es error de captura, no cero.
    expect(diferenciaEnDias("2026-08-25", "2026-08-01")).toBeNull()
    expect(diferenciaEnDias("no-es-fecha", "2026-08-01")).toBeNull()
    expect(diferenciaEnDias("2026-08-01", "")).toBeNull()

    const pedidos = [
      { estado: "recibido", diasLeadTime: 20 },
      { estado: "recibido", diasLeadTime: 30 },
      { estado: "confirmado", diasLeadTime: null },
    ]
    expect(calcularLeadTimePromedio(pedidos)).toBe(25)
  })

  it("generación de texto para WeChat / WhatsApp contiene cantidades y montos", () => {
    const medida = medidaDePrueba("m-1", "1/4", "FLAT 4 FILOS 1/4")
    const texto = generarTextoWeChat([medida], { "m-1": { cantidad: 8, precio: 5.5 } })
    expect(texto).toContain("1/4")
    expect(texto).toContain("Qty: 8 pcs")
    expect(texto).toContain("$44.00 USD")
  })

  it("el texto para WeChat numera y cuenta solo las partidas con cantidad", () => {
    const texto = generarTextoWeChat(
      [
        medidaDePrueba("m-1", "1/4", "FLAT 1/4"),
        medidaDePrueba("m-2", "3/8", "FLAT 3/8"), // sin cantidad: no se pide
        medidaDePrueba("m-3", "1/2", "FLAT 1/2"),
      ],
      {
        "m-1": { cantidad: 8, precio: 5.5 },
        "m-2": { cantidad: 0, precio: 6.25 },
        "m-3": { cantidad: 2, precio: 10 },
      }
    )

    // La numeración va corrida (1, 2), sin saltarse por la partida excluida.
    expect(texto).toContain("1. 1/4\" FLAT 1/4")
    expect(texto).toContain("2. 1/2\" FLAT 1/2")
    expect(texto).not.toContain("FLAT 3/8")
    expect(texto).not.toContain("3. ")
    // Y los totales cuentan lo que realmente se pide, no la selección completa.
    expect(texto).toContain("Total Items: 2 | Total Pieces: 10")
    expect(texto).toContain("Estimated Total: $64.00 USD")
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

