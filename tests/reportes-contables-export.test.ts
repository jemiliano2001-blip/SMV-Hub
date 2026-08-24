import { describe, expect, it } from "vitest"
import type { Linea } from "@/lib/reportes"
import {
  ANCHOS_COLUMNAS_EXCEL_CONTABLE,
  ENCABEZADOS_EXCEL_CONTABLE,
  FILA_INICIO_TABLA_EXCEL,
  armarFilasExcelContable,
  construirWorkbookExcelContable,
  nombreArchivoExcelContable,
  subtituloContablePrint,
  tituloPdfContable,
  valoresFilaExcelContable,
} from "@/lib/reportes-contables-export"

function linea(partial: Partial<Linea> & Pick<Linea, "ordenId" | "proveedor" | "descripcion" | "total" | "moneda">): Linea {
  return {
    itemIndex: 0,
    referencia: "",
    dia: null,
    descripcionSimplificada: "",
    claveProdServ: "",
    cantidad: null,
    precioUnitario: null,
    subtotal: partial.total,
    requisitor: "",
    cuentaCargo: "",
    destino: "",
    ...partial,
  }
}

describe("armarFilasExcelContable", () => {
  it("incluye factura, moneda y números tipados", () => {
    const filas = armarFilasExcelContable(
      [
        linea({
          ordenId: "o1",
          proveedor: "McMaster",
          descripcion: "Spring long name",
          descripcionSimplificada: "Resorte",
          referencia: "INV-9",
          claveProdServ: "31161904",
          cantidad: 2,
          precioUnitario: 4.5,
          total: 9,
          moneda: "USD",
          dia: new Date(2026, 7, 20),
        }),
      ],
      { "31161904": "Resortes" },
      "USD"
    )

    expect(filas).toHaveLength(1)
    expect(filas[0]).toEqual({
      Fecha: "2026-08-20",
      Factura: "INV-9",
      Proveedor: "McMaster",
      "Descripción Simplificada": "Resorte",
      "Clave SAT": "31161904",
      "Descripción Clave SAT": "Resortes",
      Cantidad: 2,
      "Precio Unitario": 4.5,
      Total: 9,
      Moneda: "USD",
    })
    expect(valoresFilaExcelContable(filas[0])).toEqual([
      "2026-08-20",
      "INV-9",
      "McMaster",
      "Resorte",
      "31161904",
      "Resortes",
      2,
      4.5,
      9,
      "USD",
    ])
  })

  it("usa descripción original si no hay simplificada y nulls → 0", () => {
    const [fila] = armarFilasExcelContable(
      [
        linea({
          ordenId: "o2",
          proveedor: "MSC",
          descripcion: "Original",
          total: 1,
          moneda: "MXN",
        }),
      ],
      {},
      "MXN"
    )
    expect(fila["Descripción Simplificada"]).toBe("Original")
    expect(fila.Cantidad).toBe(0)
    expect(fila["Precio Unitario"]).toBe(0)
    expect(fila.Factura).toBe("")
  })
})

describe("construirWorkbookExcelContable", () => {
  it("arma encabezado de documento, fila de columnas y total", async () => {
    const filas = armarFilasExcelContable(
      [
        linea({
          ordenId: "o1",
          proveedor: "McMaster",
          descripcion: "Spring",
          descripcionSimplificada: "Resorte",
          referencia: "INV-1",
          cantidad: 1,
          precioUnitario: 10,
          total: 10,
          moneda: "USD",
          dia: new Date(2026, 7, 20),
        }),
        linea({
          ordenId: "o2",
          proveedor: "MSC",
          descripcion: "Bolt",
          descripcionSimplificada: "Tornillo",
          referencia: "INV-2",
          cantidad: 2,
          precioUnitario: 5,
          total: 10,
          moneda: "USD",
        }),
      ],
      {},
      "USD"
    )

    const wb = await construirWorkbookExcelContable({
      filas,
      moneda: "USD",
      subtitulo: "Compras pendientes de enviar",
      generadoEn: new Date(2026, 7, 24),
    })
    const sheet = wb.getWorksheet("Reporte Contable")
    expect(sheet).toBeTruthy()
    expect(String(sheet!.getCell(1, 1).value)).toContain("Cierre contable")
    expect(String(sheet!.getCell(2, 1).value)).toContain("USD")
    expect(sheet!.getCell(FILA_INICIO_TABLA_EXCEL, 1).value).toBe("Fecha")
    expect(sheet!.getCell(FILA_INICIO_TABLA_EXCEL, 9).value).toBe("Total")
    expect(sheet!.getCell(FILA_INICIO_TABLA_EXCEL + 1, 3).value).toBe("McMaster")
    const totalRow = FILA_INICIO_TABLA_EXCEL + filas.length + 1
    expect(String(sheet!.getCell(totalRow, 1).value)).toContain("TOTAL")
    expect(sheet!.getCell(totalRow, 9).value).toBe(20)
    expect(sheet!.autoFilter).toBeTruthy()
  })
})

describe("nombreArchivoExcelContable / tituloPdfContable", () => {
  const generadoEn = new Date(2026, 7, 24)

  it("nombra pendientes con moneda y fecha", () => {
    expect(
      nombreArchivoExcelContable({
        tab: "pendientes",
        loteId: null,
        moneda: "USD",
        generadoEn,
      })
    ).toBe("Cierre_Contable_Pendientes_USD_2026-08-24.xlsx")
  })

  it("nombra historial con lote", () => {
    expect(
      nombreArchivoExcelContable({
        tab: "historial",
        loteId: "LOTE-20260714-RGWU",
        moneda: "MXN",
        generadoEn,
      })
    ).toBe("Cierre_Contable_LOTE-20260714-RGWU_MXN_2026-08-24.xlsx")
  })

  it("titulo PDF sin extensión", () => {
    expect(
      tituloPdfContable({
        tab: "pendientes",
        loteId: null,
        moneda: "USD",
        generadoEn,
      })
    ).toBe("Cierre_Contable_Pendientes_USD_2026-08-24")
  })
})

describe("subtituloContablePrint", () => {
  it("describe pendientes y lote", () => {
    expect(subtituloContablePrint("pendientes", null)).toBe("Compras pendientes de enviar")
    expect(subtituloContablePrint("historial", "LOTE-1")).toBe("Lote LOTE-1")
  })
})

describe("constantes de columnas", () => {
  it("alinean encabezados y anchos", () => {
    expect(ENCABEZADOS_EXCEL_CONTABLE).toHaveLength(10)
    expect(ANCHOS_COLUMNAS_EXCEL_CONTABLE).toHaveLength(ENCABEZADOS_EXCEL_CONTABLE.length)
    expect(FILA_INICIO_TABLA_EXCEL).toBe(4)
  })
})
