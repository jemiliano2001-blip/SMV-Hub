import * as functions from "firebase-functions"
import {
  errorMessage,
  getCallablePrincipal,
  principalHasLegacyPurchasingSyncAccess,
} from "./auth"
import { getDb } from "./firestore-db"
import {
  idsHuerfanosCompras,
  itemsDesdeFacturaCrudo,
  itemsDesdePoCrudo,
  mapearFacturaProveedorOdoo,
  mapearPartnerCompra,
  mapearPoOdoo,
  type OdooInvoiceLineRaw,
  type OdooPoLineRaw,
  type OdooPoRaw,
  type OdooVendorBillRaw,
} from "./odoo-compras-mapeo"
import { CATEGORIAS_PRODUCTO_REGISTRO } from "./compras-odoo/categorias-registro"
import type { IntegrityErrorCode } from "./reportes-integridad/contratos"
import { IntegrityDomainError } from "./reportes-integridad/errores"
import {
  loadIntegrityConfig,
  runIntegrityWithoutBlockingMirror,
  runIntegrityPipeline,
} from "./reportes-integridad/pipeline"
import {
  acquireIntegrityLease,
  heartbeatIntegrityLease,
  markIntegrityAttempt,
  releaseIntegrityLease,
  type IntegrityConfig,
} from "./reportes-integridad/repositorio"

const db = getDb()

// Reutiliza FINANZAS_ODOO_* (mismo Odoo). Si el API user no tiene Purchase,
// configurar COMPRAS_ODOO_* y priorizarlas abajo.
const ODOO_SECRETS = [
  "FINANZAS_ODOO_URL",
  "FINANZAS_ODOO_DB",
  "FINANZAS_ODOO_USERNAME",
  "FINANZAS_ODOO_API_KEY",
]

const CAMPOS_PO = [
  "id", "name", "partner_id", "date_order", "date_planned", "amount_total",
  "currency_id", "state", "user_id", "company_id", "order_line",
]

const CAMPOS_PO_LINE = [
  "id", "order_id", "name", "product_id", "product_qty", "price_unit", "price_subtotal",
]

const CAMPOS_VENDOR_BILL = [
  "id", "name", "move_type", "partner_id", "invoice_date", "invoice_date_due",
  "amount_untaxed", "amount_tax", "amount_total", "amount_residual", "payment_state",
  "currency_id", "state", "invoice_origin", "company_id", "invoice_line_ids",
]

const CAMPOS_INVOICE_LINE = [
  "id", "move_id", "name", "product_id", "quantity", "price_unit", "price_subtotal", "display_type",
]

const TAMANO_LOTE = 400

function credencialesOdoo(): { url: string; dbName: string; username: string; apiKey: string } {
  const url = process.env.COMPRAS_ODOO_URL || process.env.FINANZAS_ODOO_URL
  const dbName = process.env.COMPRAS_ODOO_DB || process.env.FINANZAS_ODOO_DB
  const username = process.env.COMPRAS_ODOO_USERNAME || process.env.FINANZAS_ODOO_USERNAME
  const apiKey = process.env.COMPRAS_ODOO_API_KEY || process.env.FINANZAS_ODOO_API_KEY
  if (!url || !dbName || !username || !apiKey) {
    throw new Error(
      "Faltan credenciales Odoo (FINANZAS_ODOO_* o COMPRAS_ODOO_* URL/DB/USERNAME/API_KEY)"
    )
  }
  return { url, dbName, username, apiKey }
}

async function llamarOdoo<T>(url: string, service: string, method: string, args: unknown[]): Promise<T> {
  for (let intento = 1; intento <= 3; intento++) {
    const res = await fetch(`${url}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "call", params: { service, method, args } }),
    })
    if (res.status >= 500 && intento < 3) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** (intento - 1)))
      continue
    }
    if (!res.ok) throw new Error(`Odoo HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const json = await res.json() as { result?: T; error?: unknown }
    if (json.error) throw new Error(`Odoo RPC error: ${JSON.stringify(json.error).slice(0, 500)}`)
    return json.result as T
  }
  throw new Error("Odoo: agotados los reintentos (5xx)")
}

type ExecuteKw = <T>(modelo: string, metodo: string, args: unknown[], kwargs?: Record<string, unknown>) => Promise<T>

function makeExecute(url: string, dbName: string, uid: number, apiKey: string): ExecuteKw {
  return async (modelo, metodo, args, kwargs) => {
    const callArgs = kwargs
      ? [dbName, uid, apiKey, modelo, metodo, args, kwargs]
      : [dbName, uid, apiKey, modelo, metodo, args]
    return llamarOdoo(url, "object", "execute_kw", callArgs)
  }
}

/** Intenta leer clave SAT de productos; soporta nombres comunes en l10n_mx. */
async function cargarClavesSatProducto(
  execute: ExecuteKw,
  productIds: number[]
): Promise<Map<number, string>> {
  const mapa = new Map<number, string>()
  const unicos = [...new Set(productIds.filter((id) => id > 0))]
  if (unicos.length === 0) return mapa

  const fieldsGet = await execute<Record<string, unknown>>("product.product", "fields_get", [], {
    attributes: ["string", "type"],
  })
  const candidatos = Object.keys(fieldsGet).filter((k) =>
    /unspsc|l10n_mx.*sat|clave.?prod|code_sat|sat_code/i.test(k)
  )
  if (candidatos.length === 0) return mapa

  const fields = ["id", ...candidatos]
  for (let i = 0; i < unicos.length; i += 200) {
    const chunk = unicos.slice(i, i + 200)
    const productos = await execute<Record<string, unknown>[]>(
      "product.product",
      "search_read",
      [[["id", "in", chunk]]],
      { fields }
    )
    for (const p of productos) {
      const id = p.id as number
      for (const campo of candidatos) {
        const val = p[campo]
        if (typeof val === "string" && /\d{8}/.test(val)) {
          const digits = val.replace(/\D/g, "").slice(0, 8)
          if (digits.length === 8) {
            mapa.set(id, digits)
            break
          }
        }
        // Many2one: [id, "31161501 Product…"]
        if (Array.isArray(val) && typeof val[1] === "string") {
          const digits = String(val[1]).replace(/\D/g, "").slice(0, 8)
          if (digits.length === 8) {
            mapa.set(id, digits)
            break
          }
        }
      }
    }
  }
  return mapa
}

/** Metadata enriquecida de producto Odoo: categoría, UdM, costo, referencia. */
type MetadataProducto = {
  categoriaId: number
  categoriaNombre: string
  uomNombre: string | null
  costoEstandar: number | null
  refInterna: string | null
}

async function cargarMetadataProducto(
  execute: ExecuteKw,
  productIds: number[]
): Promise<Map<number, MetadataProducto>> {
  const mapa = new Map<number, MetadataProducto>()
  const unicos = [...new Set(productIds.filter((id) => id > 0))]
  if (unicos.length === 0) return mapa

  // Leer categorías de producto
  const categoriasRaw = await execute<
    { id: number; name: string; complete_name?: string }[]
  >("product.category", "search_read", [[]], {
    fields: ["id", "name", "complete_name"],
  })
  const categoriaPorId = new Map<number, string>()
  for (const c of categoriasRaw) {
    categoriaPorId.set(c.id, c.complete_name ?? c.name)
  }

  // Leer productos con metadata
  for (let i = 0; i < unicos.length; i += 200) {
    const chunk = unicos.slice(i, i + 200)
    const productos = await execute<
      {
        id: number
        categ_id: [number, string] | false
        uom_id: [number, string] | false
        standard_price: number
        default_code: string | false
      }[]
    >("product.product", "search_read", [[["id", "in", chunk]]], {
      fields: ["id", "categ_id", "uom_id", "standard_price", "default_code"],
    })
    for (const p of productos) {
      const categId = p.categ_id ? p.categ_id[0] : 0
      mapa.set(p.id, {
        categoriaId: categId,
        categoriaNombre: categoriaPorId.get(categId) ?? (p.categ_id ? p.categ_id[1] : ""),
        uomNombre: p.uom_id ? p.uom_id[1] : null,
        costoEstandar: typeof p.standard_price === "number" ? p.standard_price : null,
        refInterna: typeof p.default_code === "string" && p.default_code ? p.default_code : null,
      })
    }
  }
  return mapa
}

async function escribirLotes(
  coleccion: string,
  docs: { id: string; data: Record<string, unknown> }[],
  creadoEnExistente: Map<string, FirebaseFirestore.Timestamp | Date>
): Promise<void> {
  const ahora = new Date()
  for (let i = 0; i < docs.length; i += TAMANO_LOTE) {
    const batch = db.batch()
    for (const d of docs.slice(i, i + TAMANO_LOTE)) {
      batch.set(db.collection(coleccion).doc(d.id), {
        ...d.data,
        creadoEn: creadoEnExistente.get(d.id) ?? ahora,
        actualizadoEn: ahora,
      })
    }
    await batch.commit()
  }
}

async function podarHuerfanos(
  coleccion: string,
  idsExistentes: string[],
  idsActuales: string[],
  vacioDesdeOdoo: boolean
): Promise<number> {
  if (vacioDesdeOdoo && idsExistentes.length > 0) {
    console.warn(
      `Sync Odoo→Compras (${coleccion}): Odoo devolvió 0 pero hay ${idsExistentes.length} en Firestore; se omite prune.`
    )
    return 0
  }
  const huerfanos = idsHuerfanosCompras(idsExistentes, idsActuales)
  for (let i = 0; i < huerfanos.length; i += TAMANO_LOTE) {
    const batch = db.batch()
    for (const id of huerfanos.slice(i, i + TAMANO_LOTE)) {
      batch.delete(db.collection(coleccion).doc(id))
    }
    await batch.commit()
  }
  return huerfanos.length
}

async function asegurarMcMasterCatalogoUsa(): Promise<void> {
  const existentes = await db
    .collection("proveedores")
    .where("nombre", "==", "McMaster-Carr")
    .limit(1)
    .get()
  if (!existentes.empty) return

  const ref = db.collection("proveedores").doc("semilla-mcmastercarr")
  await ref.set({
    id: ref.id,
    nombre: "McMaster-Carr",
    estatus: "actual",
    tipoProveedor: "estandar",
    barato: false,
    recomendado: true,
    categorias: ["tooling", "consumibles", "otros"],
    pais: "Estados Unidos",
    ubicacion: "Estados Unidos",
    web: "https://www.mcmaster.com",
    telefono: "+1 630-833-0300",
    marcas: ["McMaster-Carr"],
    moneda: "USD",
    facturaUSD: true,
    metodosPago: ["tarjeta", "credito"],
    tiempoRespuesta: "inmediato",
    frecuenciaCompra: "semanal",
    prioridad: "alta",
    leadTimeDias: 2,
    pedidoMinimo: 0,
    calificacion: 5,
    notas: "Proveedor habitual de suministros industriales.",
    mercado: "usa",
    origenProveedor: "semilla",
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  })
}

async function upsertProveedoresDesdePartners(
  execute: ExecuteKw,
  partnerIds: number[],
  monedaPorPartner: Map<number, string>,
  actividadPorPartner: Map<number, { ordenes: number; ultimaCompra: string | null }>
): Promise<number> {
  const unicos = [...new Set(partnerIds.filter((id) => id > 0))]
  if (unicos.length === 0) return 0

  const partners = await execute<
    { id: number; name: string; country_id: [number, string] | false; email: string | false; phone: string | false }[]
  >("res.partner", "search_read", [[["id", "in", unicos]]], {
    fields: ["id", "name", "country_id", "email", "phone"],
  })

  function normalizarNombre(n: string): string {
    return n
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\b(s\.?a\.? de c\.?v\.?|s\.?a\.?|c\.?v\.?|llc|inc|co|company|corp|corporation|supply)\b/gi, "")
      .replace(/[^a-z0-9]/g, "")
  }

  const existentesSnap = await db.collection("proveedores").get()
  const porOdooId = new Map<number, FirebaseFirestore.QueryDocumentSnapshot>()
  const porNombreNormalizado = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>()

  for (const d of existentesSnap.docs) {
    const data = d.data()
    if (typeof data.odooPartnerId === "number" && data.odooPartnerId > 0) {
      porOdooId.set(data.odooPartnerId, d)
    }
    const norm = normalizarNombre(String(data.nombre ?? ""))
    if (norm) {
      porNombreNormalizado.set(norm, d)
    }
  }

  let upserts = 0
  const ahora = new Date()
  for (const raw of partners) {
    const monedaDoc = monedaPorPartner.get(raw.id)
    const mapped = mapearPartnerCompra(raw, {
      monedaPreferida: monedaDoc === "USD" ? "USD" : monedaDoc === "MXN" ? "MXN" : undefined,
    })
    const actividad = actividadPorPartner.get(mapped.odooPartnerId) ?? {
      ordenes: 0,
      ultimaCompra: null,
    }
    const normMapped = normalizarNombre(mapped.nombre)
    const existente = porOdooId.get(mapped.odooPartnerId) ?? (normMapped ? porNombreNormalizado.get(normMapped) : undefined)

    if (existente) {
      await existente.ref.set(
        {
          odooPartnerId: mapped.odooPartnerId,
          ordenesOdoo: actividad.ordenes,
          ultimaCompraOdoo: actividad.ultimaCompra,
          pais: mapped.pais,
          moneda: mapped.moneda,
          facturaUSD: mapped.moneda === "USD",
          actualizadoEn: ahora,
          ...(existente.data().email ? {} : { email: mapped.email }),
          ...(existente.data().telefono ? {} : { telefono: mapped.telefono }),
        },
        { merge: true }
      )
      upserts++
      continue
    }

    const ref = db.collection("proveedores").doc()
    await ref.set({
      id: ref.id,
      nombre: mapped.nombre,
      estatus: "actual",
      tipoProveedor: "estandar",
      barato: false,
      recomendado: false,
      categorias: ["otros"],
      pais: mapped.pais,
      ubicacion: "",
      shippingAddressUSA: "",
      brokerAduanal: "",
      web: "",
      contacto: "",
      email: mapped.email,
      telefono: mapped.telefono,
      whatsapp: "",
      marcas: [],
      moneda: mapped.moneda,
      facturaUSD: mapped.moneda === "USD",
      metodosPago: ["transferencia"],
      tiempoRespuesta: "mismo_dia",
      frecuenciaCompra: "mensual",
      prioridad: "media",
      leadTimeDias: null,
      pedidoMinimo: null,
      calificacion: 5,
      notas: "Importado desde Odoo (ETL compras).",
      experienciaCompra: "",
      odooPartnerId: mapped.odooPartnerId,
      mercado: "mexico",
      origenProveedor: "odoo",
      ordenesOdoo: actividad.ordenes,
      ultimaCompraOdoo: actividad.ultimaCompra,
      creadoEn: ahora,
      actualizadoEn: ahora,
    })
    upserts++
  }
  return upserts
}

async function sincronizarComprasOdoo(options: {
  config: IntegrityConfig
  leaseOwner: string
  syncId: string
  startedAtMs: number
}): Promise<{
  pos: number
  facturas: number
  items: number
  proveedores: number
  huerfanos: number
  integrityMode: IntegrityConfig["mode"]
  integrityRunId: string | null
  integrityCases: number
  integrityErrorCode: IntegrityErrorCode | null
}> {
  let phase: "odoo" | "mirror" | "integrity" = "odoo"
  try {
  const { url, dbName, username, apiKey } = credencialesOdoo()
  const uid = await llamarOdoo<number>(url, "common", "login", [dbName, username, apiKey])
  if (!uid) throw new Error("Login a Odoo falló — revisa credenciales")
  const execute = makeExecute(url, dbName, uid, apiKey)
  const ahora = new Date()

  // ── POs ────────────────────────────────────────────────────────────────────
  const posRaw = await execute<OdooPoRaw[]>("purchase.order", "search_read", [[]], {
    fields: CAMPOS_PO,
  })
  const allLineIds = posRaw.flatMap((p) => (Array.isArray(p.order_line) ? p.order_line : []))
  const lineasPorId = new Map<number, OdooPoLineRaw>()
  for (let i = 0; i < allLineIds.length; i += 200) {
    const chunk = allLineIds.slice(i, i + 200)
    if (chunk.length === 0) continue
    const lines = await execute<OdooPoLineRaw[]>(
      "purchase.order.line",
      "search_read",
      [[["id", "in", chunk]]],
      { fields: CAMPOS_PO_LINE }
    )
    for (const l of lines) lineasPorId.set(l.id, l)
  }

  // ── Vendor bills ───────────────────────────────────────────────────────────
  const billsRaw = await execute<OdooVendorBillRaw[]>(
    "account.move",
    "search_read",
    [[["move_type", "in", ["in_invoice", "in_refund"]], ["state", "=", "posted"]]],
    { fields: CAMPOS_VENDOR_BILL }
  )
  const allInvLineIds = billsRaw.flatMap((b) =>
    Array.isArray(b.invoice_line_ids) ? b.invoice_line_ids : []
  )
  const invLineasPorId = new Map<number, OdooInvoiceLineRaw>()
  for (let i = 0; i < allInvLineIds.length; i += 200) {
    const chunk = allInvLineIds.slice(i, i + 200)
    if (chunk.length === 0) continue
    const lines = await execute<OdooInvoiceLineRaw[]>(
      "account.move.line",
      "search_read",
      [[["id", "in", chunk]]],
      { fields: CAMPOS_INVOICE_LINE }
    )
    for (const l of lines) invLineasPorId.set(l.id, l)
  }

  const productIds: number[] = []
  for (const l of lineasPorId.values()) {
    if (l.product_id) productIds.push(l.product_id[0])
  }
  for (const l of invLineasPorId.values()) {
    if (l.product_id) productIds.push(l.product_id[0])
  }
  const clavesSat = await cargarClavesSatProducto(execute, productIds)
  const metadataProducto = await cargarMetadataProducto(execute, productIds)

  for (const l of lineasPorId.values()) {
    const pid = l.product_id ? l.product_id[0] : 0
    l.clave_prod_serv = clavesSat.get(pid) ?? null
    const meta = metadataProducto.get(pid)
    if (meta) {
      l._odooCategoria = meta.categoriaNombre
      l._odooUom = meta.uomNombre
      l._odooCostoEstandar = meta.costoEstandar
      l._odooRefInterna = meta.refInterna
    }
  }
  for (const l of invLineasPorId.values()) {
    const pid = l.product_id ? l.product_id[0] : 0
    l.clave_prod_serv = clavesSat.get(pid) ?? null
    const meta = metadataProducto.get(pid)
    if (meta) {
      l._odooCategoria = meta.categoriaNombre
      l._odooUom = meta.uomNombre
      l._odooCostoEstandar = meta.costoEstandar
      l._odooRefInterna = meta.refInterna
    }
  }

  for (const po of posRaw) {
    po._lineas = (po.order_line ?? []).map((id) => lineasPorId.get(id)).filter(Boolean) as OdooPoLineRaw[]
  }
  for (const bill of billsRaw) {
    bill._lineas = (bill.invoice_line_ids ?? [])
      .map((id) => invLineasPorId.get(id))
      .filter(Boolean) as OdooInvoiceLineRaw[]
  }

  const posMapped = posRaw.map((r) => mapearPoOdoo(r, ahora))
  const billsMapped = billsRaw.map((r) => mapearFacturaProveedorOdoo(r, ahora))
  await heartbeatIntegrityLease(db, options.leaseOwner)
  phase = "mirror"

  const poExistSnap = await db.collection("compras_odoo_po").select("creadoEn").get()
  const poCreado = new Map(poExistSnap.docs.map((d) => [d.id, d.data().creadoEn as FirebaseFirestore.Timestamp]))
  const viExistSnap = await db.collection("compras_odoo_facturas").select("creadoEn").get()
  const viCreado = new Map(viExistSnap.docs.map((d) => [d.id, d.data().creadoEn as FirebaseFirestore.Timestamp]))
  const itemExistSnap = await db.collection("compras_odoo_items").select("creadoEn").get()
  const itemCreado = new Map(
    itemExistSnap.docs.map((d) => [d.id, d.data().creadoEn as FirebaseFirestore.Timestamp])
  )

  await escribirLotes(
    "compras_odoo_po",
    posMapped.map((p) => ({ id: p.id, data: p as unknown as Record<string, unknown> })),
    poCreado
  )
  await escribirLotes(
    "compras_odoo_facturas",
    billsMapped.map((f) => ({ id: f.id, data: f as unknown as Record<string, unknown> })),
    viCreado
  )

  const items = [
    ...posMapped.flatMap(itemsDesdePoCrudo),
    ...billsMapped.flatMap(itemsDesdeFacturaCrudo),
  ]
  await escribirLotes(
    "compras_odoo_items",
    items.map((it) => ({
      id: it.id,
      data: { ...it, sincronizadoEn: ahora } as unknown as Record<string, unknown>,
    })),
    itemCreado
  )

  let huerfanos = 0
  huerfanos += await podarHuerfanos(
    "compras_odoo_po",
    [...poCreado.keys()],
    posMapped.map((p) => p.id),
    posRaw.length === 0
  )
  huerfanos += await podarHuerfanos(
    "compras_odoo_facturas",
    [...viCreado.keys()],
    billsMapped.map((f) => f.id),
    billsRaw.length === 0
  )
  // Los ítems se hidratan desde las líneas de POs y facturas: si Odoo devolvió
  // documentos pero no salió ni un ítem, la hidratación falló y podar borraría la
  // colección entera. Tratamos ese caso como "vacío desde Odoo" para omitir el prune.
  huerfanos += await podarHuerfanos(
    "compras_odoo_items",
    [...itemCreado.keys()],
    items.map((i) => i.id),
    items.length === 0
  )

  // Seed categorías (idempotente)
  for (const cat of CATEGORIAS_PRODUCTO_REGISTRO) {
    await db.collection("categorias_producto").doc(cat.id).set(cat, { merge: true })
  }
  await asegurarMcMasterCatalogoUsa()

  const posConfirmadas = posMapped.filter(
    (p) => !p.esRfq && p.estado !== "cancel"
  )
  const facturasContabilizadas = billsMapped.filter(
    (f) => f.estado === "posted"
  )
  const partnerIds = [
    ...posConfirmadas.map((p) => p.odooPartnerId),
    ...facturasContabilizadas.map((f) => f.odooPartnerId),
  ]
  const monedaPorPartner = new Map<number, string>()
  const actividadPorPartner = new Map<
    number,
    { ordenes: number; ultimaCompra: string | null }
  >()
  for (const p of posConfirmadas) {
    if (p.odooPartnerId > 0 && p.moneda) monedaPorPartner.set(p.odooPartnerId, p.moneda)
    if (p.odooPartnerId <= 0) continue
    const previa = actividadPorPartner.get(p.odooPartnerId) ?? {
      ordenes: 0,
      ultimaCompra: null,
    }
    actividadPorPartner.set(p.odooPartnerId, {
      ordenes: previa.ordenes + 1,
      ultimaCompra:
        p.fechaOrden && (!previa.ultimaCompra || p.fechaOrden > previa.ultimaCompra)
          ? p.fechaOrden
          : previa.ultimaCompra,
    })
  }
  for (const f of facturasContabilizadas) {
    if (f.odooPartnerId > 0 && f.moneda) monedaPorPartner.set(f.odooPartnerId, f.moneda)
  }
  const proveedores = await upsertProveedoresDesdePartners(
    execute,
    partnerIds,
    monedaPorPartner,
    actividadPorPartner
  )

  await db.collection("compras_odoo_sync_state").doc("odoo").set({
    ultimaCorridaEn: ahora,
    ultimoError: null,
    posSincronizados: posMapped.length,
    facturasSincronizadas: billsMapped.length,
    itemsSincronizados: items.length,
    proveedoresUpsert: proveedores,
    huerfanosEliminados: huerfanos,
  })

  await heartbeatIntegrityLease(db, options.leaseOwner)
  phase = "integrity"
  const integrityFallback = {
    mode: options.config.mode,
    runId: null as string | null,
    cases: 0,
    checksum: null as string | null,
  }
  const { result: integrity, errorCode: integrityErrorCode } =
    await runIntegrityWithoutBlockingMirror({
      fallback: integrityFallback,
      run: () =>
        runIntegrityPipeline({
          db,
          config: options.config,
          purchaseOrders: posMapped,
          bills: billsMapped,
          syncId: options.syncId,
          computedAt: ahora,
          startedAtMs: options.startedAtMs,
        }),
      onDomainError: (error) => {
        console.warn(
          `Integridad: cálculo aislado del espejo con estado ${error.dto.code}.`
        )
      },
    })

  return {
    pos: posMapped.length,
    facturas: billsMapped.length,
    items: items.length,
    proveedores,
    huerfanos,
    integrityMode: integrity.mode,
    integrityRunId: integrity.runId,
    integrityCases: integrity.cases,
    integrityErrorCode,
  }
  } catch (error) {
    if (error instanceof IntegrityDomainError) throw error
    if (phase === "odoo") {
      throw new IntegrityDomainError(
        "ODOO_UNAVAILABLE",
        "Odoo no está disponible; se conserva la última corrida válida."
      )
    }
    if (phase === "mirror") {
      throw new IntegrityDomainError(
        "MIRROR_WRITE_FAILED",
        "El espejo Odoo no se completó; no se publicó una nueva corrida."
      )
    }
    throw new IntegrityDomainError(
      "RUN_WRITE_FAILED",
      "No fue posible publicar la nueva corrida de Integridad."
    )
  }
}

async function ejecutarSyncConLogging(kind: "manual" | "scheduled") {
  const startedAtMs = Date.now()
  const config = await loadIntegrityConfig(db)
  const lease = await acquireIntegrityLease(db, kind)
  const syncId = `sync_${new Date(startedAtMs).toISOString().replace(/\D/g, "").slice(0, 17)}_${lease.ownerInvocationId.slice(0, 8)}`
  try {
    const r = await sincronizarComprasOdoo({
      config,
      leaseOwner: lease.ownerInvocationId,
      syncId,
      startedAtMs,
    })
    await markIntegrityAttempt(
      db,
      r.integrityErrorCode
        ? {
            at: new Date(),
            health: "failed",
            safeErrorCode: r.integrityErrorCode,
          }
        : {
            at: new Date(),
            health: "current",
            safeErrorCode: null,
          }
    )
    console.log(
      `Sync Odoo→Compras: ${r.pos} POs, ${r.facturas} facturas, ${r.items} ítems, ${r.proveedores} proveedores; Integridad=${r.integrityMode}/${r.integrityCases}${r.integrityErrorCode ? ` (${r.integrityErrorCode})` : ""}`
    )
    return r
  } catch (error) {
    console.error("Sync Odoo→Compras falló:", errorMessage(error))
    await db.collection("compras_odoo_sync_state").doc("odoo").set(
      { ultimoError: errorMessage(error), ultimoErrorEn: new Date() },
      { merge: true }
    )
    if (
      !(error instanceof IntegrityDomainError) ||
      error.dto.code !== "SYNC_ALREADY_RUNNING"
    ) {
      await markIntegrityAttempt(db, {
        at: new Date(),
        health: "failed",
        safeErrorCode:
          error instanceof IntegrityDomainError
            ? error.dto.code
            : "ODOO_UNAVAILABLE",
      })
    }
    throw error
  } finally {
    await releaseIntegrityLease(db, lease.ownerInvocationId).catch((error) => {
      console.error("Integridad: no se pudo liberar el lease", errorMessage(error))
    })
  }
}

export const syncOdooComprasScheduled = functions
  .runWith({ secrets: ODOO_SECRETS, timeoutSeconds: 540, memory: "1GB" })
  .pubsub.schedule("every 2 hours")
  .onRun(async () => {
    try {
      await ejecutarSyncConLogging("scheduled")
    } catch {
      // Ya quedó en sync_state
    }
  })

export const syncOdooComprasManual = functions
  .runWith({ secrets: ODOO_SECRETS, timeoutSeconds: 540, memory: "1GB" })
  .https.onCall(async (_data, context) => {
    const principal = await getCallablePrincipal(context)
    if (!principalHasLegacyPurchasingSyncAccess(principal)) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Requiere proveedores/compras, super-admin o los módulos reportes + finanzas."
      )
    }
    try {
      return await ejecutarSyncConLogging("manual")
    } catch (error) {
      if (error instanceof IntegrityDomainError) {
        const code =
          error.dto.code === "SYNC_ALREADY_RUNNING"
            ? "already-exists"
            : error.dto.code === "ODOO_UNAVAILABLE"
              ? "unavailable"
              : error.dto.code === "SOURCE_SNAPSHOT_INVALID"
                ? "failed-precondition"
                : "internal"
        throw new functions.https.HttpsError(code, error.dto.message, error.dto)
      }
      throw new functions.https.HttpsError("internal", errorMessage(error))
    }
  })
