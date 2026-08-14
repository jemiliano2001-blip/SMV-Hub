import { describe, expect, it } from "vitest"
import {
  claveHibridaItem,
  comprasHistoricasDelGrupo,
  grupoConMasCompras,
  indiceRangosHistoricos,
  llaveRangoHistorico,
  posicionPrecioEnRango,
  rangoHistoricoPorClave,
  type ItemParaClaveHibrida,
} from "@/lib/compras-odoo/clave-hibrida"

function item(cambios: Partial<ItemParaClaveHibrida> & Pick<ItemParaClaveHibrida, "descripcion">): ItemParaClaveHibrida {
  return {
    categoriaId: "metals",
    precioUnitario: 10,
    moneda: "MXN",
    odooPartnerId: 1,
    ...cambios,
  }
}

describe("claveHibridaItem", () => {
  it("gana el SKU aunque haya familia y descripción", () => {
    const clave = claveHibridaItem(
      item({
        descripcion: "Barra acero 1018 1/2",
        odooRefInterna: "P00552",
        tipoInsumo: "acero_1018",
        medida: "1/2",
      }),
    )
    expect(clave).toBe("sku:p00552")
  })

  it("trata un SKU vacío o de solo espacios como ausente", () => {
    const conFamilia = claveHibridaItem(
      item({
        descripcion: "Barra acero 1018 1/2",
        odooRefInterna: "   ",
        tipoMetal: "acero_1018",
        medida: "1/2\"",
      }),
    )
    expect(conFamilia.startsWith("fam:")).toBe(true)
  })

  it("sin SKU usa familia + tipo + medida", () => {
    const clave = claveHibridaItem(
      item({
        descripcion: "ACERO 1018 BARRA 1/2 in",
        tipoInsumo: "acero_1018",
        medida: "1/2\"",
      }),
    )
    expect(clave).toBe("fam:metals|tipo:acero_1018|med:1_2")
  })

  it("si falta tipo o medida cae a descripción", () => {
    const sinMedida = claveHibridaItem(
      item({
        descripcion: "Broca carburo 3/8",
        categoriaId: "tools",
        tipoInsumo: "broca",
      }),
    )
    expect(sinMedida.startsWith("desc:")).toBe(true)

    const sinTipo = claveHibridaItem(
      item({
        descripcion: "Insumo raro 10mm",
        categoriaId: "otros",
        medida: "10mm",
      }),
    )
    expect(sinTipo.startsWith("desc:")).toBe(true)
  })

  it("normaliza descripción para que acentos y mayúsculas no partan el grupo", () => {
    const a = claveHibridaItem(item({ descripcion: "Nylon 6mm" }))
    const b = claveHibridaItem(item({ descripcion: "NYLON  6mm" }))
    expect(a).toBe(b)
  })
})

describe("rango histórico por clave y moneda", () => {
  const historico: ItemParaClaveHibrida[] = [
    item({
      descripcion: "Acero 1018 1/2",
      tipoInsumo: "acero_1018",
      medida: "1/2",
      precioUnitario: 80,
      odooPartnerId: 1,
      moneda: "MXN",
    }),
    item({
      descripcion: "Acero 1018 1/2 otra PO",
      tipoInsumo: "acero_1018",
      medida: "1/2",
      precioUnitario: 100,
      odooPartnerId: 2,
      moneda: "MXN",
    }),
    item({
      descripcion: "Acero 1018 1/2",
      tipoInsumo: "acero_1018",
      medida: "1/2",
      precioUnitario: 120,
      odooPartnerId: 3,
      moneda: "MXN",
    }),
    item({
      descripcion: "Acero 1018 1/2 USD",
      tipoInsumo: "acero_1018",
      medida: "1/2",
      precioUnitario: 6,
      odooPartnerId: 4,
      moneda: "USD",
    }),
    item({
      descripcion: "Acero 1018 1/2 cero",
      tipoInsumo: "acero_1018",
      medida: "1/2",
      precioUnitario: 0,
      odooPartnerId: 5,
      moneda: "MXN",
    }),
    item({
      descripcion: "Acero 1018 1/2 RFQ",
      tipoInsumo: "acero_1018",
      medida: "1/2",
      precioUnitario: 90,
      odooPartnerId: 6,
      moneda: "MXN",
    }),
  ]

  const clave = claveHibridaItem(historico[0])

  it("no mezcla monedas e ignora líneas en $0", () => {
    const mxn = rangoHistoricoPorClave(historico, clave, "MXN")
    expect(mxn).not.toBeNull()
    expect(mxn?.min).toBe(80)
    expect(mxn?.max).toBe(120)
    expect(mxn?.promedio).toBe(97.5)
    expect(mxn?.n).toBe(4)
    expect(mxn?.proveedores).toBe(4)

    const usd = rangoHistoricoPorClave(historico, clave, "USD")
    expect(usd?.n).toBe(1)
    expect(usd?.min).toBe(6)
  })

  it("un subconjunto filtrado por proveedor no achica el rango histórico", () => {
    const soloProveedor1 = historico.filter((fila) => fila.odooPartnerId === 1)
    const rangoFiltrado = rangoHistoricoPorClave(soloProveedor1, clave, "MXN")
    const rangoCompleto = rangoHistoricoPorClave(historico, clave, "MXN")
    expect(rangoFiltrado?.n).toBe(1)
    expect(rangoCompleto?.n).toBe(4)
    expect(rangoCompleto?.min).toBe(80)
    expect(rangoCompleto?.max).toBe(120)
  })

  it("el índice usa clave::moneda y RFQ con precio cuenta", () => {
    const indice = indiceRangosHistoricos(historico)
    const mxn = indice.get(llaveRangoHistorico(clave, "MXN"))
    expect(mxn?.n).toBe(4)
  })

  it("grupoConMasCompras elige el de mayor n", () => {
    const indice = indiceRangosHistoricos(historico)
    const ganador = grupoConMasCompras(indice.values())
    expect(ganador?.moneda).toBe("MXN")
    expect(ganador?.n).toBe(4)
  })
})

describe("posicionPrecioEnRango", () => {
  const rango = {
    clave: "fam:metals|tipo:acero_1018|med:1_2",
    moneda: "MXN",
    min: 80,
    max: 120,
    promedio: 100,
    n: 3,
    proveedores: 3,
  }

  it("marca barato cerca del mínimo, en medio hasta el promedio y caro arriba", () => {
    expect(posicionPrecioEnRango(80, rango)).toBe("barato")
    expect(posicionPrecioEnRango(80.04, rango)).toBe("barato")
    expect(posicionPrecioEnRango(90, rango)).toBe("en_medio")
    expect(posicionPrecioEnRango(100, rango)).toBe("en_medio")
    expect(posicionPrecioEnRango(110, rango)).toBe("caro")
  })
})

describe("comprasHistoricasDelGrupo", () => {
  it("devuelve las más recientes del grupo, tope 8, sin $0", () => {
    const filas: ItemParaClaveHibrida[] = [
      item({
        descripcion: "x",
        odooRefInterna: "SKU1",
        precioUnitario: 10,
        fecha: "2026-01-01",
        moneda: "MXN",
      }),
      item({
        descripcion: "x",
        odooRefInterna: "SKU1",
        precioUnitario: 12,
        fecha: "2026-08-01",
        moneda: "MXN",
      }),
      item({
        descripcion: "x",
        odooRefInterna: "SKU1",
        precioUnitario: 0,
        fecha: "2026-08-02",
        moneda: "MXN",
      }),
      item({
        descripcion: "x",
        odooRefInterna: "SKU1",
        precioUnitario: 9,
        fecha: "2026-07-01",
        moneda: "USD",
      }),
    ]
    const clave = claveHibridaItem(filas[0])
    const grupo = comprasHistoricasDelGrupo(filas, clave, "MXN", 8)
    expect(grupo.map((fila) => fila.fecha)).toEqual(["2026-08-01", "2026-01-01"])
  })
})
