import { describe, it, expect } from "vitest"
import { parsearTextoExcel, limpiarNumero } from "@/lib/odoo-cotizador-parser"

describe("odoo-cotizador-parser", () => {
  it("limpia números con símbolos monetarios y comas correctamente", () => {
    expect(limpiarNumero("$3.8800")).toBe(3.88)
    expect(limpiarNumero(" $ 1,234.50 ")).toBe(1234.5)
    expect(limpiarNumero("100")).toBe(100)
    expect(limpiarNumero("")).toBe(0)
    expect(limpiarNumero(null)).toBe(0)
  })

  it("no confunde filas de datos que contienen '#' o palabras comunes de taller como encabezados", () => {
    const rawTsv = [
      "1\tBRC-07\tBROCA #7 USO RUDO\t10\t50.00\t500.00",
      "2\tBRC-08\tBROCA 1/4\t5\t60.00\t300.00",
    ].join("\n")

    const resultado = parsearTextoExcel(rawTsv)

    expect(resultado.partidas).toHaveLength(2)
    expect(resultado.filasOmitidas).toBe(0)

    const p0 = resultado.partidas[0]
    expect(p0.clave).toBe("BRC-07")
    expect(p0.descripcion).toBe("BROCA #7 USO RUDO")
    expect(p0.cantidad).toBe(10)
    expect(p0.precioUnitario).toBe(50)
    expect(p0.subtotal).toBe(500)

    const p1 = resultado.partidas[1]
    expect(p1.clave).toBe("BRC-08")
    expect(p1.descripcion).toBe("BROCA 1/4")
    expect(p1.cantidad).toBe(5)
    expect(p1.precioUnitario).toBe(60)
    expect(p1.subtotal).toBe(300)
  })

  it("parsea tabla copiada de Google Sheets con encabezados reales", () => {
    const rawTsv = [
      "# Partida\tClave\tDescripción\tCantidad\tPrecio Unitario\tImporte",
      "12\tTSF 05X064\tTOR SOCKET FINO 3/16-32 X 2-1/2\t100\t$3.8800\t$388.00",
      "13\tTSS 06X016\tTOR SOCKET STD 1/4-20 X 5/8\t100\t$1.3300\t$133.00",
      "14\tTSS 06X019\tTOR SOCKET STD 1/4-20 X 3/4\t10\t$1.0000\t$10.00",
    ].join("\n")

    const resultado = parsearTextoExcel(rawTsv, {
      requisitor: "Pablo",
      empresa: "Taller",
      uso: "General",
    })

    expect(resultado.partidas).toHaveLength(3)
    expect(resultado.totalFilasLeidas).toBe(3)
    expect(resultado.filasOmitidas).toBe(0)

    const p0 = resultado.partidas[0]
    expect(p0.partida).toBe(12)
    expect(p0.clave).toBe("TSF 05X064")
    expect(p0.descripcion).toBe("TOR SOCKET FINO 3/16-32 X 2-1/2")
    expect(p0.cantidad).toBe(100)
    expect(p0.precioUnitario).toBe(3.88)
    expect(p0.subtotal).toBe(388)
    expect(p0.requisitor).toBe("Pablo")
    expect(p0.empresa).toBe("Taller")
    expect(p0.uso).toBe("General")
    expect(p0.udm).toBe("Pieza")
  })

  it("parsea datos sin encabezados basándose en orden posicional de columnas", () => {
    const rawTsv = [
      "TSF 05X064\tTOR SOCKET FINO 3/16-32 X 2-1/2\t100\t3.88\t388.00",
      "TSS 06X016\tTOR SOCKET STD 1/4-20 X 5/8\t150\t1.33\t199.50",
    ].join("\n")

    const resultado = parsearTextoExcel(rawTsv, { requisitor: "Daniel" })

    expect(resultado.partidas).toHaveLength(2)
    expect(resultado.partidas[0].clave).toBe("TSF 05X064")
    expect(resultado.partidas[0].descripcion).toBe("TOR SOCKET FINO 3/16-32 X 2-1/2")
    expect(resultado.partidas[0].cantidad).toBe(100)
    expect(resultado.partidas[0].precioUnitario).toBe(3.88)
    expect(resultado.partidas[0].requisitor).toBe("Daniel")
  })

  it("registra advertencias cuando hay filas omitidas, precios 0 o importes discrepantes", () => {
    const rawTsv = [
      "Clave\tDescripción\tCantidad\tPrecio Unitario\tImporte",
      "A1\tTORNILLO ACERO\t10\t0\t0",
      "\t\t\t\t",
      "B2\tTUERCA ESPECIAL\t5\t20.00\t80.00", // Importe 80 != 5*20=100 (descuento)
    ].join("\n")

    const resultado = parsearTextoExcel(rawTsv)

    expect(resultado.partidas).toHaveLength(2)
    expect(resultado.filasOmitidas).toBe(1)
    expect(resultado.advertencias.length).toBeGreaterThan(0)
    expect(resultado.advertencias.some((a) => a.includes("omitida"))).toBe(true)
    expect(resultado.advertencias.some((a) => a.includes("precio unitario es $0.00"))).toBe(true)
    expect(resultado.advertencias.some((a) => a.includes("difiere del cálculo"))).toBe(true)
    expect(resultado.partidas[1].subtotal).toBe(80) // Mantiene importe del archivo
  })

  it("reconoce encabezado de OT / Orden de trabajo y lo asigna al uso y ordenTrabajo", () => {
    const rawTsv = [
      "Descripción\tOT\tCantidad\tPrecio Unitario",
      "Tugsteno de carburo 3/16 x 3/4 x 6\t2026/S01641\t2\t2090.05",
    ].join("\n")

    const resultado = parsearTextoExcel(rawTsv, {
      requisitor: "Antonio",
      empresa: "Mecalux",
    })

    expect(resultado.partidas).toHaveLength(1)
    const p = resultado.partidas[0]
    expect(p.descripcion).toBe("Tugsteno de carburo 3/16 x 3/4 x 6")
    expect(p.uso).toBe("2026/S01641")
    expect(p.ordenTrabajo).toBe("2026/S01641")
    expect(p.requisitor).toBe("Antonio")
    expect(p.empresa).toBe("Mecalux")
    expect(p.cantidad).toBe(2)
    expect(p.precioUnitario).toBe(2090.05)
    expect(p.subtotal).toBe(4180.1)
  })
})
