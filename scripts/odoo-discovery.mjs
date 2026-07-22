// Fase 0: descubre campos reales de Odoo para Finanzas (AR) y Compras (PO + vendor bills).
// Solo lectura — no escribe nada en Odoo.
//
// Uso:
//   node scripts/odoo-discovery.mjs
//
// Variables de entorno (de .env.local):
//   ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(__dirname, "..")
const SALIDA_DIR = path.join(REPO, "data", "odoo-discovery")

cargarEnvLocal()
const { ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY } = process.env

const CAMPOS_FACTURA_CLIENTE = [
  "id", "name", "move_type", "partner_id", "invoice_date", "invoice_date_due",
  "amount_untaxed", "amount_tax", "amount_total", "amount_residual",
  "currency_id", "payment_state", "state", "ref", "invoice_origin", "company_id",
]

const CAMPOS_PO = [
  "id", "name", "partner_id", "date_order", "date_planned", "amount_total",
  "currency_id", "state", "user_id", "company_id", "order_line",
]

const CAMPOS_PO_LINE = [
  "id", "order_id", "name", "product_id", "product_qty", "price_unit",
  "price_subtotal", "product_uom",
]

const CAMPOS_FACTURA_PROVEEDOR = [
  "id", "name", "move_type", "partner_id", "invoice_date", "amount_untaxed",
  "amount_tax", "amount_total", "currency_id", "state", "invoice_origin",
  "company_id", "invoice_line_ids",
]

async function llamarOdoo(service, method, args, kwargs) {
  const res = await fetch(`${ODOO_URL}/jsonrpc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { service, method, args: kwargs ? [...args, kwargs] : args },
    }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const json = await res.json()
  if (json.error) throw new Error(`Odoo RPC error: ${JSON.stringify(json.error).slice(0, 500)}`)
  return json.result
}

async function main() {
  for (const [k, v] of Object.entries({ ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY })) {
    if (!v) { console.error(`Falta ${k} en .env.local`); process.exit(1) }
  }

  const uid = await llamarOdoo("common", "login", [ODOO_DB, ODOO_USERNAME, ODOO_API_KEY])
  if (!uid) throw new Error("Login falló — revisa ODOO_DB/ODOO_USERNAME/ODOO_API_KEY")

  fs.mkdirSync(SALIDA_DIR, { recursive: true })
  const execute = (modelo, metodo, args, kwargs) =>
    llamarOdoo("object", "execute_kw", [ODOO_DB, uid, ODOO_API_KEY, modelo, metodo, args], kwargs)

  // ── Finanzas (AR) ──────────────────────────────────────────────────────────
  const companies = await execute("res.company", "search_read", [[], ["id", "name"]])
  guardar("companies.json", companies)
  console.log(`Compañías: ${companies.map((c) => `${c.id}:${c.name}`).join(", ")}`)

  const fieldsMove = await execute("account.move", "fields_get", [], { attributes: ["string", "type", "selection"] })
  guardar("account-move-fields.json", fieldsMove)

  const sampleOut = await execute(
    "account.move", "search_read",
    [[["move_type", "in", ["out_invoice", "out_refund"]], ["state", "=", "posted"]]],
    { fields: CAMPOS_FACTURA_CLIENTE, limit: 5, order: "id desc" }
  )
  guardar("sample-invoices.json", sampleOut)

  // ── Compras: purchase.order ────────────────────────────────────────────────
  const fieldsPo = await execute("purchase.order", "fields_get", [], { attributes: ["string", "type", "selection"] })
  guardar("purchase-order-fields.json", fieldsPo)

  const fieldsPoLine = await execute("purchase.order.line", "fields_get", [], { attributes: ["string", "type", "selection"] })
  guardar("purchase-order-line-fields.json", fieldsPoLine)

  const samplePo = await execute(
    "purchase.order", "search_read",
    [[]],
    { fields: CAMPOS_PO, limit: 5, order: "id desc" }
  )
  guardar("sample-purchase-orders.json", samplePo)

  const lineIds = samplePo.flatMap((po) => (Array.isArray(po.order_line) ? po.order_line : [])).slice(0, 20)
  if (lineIds.length > 0) {
    const sampleLines = await execute(
      "purchase.order.line", "search_read",
      [[["id", "in", lineIds]]],
      { fields: CAMPOS_PO_LINE }
    )
    guardar("sample-purchase-order-lines.json", sampleLines)
  }

  // ── Vendor bills ───────────────────────────────────────────────────────────
  const sampleIn = await execute(
    "account.move", "search_read",
    [[["move_type", "in", ["in_invoice", "in_refund"]], ["state", "=", "posted"]]],
    { fields: CAMPOS_FACTURA_PROVEEDOR, limit: 5, order: "id desc" }
  )
  guardar("sample-vendor-bills.json", sampleIn)

  // ── Productos: campos SAT MX ───────────────────────────────────────────────
  const fieldsProduct = await execute("product.product", "fields_get", [], { attributes: ["string", "type"] })
  const satKeys = Object.keys(fieldsProduct).filter((k) =>
    /sat|l10n_mx|prod.?serv|unspsc|clave/i.test(k)
  )
  guardar("product-sat-field-names.json", satKeys)
  const satFieldsDetail = {}
  for (const k of satKeys) satFieldsDetail[k] = fieldsProduct[k]
  guardar("product-sat-fields.json", satFieldsDetail)

  try {
    const fieldsTemplate = await execute("product.template", "fields_get", [], { attributes: ["string", "type"] })
    const satTpl = Object.keys(fieldsTemplate).filter((k) =>
      /sat|l10n_mx|prod.?serv|unspsc|clave/i.test(k)
    )
    guardar("product-template-sat-field-names.json", satTpl)
  } catch (e) {
    console.warn("product.template fields_get:", e.message || e)
  }

  // ── Partners (país) ────────────────────────────────────────────────────────
  const fieldsPartner = await execute("res.partner", "fields_get", [], { attributes: ["string", "type"] })
  guardar("res-partner-country-related.json", {
    country_id: fieldsPartner.country_id ?? null,
    vat: fieldsPartner.vat ?? null,
  })

  const partnerIds = [
    ...samplePo.map((p) => (Array.isArray(p.partner_id) ? p.partner_id[0] : null)),
    ...sampleIn.map((p) => (Array.isArray(p.partner_id) ? p.partner_id[0] : null)),
  ].filter(Boolean)
  const uniquePartners = [...new Set(partnerIds)].slice(0, 10)
  if (uniquePartners.length > 0) {
    const partners = await execute(
      "res.partner", "search_read",
      [[["id", "in", uniquePartners]]],
      { fields: ["id", "name", "country_id", "vat", "email", "phone", "supplier_rank", "is_company"] }
    )
    guardar("sample-purchase-partners.json", partners)
  }

  console.log(`\nListo. Revisa data/odoo-discovery/ (gitignored).`)
}

function guardar(nombre, data) {
  fs.writeFileSync(path.join(SALIDA_DIR, nombre), JSON.stringify(data, null, 2) + "\n")
}

function cargarEnvLocal() {
  const f = path.join(REPO, ".env.local")
  if (!fs.existsSync(f)) return
  for (const linea of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
}

main().catch((e) => { console.error("Descubrimiento falló:", e.message || e); process.exit(1) })
