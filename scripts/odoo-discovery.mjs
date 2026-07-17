// Fase 0 del módulo Finanzas: descubre contra Odoo real qué compañía emite las
// facturas de cliente y qué campos reales tiene account.move, antes de escribir
// cualquier schema Zod o pipeline de sync. Sin dependencias nuevas (fetch nativo,
// JSON-RPC de Odoo). Solo lectura — no escribe nada en Odoo.
//
// Uso:
//   node scripts/odoo-discovery.mjs
//
// Variables de entorno (de .env.local, nunca commiteadas):
//   ODOO_URL       (obligatoria, ej. https://smv.odoo.com)
//   ODOO_DB        (obligatoria)
//   ODOO_USERNAME  (obligatoria)
//   ODOO_API_KEY   (obligatoria)
//
// Salida: data/odoo-discovery/*.json (gitignored). Revísalos tú mismo — pueden
// contener nombres de clientes reales, no los pegues en el chat.

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(__dirname, "..")
const SALIDA_DIR = path.join(REPO, "data", "odoo-discovery")

cargarEnvLocal()
const { ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY } = process.env

const CAMPOS_FACTURA = [
  "id", "name", "move_type", "partner_id", "invoice_date", "invoice_date_due",
  "amount_untaxed", "amount_tax", "amount_total", "amount_residual",
  "currency_id", "payment_state", "state", "ref", "invoice_origin", "company_id",
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

  const companies = await execute("res.company", "search_read", [[], ["id", "name"]])
  guardar("companies.json", companies)
  console.log(`Compañías: ${companies.map((c) => `${c.id}:${c.name}`).join(", ")}`)
  console.log("→ Confirma cuál emite las facturas de cliente reales antes de continuar.")

  const fields = await execute("account.move", "fields_get", [], { attributes: ["string", "type", "selection"] })
  guardar("account-move-fields.json", fields)

  // state = 'posted' y orden por id desc: evita traer borradores/cancelados de prueba
  // (invoice_date suele venir null en esos, lo cual vuelve inútil ordenar por esa fecha).
  const sample = await execute(
    "account.move", "search_read",
    [[["move_type", "in", ["out_invoice", "out_refund"]], ["state", "=", "posted"]]],
    { fields: CAMPOS_FACTURA, limit: 5, order: "id desc" }
  )
  guardar("sample-invoices.json", sample)
  if (sample.length === 0) {
    console.log("⚠ No hay facturas con state='posted' — revisa si el usuario/API key tiene acceso, o si todo el histórico está en borrador.")
  }

  console.log(`\nListo. Revisa data/odoo-discovery/ (gitignored, no lo compartas fuera del repo).`)
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
