import { z } from "zod"

// ── Ítem de factura extraído por IA ──────────────────────────────────────────

export const ItemFacturaSchema = z.object({
  descripcion: z.string(),
  descripcionSimplificada: z.string().optional().default(""),
  cantidad: z.number().nullable(),
  precioUnitario: z.number().nullable(),
  total: z.number().nullable(),
  claveProdServ: z.string().regex(/^\d{8}$/).nullable().optional().default(null),
  satPendiente: z.boolean().optional().default(true),
  /** Empresa / destino (mismo concepto en SMV). */
  empresa: z.string().optional().default(""),
  cuentaCargo: z.string().optional().default(""),
  requisitor: z.string().optional().default(""),
  ordenTrabajo: z.string().optional().default(""),
})

export type ItemFactura = z.infer<typeof ItemFacturaSchema>

// ── Lo que la IA (Gemini) extrae de la imagen de la factura ──────────────────

export const ExtraccionInvoiceSchema = z.object({
  proveedor: z.string(),
  numeroFactura: z.string().nullable(),
  fechaFactura: z.string().nullable(), // ISO 8601 o "YYYY-MM-DD"
  moneda: z.string().default("USD"),
  subtotal: z.number().nullable(),
  /** Cargo de envío / shipping (aparte del subtotal de mercancía). */
  envio: z.number().nullable().default(null),
  impuestos: z.number().nullable(),
  total: z.number().nullable(),
  items: z.array(ItemFacturaSchema).default([]),
})

export type ExtraccionInvoice = z.infer<typeof ExtraccionInvoiceSchema>

// ── Campos legacy a nivel orden (órdenes históricas / listado) ────────────────

export const CamposManualSchema = z.object({
  requisitor: z.string().optional().default(""),
  ordenTrabajo: z.string().optional().default(""),
  empresa: z.string().optional().default(""),
  cuentaCargo: z.string().optional().default(""),
  destino: z.string().optional().default(""),
})

export type CamposManual = z.infer<typeof CamposManualSchema>

/** Campos de ítem con fallback a la orden (compatibilidad con datos antiguos). */
export function resolverCampoItem(
  item: ItemFactura,
  orden: CamposManual,
  campo: "empresa" | "cuentaCargo" | "requisitor" | "ordenTrabajo"
): string {
  const enItem = item[campo]?.trim()
  if (enItem) return enItem
  if (campo === "empresa") {
    return orden.empresa?.trim() || orden.destino?.trim() || ""
  }
  return orden[campo]?.trim() || ""
}

/** Destino = empresa (mismo concepto). */
export function resolverDestinoItem(item: ItemFactura, orden: CamposManual): string {
  return resolverCampoItem(item, orden, "empresa")
}

/** Sincroniza campos legacy de orden desde el primer ítem (listados). */
export function sincronizarCamposLegacyOrden<
  T extends CamposManual & { items: ItemFactura[] },
>(datos: T): T {
  const primero = datos.items[0]
  if (!primero) return datos
  const empresa = resolverCampoItem(primero, datos, "empresa")
  return {
    ...datos,
    requisitor: resolverCampoItem(primero, datos, "requisitor"),
    ordenTrabajo: resolverCampoItem(primero, datos, "ordenTrabajo"),
    empresa,
    destino: empresa,
    cuentaCargo: resolverCampoItem(primero, datos, "cuentaCargo"),
  }
}

function validarItemsCompra(items: ItemFactura[], ctx: z.RefinementCtx): void {
  if (items.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Agrega al menos un ítem",
      path: ["items"],
    })
    return
  }
  items.forEach((item, i) => {
    const suf = items.length > 1 ? ` (ítem ${i + 1})` : ""
    if (!item.requisitor?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Requisitor obligatorio${suf}`,
        path: ["items", i, "requisitor"],
      })
    }
    if (!item.empresa?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Empresa obligatoria${suf}`,
        path: ["items", i, "empresa"],
      })
    }
  })
}

// ── Schema completo del form de nueva compra ─────────────────────────────────

const NuevaCompraFormBaseSchema = ExtraccionInvoiceSchema.extend(CamposManualSchema.shape)

export const NuevaCompraFormSchema = NuevaCompraFormBaseSchema.superRefine((data, ctx) => {
  validarItemsCompra(data.items, ctx)
})

export type NuevaCompraForm = z.infer<typeof NuevaCompraFormBaseSchema>

// ── Orden de compra guardada en Firestore ────────────────────────────────────

export const EstadoOrdenSchema = z.enum(["pendiente", "aprobada", "rechazada"])
export type EstadoOrden = z.infer<typeof EstadoOrdenSchema>

export const OrdenCompraSchema = NuevaCompraFormBaseSchema.extend({
  id: z.string(),
  imagenUrl: z.string().url().optional(),
  imagenPath: z.string().optional(),
  linkProveedor: z.string().nullable().optional(),
  fechaEntrega: z.string().nullable().optional(),
  estado: EstadoOrdenSchema.default("pendiente"),
  reporteContableId: z.string().nullable().optional(),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})

export type OrdenCompra = z.infer<typeof OrdenCompraSchema>

// ── Cotización (base de datos histórica buscable) ────────────────────────────
// Modelo plano: 1 fila = 1 pieza cotizada con 1 proveedor (la misma pieza con
// varios proveedores son varios registros, para comparar precios). Cada registro
// lleva UNA moneda según la ubicación: USA→USD, MX→MXN (nunca se mezclan).

export const EstatusCotizacionSchema = z.enum(["cotizado", "cancelado", "revisar"])
export type EstatusCotizacion = z.infer<typeof EstatusCotizacionSchema>

export const UbicacionSchema = z.enum(["MX", "USA"])
export type Ubicacion = z.infer<typeof UbicacionSchema>

export const CotizacionSchema = z.object({
  id: z.string(),
  solicitante: z.string(),                        // quién pide (Edgar, Francisco…)
  fecha: z.string().nullable(),                   // "YYYY-MM-DD"
  estatus: EstatusCotizacionSchema.default("cotizado"),
  ubicacion: UbicacionSchema,
  proveedor: z.string(),
  descripcion: z.string(),
  numeroParte: z.string().nullable(),
  cantidad: z.number().nullable(),
  precioUnitario: z.number().nullable(),
  moneda: z.enum(["USD", "MXN"]),                 // derivada de ubicacion en el import
  total: z.number().nullable(),
  diasHabiles: z.string().nullable(),             // texto libre: "3 dias", "20-30 dias"
  link: z.string().nullable(),                    // sanitizada http/https en el import
  notas: z.string().nullable(),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})

export type Cotizacion = z.infer<typeof CotizacionSchema>

// ── Requisición de compra ─────────────────────────────────────────────────────
// Solicitud que un ingeniero levanta para que se compre un material o herramienta.

export const EstatusRequisicionSchema = z.enum([
  "no_comprado",
  "en_proceso",
  "comprado",
  "parcial",
  "recibido",
])
export type EstatusRequisicion = z.infer<typeof EstatusRequisicionSchema>

export const PrioridadRequisicionSchema = z.enum(["1-2 dias", "3-5 dias", "7-14 dias", "cuando se pueda"])
export type PrioridadRequisicion = z.infer<typeof PrioridadRequisicionSchema>

export const TipoRequisicionSchema = z.enum(["general", "automatizacion"])
export type TipoRequisicion = z.infer<typeof TipoRequisicionSchema>

export const RequisicionSchema = z.object({
  id: z.string(),
  tipo: TipoRequisicionSchema.default("general"),
  solicitante: z.string(),
  estado: EstatusRequisicionSchema.default("no_comprado"),
  fechaPedido: z.string(),          // YYYY-MM-DD
  tienda: z.string().nullable(),    // "Tienda" en general, "Proveedor" en automatización
  descripcion: z.string().min(1),
  link: z.string().nullable().default(null),
  cantidad: z.string().nullable(),  // texto libre: "1 paq", "20 pz", "100"
  prioridad: PrioridadRequisicionSchema.nullable(),
  empresa: z.string().nullable(),
  ordenServicio: z.string().nullable(),
  parteNumero: z.string().nullable(),  // solo automatización: No. de parte
  fechaEntregaEst: z.string().nullable(), // solo automatización: fecha de entrega estimada
  recibio: z.string().nullable().default(null),
  revisionFinanzas: z.string().nullable().default(null),
  nota: z.string().nullable().default(null),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})
export type Requisicion = z.infer<typeof RequisicionSchema>

// ── Orden de servicio (seguimiento de OTs con proveedores externos — hoja Fisher) ──

export const EstatusOrdenServicioSchema = z.enum([
  "pendiente",
  "en_proceso",
  "detenida",
  "entregada",
  "cancelado",
])
export type EstatusOrdenServicio = z.infer<typeof EstatusOrdenServicioSchema>

export const OrdenServicioSchema = z.object({
  id: z.string(),
  estatus: EstatusOrdenServicioSchema.default("pendiente"),
  fechaOC: z.string().nullable(),        // YYYY-MM-DD: fecha de la orden de compra
  numOC: z.string().nullable(),          // número de OC: "MXN050116"
  requisitor: z.string(),
  ingAcargo: z.string().nullable(),      // ingeniero a cargo
  ordenTrabajo: z.string().nullable(),   // número de OT
  descripcion: z.string().min(1),
  cantidad: z.string().nullable(),       // texto libre: "12", "1 pza", "3 mts"
  cantidadEntregada: z.number().nullable().optional().default(null),
  cantidadPendiente: z.number().nullable().optional().default(null),
  tiempoEntrega: z.string().nullable(),  // texto libre: "6 dias h", "??"
  fechaEntrega: z.string().nullable(),   // texto o YYYY-MM-DD: "??", "8 al 15 abril"
  fechaEntregaActualizada: z.string().nullable().optional().default(null),
  nota: z.string().nullable().optional().default(null),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})
export type OrdenServicio = z.infer<typeof OrdenServicioSchema>

// ── Catálogo de operadores (fuente de verdad de nombres/roles) ────────────────

export const AreaSchema = z.enum(["taller", "diseno", "automatizacion", "cnc", "limpieza", "administracion"])
export type Area = z.infer<typeof AreaSchema>

export const OperadorSchema = z.object({
  id: z.string(),
  nombre: z.string().min(1),
  area: AreaSchema.default("taller"),
  activo: z.boolean().default(true),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})
export type Operador = z.infer<typeof OperadorSchema>

// ── Usuarios (roles y acceso, administrados desde /usuarios) ──────────────────

export const RolSchema = z.enum(["admin", "compras", "diseno", "almacen"])
export type Rol = z.infer<typeof RolSchema>

export const ProveedorAuthSchema = z.enum(["google", "password"])
export type ProveedorAuth = z.infer<typeof ProveedorAuthSchema>

export const UsuarioSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  rol: RolSchema,
  activo: z.boolean().default(true),
  proveedor: ProveedorAuthSchema,
  creadoPor: z.string(),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})
export type Usuario = z.infer<typeof UsuarioSchema>

// ── Almacén (Entradas y Salidas) ─────────────────────────────────────────────

export const EntradaAlmacenSchema = z.object({
  id: z.string(),
  fecha: z.string(),
  descripcion: z.string().min(1),
  cantidad: z.string(),
  cargoA: z.string(),
  recibio: z.string(),
  revision: z.string().nullable(),
  estatus: z.enum(["pendiente", "entregado", "devuelto"]).default("entregado"),
  notas: z.string().nullable(),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})
export type EntradaAlmacen = z.infer<typeof EntradaAlmacenSchema>

export const SalidaAlmacenSchema = z.object({
  id: z.string(),
  fecha: z.string(),
  herramienta: z.string().min(1),
  cantidad: z.number().default(1),
  operador: z.string(),
  cambio: z.string().nullable(),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})
export type SalidaAlmacen = z.infer<typeof SalidaAlmacenSchema>

// ── Control de Baños ──────────────────────────────────────────────────────────

export const BanoSchema = z.enum(["Baño #1", "Baño #2", "CNC", "Automatizacion"])
export type Bano = z.infer<typeof BanoSchema>

export const RegistroBanoSchema = z.object({
  id: z.string(),
  operador: z.string(),
  bano: BanoSchema,
  horaEntrada: z.string(),
  horaLlegada: z.string().nullable(),
  fecha: z.string(),
  tiempoMinutos: z.number().nullable(),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})
export type RegistroBano = z.infer<typeof RegistroBanoSchema>

// ── Horas Extra ───────────────────────────────────────────────────────────────

export const DepartamentoSchema = z.enum(["diseno", "automatizacion", "taller", "cnc"])
export type Departamento = z.infer<typeof DepartamentoSchema>

export const HorasExtraSchema = z.object({
  id: z.string(),
  empleado: z.string(),
  departamento: DepartamentoSchema,
  semanaInicio: z.string(), // YYYY-MM-DD
  miercoles: z.string().nullable(),
  jueves: z.string().nullable(),
  viernes: z.string().nullable(),
  sabado: z.string().nullable(),
  domingo: z.string().nullable(),
  lunes: z.string().nullable(),
  martes: z.string().nullable(),
  totalHoras: z.number().nullable(),
  notas: z.string().nullable(),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})
export type HorasExtra = z.infer<typeof HorasExtraSchema>

// ── Caja Chica ───────────────────────────────────────────────────────────────

export const TipoMovimientoCajaSchema = z.enum(["ENTRADA", "SALIDA"])
export type TipoMovimientoCaja = z.infer<typeof TipoMovimientoCajaSchema>

export const ComprobanteCajaSchema = z.enum(["FACTURA", "VALE", "TICKET", "NINGUNO"])
export type ComprobanteCaja = z.infer<typeof ComprobanteCajaSchema>

export const MovimientoCajaChicaSchema = z.object({
  id: z.string(),
  fecha: z.string(), // YYYY-MM-DD
  periodo: z.string(), // YYYY-MM
  descripcion: z.string(),
  proveedor: z.string(),
  categoria: z.string(),
  solicitante: z.string(),
  comprobante: ComprobanteCajaSchema,
  deducible: z.boolean(),
  tipo: TipoMovimientoCajaSchema,
  monto: z.number().min(0),
  costoReal: z.number().min(0),
  ivaEstimado: z.number().min(0),
  verificado: z.boolean().default(false),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})
export type MovimientoCajaChica = z.infer<typeof MovimientoCajaChicaSchema>

// ── Finanzas: facturación de clientes (espejo de solo lectura de Odoo) ───────
// Campos confirmados contra Odoo real (Fase 0, 2026-07-15): account.move,
// compañía única "SERVICIOS Y MAQUINADOS VAZQUEZ" (id=1).

export const EstadoPagoFacturaSchema = z.enum(["no_pagado", "pagado_parcial", "pagado", "revertido"])
export type EstadoPagoFactura = z.infer<typeof EstadoPagoFacturaSchema>

export const EstadoFacturaSchema = z.enum(["borrador", "publicado", "cancelado"]) // state: draft/posted/cancel
export type EstadoFactura = z.infer<typeof EstadoFacturaSchema>

export const TipoFacturaSchema = z.enum(["factura", "nota_credito"]) // move_type: out_invoice/out_refund
export type TipoFactura = z.infer<typeof TipoFacturaSchema>

export const FacturaClienteSchema = z.object({
  id: z.string(), // `odoo_<move_id>`
  odooId: z.number(),
  odooCompanyId: z.number(),
  numeroFactura: z.string(), // move.name — "/" hasta que se postea
  cliente: z.string(), // partner_id[1]
  odooPartnerId: z.number(), // partner_id[0]
  fechaFactura: z.string().nullable(), // invoice_date, YYYY-MM-DD — null en no-posteadas
  fechaVencimiento: z.string().nullable(), // invoice_date_due
  moneda: z.string(), // currency_id[1], código ISO — nunca asumir MXN
  subtotal: z.number(), // amount_untaxed
  impuestos: z.number(), // amount_tax — nunca hardcodear tasa (8% frontera ≠ 16% general)
  total: z.number(), // amount_total
  saldoPendiente: z.number(), // amount_residual ("Amount Due")
  montoPagado: z.number(), // derivado: total - saldoPendiente
  estadoPago: EstadoPagoFacturaSchema,
  estado: EstadoFacturaSchema,
  tipo: TipoFacturaSchema,
  referencia: z.string().nullable(), // ref: PO del cliente, o nota de reversión en notas de crédito
  origenVenta: z.string().nullable(), // invoice_origin — orden de venta origen, ej. "2026/S01413"
  origen: z.literal("odoo"), // trazabilidad (CLAUDE.md regla 9)
  sincronizadoEn: z.date(),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})
export type FacturaCliente = z.infer<typeof FacturaClienteSchema>

