import type { CotizacionOdooPayload } from "@/lib/schemas"

export interface CredencialesOdoo {
  url: string
  dbName: string
  username: string
  apiKey: string
}

export interface ResultadoCreacionOdoo {
  odooId: number
  odooName: string
  odooState: string
  proveedorId: number
  proveedorNombre: string
  referenciaProveedor: string
  moneda: string
  totalUntaxed: number
  totalTax: number
  total: number
  itemsCount: number
}

export function obtenerCredencialesOdoo(): CredencialesOdoo {
  const url =
    process.env.COMPRAS_ODOO_URL ||
    process.env.FINANZAS_ODOO_URL ||
    process.env.ODOO_URL
  const dbName =
    process.env.COMPRAS_ODOO_DB ||
    process.env.FINANZAS_ODOO_DB ||
    process.env.ODOO_DB
  const username =
    process.env.COMPRAS_ODOO_USERNAME ||
    process.env.FINANZAS_ODOO_USERNAME ||
    process.env.ODOO_USERNAME
  const apiKey =
    process.env.COMPRAS_ODOO_API_KEY ||
    process.env.FINANZAS_ODOO_API_KEY ||
    process.env.ODOO_API_KEY

  if (!url || !dbName || !username || !apiKey) {
    throw new Error(
      "Faltan credenciales de Odoo en variables de entorno (ODOO_URL / ODOO_DB / ODOO_USERNAME / ODOO_API_KEY o FINANZAS_ODOO_* / COMPRAS_ODOO_*)"
    )
  }

  return { url: url.replace(/\/+$/, ""), dbName, username, apiKey }
}

export async function llamarOdooRpc<T>(
  url: string,
  service: string,
  method: string,
  args: unknown[],
  timeoutMs = 20000
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${url}/jsonrpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: { service, method, args },
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const errorText = (await res.text()).slice(0, 300)
      throw new Error(`Error de comunicación con Odoo (HTTP ${res.status}): ${errorText}`)
    }

    const json = (await res.json()) as {
      result?: T
      error?: { message?: string; data?: { message?: string } }
    }
    if (json.error) {
      const msg = json.error.data?.message || json.error.message || JSON.stringify(json.error)
      throw new Error(`Error de Odoo RPC: ${msg}`)
    }

    return json.result as T
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `Tiempo de espera agotado (${timeoutMs / 1000}s) comunicándose con Odoo (${service}.${method}).`
      )
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

export async function autenticarOdoo(cred: CredencialesOdoo): Promise<number> {
  const uid = await llamarOdooRpc<number>(
    cred.url,
    "common",
    "login",
    [cred.dbName, cred.username, cred.apiKey]
  )
  if (!uid || typeof uid !== "number") {
    throw new Error("Autenticación con Odoo falló. Revisa usuario y API key.")
  }
  return uid
}

export async function buscarProveedoresOdoo(
  termino: string,
  limite = 20
): Promise<Array<{ id: number; name: string }>> {
  const cred = obtenerCredencialesOdoo()
  const uid = await autenticarOdoo(cred)

  const domain = termino.trim()
    ? [["name", "ilike", termino.trim()]]
    : []

  const partners = await llamarOdooRpc<Array<{ id: number; name: string }>>(
    cred.url,
    "object",
    "execute_kw",
    [
      cred.dbName,
      uid,
      cred.apiKey,
      "res.partner",
      "search_read",
      [domain],
      {
        fields: ["id", "name"],
        limit: Math.min(limite, 50),
        order: "name asc",
      },
    ]
  )

  return partners || []
}

/**
 * Resuelve un proveedor existente en Odoo.
 * NUNCA crea un nuevo partner silenciosamente en producción.
 */
async function resolverPartnerId(
  cred: CredencialesOdoo,
  uid: number,
  proveedorNombre: string,
  proveedorIdPropuesto?: number | string | null
): Promise<{ id: number; name: string }> {
  if (proveedorIdPropuesto && Number(proveedorIdPropuesto) > 0) {
    const pId = Number(proveedorIdPropuesto)
    const encontrado = await llamarOdooRpc<Array<{ id: number; name: string }>>(
      cred.url,
      "object",
      "execute_kw",
      [
        cred.dbName,
        uid,
        cred.apiKey,
        "res.partner",
        "search_read",
        [[["id", "=", pId]]],
        { fields: ["id", "name"], limit: 1 },
      ]
    )
    if (encontrado && encontrado.length > 0) {
      return encontrado[0]
    }
  }

  // Buscar por nombre exacto (insensible a mayúsculas con =ilike)
  const nombreLimpio = proveedorNombre.trim()
  const existentes = await llamarOdooRpc<Array<{ id: number; name: string }>>(
    cred.url,
    "object",
    "execute_kw",
    [
      cred.dbName,
      uid,
      cred.apiKey,
      "res.partner",
      "search_read",
      [[["name", "=ilike", nombreLimpio]]],
      { fields: ["id", "name"], limit: 1 },
    ]
  )

  if (existentes && existentes.length > 0) {
    return existentes[0]
  }

  throw new Error(
    `No se encontró el proveedor "${nombreLimpio}" en Odoo. Selecciona uno del buscador o regístralo primero en Odoo antes de cotizar.`
  )
}

/**
 * Busca el producto comodín genérico (ej. '.' o 'generico') en Odoo.
 * Falla fuerte si no existe para evitar estampar productos reales de inventario.
 */
async function resolverProductoGenericoId(
  cred: CredencialesOdoo,
  uid: number
): Promise<number> {
  // 1. Buscar producto con nombre '.' o default_code '.'
  const productosPunto = await llamarOdooRpc<Array<{ id: number }>>(
    cred.url,
    "object",
    "execute_kw",
    [
      cred.dbName,
      uid,
      cred.apiKey,
      "product.product",
      "search_read",
      [[["name", "=", "."]]],
      { fields: ["id"], limit: 1 },
    ]
  )

  if (productosPunto && productosPunto.length > 0) {
    return productosPunto[0].id
  }

  // 2. Buscar por 'generico'
  const genericos = await llamarOdooRpc<Array<{ id: number }>>(
    cred.url,
    "object",
    "execute_kw",
    [
      cred.dbName,
      uid,
      cred.apiKey,
      "product.product",
      "search_read",
      [[["name", "ilike", "generico"]]],
      { fields: ["id"], limit: 1 },
    ]
  )

  if (genericos && genericos.length > 0) {
    return genericos[0].id
  }

  throw new Error(
    "No se encontró un producto genérico (con nombre '.' o 'generico') en Odoo. Por favor regístralo en Odoo antes de cotizar para no contaminar productos de inventario."
  )
}

/**
 * Resuelve el impuesto de compras en Odoo según la tasa específica (ej. 16% -> 16, 0% -> 0).
 */
async function resolverImpuestoCompraPorTasa(
  cred: CredencialesOdoo,
  uid: number,
  tasaIva: number
): Promise<number | null> {
  const porcentaje = Math.round(tasaIva * 100)
  if (porcentaje === 0) {
    return null
  }

  const impuestos = await llamarOdooRpc<Array<{ id: number; name: string }>>(
    cred.url,
    "object",
    "execute_kw",
    [
      cred.dbName,
      uid,
      cred.apiKey,
      "account.tax",
      "search_read",
      [[["type_tax_use", "=", "purchase"], ["amount", "=", porcentaje]]],
      { fields: ["id", "name"], limit: 1 },
    ]
  )

  if (impuestos && impuestos.length > 0) {
    return impuestos[0].id
  }

  throw new Error(
    `No se encontró un impuesto de compras con tasa ${porcentaje}% en Odoo (account.tax).`
  )
}

/**
 * Resuelve la moneda en Odoo (MXN o USD).
 * Falla fuerte si no existe.
 */
async function resolverMonedaId(
  cred: CredencialesOdoo,
  uid: number,
  codigoMoneda: "MXN" | "USD"
): Promise<number> {
  const monedas = await llamarOdooRpc<Array<{ id: number; name: string }>>(
    cred.url,
    "object",
    "execute_kw",
    [
      cred.dbName,
      uid,
      cred.apiKey,
      "res.currency",
      "search_read",
      [[["name", "=", codigoMoneda]]],
      { fields: ["id", "name"], limit: 1 },
    ]
  )

  if (monedas && monedas.length > 0) {
    return monedas[0].id
  }

  throw new Error(
    `No se encontró la moneda ${codigoMoneda} en Odoo (res.currency). Verifica la configuración de monedas en Odoo.`
  )
}

/**
 * Crea una Solicitud de cotización (purchase.order en estado draft) en Odoo.
 */
export async function crearCotizacionEnOdoo(
  payload: CotizacionOdooPayload
): Promise<ResultadoCreacionOdoo> {
  const cred = obtenerCredencialesOdoo()
  const uid = await autenticarOdoo(cred)

  // 1. Validar y resolver entidades obligatorias (fallan fuerte antes de crear)
  const partner = await resolverPartnerId(
    cred,
    uid,
    payload.proveedor,
    payload.proveedorId
  )

  const dummyProductId = await resolverProductoGenericoId(cred, uid)
  const currencyId = await resolverMonedaId(cred, uid, payload.moneda)

  // 2. Resolver impuestos por tasa única requerida en las partidas (con cache)
  const cacheImpuestos = new Map<number, number | null>()
  for (const item of payload.partidas) {
    const tasa = item.tasaIva ?? 0
    if (!cacheImpuestos.has(tasa)) {
      const taxId = await resolverImpuestoCompraPorTasa(cred, uid, tasa)
      cacheImpuestos.set(tasa, taxId)
    }
  }

  // 3. Armar las líneas de la orden
  const orderLines = payload.partidas.map((item) => {
    const prefijoClave = item.clave ? `[${item.clave.trim()}] ` : ""
    const requisitor = item.requisitor || payload.requisitorGeneral
    const empresa = item.empresa || payload.empresaGeneral
    const uso = item.uso || payload.usoGeneral

    let descripcion = `${prefijoClave}${item.descripcion}`
    const metaParts: string[] = []
    if (requisitor) metaParts.push(`Req: ${requisitor}`)
    if (empresa) metaParts.push(`Emp: ${empresa}`)
    if (uso) metaParts.push(`Uso: ${uso}`)
    if (metaParts.length > 0) {
      descripcion += ` (${metaParts.join(" | ")})`
    }

    const lineValues: Record<string, unknown> = {
      product_id: dummyProductId,
      name: descripcion,
      product_qty: item.cantidad,
      price_unit: item.precioUnitario,
    }

    const taxId = cacheImpuestos.get(item.tasaIva ?? 0)
    if (taxId) {
      lineValues.taxes_id = [[6, 0, [taxId]]]
    } else {
      lineValues.taxes_id = [[6, 0, []]]
    }

    return [0, 0, lineValues]
  })

  const ordenValues: Record<string, unknown> = {
    partner_id: partner.id,
    currency_id: currencyId,
    partner_ref: payload.referenciaProveedor || false,
    order_line: orderLines,
  }

  if (payload.fecha) {
    ordenValues.date_order = `${payload.fecha} 12:00:00`
  }

  if (payload.notas) {
    ordenValues.notes = payload.notas
  }

  // 4. Ejecutar creación de purchase.order
  const nuevoPoId = await llamarOdooRpc<number>(
    cred.url,
    "object",
    "execute_kw",
    [cred.dbName, uid, cred.apiKey, "purchase.order", "create", [ordenValues]]
  )

  if (!nuevoPoId || typeof nuevoPoId !== "number") {
    throw new Error("Odoo no devolvió un ID de orden válido al crear la cotización.")
  }

  // 5. Leer la orden creada para obtener su nombre (folio ej. P00708), estado y totales
  const poCreado = await llamarOdooRpc<
    Array<{
      id: number
      name: string
      state: string
      amount_untaxed: number
      amount_tax: number
      amount_total: number
    }>
  >(cred.url, "object", "execute_kw", [
    cred.dbName,
    uid,
    cred.apiKey,
    "purchase.order",
    "search_read",
    [[["id", "=", nuevoPoId]]],
    {
      fields: ["id", "name", "state", "amount_untaxed", "amount_tax", "amount_total"],
      limit: 1,
    },
  ])

  const po = poCreado?.[0]

  return {
    odooId: nuevoPoId,
    odooName: po?.name || `PO-${nuevoPoId}`,
    odooState: po?.state || "draft",
    proveedorId: partner.id,
    proveedorNombre: partner.name,
    referenciaProveedor: payload.referenciaProveedor || "",
    moneda: payload.moneda,
    totalUntaxed: po?.amount_untaxed ?? payload.partidas.reduce((acc, p) => acc + p.subtotal, 0),
    totalTax: po?.amount_tax ?? payload.partidas.reduce((acc, p) => acc + p.subtotal * p.tasaIva, 0),
    total: po?.amount_total ?? payload.partidas.reduce((acc, p) => acc + p.subtotal * (1 + p.tasaIva), 0),
    itemsCount: payload.partidas.length,
  }
}
