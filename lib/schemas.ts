import { z } from "zod"

// ── Ítem de factura extraído por IA ──────────────────────────────────────────

export const ItemFacturaSchema = z.object({
  descripcion: z.string(),
  cantidad: z.number().nullable(),
  precioUnitario: z.number().nullable(),
  total: z.number().nullable(),
})

// ── Lo que Claude extrae de la imagen de la factura ──────────────────────────

export const ExtraccionInvoiceSchema = z.object({
  proveedor: z.string(),
  numeroFactura: z.string().nullable(),
  fechaFactura: z.string().nullable(), // ISO 8601 o "YYYY-MM-DD"
  moneda: z.string().default("USD"),
  subtotal: z.number().nullable(),
  impuestos: z.number().nullable(),
  total: z.number().nullable(),
  items: z.array(ItemFacturaSchema).default([]),
})

export type ExtraccionInvoice = z.infer<typeof ExtraccionInvoiceSchema>
export type ItemFactura = z.infer<typeof ItemFacturaSchema>

// ── Campos que el usuario completa manualmente ───────────────────────────────

export const CamposManualSchema = z.object({
  requisitor: z.string().min(1, "El requisitor es obligatorio"),
  ordenTrabajo: z.string().min(1, "La orden de trabajo es obligatoria"),
  empresa: z.string().min(1, "La empresa es obligatoria"),
})

export type CamposManual = z.infer<typeof CamposManualSchema>

// ── Schema completo del form de nueva compra ─────────────────────────────────

export const NuevaCompraFormSchema = ExtraccionInvoiceSchema.extend(CamposManualSchema.shape)
export type NuevaCompraForm = z.infer<typeof NuevaCompraFormSchema>

// ── Orden de compra guardada en Firestore ────────────────────────────────────

export const EstadoOrdenSchema = z.enum(["pendiente", "aprobada", "rechazada"])
export type EstadoOrden = z.infer<typeof EstadoOrdenSchema>

export const OrdenCompraSchema = NuevaCompraFormSchema.extend({
  id: z.string(),
  imagenUrl: z.string().url().optional(),
  imagenPath: z.string().optional(),
  linkProveedor: z.string().nullable().optional(),
  fechaEntrega: z.string().nullable().optional(),
  estado: EstadoOrdenSchema.default("pendiente"),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})

export type OrdenCompra = z.infer<typeof OrdenCompraSchema>
