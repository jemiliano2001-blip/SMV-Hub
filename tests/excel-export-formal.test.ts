import { describe, it, expect } from "vitest"
import {
  construirWorkbookFormal,
  generarBufferExcelFormal,
  fechaIso,
} from "@/lib/excel-export-base"
import { generarExcelReporteCompras } from "@/lib/reportes-compras-export"
import { generarExcelReporteFinanzas } from "@/lib/finanzas-reportes-export"
import { generarExcelReporteCaja } from "@/lib/caja-chica-export"
import {
  generarExcelResumenHorasExtra,
  generarExcelDetalleHorasExtra,
} from "@/lib/horas-extra-export"
import { generarExcelPresupuestoInsumos } from "@/lib/presupuesto-insumos-export"
import { generarExcelPOEndmills } from "@/lib/endmills-export"
import type { Linea } from "@/lib/reportes"
import type { FacturaCliente, MovimientoCajaChica, HorasExtra } from "@/lib/schemas"
import type { EmpleadoResumen } from "@/lib/horas-extra-resumen"

describe("excel-export-base", () => {
  it("fechaIso formatea cadenas y fechas válidas", () => {
    expect(fechaIso("2026-08-25T14:30:00Z")).toBe("2026-08-25")
    expect(fechaIso("2026-01-05")).toBe("2026-01-05")
    expect(fechaIso(undefined)).toBe("—")
    expect(fechaIso(null)).toBe("—")
  })

  it("construye un workbook formal con membrete y estilos", async () => {
    const wb = await construirWorkbookFormal({
      nombreHoja: "Test",
      titulo: "Prueba de Documento",
      subtitulo: "Periodo Agosto 2026",
      columnas: [
        { header: "Código", width: 10, align: "center" },
        { header: "Descripción", width: 30, align: "left" },
        { header: "Monto", width: 15, align: "right", numFmt: "$#,##0.00" },
      ],
      filas: [
        ["A001", "Tornillo Allen", 45.5],
        ["A002", "Broca Carburo", 120.0],
      ],
      totales: {
        labelColSpan: 2,
        label: "TOTAL",
        valores: [{ colIndex: 3, valor: 165.5, numFmt: "$#,##0.00" }],
      },
    })

    const ws = wb.getWorksheet("Test")
    expect(ws).toBeDefined()
    expect(ws?.getCell("A1").value).toBe("SMV Maquinados — Prueba de Documento")
    expect(ws?.getCell("A2").value).toContain("Periodo Agosto 2026")
    // Header row is row 4
    expect(ws?.getCell("A4").value).toBe("Código")
    expect(ws?.getCell("B4").value).toBe("Descripción")
    expect(ws?.getCell("C4").value).toBe("Monto")
    // Data rows are 5 and 6
    expect(ws?.getCell("A5").value).toBe("A001")
    expect(ws?.getCell("C5").value).toBe(45.5)
    // Total row is row 7
    expect(ws?.getCell("A7").value).toBe("TOTAL")
    expect(ws?.getCell("C7").value).toBe(165.5)
  })

  it("genera un buffer binario no vacío", async () => {
    const buffer = await generarBufferExcelFormal({
      nombreHoja: "Test Buffer",
      titulo: "Buffer Test",
      columnas: [{ header: "Item", width: 20 }],
      filas: [["Item 1"]],
    })

    expect(buffer).toBeDefined()
    expect(buffer.byteLength).toBeGreaterThan(1000)
  })
})

describe("reportes-compras-export", () => {
  it("genera excel formal de compras con totales", async () => {
    const mockLineas: Linea[] = [
      {
        dia: new Date("2026-08-01T00:00:00Z"),
        ordenId: "ORD-1",
        itemIndex: 0,
        referencia: "INV-100",
        proveedor: "McMaster-Carr",
        descripcion: "End Mill 1/2 Carbide",
        cantidad: 4,
        precioUnitario: 35.5,
        subtotal: 142.0,
        total: 142.0,
        moneda: "USD",
        requisitor: "Carlos",
        cuentaCargo: "Taller",
        destino: "SMV",
      },
    ]

    const buffer = await generarExcelReporteCompras({
      lineas: mockLineas,
      subtitulo: "Agosto 2026",
      moneda: "USD",
    })

    expect(buffer.byteLength).toBeGreaterThan(1000)
  })
})

describe("finanzas-reportes-export", () => {
  it("genera excel formal de finanzas", async () => {
    const mockFacturas = [
      {
        id: "fac-1",
        cliente: "Cliente Industrial Monterrey",
        numeroFactura: "FAC-991",
        tipo: "factura",
        fechaFactura: "2026-08-10",
        fechaVencimiento: "2026-09-10",
        moneda: "MXN",
        subtotal: 10000,
        impuestos: 1600,
        total: 11600,
        saldoPendiente: 0,
        estadoPago: "pagado",
        estado: "publicado",
      },
    ] as unknown as FacturaCliente[]

    const buffer = await generarExcelReporteFinanzas({
      facturas: mockFacturas,
      periodoLabel: "Mes Actual",
      moneda: "MXN",
    })

    expect(buffer.byteLength).toBeGreaterThan(1000)
  })
})

describe("caja-chica-export", () => {
  it("genera excel formal de caja chica", async () => {
    const mockMovs = [
      {
        id: "mov-1",
        fecha: "2026-08-15",
        descripcion: "Gasolina para entrega de maquinados",
        proveedor: "OXXO Gas",
        categoria: "Combustible",
        comprobante: "FACTURA",
        monto: 850.0,
        estadoCorte: "ACTIVO",
        creadoEn: new Date("2026-08-15T10:00:00Z"),
      },
    ] as unknown as MovimientoCajaChica[]

    const buffer = await generarExcelReporteCaja({
      movimientos: mockMovs,
      etiquetaModo: "Ciclo Activo",
      conFactura: true,
    })

    expect(buffer.byteLength).toBeGreaterThan(1000)
  })
})

describe("horas-extra-export", () => {
  it("genera excel de resumen y detalle de horas extra", async () => {
    const mockResumen: EmpleadoResumen[] = [
      {
        empleado: "Juan Pérez",
        totalHoras: 16.5,
        semanas: [
          { semanaInicio: "2026-08-03", horas: 8.5 },
          { semanaInicio: "2026-08-10", horas: 8.0 },
        ],
      },
    ]

    const bufferResumen = await generarExcelResumenHorasExtra({
      resumen: mockResumen,
      mes: "2026-08",
      departamentoLabel: "Taller / Tool Room",
    })
    expect(bufferResumen.byteLength).toBeGreaterThan(1000)

    const mockRegistros = [
      {
        id: "he-1",
        departamento: "taller",
        empleado: "Juan Pérez",
        semanaInicio: "2026-08-10",
        lunes: "2.5",
        martes: "2.0",
        miercoles: "0",
        jueves: "0",
        viernes: "0",
        sabado: "0",
        domingo: "0",
        creadoEn: new Date("2026-08-12T18:00:00Z"),
      },
    ] as unknown as HorasExtra[]

    const bufferDetalle = await generarExcelDetalleHorasExtra({
      registros: mockRegistros,
      mes: "2026-08",
      departamentoLabel: "Taller / Tool Room",
    })
    expect(bufferDetalle.byteLength).toBeGreaterThan(1000)
  })
})

describe("presupuesto-insumos-export", () => {
  it("genera excel formal de presupuesto de insumos", async () => {
    const buffer = await generarExcelPresupuestoInsumos({
      partidas: [
        {
          id: "p-1",
          itemId: "item-1",
          descripcion: "Placa Aluminio 6061-T6 1/2x12x24",
          categoriaId: "metales",
          tipoInsumo: "Aluminio 6061",
          medida: "1/2 x 12 x 24 in",
          proveedorNombre: "Alro Metals",
          moneda: "USD",
          precioUnitario: 145.0,
          cantidad: 2,
          subtotal: 290.0,
          subtotalMxn: 5510.0,
          subtotalUsd: 290.0,
        },
      ],
      usdToMxn: 19.0,
      totalMxn: 5510.0,
      totalUsd: 290.0,
    })

    expect(buffer.byteLength).toBeGreaterThan(1000)
  })
})

describe("endmills-export", () => {
  it("genera excel formal de purchase order para endmills", async () => {
    const buffer = await generarExcelPOEndmills({
      partidas: [
        {
          id: "em-1",
          medidaPulgadas: "1/2",
          descripcion: "1/2 Flat 4 Flutes AlTiN",
          specPropuesta: "D12*75L*4T HRC55 AlTiN",
          cantidad: 20,
          precio: 6.8,
          subtotal: 136.0,
        },
      ],
      fecha: "2026-08-25",
      numeroProveedor: "PI-2026-088",
      proveedorNombre: "Rita (ChangZhou North Alloy Tool)",
      itemsSubtotal: 136.0,
      shippingUSD: 45.0,
      aliCostUSD: 12.0,
      totalUSD: 193.0,
    })

    expect(buffer.byteLength).toBeGreaterThan(1000)
  })
})
