import { describe, it, expect, vi, afterEach } from "vitest"
import {
  investigarPreciosInsumoIA,
  cruzarConHistoricoLocal,
  resolverModeloInvestigacion,
  type ResultadoInvestigacionPrecios,
} from "@/lib/proveedores-investigacion-ia"
import { ErrorIA } from "@/lib/extraer-ia"
import type { CompraOdooItem, OrdenCompra } from "@/lib/schemas"

describe("resolverModeloInvestigacion", () => {
  const originalEnv = process.env.GEMINI_MODEL_INVESTIGACION

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.GEMINI_MODEL_INVESTIGACION
    } else {
      process.env.GEMINI_MODEL_INVESTIGACION = originalEnv
    }
  })

  it("devuelve el modelo default gemini-3.7-flash cuando no hay variable", () => {
    delete process.env.GEMINI_MODEL_INVESTIGACION
    expect(resolverModeloInvestigacion()).toBe("gemini-3.7-flash")
  })

  it("respeta el override de GEMINI_MODEL_INVESTIGACION", () => {
    process.env.GEMINI_MODEL_INVESTIGACION = "gemini-3.1-pro-preview"
    expect(resolverModeloInvestigacion()).toBe("gemini-3.1-pro-preview")
  })
})

describe("investigarPreciosInsumoIA", () => {
  it("procesa la respuesta de Gemini y calcula montos en MXN y USD", async () => {
    const mockGeminiJson = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  concepto: "Endmill 1/2 pulgada 4 filos AlTiN",
                  categoria: "herramientas_corte",
                  especificacionesClave: [
                    "Diámetro: 1/2 pulgada",
                    "Filos: 4",
                    "Recubrimiento: AlTiN",
                    "Material: Carburo sólido",
                  ],
                  rangoPreciosUSD: {
                    min: 24.5,
                    promedio: 38.0,
                    max: 55.0,
                  },
                  opciones: [
                    {
                      proveedor: "Shars Tool",
                      mercado: "USA",
                      skuReferencia: "404-1234",
                      precioEstimadoUSD: 24.5,
                      tiempoEntregaDias: 3,
                      calidadGrado: "Económico de taller",
                      urlBusqueda: "https://shars.com",
                      notas: "Excelente relación costo-beneficio para desbaste.",
                    },
                    {
                      proveedor: "McMaster-Carr",
                      mercado: "USA",
                      skuReferencia: "8888A12",
                      precioEstimadoUSD: 45.0,
                      tiempoEntregaDias: 2,
                      calidadGrado: "Premium industrial",
                      urlBusqueda: "https://mcmaster.com",
                      notas: "Entrega express al día siguiente.",
                    },
                  ],
                  mejorOpcionCosto: "Shars Tool",
                  mejorOpcionTiempo: "McMaster-Carr",
                  recomendacionesTecnicas: "Usar refrigerante soluble con corte en aceros aleados.",
                  alternativasMaterial: ["HSS con recubrimiento TiN para bajas revoluciones"],
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

    const resultado = await investigarPreciosInsumoIA(
      {
        consulta: "Endmill 1/2 4F AlTiN",
        mercado: "usa",
        cantidad: 2,
        tipoCambio: 20.0,
      },
      {
        apiKey: "fake-api-key",
        modelo: "gemini-3.7-flash",
        fetchFn: mockFetch as unknown as typeof fetch,
      }
    )

    expect(resultado.concepto).toBe("Endmill 1/2 pulgada 4 filos AlTiN")
    expect(resultado.categoria).toBe("herramientas_corte")
    expect(resultado.rangoPreciosUSD.min).toBe(24.5)
    expect(resultado.rangoPreciosMXN.min).toBe(490.0) // 24.5 * 20.0
    expect(resultado.rangoPreciosUSD.promedio).toBe(38.0)
    expect(resultado.rangoPreciosMXN.promedio).toBe(760.0) // 38.0 * 20.0
    expect(resultado.opciones).toHaveLength(2)
    expect(resultado.opciones[0].precioEstimadoMXN).toBe(490.0)
    expect(resultado.mejorOpcionCosto).toBe("Shars Tool")
  })

  it("lanza ErrorIA cuando la API de Gemini responde con status de error", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => "Bad Request",
    } as unknown as Response)

    await expect(
      investigarPreciosInsumoIA(
        { consulta: "Placa 6061" },
        { apiKey: "fake-key", fetchFn: mockFetch as unknown as typeof fetch }
      )
    ).rejects.toThrow(ErrorIA)
  })
})

describe("cruzarConHistoricoLocal", () => {
  const baseInvestigacion: ResultadoInvestigacionPrecios = {
    concepto: "Placa de aluminio 6061-T6",
    categoria: "metales",
    especificacionesClave: ["Aleación 6061-T6", "Espesor 1/2 pulgada"],
    rangoPreciosUSD: { min: 40, promedio: 55, max: 70 },
    rangoPreciosMXN: { min: 800, promedio: 1100, max: 1400 },
    opciones: [
      {
        proveedor: "OnlineMetals",
        mercado: "USA",
        skuReferencia: "",
        precioEstimadoUSD: 48,
        precioEstimadoMXN: 960,
        tiempoEntregaDias: 4,
        calidadGrado: "Estándar industrial",
        urlBusqueda: "",
        notas: "",
      },
    ],
    mejorOpcionCosto: "OnlineMetals",
    mejorOpcionTiempo: "OnlineMetals",
    recomendacionesTecnicas: "Corte con disco para no templar orillas.",
    alternativasMaterial: ["Aluminio 7075 para mayor resistencia"],
  }

  it("encuentra coincidencia en ítems de Odoo", () => {
    const itemsOdoo = [
      {
        id: "odoo-1",
        llaveItem: "odoo-po-44-1",
        fuente: "po" as const,
        odooDocId: 412,
        odooLineId: 1,
        referenciaDoc: "PO00412",
        origenPo: null,
        descripcion: "Placa Aluminio 6061-T6 1/2x12x24",
        cantidad: 1,
        precioUnitario: 950,
        subtotal: 950,
        moneda: "MXN",
        fecha: "2026-06-15",
        odooPartnerId: 44,
        proveedorNombre: "Aceros y Metales Murillo",
        productOdooId: null,
        claveProdServ: "30102400",
        satPendiente: false,
        categoriaId: "metales",
        tipoMetal: "Aluminio",
        tipoInsumo: null,
        medida: "1/2x12x24",
        unidad: "Pza",
        esRfq: false,
        origen: "odoo" as const,
        odooCategoria: "Metales / Aluminio",
        odooUom: "Pza",
        odooCostoEstandar: null,
        odooRefInterna: null,
        clasificadoPorIa: false,
        sincronizadoEn: new Date(),
        creadoEn: new Date(),
        actualizadoEn: new Date(),
      },
    ] as CompraOdooItem[]

    const resultado = cruzarConHistoricoLocal(baseInvestigacion, [], itemsOdoo, 20.0)

    expect(resultado.coincidenciaHistorica).toBeDefined()
    expect(resultado.coincidenciaHistorica?.encontrado).toBe(true)
    expect(resultado.coincidenciaHistorica?.fuente).toBe("odoo")
    expect(resultado.coincidenciaHistorica?.proveedor).toBe("Aceros y Metales Murillo")
    expect(resultado.coincidenciaHistorica?.precioUltimoMXN).toBe(950)
    expect(resultado.coincidenciaHistorica?.precioUltimoUSD).toBe(47.5)
  })

  it("encuentra coincidencia en órdenes de compras americanas", () => {
    const ordenes = [
      {
        id: "ord-1",
        proveedor: "McMaster-Carr",
        numeroFactura: "991234",
        fechaFactura: "2026-05-10",
        moneda: "USD",
        items: [
          {
            descripcion: "Aluminum 6061-T6 Plate 1/2 Thick",
            descripcionSimplificada: "Placa aluminio 6061",
            cantidad: 2,
            precioUnitario: 52.0,
            total: 104.0,
            claveProdServ: "30102400",
            satPendiente: false,
            empresa: "SMV",
            cuentaCargo: "Stock",
            requisitor: "Antonio",
            ordenTrabajo: "",
          },
        ],
        subtotal: 104.0,
        total: 104.0,
      },
    ] as unknown as OrdenCompra[]

    const resultado = cruzarConHistoricoLocal(baseInvestigacion, ordenes, [], 20.0)

    expect(resultado.coincidenciaHistorica).toBeDefined()
    expect(resultado.coincidenciaHistorica?.encontrado).toBe(true)
    expect(resultado.coincidenciaHistorica?.fuente).toBe("compras_americanas")
    expect(resultado.coincidenciaHistorica?.proveedor).toBe("McMaster-Carr")
    expect(resultado.coincidenciaHistorica?.precioUltimoUSD).toBe(52.0)
    expect(resultado.coincidenciaHistorica?.precioUltimoMXN).toBe(1040.0)
  })

  it("selecciona la compra más reciente entre múltiples coincidencias", () => {
    const itemsOdoo = [
      {
        id: "odoo-viejo",
        descripcion: "Placa Aluminio 6061-T6 1/2x12x24",
        cantidad: 1,
        precioUnitario: 800,
        moneda: "MXN",
        fecha: "2026-01-10",
        proveedorNombre: "Distribuidor Antiguo",
      },
      {
        id: "odoo-reciente",
        descripcion: "Placa Aluminio 6061-T6 1/2x12x24",
        cantidad: 1,
        precioUnitario: 1000,
        moneda: "MXN",
        fecha: "2026-08-01",
        proveedorNombre: "Distribuidor Reciente",
      },
    ] as unknown as CompraOdooItem[]

    const resultado = cruzarConHistoricoLocal(baseInvestigacion, [], itemsOdoo, 20.0)

    expect(resultado.coincidenciaHistorica?.proveedor).toBe("Distribuidor Reciente")
    expect(resultado.coincidenciaHistorica?.fechaUltimaCompra).toBe("2026-08-01")
    expect(resultado.coincidenciaHistorica?.precioUltimoMXN).toBe(1000)
    expect(resultado.coincidenciaHistorica?.precioUltimoUSD).toBe(50.0)
  })
})
