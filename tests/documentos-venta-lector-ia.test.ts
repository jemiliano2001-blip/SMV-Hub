import { describe, it, expect, vi, afterEach } from "vitest"
import {
  resolverModeloExtraccionCliente,
  MODELO_ORDENES_CLIENTE_DEFAULT,
  OrdenCompraClienteExtraidaSchema,
  extraerOrdenCompraClienteIA,
  emparejarConVentasOdoo,
  type OrdenCompraClienteExtraida,
} from "@/lib/documentos-venta-lector-ia"
import { ErrorIA } from "@/lib/extraer-ia"
import type { VentaOdooSo } from "@/lib/schemas"

describe("resolverModeloExtraccionCliente", () => {
  const originalEnv = process.env.GEMINI_MODEL_CLIENTE_PO

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.GEMINI_MODEL_CLIENTE_PO
    } else {
      process.env.GEMINI_MODEL_CLIENTE_PO = originalEnv
    }
  })

  it("devuelve gemini-3.7-flash por defecto", () => {
    delete process.env.GEMINI_MODEL_CLIENTE_PO
    expect(resolverModeloExtraccionCliente()).toBe(MODELO_ORDENES_CLIENTE_DEFAULT)
    expect(resolverModeloExtraccionCliente()).toBe("gemini-3.7-flash")
  })

  it("respeta override de GEMINI_MODEL_CLIENTE_PO", () => {
    process.env.GEMINI_MODEL_CLIENTE_PO = "gemini-3.1-pro-preview"
    expect(resolverModeloExtraccionCliente()).toBe("gemini-3.1-pro-preview")
  })
})

describe("OrdenCompraClienteExtraidaSchema", () => {
  it("valida correctamente una orden de compra completa", () => {
    const raw = {
      numeroOrdenCompraCliente: "PO-2026-9901",
      nombreCliente: "Suprajit Automotive Mexico",
      rfcCliente: "SAM120304AA1",
      fechaOrden: "2026-08-10",
      fechaEntregaRequerida: "2026-08-25",
      moneda: "USD",
      subtotal: 1500.0,
      impuestos: 240.0,
      total: 1740.0,
      partidas: [
        {
          numeroLinea: 1,
          numeroParteCliente: "SUP-BUSH-01",
          descripcion: "Bushing de bronce maquinado CNC",
          cantidad: 100,
          unidad: "PZA",
          precioUnitario: 15.0,
          total: 1500.0,
        },
      ],
    }

    const parsed = OrdenCompraClienteExtraidaSchema.parse(raw)
    expect(parsed.numeroOrdenCompraCliente).toBe("PO-2026-9901")
    expect(parsed.partidas).toHaveLength(1)
    expect(parsed.partidas[0].cantidad).toBe(100)
  })

  it("falla si no contiene partidas", () => {
    const raw = {
      numeroOrdenCompraCliente: "PO-123",
      nombreCliente: "Cliente X",
      partidas: [],
    }
    expect(() => OrdenCompraClienteExtraidaSchema.parse(raw)).toThrow()
  })
})

describe("extraerOrdenCompraClienteIA", () => {
  it("extrae la orden usando Gemini 3.7 y procesa el JSON de respuesta", async () => {
    const mockGeminiJson = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  numeroOrdenCompraCliente: "4500123987",
                  nombreCliente: "Schneider Electric",
                  rfcCliente: "SEM950201ABC",
                  fechaOrden: "2026-08-12",
                  fechaEntregaRequerida: "2026-08-30",
                  moneda: "USD",
                  subtotal: 3200,
                  impuestos: 0,
                  total: 3200,
                  partidas: [
                    {
                      numeroLinea: 1,
                      numeroParteCliente: "SCH-PLT-44",
                      descripcion: "Placa base aluminio 6061 con anodizado natural",
                      cantidad: 20,
                      unidad: "PZA",
                      precioUnitario: 160,
                      total: 3200,
                    },
                  ],
                  terminosEntrega: "FOB Monterrey",
                  confianzaExtraccion: 0.95,
                }),
              },
            ],
          },
        },
      ],
    }

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockGeminiJson,
    } as unknown as Response)

    const resultado = await extraerOrdenCompraClienteIA("base64fake", "application/pdf", {
      apiKey: "fake-key",
      fetchFn: mockFetch as unknown as typeof fetch,
    })

    expect(resultado.numeroOrdenCompraCliente).toBe("4500123987")
    expect(resultado.nombreCliente).toBe("Schneider Electric")
    expect(resultado.partidas).toHaveLength(1)
    expect(resultado.partidas[0].precioUnitario).toBe(160)
  })

  it("lanza ErrorIA cuando la API de Gemini falla", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    } as unknown as Response)

    await expect(
      extraerOrdenCompraClienteIA("base64fake", "application/pdf", {
        apiKey: "fake-key",
        fetchFn: mockFetch as unknown as typeof fetch,
      })
    ).rejects.toThrow(ErrorIA)
  })
})

describe("emparejarConVentasOdoo", () => {
  const ordenCliente: OrdenCompraClienteExtraida = {
    numeroOrdenCompraCliente: "PO-450098",
    nombreCliente: "Suprajit Automotive",
    rfcCliente: "",
    fechaOrden: "2026-08-15",
    fechaEntregaRequerida: "2026-08-28",
    moneda: "USD",
    subtotal: 1000,
    impuestos: 160,
    total: 1160,
    partidas: [
      {
        numeroLinea: 1,
        numeroParteCliente: "SUP-PIN-01",
        descripcion: "Perno expulsor rectificado D8x120",
        cantidad: 50,
        unidad: "PZA",
        precioUnitario: 20,
        total: 1000,
        fechaEntregaRequerida: "2026-08-28",
      },
    ],
    terminosEntrega: "",
    notasEspeciales: "",
    confianzaExtraccion: 0.95,
  }

  const mockSos: VentaOdooSo[] = [
    {
      id: "so-1",
      odooId: 101,
      name: "SO/2026/0412",
      partnerId: 88,
      partnerName: "Suprajit Automotive Mexico",
      clientOrderRef: "PO-450098",
      ordenCompra: "PO-450098",
      dateOrder: "2026-08-15",
      state: "sale",
      invoiceStatus: "to invoice",
      remisiones: [],
      lineas: [
        {
          odooLineId: 501,
          productName: "Perno D8x120",
          productDefaultCode: "SUP-PIN-01",
          qtyOrdered: 50,
          qtyDelivered: 50,
          qtyPending: 50,
        },
      ],
      sincronizadoEn: new Date(),
    },
    {
      id: "so-2",
      odooId: 102,
      name: "SO/2026/0413",
      partnerId: 99,
      partnerName: "BorgWarner",
      clientOrderRef: "BW-9912",
      ordenCompra: "BW-9912",
      dateOrder: "2026-08-16",
      state: "sale",
      invoiceStatus: "to invoice",
      remisiones: [],
      lineas: [],
      sincronizadoEn: new Date(),
    },
  ]

  it("encuentra la orden de venta correcta con score alto y sugiere partidas", () => {
    const matches = emparejarConVentasOdoo(ordenCliente, mockSos)

    expect(matches.length).toBeGreaterThanOrEqual(1)
    expect(matches[0].so.odooId).toBe(101)
    expect(matches[0].scoreCoincidencia).toBeGreaterThanOrEqual(80)
    expect(matches[0].partidasSugeridas).toHaveLength(1)
    expect(matches[0].partidasSugeridas[0].odooLineId).toBe(501)
    expect(matches[0].partidasSugeridas[0].qtySolicitada).toBe(50)
  })
})
