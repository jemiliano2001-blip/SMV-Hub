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
  linkProveedor: z.string().nullable().optional(),
  fechaEntrega: z.string().nullable().optional(),
})

export type ExtraccionInvoice = z.infer<typeof ExtraccionInvoiceSchema>

// ── Campos legacy a nivel orden (órdenes históricas / listado) ────────────────

export const CamposManualSchema = z.object({
  requisitor: z.string().optional().default(""),
  ordenTrabajo: z.string().optional().default(""),
  empresa: z.string().optional().default(""),
  cuentaCargo: z.string().optional().default(""),
  destino: z.string().optional().default(""),
  linkProveedor: z.string().nullable().optional(),
  fechaEntrega: z.string().nullable().optional(),
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
  /** FK opcional al catálogo de proveedores (USA Tooling). Retrocompatible. */
  proveedorId: z.string().nullable().optional(),
  /** FK opcional a la cotización ganadora que originó esta OC (flujo requisiciones). */
  cotizacionGanadoraId: z.string().nullable().optional(),
  /** FK opcional a la requisición que originó esta OC. */
  requisicionId: z.string().nullable().optional(),
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
  /** FK opcional al catálogo de proveedores (USA Tooling). Retrocompatible. */
  proveedorId: z.string().nullable().optional(),
  descripcion: z.string(),
  numeroParte: z.string().nullable(),
  /** Llave canónica para cruzar histórico ↔ requisición ↔ comparador. */
  llavePieza: z.string().nullable().optional(),
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

export const EstatusRequisicionFlujoSchema = z.enum([
  "borrador",
  "enviada",
  "cotizando",
  "aprobada",
  "rechazada",
  "convertida_a_oc",
])
export type EstatusRequisicionFlujo = z.infer<typeof EstatusRequisicionFlujoSchema>

export const PrioridadFlujoSchema = z.enum(["baja", "media", "alta", "urgente"])
export type PrioridadFlujo = z.infer<typeof PrioridadFlujoSchema>

export const ItemRequisicionSchema = z.object({
  id: z.string(),
  descripcion: z.string().min(1),
  categoria: z.string().default("endmills"), // endmills, insertos, tooling, consumibles
  cantidad: z.number().min(1),
  unidad: z.string().default("pza"),
  marcaPreferida: z.string().optional(),
  especificacion: z.string().optional(),
  fechaRequerida: z.string().optional(),
  proveedorSugeridoId: z.string().optional(),
  proveedorSugeridoNombre: z.string().optional(),
})
export type ItemRequisicion = z.infer<typeof ItemRequisicionSchema>

export const CotizacionRequisicionSchema = z.object({
  id: z.string(),
  requisicionId: z.string(),
  proveedorId: z.string(),
  proveedorNombre: z.string(),
  fechaCotizacion: z.string(),
  moneda: z.enum(["USD", "MXN"]).default("USD"),
  condicionesPago: z.string().default("Net 30"),
  leadTimeDias: z.number().default(3),
  costoEnvioUSD: z.number().default(0),
  subtotal: z.number().default(0),
  total: z.number().default(0),
  observaciones: z.string().optional(),
  itemsCotizados: z.array(
    z.object({
      itemId: z.string(),
      descripcion: z.string(),
      cantidad: z.number(),
      precioUnitario: z.number(),
      subtotal: z.number(),
      /** Categoría del item original de la requisición (endmills/insertos/tooling/...); se
       * usa al generar la OC para alimentar la inteligencia de proveedores con la categoría
       * real en vez de un valor fijo. */
      categoria: z.string().optional(),
    })
  ).default([]),
  ganadora: z.boolean().default(false),
  creadoEn: z.date().optional(),
})
export type CotizacionRequisicion = z.infer<typeof CotizacionRequisicionSchema>

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
  // ── Campos extendidos de flujo de compras de punta a punta ──
  folio: z.string().optional(),
  departamento: z.string().optional(),
  prioridadFlujo: PrioridadFlujoSchema.optional(),
  estatusFlujo: EstatusRequisicionFlujoSchema.optional(),
  motivoJustificacion: z.string().optional(),
  items: z.array(ItemRequisicionSchema).optional(),
  proveedorGanadorId: z.string().nullable().optional(),
  proveedorGanadorNombre: z.string().nullable().optional(),
  motivoSeleccion: z.string().nullable().optional(),
  fechaDecision: z.string().nullable().optional(),
  usuarioDecision: z.string().nullable().optional(),
  aprobacionRequerida: z.boolean().optional(),
  aprobador: z.string().nullable().optional(),
  estatusAprobacion: z.enum(["pendiente", "aprobada", "rechazada"]).optional(),
  fechaAprobacion: z.string().nullable().optional(),
  ordenCompraFolio: z.string().nullable().optional(),
  ordenCompraId: z.string().nullable().optional(),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})
export type Requisicion = z.infer<typeof RequisicionSchema>

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

// ── Gafetes de personal (perfil privado ligado a operadores/{id}) ──────────

export const GafeteAjusteFotoSchema = z.object({
  rotacion: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).default(0),
  zoom: z.number().min(0.75).max(2.5).default(1),
  desplazamientoX: z.number().min(-50).max(50).default(0),
  desplazamientoY: z.number().min(-50).max(50).default(0),
})
export type GafeteAjusteFoto = z.infer<typeof GafeteAjusteFotoSchema>

/**
 * Datos privados que se imprimen en un gafete. El nombre y el área se leen de
 * `operadores/{operadorId}` para no duplicar la fuente de verdad del personal.
 */
export const GafetePerfilSchema = z.object({
  id: z.string(),
  operadorId: z.string(),
  cargo: z.string(),
  fechaIngreso: z.string(),
  nss: z.string(),
  rfc: z.string(),
  fotoPath: z.string(),
  fotoAjuste: GafeteAjusteFotoSchema,
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})
export type GafetePerfil = z.infer<typeof GafetePerfilSchema>

// ── Usuarios (roles y acceso, administrados desde /usuarios) ──────────────────

export const RolSchema = z.enum(["admin", "compras", "diseno", "almacen", "automatizacion"])
export type Rol = z.infer<typeof RolSchema>

/** Identificadores de módulo asignables por usuario (sí/no). */
export const ModuloIdSchema = z.enum([
  "nueva-compra",
  "ordenes",
  "claves-sat",
  "cotizaciones",
  "endmills",
  "requisiciones",
  "proveedores",
  "reportes",
  "caja-chica",
  "almacen",
  "pedidos-almacen",
  "operadores",
  "horas-extra",
  "banos",
  "notificaciones",
  "finanzas",
  "documentos-venta",
  "auditoria",
  "usuarios",
])
export type ModuloId = z.infer<typeof ModuloIdSchema>

export const ProveedorAuthSchema = z.enum(["google", "password"])
export type ProveedorAuth = z.infer<typeof ProveedorAuthSchema>

export const UsuarioSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  /** @deprecated Preferir `plantilla` + `modulos`. Se sincroniza al escribir. */
  rol: RolSchema,
  plantilla: RolSchema.optional(),
  modulos: z.array(ModuloIdSchema).default([]),
  esSuperAdmin: z.boolean().default(false),
  activo: z.boolean().default(true),
  proveedor: ProveedorAuthSchema,
  atiendeDocumentosVenta: z.boolean().default(false),
  /** Permite editar /horas-extra sin plantilla admin/compras (contabilidad, automatización). */
  editaHorasExtra: z.boolean().default(false),
  operadorId: z.string().nullable().optional(),
  operadorNombre: z.string().nullable().optional(),
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

// ── Pedidos de almacén (captura móvil: "necesito que compres X") ──────────────
// El encargado de almacén anota qué necesita comprado, sin datos de factura.
// Se convierte en una orden real vía /nueva-compra?pedidoId=... (lib/pedidos-almacen.ts).

export const EstadoPedidoAlmacenSchema = z.enum(["pendiente", "comprado", "cancelado"])
export type EstadoPedidoAlmacen = z.infer<typeof EstadoPedidoAlmacenSchema>

export const PedidoAlmacenSchema = z.object({
  id: z.string(),
  descripcion: z.string().min(1),
  urgente: z.boolean().default(false),
  imagenUrl: z.string().url().optional(),
  imagenPath: z.string().optional(),
  estado: EstadoPedidoAlmacenSchema.default("pendiente"),
  solicitadoPorUid: z.string(),
  solicitadoPorNombre: z.string(),
  ordenIdVinculada: z.string().nullable().default(null),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})
export type PedidoAlmacen = z.infer<typeof PedidoAlmacenSchema>

export const NuevoPedidoAlmacenSchema = PedidoAlmacenSchema.pick({
  descripcion: true,
  urgente: true,
  imagenUrl: true,
  imagenPath: true,
  solicitadoPorUid: true,
  solicitadoPorNombre: true,
})
export type NuevoPedidoAlmacen = z.infer<typeof NuevoPedidoAlmacenSchema>

// Endmills China: inventario y ciclos de compra.
export const CategoriaEndmillSchema = z.enum([
  "FLAT",
  "BALL",
  "LARGO_FLAT",
  "LARGO_BOLA",
  "EXTRA_LARGO_FLAT",
  "EXTRA_LARGO_BOLA",
  "RUPA_CARBURO",
])
export type CategoriaEndmill = z.infer<typeof CategoriaEndmillSchema>

export const EstadoStockEndmillSchema = z.enum(["sin_base", "critico", "bajo", "ok"])
export type EstadoStockEndmill = z.infer<typeof EstadoStockEndmillSchema>

export const ProveedorEndmillsSnapshotSchema = z.object({
  nombre: z.string().min(1),
  contacto: z.string().min(1),
  email: z.string().email(),
  origen: z.string().min(1),
})
export type ProveedorEndmillsSnapshot = z.infer<typeof ProveedorEndmillsSnapshotSchema>

export const EndmillMedidaSchema = z.object({
  id: z.string().min(1),
  orden: z.number().int().positive(),
  categoria: CategoriaEndmillSchema,
  medidaPulgadas: z.string().min(1),
  descripcion: z.string().min(1),
  stockActual: z.number().int().min(0),
  stockActualizadoEn: z.date(),
  precioActualUSD: z.number().min(0),
  cotizacionFecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  specPropuesta: z.string().min(1),
  requiereConfirmacion: z.boolean(),
  notas: z.string().nullable(),
  objetivoPar: z.number().int().min(0).nullable(),
  ultimoPedidoId: z.string().nullable(),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})
export type EndmillMedida = z.infer<typeof EndmillMedidaSchema>

export const CrearEndmillMedidaInputSchema = z.object({
  categoria: CategoriaEndmillSchema,
  medidaPulgadas: z.string().trim().min(1),
  descripcion: z.string().trim().min(1),
  specPropuesta: z.string().trim().min(1),
  stockInicial: z.number().int().min(0).default(0),
  precioActualUSD: z.number().min(0).default(0),
  cotizacionFecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  requiereConfirmacion: z.boolean().default(false),
  objetivoPar: z.number().int().min(0).nullable().optional().default(null),
  notas: z.string().trim().nullable().optional().default(null),
})
export type CrearEndmillMedidaInput = z.infer<typeof CrearEndmillMedidaInputSchema>

export const ReordenarMedidaItemSchema = z.object({
  id: z.string().min(1),
  orden: z.number().int().positive(),
})
export type ReordenarMedidaItem = z.infer<typeof ReordenarMedidaItemSchema>

export const EstadoPedidoEndmillsSchema = z.enum(["confirmado", "recibido", "cancelado"])
export type EstadoPedidoEndmills = z.infer<typeof EstadoPedidoEndmillsSchema>

export const PedidoEndmillsSchema = z.object({
  id: z.string().min(1),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  numeroProveedor: z.string().nullable(),
  estado: EstadoPedidoEndmillsSchema,
  proveedor: ProveedorEndmillsSnapshotSchema,
  moneda: z.literal("USD"),
  costoItemsUSD: z.number().min(0),
  aliCostUSD: z.number().min(0),
  shippingUSD: z.number().min(0),
  totalUSD: z.number().min(0),
  costosAdicionalesConfirmados: z.boolean(),
  numeroPartidas: z.number().int().min(0),
  numeroPiezas: z.number().int().min(0),
  origen: z.enum(["semilla", "manual"]),
  motivoCancelacion: z.string().nullable(),
  fechaRecepcionCompleta: z.string().nullable().optional().default(null),
  diasLeadTime: z.number().int().min(0).nullable().optional().default(null),
  tipoCambioUSD: z.number().positive().nullable().optional().default(null),
  creadoPorUid: z.string(),
  creadoPorNombre: z.string().min(1),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})
export type PedidoEndmills = z.infer<typeof PedidoEndmillsSchema>

export const TipoPartidaPedidoEndmillsSchema = z.enum(["catalogada", "fuera_catalogo"])

export const RecepcionParcialEndmillSchema = z.object({
  cantidad: z.number().int().positive(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notas: z.string().optional(),
})
export type RecepcionParcialEndmill = z.infer<typeof RecepcionParcialEndmillSchema>

export const PartidaPedidoEndmillsSchema = z.object({
  id: z.string().min(1),
  pedidoId: z.string().min(1),
  fechaPedido: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tipo: TipoPartidaPedidoEndmillsSchema,
  medidaId: z.string().nullable(),
  categoria: CategoriaEndmillSchema.nullable(),
  medidaPulgadas: z.string(),
  descripcion: z.string().min(1),
  spec: z.string(),
  stockAntesPedido: z.number().int().min(0).nullable(),
  cantidadPedida: z.number().int().positive(),
  cantidadRecibida: z.number().int().min(0),
  recepciones: z.array(RecepcionParcialEndmillSchema).optional().default([]),
  precioUnitarioUSD: z.number().min(0),
  subtotalUSD: z.number().min(0),
  objetivoPar: z.number().int().min(0).nullable(),
  requiereConfirmacionAlCrear: z.boolean(),
  confirmacionResuelta: z.boolean(),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
}).superRefine((partida, ctx) => {
  if (partida.cantidadRecibida > partida.cantidadPedida) {
    ctx.addIssue({
      code: "custom",
      path: ["cantidadRecibida"],
      message: "La cantidad recibida no puede superar la pedida",
    })
  }
  if (partida.tipo === "catalogada" && (!partida.medidaId || !partida.categoria)) {
    ctx.addIssue({
      code: "custom",
      path: ["medidaId"],
      message: "Una partida catalogada requiere medida y categoría",
    })
  }
  if (partida.tipo === "fuera_catalogo" && partida.medidaId !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["medidaId"],
      message: "Una partida fuera de catálogo no puede apuntar a una medida",
    })
  }
})
export type PartidaPedidoEndmills = z.infer<typeof PartidaPedidoEndmillsSchema>

export const BorradorPartidaEndmillsSchema = z.object({
  medidaId: z.string().min(1),
  stockRevisado: z.number().int().min(0),
  cantidadPedida: z.number().int().min(0),
  precioUnitarioUSD: z.number().min(0),
  confirmacionResuelta: z.boolean(),
})
export type BorradorPartidaEndmills = z.infer<typeof BorradorPartidaEndmillsSchema>

export const RegistrarPedidoEndmillsInputSchema = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  numeroProveedor: z.string().trim().min(1).nullable(),
  proveedor: ProveedorEndmillsSnapshotSchema,
  aliCostUSD: z.number().min(0),
  shippingUSD: z.number().min(0),
  tipoCambioUSD: z.number().positive().nullable().optional().default(null),
  costosAdicionalesConfirmados: z.boolean(),
  partidas: z.array(BorradorPartidaEndmillsSchema).min(1),
})
export type RegistrarPedidoEndmillsInput = z.infer<typeof RegistrarPedidoEndmillsInputSchema>

export const RecibirPedidoEndmillsInputSchema = z.object({
  fechaRecepcion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  partidas: z.array(z.object({
    partidaId: z.string().min(1),
    cantidadRecibida: z.number().int().min(0),
    notas: z.string().optional(),
  })).min(1),
})
export type RecibirPedidoEndmillsInput = z.infer<typeof RecibirPedidoEndmillsInputSchema>

// Estructura del archivo privado de importación.
export const CategoriaEndmillSeedSchema = z.enum([
  "FLAT",
  "BALL",
  "LARGO FLAT",
  "LARGO BOLA",
  "EXTRA LARGO FLAT",
  "EXTRA LARGO BOLA",
  "RUPA CARBURO",
])

export const EndmillsSeedSchema = z.object({
  _fuente: z.string().min(1),
  _advertencia: z.string().min(1),
  proveedor: ProveedorEndmillsSnapshotSchema,
  ordenMarzoTotales: z.object({
    piezasTotales: z.number().int().positive(),
    costoItemsUSD: z.number().min(0),
    aliCostUSD: z.number().min(0),
    shippingUSD: z.number().min(0),
    totalUSD: z.number().min(0),
    notaItemFueraDeLista: z.string().min(1),
  }),
  medidas: z.array(z.object({
    id: z.number().int().positive(),
    categoria: CategoriaEndmillSeedSchema,
    medidaPulgadas: z.string().min(1),
    descripcion: z.string().min(1),
    stockActual: z.number().int().min(0),
    precioActualUSD: z.number().min(0),
    ordenMarzo2026: z.object({
      piezasPedidas: z.number().int().positive().nullable(),
      precioUnitarioUSD: z.number().min(0).nullable(),
      subtotalUSD: z.number().min(0).nullable(),
      seHabiaPedidoAntes: z.boolean(),
    }),
    cotizacionChinaAgo2026: z.object({
      specPropuesta: z.string().min(1),
      precioUnitarioUSD: z.number().min(0),
      requiereConfirmacion: z.boolean(),
    }),
    notas: z.string().nullable(),
  })).length(47),
})
export type EndmillsSeed = z.infer<typeof EndmillsSeedSchema>

// ── Notificaciones in-app (Operación del Taller) ─────────────────────────────
// Feed broadcast de eventos de pedidos-almacén y requisiciones; leído por usuario
// en usuarios/{uid}/notificaciones_leidas/{notificacionId}.

export const TipoNotificacionSchema = z.enum([
  "pedido_almacen_creado",
  "pedido_almacen_estado",
  "requisicion_creada",
  "requisicion_estado",
  "banos_solicitud_creada",
  "banos_solicitud_resuelta",
  "solicitud_documento_creada",
  "solicitud_documento_estado",
  "solicitud_documento_mensaje",
  "endmills_stock_critico",
])
export type TipoNotificacion = z.infer<typeof TipoNotificacionSchema>

export const OrigenModuloNotificacionSchema = z.enum([
  "pedidos-almacen",
  "requisiciones",
  "banos",
  "documentos-venta",
  "endmills",
])
export type OrigenModuloNotificacion = z.infer<typeof OrigenModuloNotificacionSchema>

/** Grupo que puede ver la notificación además de su destinatario directo. */
export const AudienciaNotificacionSchema = z.enum([
  "pedidos-almacen",
  "requisiciones",
  "banos",
  "documentos-venta",
  "endmills",
])
export type AudienciaNotificacion = z.infer<typeof AudienciaNotificacionSchema>

export const NotificacionSchema = z.object({
  id: z.string(),
  tipo: TipoNotificacionSchema,
  titulo: z.string().min(1),
  cuerpo: z.string(),
  origenModulo: OrigenModuloNotificacionSchema,
  origenId: z.string().min(1),
  audiencia: AudienciaNotificacionSchema,
  /** Solicitante que debe ver el aviso aunque no pertenezca al grupo de atención. */
  destinatarioUid: z.string().min(1).nullable(),
  href: z.string().min(1),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
  creadoPorUid: z.string(),
  creadoPorNombre: z.string(),
})
export type Notificacion = z.infer<typeof NotificacionSchema>

export const NuevaNotificacionSchema = NotificacionSchema.omit({
  id: true,
  creadoEn: true,
  actualizadoEn: true,
})
export type NuevaNotificacion = z.infer<typeof NuevaNotificacionSchema>

export const NotificacionLeidaSchema = z.object({
  id: z.string(),
  leidoEn: z.date(),
})
export type NotificacionLeida = z.infer<typeof NotificacionLeidaSchema>

export type NotificacionConLeida = Notificacion & { leida: boolean }

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
  creadoPorUid: z.string().optional(),
  creadoPorNombre: z.string().optional(),
  solicitudBorradoEstado: z.literal("pendiente").optional(),
})
export type RegistroBano = z.infer<typeof RegistroBanoSchema>

// ── Solicitudes de eliminación de registros de baño ───────────────────────────

export const MotivoSolicitudBorradoBanoSchema = z.enum([
  "accidental",
  "bano_equivocado",
  "operador_equivocado",
  "hora_mal_capturada",
  "duplicado",
  "otro",
])
export type MotivoSolicitudBorradoBano = z.infer<typeof MotivoSolicitudBorradoBanoSchema>

export const EstadoSolicitudBorradoBanoSchema = z.enum([
  "pendiente",
  "auto_aprobada",
  "aprobada",
  "rechazada",
])
export type EstadoSolicitudBorradoBano = z.infer<typeof EstadoSolicitudBorradoBanoSchema>

export const ReglaAutoAprobacionSchema = z.enum([
  "duplicado_10min",
  "arrepentimiento_2min",
  "ia_aprobada",
  "ia_rechazada",
])
export type ReglaAutoAprobacion = z.infer<typeof ReglaAutoAprobacionSchema>

export const RegistroResumenSolicitudSchema = z.object({
  operador: z.string(),
  bano: BanoSchema,
  fecha: z.string(),
  horaEntrada: z.string(),
  horaLlegada: z.string().nullable(),
  tiempoMinutos: z.number().nullable(),
})
export type RegistroResumenSolicitud = z.infer<typeof RegistroResumenSolicitudSchema>

export const SolicitudBorradoBanoSchema = z.object({
  id: z.string(),
  registroId: z.string(),
  registroResumen: RegistroResumenSolicitudSchema,
  motivo: MotivoSolicitudBorradoBanoSchema,
  nota: z.string().optional(),
  solicitadoPorUid: z.string(),
  solicitadoPorNombre: z.string(),
  estado: EstadoSolicitudBorradoBanoSchema,
  reglaAutoAplicada: ReglaAutoAprobacionSchema.optional(),
  evaluacionIa: z.object({
    decision: z.enum(["aprobar", "rechazar", "revision"]),
    confianza: z.number().min(0).max(1),
    motivo: z.string(),
  }).optional(),
  resueltoPorUid: z.string().optional(),
  resueltoPorNombre: z.string().optional(),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})
export type SolicitudBorradoBano = z.infer<typeof SolicitudBorradoBanoSchema>

export const CrearSolicitudBorradoBanoInputSchema = z
  .object({
    registroId: z.string().min(1),
    motivo: MotivoSolicitudBorradoBanoSchema,
    nota: z.string().trim().max(280).optional(),
  })
  .refine((d) => d.motivo !== "otro" || (d.nota !== undefined && d.nota.length > 0), {
    message: "La nota es obligatoria cuando el motivo es 'Otro'",
    path: ["nota"],
  })
export type CrearSolicitudBorradoBanoInput = z.infer<typeof CrearSolicitudBorradoBanoInputSchema>

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

export const EstadoCorteCajaSchema = z.enum(["ACTIVO", "CORTADO"])
export type EstadoCorteCaja = z.infer<typeof EstadoCorteCajaSchema>

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
  anulado: z.boolean().optional(),
  corteId: z.string().nullable().optional(),
  estadoCorte: EstadoCorteCajaSchema.optional().default("ACTIVO"),
  archivoUrl: z.string().nullable().optional(),
  archivoNombre: z.string().nullable().optional(),
  archivoPath: z.string().nullable().optional(),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})
export type MovimientoCajaChica = z.infer<typeof MovimientoCajaChicaSchema>

export const CorteCajaSchema = z.object({
  id: z.string(),
  folio: z.string(), // ej. CORTE-2026-001
  fechaInicio: z.string(), // YYYY-MM-DD del movimiento más antiguo del ciclo
  fechaCierre: z.string(), // YYYY-MM-DD del día en que se hizo el corte
  totalEntradas: z.number().min(0),
  totalSalidas: z.number().min(0),
  saldoReembolsado: z.number().min(0),
  cantidadMovimientos: z.number().min(0),
  creadoPor: z.string(),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
  nota: z.string().optional(),
})
export type CorteCaja = z.infer<typeof CorteCajaSchema>


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

// ── Finanzas: Cuentas por Pagar (AP - Facturas de Proveedores desde Odoo) ───

export const FacturaProveedorSchema = z.object({
  id: z.string(), // `vi_<odoo_id>`
  odooId: z.number(),
  odooCompanyId: z.number(),
  numeroFactura: z.string(),
  proveedorNombre: z.string(),
  odooPartnerId: z.number(),
  fechaFactura: z.string().nullable(), // YYYY-MM-DD
  fechaVencimiento: z.string().nullable(), // YYYY-MM-DD
  moneda: z.string(),
  subtotal: z.number(),
  impuestos: z.number(),
  total: z.number(),
  saldoPendiente: z.number(),
  estadoPago: z.string(), // not_paid | in_payment | paid | partial
  estado: z.string(), // draft | posted | cancel
  tipo: z.enum(["factura_proveedor", "nota_credito_proveedor"]),
  origenPo: z.string().nullable(),
  origen: z.literal("odoo"),
  sincronizadoEn: z.union([z.date(), z.string()]),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})
export type FacturaProveedor = z.infer<typeof FacturaProveedorSchema>

// ── Finanzas: seguimiento local de cobranza ─────────────────────────────────
// Vive separado del espejo de Odoo. El id del documento es `facturaId`.

const FechaIsoOpcionalSchema = z.union([
  z.literal(""),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe usar formato YYYY-MM-DD"),
])

export const SeguimientoCobranzaInputSchema = z.object({
  facturaId: z.string().regex(/^odoo_\d+$/, "La factura de Odoo no es válida"),
  nota: z.string().trim().max(2_000, "La nota no puede exceder 2,000 caracteres"),
  promesaPagoFecha: FechaIsoOpcionalSchema,
  enDisputa: z.boolean(),
  actualizadoPor: z.string().trim().email("El correo del responsable no es válido"),
}).strict()
export type SeguimientoCobranzaInput = z.infer<typeof SeguimientoCobranzaInputSchema>

export const SeguimientoCobranzaSchema = SeguimientoCobranzaInputSchema.extend({
  actualizadoEn: z.date(),
}).strict()
export type SeguimientoCobranza = z.infer<typeof SeguimientoCobranzaSchema>

// ── Catálogo de Proveedores (Tooling & Compras US) ───────────────────────────

export const EstatusProveedorSchema = z.enum(["actual", "prospecto", "inactivo"])
export type EstatusProveedor = z.infer<typeof EstatusProveedorSchema>

export const CategoriaProveedorSchema = z.enum(["endmills", "insertos", "tooling", "consumibles", "otros"])
export type CategoriaProveedor = z.infer<typeof CategoriaProveedorSchema>

export const TipoProveedorSchema = z.enum(["barato", "estandar", "premium"])
export type TipoProveedor = z.infer<typeof TipoProveedorSchema>

export const MetodoPagoSchema = z.enum(["tarjeta", "transferencia", "credito", "paypal"])
export type MetodoPago = z.infer<typeof MetodoPagoSchema>

export const TiempoRespuestaSchema = z.enum(["inmediato", "mismo_dia", "24_48h", "lento"])
export type TiempoRespuesta = z.infer<typeof TiempoRespuestaSchema>

export const FrecuenciaCompraSchema = z.enum(["semanal", "mensual", "trimestral", "ocasional"])
export type FrecuenciaCompra = z.infer<typeof FrecuenciaCompraSchema>

export const PrioridadSchema = z.enum(["alta", "media", "baja"])
export type Prioridad = z.infer<typeof PrioridadSchema>

export const ProveedorSchema = z.object({
  id: z.string(),
  nombre: z.string().min(1, "El nombre es obligatorio"),
  estatus: EstatusProveedorSchema.default("actual"),
  tipoProveedor: TipoProveedorSchema.default("estandar"),
  barato: z.boolean().default(false),
  recomendado: z.boolean().default(false),
  categorias: z.array(CategoriaProveedorSchema).default(["tooling"]),
  pais: z.string().default("Estados Unidos"),
  ubicacion: z.string().optional().default(""),
  shippingAddressUSA: z.string().optional().default(""),
  brokerAduanal: z.string().optional().default(""),
  web: z.string().optional().default(""),
  contacto: z.string().optional().default(""),
  email: z.string().optional().default(""),
  telefono: z.string().optional().default(""),
  whatsapp: z.string().optional().default(""),
  marcas: z.array(z.string()).default([]),
  moneda: z.enum(["USD", "MXN"]).default("USD"),
  facturaUSD: z.boolean().default(true),
  metodosPago: z.array(MetodoPagoSchema).default(["tarjeta"]),
  tiempoRespuesta: TiempoRespuestaSchema.default("mismo_dia"),
  frecuenciaCompra: FrecuenciaCompraSchema.default("mensual"),
  prioridad: PrioridadSchema.default("media"),
  leadTimeDias: z.number().nullable().optional().default(null),
  pedidoMinimo: z.number().nullable().optional().default(null),
  calificacion: z.number().min(1).max(5).nullable().optional().default(5),
  notas: z.string().optional().default(""),
  experienciaCompra: z.string().optional().default(""),
  /** FK a res.partner de Odoo cuando el proveedor vino del ETL de compras. */
  odooPartnerId: z.number().nullable().optional().default(null),
  /** Mercado operativo explícito; no se infiere de moneda o país. */
  mercado: z.enum(["usa", "mexico"]).optional(),
  origenProveedor: z.enum(["semilla", "manual", "odoo"]).optional(),
  /** Métricas derivadas del histórico Odoo para ordenar proveedores habituales. */
  ordenesOdoo: z.number().int().min(0).optional(),
  ultimaCompraOdoo: z.string().nullable().optional(),
  creadoEn: z.union([z.date(), z.string()]).optional(),
  actualizadoEn: z.union([z.date(), z.string()]).optional(),
})

export type Proveedor = z.infer<typeof ProveedorSchema>

// ── Historial de compras por proveedor ──────────────────────────────────────
export const CompraProveedorSchema = z.object({
  id: z.string(),
  proveedorId: z.string(),
  proveedorNombre: z.string(),
  numeroOrden: z.string().default(''),
  fecha: z.string(),
  producto: z.string().min(1, 'El nombre del producto es obligatorio'),
  categoria: CategoriaProveedorSchema.default('tooling'),
  marca: z.string().default(''),
  cantidad: z.number().min(1).default(1),
  precioUnitario: z.number().min(0).default(0),
  moneda: z.enum(['USD', 'MXN']).default('USD'),
  costoTotal: z.number().min(0).default(0),
  leadTimeRealDias: z.number().min(0).default(3),
  notas: z.string().optional().default(''),
  creadoEn: z.union([z.date(), z.string()]).optional(),
})

export type CompraProveedor = z.infer<typeof CompraProveedorSchema>

// ── Scorecard / Evaluación Interna de Proveedores ─────────────────────────
export const EvaluacionProveedorSchema = z.object({
  id: z.string(),
  proveedorId: z.string(),
  precio: z.number().min(1).max(5).default(4),
  tiempoEntrega: z.number().min(1).max(5).default(4),
  calidad: z.number().min(1).max(5).default(5),
  respuestaComunicacion: z.number().min(1).max(5).default(4),
  cumplimiento: z.number().min(1).max(5).default(5),
  facilidadCompra: z.number().min(1).max(5).default(4),
  promedioGeneral: z.number().min(1).max(5).default(4.3),
  fortalezas: z.array(z.string()).default([]),
  debilidades: z.array(z.string()).default([]),
  fechaEvaluacion: z.string().default(''),
  evaluadoPor: z.string().default('Compras SMV'),
  creadoEn: z.union([z.date(), z.string()]).optional(),
})

export type EvaluacionProveedor = z.infer<typeof EvaluacionProveedorSchema>

// ── Comparador de Cotizaciones de Proveedores ──────────────────────────────
export const OfertaCotizacionSchema = z.object({
  proveedorId: z.string(),
  proveedorNombre: z.string(),
  precioUnitario: z.number().min(0),
  moneda: z.enum(['USD', 'MXN']).default('USD'),
  leadTimeDias: z.number().min(0).default(3),
  MOQ: z.number().min(0).default(1),
  marca: z.string().default(''),
  disponible: z.boolean().default(true),
  garantia: z.string().optional().default('Garantía estándar'),
  enlace: z.string().optional().default(''),
  notas: z.string().optional().default(''),
  scoreCalculado: z.number().optional().default(0),
})

export type OfertaCotizacion = z.infer<typeof OfertaCotizacionSchema>

export const CotizacionComparacionSchema = z.object({
  id: z.string(),
  concepto: z.string().min(1, 'El concepto es obligatorio'),
  categoria: CategoriaProveedorSchema.default('endmills'),
  fecha: z.string(),
  ofertas: z.array(OfertaCotizacionSchema).default([]),
  creadoEn: z.union([z.date(), z.string()]).optional(),
  actualizadoEn: z.union([z.date(), z.string()]).optional(),
})

export type CotizacionComparacion = z.infer<typeof CotizacionComparacionSchema>

// ── Configuración del sistema (tipo de cambio, etc.) ─────────────────────────

export const TipoCambioConfigSchema = z.object({
  id: z.literal("tipo_cambio"),
  usdToMxn: z.number().positive(),
  actualizadoEn: z.union([z.date(), z.string()]),
  actualizadoPor: z.string().optional().default(""),
  nota: z.string().optional().default(""),
})

export type TipoCambioConfig = z.infer<typeof TipoCambioConfigSchema>

// ── Compras Odoo (ETL solo lectura: PO + facturas de proveedor) ───────────────
// Capa cruda = espejo fiel. Capa intermedia = SAT + categoría + metal (nunca
// se escribe de vuelta en los docs crudos).

export const CompraOdooPoCrudoSchema = z.object({
  id: z.string(), // po_<odooId>
  odooId: z.number(),
  referencia: z.string(),
  proveedorNombre: z.string(),
  odooPartnerId: z.number(),
  fechaOrden: z.string().nullable(),
  fechaLimite: z.string().nullable(),
  moneda: z.string(),
  total: z.number(),
  estado: z.string(),
  esRfq: z.boolean(),
  representante: z.string().nullable(),
  odooCompanyId: z.number(),
  lineas: z.array(z.object({
    odooLineId: z.number(),
    descripcion: z.string(),
    cantidad: z.number(),
    precioUnitario: z.number(),
    subtotal: z.number(),
    productOdooId: z.number().nullable(),
    claveProdServ: z.string().nullable(),
  })),
  origen: z.literal("odoo"),
  sincronizadoEn: z.date(),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})
export type CompraOdooPoCrudo = z.infer<typeof CompraOdooPoCrudoSchema>

export const CompraOdooFacturaCrudoSchema = z.object({
  id: z.string(), // vi_<odooId>
  odooId: z.number(),
  numeroFactura: z.string(),
  proveedorNombre: z.string(),
  odooPartnerId: z.number(),
  fechaFactura: z.string().nullable(),
  moneda: z.string(),
  subtotal: z.number(),
  impuestos: z.number(),
  total: z.number(),
  estado: z.string(),
  tipo: z.enum(["factura_proveedor", "nota_credito_proveedor"]),
  origenPo: z.string().nullable(),
  odooCompanyId: z.number(),
  lineas: z.array(z.object({
    odooLineId: z.number(),
    descripcion: z.string(),
    cantidad: z.number(),
    precioUnitario: z.number(),
    subtotal: z.number(),
    productOdooId: z.number().nullable(),
    claveProdServ: z.string().nullable(),
  })),
  origen: z.literal("odoo"),
  sincronizadoEn: z.date(),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})
export type CompraOdooFacturaCrudo = z.infer<typeof CompraOdooFacturaCrudoSchema>

/** Capa intermedia: categorización / SAT / metal — no es el espejo crudo. */
export const CompraOdooItemSchema = z.object({
  id: z.string(),
  llaveItem: z.string(),
  fuente: z.enum(["po", "factura"]),
  odooDocId: z.number(),
  odooLineId: z.number(),
  referenciaDoc: z.string(),
  origenPo: z.string().nullable(),
  descripcion: z.string(),
  cantidad: z.number(),
  precioUnitario: z.number(),
  subtotal: z.number(),
  moneda: z.string(),
  fecha: z.string().nullable(),
  odooPartnerId: z.number(),
  proveedorNombre: z.string(),
  productOdooId: z.number().nullable(),
  claveProdServ: z.string().nullable(),
  satPendiente: z.boolean(),
  /** Slug abierto del registro de categorías (metals, tools, plastics, …). */
  categoriaId: z.string(),
  tipoMetal: z.string().nullable(),
  tipoInsumo: z.string().nullable().optional().default(null),
  medida: z.string().nullable(),
  unidad: z.string().nullable(),
  esRfq: z.boolean(),
  origen: z.literal("odoo"),
  /** Categoría del producto en Odoo (jerárquica). */
  odooCategoria: z.string().nullable().optional().default(null),
  /** Unidad de medida Odoo. */
  odooUom: z.string().nullable().optional().default(null),
  /** Costo estándar Odoo. */
  odooCostoEstandar: z.number().nullable().optional().default(null),
  /** Referencia interna Odoo. */
  odooRefInterna: z.string().nullable().optional().default(null),
  /** Re-clasificado por IA (Gemini). */
  clasificadoPorIa: z.boolean().optional().default(false),
  sincronizadoEn: z.date(),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})
export type CompraOdooItem = z.infer<typeof CompraOdooItemSchema>

export const CategoriaProductoSchema = z.object({
  id: z.string().min(1),
  etiqueta: z.string().min(1),
  divisionesSat: z.array(z.string()).default([]),
  palabrasClave: z.array(z.string()).default([]),
})
export type CategoriaProducto = z.infer<typeof CategoriaProductoSchema>

// ── Documentos de venta (factura / remisión sobre SO Odoo) ────────────────────

export const TipoSolicitudDocumentoSchema = z.enum(["factura", "remision"])
export type TipoSolicitudDocumento = z.infer<typeof TipoSolicitudDocumentoSchema>

export const EstadoSolicitudDocumentoSchema = z.enum([
  "pendiente",
  "en_proceso",
  "completada",
  "rechazada",
])
export type EstadoSolicitudDocumento = z.infer<typeof EstadoSolicitudDocumentoSchema>

export const PartidaSolicitudDocumentoSchema = z.object({
  odooLineId: z.number().int().positive(),
  productName: z.string().min(1),
  qtySolicitada: z.number().positive(),
})

export const SolicitudDocumentoSchema = z.object({
  id: z.string(),
  tipo: TipoSolicitudDocumentoSchema,
  estado: EstadoSolicitudDocumentoSchema,
  odooSoId: z.number().int().positive(),
  odooSoName: z.string().min(1),
  clientOrderRef: z.string().nullable(),
  ordenCompra: z.string().nullable(),
  partnerName: z.string().min(1),
  partidas: z.array(PartidaSolicitudDocumentoSchema).default([]),
  nota: z.string().default(""),
  folioOdoo: z.string().nullable(),
  motivoRechazo: z.string().nullable(),
  solicitadoPorUid: z.string().min(1),
  solicitadoPorNombre: z.string().min(1),
  atendidoPorUid: z.string().nullable(),
  atendidoPorNombre: z.string().nullable(),
  creadoEn: z.date(),
  actualizadoEn: z.date(),
})
export type SolicitudDocumento = z.infer<typeof SolicitudDocumentoSchema>

export const NuevaSolicitudDocumentoSchema = SolicitudDocumentoSchema.omit({
  id: true,
  creadoEn: true,
  actualizadoEn: true,
  estado: true,
  folioOdoo: true,
  motivoRechazo: true,
  atendidoPorUid: true,
  atendidoPorNombre: true,
}).extend({
  estado: z.literal("pendiente").default("pendiente"),
})
export type NuevaSolicitudDocumento = z.infer<typeof NuevaSolicitudDocumentoSchema>

export const MensajeSolicitudDocumentoSchema = z.object({
  id: z.string(),
  texto: z.string().min(1).max(4000),
  autorUid: z.string().min(1),
  autorNombre: z.string().min(1),
  creadoEn: z.date(),
})
export type MensajeSolicitudDocumento = z.infer<typeof MensajeSolicitudDocumentoSchema>

export const VentaOdooLineaSchema = z.object({
  odooLineId: z.number().int().positive(),
  productName: z.string(),
  productDefaultCode: z.string().nullable(),
  qtyOrdered: z.number().nonnegative(),
  qtyDelivered: z.number().nonnegative(),
  qtyPending: z.number().nonnegative(),
})

export const VentaOdooRemisionSchema = z.object({
  name: z.string(),
  state: z.string(),
  dateDone: z.string().nullable(),
})

export const VentaOdooSoSchema = z.object({
  id: z.string(),
  odooId: z.number().int().positive(),
  name: z.string().min(1),
  clientOrderRef: z.string().nullable(),
  ordenCompra: z.string().nullable(),
  partnerId: z.number().int(),
  partnerName: z.string(),
  dateOrder: z.string().nullable(),
  state: z.string(),
  invoiceStatus: z.string(),
  lineas: z.array(VentaOdooLineaSchema),
  remisiones: z.array(VentaOdooRemisionSchema),
  sincronizadoEn: z.date(),
})
export type VentaOdooSo = z.infer<typeof VentaOdooSoSchema>
