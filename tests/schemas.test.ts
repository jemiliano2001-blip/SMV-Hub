import { describe, it, expect } from "vitest"
import {
  ItemFacturaSchema,
  ExtraccionInvoiceSchema,
  CamposManualSchema,
  NuevaCompraFormSchema,
  OrdenCompraSchema,
  EstadoOrdenSchema,
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
    const { moneda: _, ...sinMoneda } = BASE
    const r = ExtraccionInvoiceSchema.safeParse(sinMoneda)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.moneda).toBe("USD")
  })

  it("asigna items [] por defecto si falta", () => {
    const { items: _, ...sinItems } = BASE
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

  it("rechaza proveedor ausente", () => {
    const { proveedor: _, ...sinProveedor } = BASE
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
  const OK = { requisitor: "Juan", ordenTrabajo: "OT-100", empresa: "SMV" }

  it("valida campos completos", () => {
    expect(CamposManualSchema.safeParse(OK).success).toBe(true)
  })

  it("rechaza requisitor vacío", () => {
    const r = CamposManualSchema.safeParse({ ...OK, requisitor: "" })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.requisitor).toBeDefined()
    }
  })

  it("rechaza ordenTrabajo vacía", () => {
    const r = CamposManualSchema.safeParse({ ...OK, ordenTrabajo: "" })
    expect(r.success).toBe(false)
  })

  it("rechaza empresa vacía", () => {
    const r = CamposManualSchema.safeParse({ ...OK, empresa: "" })
    expect(r.success).toBe(false)
  })
})

// ── NuevaCompraFormSchema (ExtraccionInvoice + CamposManual) ─────────────────

describe("NuevaCompraFormSchema", () => {
  const OK = {
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
  }

  it("valida form completo", () => {
    expect(NuevaCompraFormSchema.safeParse(OK).success).toBe(true)
  })

  it("rechaza si falta empresa", () => {
    const { empresa: _, ...sin } = OK
    expect(NuevaCompraFormSchema.safeParse(sin).success).toBe(false)
  })

  it("rechaza si falta proveedor", () => {
    const { proveedor: _, ...sin } = OK
    expect(NuevaCompraFormSchema.safeParse(sin).success).toBe(false)
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
    const { estado: _, ...sinEstado } = OK
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
    const { imagenUrl, imagenPath, ...sinImagen } = OK
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
