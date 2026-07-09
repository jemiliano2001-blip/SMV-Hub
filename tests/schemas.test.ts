import { describe, it, expect } from "vitest"
import {
  ItemFacturaSchema,
  ExtraccionInvoiceSchema,
  CamposManualSchema,
  NuevaCompraFormSchema,
  OrdenCompraSchema,
  EstadoOrdenSchema,
  RequisicionSchema,
} from "@/lib/schemas"

// ── ItemFacturaSchema ────────────────────────────────────────────────────────

describe("ItemFacturaSchema", () => {
  it("acepta un ítem completo", () => {
    const result = ItemFacturaSchema.safeParse({
      descripcion: "Tornillo M6",
      cantidad: 10,
      precioUnitario: 1.5,
      total: 15,
    })
    expect(result.success).toBe(true)
  })

  it("acepta nulls en campos numéricos", () => {
    const result = ItemFacturaSchema.safeParse({
      descripcion: "Sin precio",
      cantidad: null,
      precioUnitario: null,
      total: null,
    })
    expect(result.success).toBe(true)
  })

  it("rechaza sin descripcion", () => {
    const result = ItemFacturaSchema.safeParse({ cantidad: 1, precioUnitario: 1, total: 1 })
    expect(result.success).toBe(false)
  })
})

// ── ExtraccionInvoiceSchema ──────────────────────────────────────────────────

describe("ExtraccionInvoiceSchema", () => {
  const BASE = {
    proveedor: "Amazon",
    numeroFactura: "INV-001",
    fechaFactura: "2024-06-01",
    moneda: "USD",
    subtotal: 100,
    impuestos: 8,
    total: 108,
    items: [],
  }

  it("valida factura completa", () => {
    expect(ExtraccionInvoiceSchema.safeParse(BASE).success).toBe(true)
  })

  it("asigna moneda USD por defecto si falta", () => {
    const sinMoneda = { ...BASE } as Partial<typeof BASE>
    delete sinMoneda.moneda
    const r = ExtraccionInvoiceSchema.safeParse(sinMoneda)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.moneda).toBe("USD")
  })

  it("asigna items [] por defecto si falta", () => {
    const sinItems = { ...BASE } as Partial<typeof BASE>
    delete sinItems.items
    const r = ExtraccionInvoiceSchema.safeParse(sinItems)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.items).toEqual([])
  })

  it("acepta total null cuando la IA no puede leerlo", () => {
    const r = ExtraccionInvoiceSchema.safeParse({ ...BASE, total: null })
    expect(r.success).toBe(true)
  })

  it("acepta numeroFactura null", () => {
    const r = ExtraccionInvoiceSchema.safeParse({ ...BASE, numeroFactura: null })
    expect(r.success).toBe(true)
  })

  it("acepta envio null por defecto en facturas antiguas", () => {
    const r = ExtraccionInvoiceSchema.safeParse(BASE)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.envio).toBeNull()
  })

  it("valida factura con envío y total cuadrado", () => {
    const r = ExtraccionInvoiceSchema.safeParse({
      ...BASE,
      envio: 15,
      impuestos: 9.49,
      total: 124.49,
    })
    expect(r.success).toBe(true)
  })

  it("rechaza proveedor ausente", () => {
    const sinProveedor = { ...BASE } as Partial<typeof BASE>
    delete sinProveedor.proveedor
    expect(ExtraccionInvoiceSchema.safeParse(sinProveedor).success).toBe(false)
  })

  it("rechaza total no numérico y no null", () => {
    const r = ExtraccionInvoiceSchema.safeParse({ ...BASE, total: "cien" })
    expect(r.success).toBe(false)
  })

  it("valida items anidados correctamente", () => {
    const r = ExtraccionInvoiceSchema.safeParse({
      ...BASE,
      items: [{ descripcion: "Widget", cantidad: 2, precioUnitario: 5, total: 10 }],
    })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.items).toHaveLength(1)
  })

  it("rechaza item sin descripcion", () => {
    const r = ExtraccionInvoiceSchema.safeParse({
      ...BASE,
      items: [{ cantidad: 1, precioUnitario: 1, total: 1 }],
    })
    expect(r.success).toBe(false)
  })
})

// ── CamposManualSchema ───────────────────────────────────────────────────────

describe("CamposManualSchema", () => {
  it("acepta campos legacy vacíos (opcionales a nivel orden)", () => {
    expect(CamposManualSchema.safeParse({}).success).toBe(true)
  })

  it("acepta campos legacy completos", () => {
    expect(
      CamposManualSchema.safeParse({
        requisitor: "Juan",
        ordenTrabajo: "OT-100",
        empresa: "SMV",
        cuentaCargo: "SO1",
        destino: "SMV",
      }).success
    ).toBe(true)
  })
})

// ── NuevaCompraFormSchema (ExtraccionInvoice + CamposManual) ─────────────────

describe("NuevaCompraFormSchema", () => {
  const itemOk = {
    descripcion: "Widget",
    cantidad: 1,
    precioUnitario: 10,
    total: 10,
    empresa: "APX",
    cuentaCargo: "SO1148",
    requisitor: "María",
    ordenTrabajo: "",
  }

  const OK = {
    proveedor: "Grainger",
    numeroFactura: "GR-202",
    fechaFactura: "2024-06-15",
    moneda: "USD",
    subtotal: 200,
    impuestos: 16,
    total: 216,
    items: [itemOk],
    requisitor: "",
    ordenTrabajo: "",
    empresa: "",
    cuentaCargo: "",
    destino: "",
  }

  it("valida form completo con ítems", () => {
    expect(NuevaCompraFormSchema.safeParse(OK).success).toBe(true)
  })

  it("rechaza si un ítem no tiene empresa", () => {
    const r = NuevaCompraFormSchema.safeParse({
      ...OK,
      items: [{ ...itemOk, empresa: "" }],
    })
    expect(r.success).toBe(false)
  })

  it("rechaza si falta proveedor", () => {
    const sin = { ...OK } as Partial<typeof OK>
    delete sin.proveedor
    expect(NuevaCompraFormSchema.safeParse(sin).success).toBe(false)
  })

  it("rechaza sin ítems", () => {
    const r = NuevaCompraFormSchema.safeParse({ ...OK, items: [] })
    expect(r.success).toBe(false)
  })
})

// ── EstadoOrdenSchema ────────────────────────────────────────────────────────

describe("EstadoOrdenSchema", () => {
  it.each(["pendiente", "aprobada", "rechazada"])("acepta '%s'", (estado) => {
    expect(EstadoOrdenSchema.safeParse(estado).success).toBe(true)
  })

  it("rechaza estado desconocido", () => {
    expect(EstadoOrdenSchema.safeParse("cancelada").success).toBe(false)
  })
})

// ── OrdenCompraSchema ────────────────────────────────────────────────────────

describe("OrdenCompraSchema", () => {
  const OK = {
    id: "abc123",
    proveedor: "Grainger",
    numeroFactura: "GR-202",
    fechaFactura: "2024-06-15",
    moneda: "USD",
    subtotal: 200,
    impuestos: 16,
    total: 216,
    items: [],
    requisitor: "María",
    ordenTrabajo: "OT-999",
    empresa: "SMV Norte",
    imagenUrl: "https://storage.googleapis.com/bucket/img.jpg",
    imagenPath: "ordenes/abc123.jpg",
    estado: "pendiente" as const,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  }

  it("valida orden completa", () => {
    expect(OrdenCompraSchema.safeParse(OK).success).toBe(true)
  })

  it("asigna estado 'pendiente' por defecto", () => {
    const sinEstado = { ...OK } as Partial<typeof OK>
    delete sinEstado.estado
    const r = OrdenCompraSchema.safeParse(sinEstado)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.estado).toBe("pendiente")
  })

  it("rechaza imagenUrl sin formato URL", () => {
    const r = OrdenCompraSchema.safeParse({ ...OK, imagenUrl: "no-es-url" })
    expect(r.success).toBe(false)
  })

  it("rechaza creadoEn que no sea Date", () => {
    const r = OrdenCompraSchema.safeParse({ ...OK, creadoEn: "2024-01-01" })
    expect(r.success).toBe(false)
  })

  it("acepta orden sin imagenUrl ni imagenPath (importación histórica)", () => {
    const sinImagen = { ...OK } as Partial<typeof OK>
    delete sinImagen.imagenUrl
    delete sinImagen.imagenPath
    const r = OrdenCompraSchema.safeParse(sinImagen)
    expect(r.success).toBe(true)
  })

  it("acepta linkProveedor como string", () => {
    const r = OrdenCompraSchema.safeParse({ ...OK, linkProveedor: "https://amazon.com/p/123" })
    expect(r.success).toBe(true)
  })

  it("acepta linkProveedor null", () => {
    const r = OrdenCompraSchema.safeParse({ ...OK, linkProveedor: null })
    expect(r.success).toBe(true)
  })

  it("acepta fechaEntrega como string", () => {
    const r = OrdenCompraSchema.safeParse({ ...OK, fechaEntrega: "2024-07-10" })
    expect(r.success).toBe(true)
  })

  it("acepta fechaEntrega null", () => {
    const r = OrdenCompraSchema.safeParse({ ...OK, fechaEntrega: null })
    expect(r.success).toBe(true)
  })
})

// ── RequisicionSchema ────────────────────────────────────────────────────────

describe("RequisicionSchema", () => {
  const baseReq = {
    id: "r1",
    tipo: "automatizacion" as const,
    solicitante: "Oscar",
    estado: "no_comprado" as const,
    fechaPedido: "2026-07-01",
    tienda: null,
    descripcion: "Conector SMC",
    cantidad: null,
    prioridad: null,
    empresa: null,
    ordenServicio: null,
    parteNumero: null,
    fechaEntregaEst: null,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  }

  it("default null en campos nuevos (registros viejos)", () => {
    const r = RequisicionSchema.parse(baseReq)
    expect(r.link).toBeNull()
    expect(r.recibio).toBeNull()
    expect(r.revisionFinanzas).toBeNull()
    expect(r.nota).toBeNull()
  })

  it("acepta link y nota", () => {
    const r = RequisicionSchema.parse({
      ...baseReq,
      link: "https://www.automationdirect.com/adc/overview",
      nota: "Entregadas 28 piezas",
    })
    expect(r.link).toContain("automationdirect")
    expect(r.nota).toBe("Entregadas 28 piezas")
  })

  it("acepta estado parcial", () => {
    const r = RequisicionSchema.parse({ ...baseReq, estado: "parcial" })
    expect(r.estado).toBe("parcial")
  })
})
