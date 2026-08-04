import { describe, it, expect } from "vitest"
import {
  CATEGORIAS_PRODUCTO_REGISTRO,
  consolidarHistoricoCostos,
  construirItemDesdeLinea,
  esItemComprable,
  idsHuerfanosCompras,
  listarTiposMetal,
  parseAtributosMetal,
  rangoPreciosPorFamilia,
  rangoPreciosPorMetal,
  resolverCategoriaProducto,
  type CategoriaProductoDef,
  type CompraOdooItemNormalizado,
} from "@/lib/compras-odoo"
import { CATEGORIAS_PRODUCTO_REGISTRO as CATEGORIAS_PRODUCTO_REGISTRO_FUNCTIONS } from "../functions/src/compras-odoo/categorias-registro"
import {
  itemsDesdeFacturaCrudo,
  itemsDesdePoCrudo,
  mapearFacturaProveedorOdoo,
  mapearPoOdoo,
  type OdooPoRaw,
  type OdooVendorBillRaw,
} from "../functions/src/odoo-compras-mapeo"

describe("paridad del registro de categorias (lib/ vs functions/)", () => {
  it("lib/compras-odoo y functions/src/compras-odoo definen el mismo registro", () => {
    // ponytail: registro duplicado a mano entre app y Cloud Function; este test es el
    // guardrail minimo para que una categoria agregada en un solo lado no rompa el
    // filtro del comparador de precios en silencio.
    expect(CATEGORIAS_PRODUCTO_REGISTRO).toEqual(CATEGORIAS_PRODUCTO_REGISTRO_FUNCTIONS)
  })
})

describe("resolverCategoriaProducto", () => {
  it("categoriza por división SAT (metals / tools / plastics)", () => {
    expect(resolverCategoriaProducto({ claveProdServ: "30101600" })).toBe("metals")
    expect(resolverCategoriaProducto({ claveProdServ: "23241600" })).toBe("tools")
    expect(resolverCategoriaProducto({ claveProdServ: "13111200" })).toBe("plastics")
  })

  it("usa keywords cuando no hay SAT", () => {
    expect(resolverCategoriaProducto({ descripcion: "Barra acero 1018 1/2 in" })).toBe("metals")
    expect(resolverCategoriaProducto({ descripcion: "Fresa carburo 4 flutes" })).toBe("tools")
    expect(resolverCategoriaProducto({ descripcion: "Placa nylon 6mm" })).toBe("plastics")
  })

  it("cae a otros si no hay match", () => {
    expect(resolverCategoriaProducto({ descripcion: "Servicio de mensajería" })).toBe("otros")
  })

  it("categoriza papelería y medicinas", () => {
    expect(resolverCategoriaProducto({ descripcion: "Resma de papel carta" })).toBe("office")
    expect(resolverCategoriaProducto({ descripcion: "Ibuprofeno 400mg" })).toBe("medical")
  })

  it("permite añadir categoría foam sin cambiar el resolver", () => {
    const registro: CategoriaProductoDef[] = [
      ...CATEGORIAS_PRODUCTO_REGISTRO.filter((c) => c.id !== "otros"),
      {
        id: "foam",
        etiqueta: "Espumas",
        divisionesSat: ["48"],
        palabrasClave: ["foam", "espuma", "neopreno"],
      },
      CATEGORIAS_PRODUCTO_REGISTRO.find((c) => c.id === "otros")!,
    ]
    expect(resolverCategoriaProducto({ descripcion: "Espuma neopreno 10mm", registro })).toBe("foam")
    expect(resolverCategoriaProducto({ claveProdServ: "48101600", registro })).toBe("foam")
    // Core sin cambios: metals sigue resolviendo
    expect(resolverCategoriaProducto({ claveProdServ: "30101600", registro })).toBe("metals")
  })
})

describe("parseAtributosMetal", () => {
  it("extrae tipo y medida de descripciones de estación de compras", () => {
    const a = parseAtributosMetal("ACERO 1018 BARRA REDONDA 1/2\"")
    expect(a.tipoMetal).toBe("acero_1018")
    expect(a.medida).toContain("1/2")

    const b = parseAtributosMetal("Placa aluminio 6061 25mm")
    expect(b.tipoMetal).toBe("aluminio_6061")
    expect(b.medida).toMatch(/25/)
  })
})

describe("lote mixto PO + factura", () => {
  const ahora = new Date("2026-07-21T12:00:00Z")

  const poRaw: OdooPoRaw = {
    id: 583,
    name: "P00583",
    partner_id: [100, "ACEROS LEVINSON"],
    date_order: "2026-07-21 10:00:00",
    date_planned: "2026-07-25 00:00:00",
    amount_total: 5117.43,
    currency_id: [33, "MXN"],
    state: "purchase",
    user_id: [5, "Lic. Lorena Vazquez"],
    company_id: [1, "Maquinados Vazquez"],
    _lineas: [
      {
        id: 1,
        name: "Acero 1018 barra 1/2 in",
        product_id: [10, "ACERO 1018"],
        product_qty: 10,
        price_unit: 85.5,
        price_subtotal: 855,
        clave_prod_serv: "30101601",
      },
      {
        id: 2,
        name: "Fresa carburo 1/4",
        product_id: [11, "FRESA"],
        product_qty: 2,
        price_unit: 400,
        price_subtotal: 800,
        clave_prod_serv: "23241602",
      },
      {
        id: 3,
        name: "Placa nylon 10mm",
        product_id: [12, "NYLON"],
        product_qty: 1,
        price_unit: 350,
        price_subtotal: 350,
        clave_prod_serv: null,
      },
    ],
  }

  const billRaw: OdooVendorBillRaw = {
    id: 900,
    name: "BILL/2026/0001",
    move_type: "in_invoice",
    partner_id: [100, "ACEROS LEVINSON"],
    invoice_date: "2026-07-22",
    amount_untaxed: 900,
    amount_tax: 72,
    amount_total: 972,
    currency_id: [33, "MXN"],
    state: "posted",
    invoice_origin: "P00583",
    company_id: [1, "Maquinados Vazquez"],
    _lineas: [
      {
        id: 50,
        name: "Acero 1018 barra 1/2 in",
        product_id: [10, "ACERO 1018"],
        quantity: 10,
        price_unit: 90,
        price_subtotal: 900,
        clave_prod_serv: "30101601",
      },
    ],
  }

  it("mapea PO y factura a ítems con categorías SAT correctas", () => {
    const po = mapearPoOdoo(poRaw, ahora)
    const bill = mapearFacturaProveedorOdoo(billRaw, ahora)
    expect(po.id).toBe("po_583")
    expect(po.esRfq).toBe(false)
    expect(bill.tipo).toBe("factura_proveedor")
    expect(bill.origenPo).toBe("P00583")

    const items = [...itemsDesdePoCrudo(po), ...itemsDesdeFacturaCrudo(bill)]
    expect(items).toHaveLength(4)

    const cats = items.map((i) => i.categoriaId)
    expect(cats).toContain("metals")
    expect(cats).toContain("tools")
    expect(cats).toContain("plastics")

    const metal = items.find((i) => i.fuente === "po" && i.categoriaId === "metals")!
    expect(metal.claveProdServ).toBe("30101601")
    expect(metal.satPendiente).toBe(false)
    expect(metal.tipoMetal).toBe("acero_1018")
  })

  it("consolida histórico preferiendo precio de factura", () => {
    const po = mapearPoOdoo(poRaw, ahora)
    const bill = mapearFacturaProveedorOdoo(billRaw, ahora)
    const items = [...itemsDesdePoCrudo(po), ...itemsDesdeFacturaCrudo(bill)]
    const hist = consolidarHistoricoCostos(items)
    const metalHist = hist.find((h) => h.categoriaId === "metals" && h.tipoMetal === "acero_1018")
    expect(metalHist).toBeDefined()
    expect(metalHist!.puntos.length).toBeGreaterThanOrEqual(2)
    expect(metalHist!.fuentePreferida).toBe("factura")
    expect(metalHist!.precioPreferido).toBe(90)
  })

  it("rango de precios filtrable por tipoMetal y medida", () => {
    const po = mapearPoOdoo(poRaw, ahora)
    const bill = mapearFacturaProveedorOdoo(billRaw, ahora)
    const items = [...itemsDesdePoCrudo(po), ...itemsDesdeFacturaCrudo(bill)]

    const rango = rangoPreciosPorMetal(items, {
      tipoMetal: "acero_1018",
      medida: "1/2",
      moneda: "MXN",
    })
    expect(rango.n).toBe(2)
    expect(rango.min).toBe(85.5)
    expect(rango.max).toBe(90)
    expect(rango.promedio).toBe(87.75)
    expect(listarTiposMetal(items)).toContain("acero_1018")

    const rPlastico = rangoPreciosPorFamilia(items, {
      categoriaId: "plastics",
      tipo: "nylon",
    })
    expect(rPlastico.n).toBeGreaterThanOrEqual(1)
    expect(rPlastico.min).toBe(350)
  })
})

describe("esItemComprable", () => {
  it("descarta precio en 0; acepta cualquier ítem con precio > 0 sin importar esRfq", () => {
    // Odoo permite capturar el precio de línea antes de aprobar la PO: una RFQ con
    // precio real (ej. producción: 217 líneas RFQ con precio > 0) sí debe mostrarse.
    expect(esItemComprable({ precioUnitario: 0 })).toBe(false)
    expect(esItemComprable({ precioUnitario: 280 })).toBe(true)
    const rfqConPrecio: { esRfq: boolean; precioUnitario: number } = { esRfq: true, precioUnitario: 35.88 }
    expect(esItemComprable(rfqConPrecio)).toBe(true)
  })

  it("rangoPreciosPorFamilia ignora líneas en $0 aunque el resto del grupo sí tenga precio", () => {
    const base = {
      id: "1",
      llaveItem: "k",
      fuente: "po" as const,
      odooDocId: 1,
      odooLineId: 1,
      referenciaDoc: "P1",
      origenPo: null,
      descripcion: "Solera 1/4 x 2",
      cantidad: 1,
      subtotal: 0,
      fecha: "2026-08-01",
      odooPartnerId: 1,
      proveedorNombre: "X",
      productOdooId: null,
      claveProdServ: null,
      satPendiente: true,
      categoriaId: "metals",
      tipoMetal: "acero_1018",
      tipoInsumo: "acero_1018",
      medida: "1/4x2",
      unidad: null,
      origen: "odoo" as const,
      odooCategoria: null,
      odooUom: null,
      odooCostoEstandar: null,
      odooRefInterna: null,
      clasificadoPorIa: false,
    }
    const items: CompraOdooItemNormalizado[] = [
      { ...base, id: "sin-precio", precioUnitario: 0, moneda: "MXN", esRfq: true },
      { ...base, id: "con-precio-rfq", precioUnitario: 280, moneda: "MXN", esRfq: true },
    ]

    const rango = rangoPreciosPorFamilia(items, { categoriaId: "metals", tipo: "acero_1018" })
    expect(rango.n).toBe(1)
    expect(rango.min).toBe(280)
  })
})

describe("idsHuerfanosCompras", () => {
  it("detecta IDs que ya no están en Odoo", () => {
    expect(idsHuerfanosCompras(["po_1", "po_2", "po_3"], ["po_1", "po_3"])).toEqual(["po_2"])
  })
})

describe("construirItemDesdeLinea — capa intermedia sin tocar crudo", () => {
  it("marca satPendiente cuando no hay clave", () => {
    const item: CompraOdooItemNormalizado = construirItemDesdeLinea({
      fuente: "po",
      odooDocId: 1,
      odooLineId: 2,
      referenciaDoc: "P1",
      descripcion: "Algo desconocido",
      cantidad: 1,
      precioUnitario: 10,
      subtotal: 10,
      moneda: "MXN",
      fecha: "2026-07-21",
      odooPartnerId: 1,
      proveedorNombre: "X",
      claveProdServ: null,
    })
    expect(item.satPendiente).toBe(true)
    expect(item.categoriaId).toBe("otros")
    expect(item.origen).toBe("odoo")
  })
})
