// Extrae registros de compra de las capturas en la carpeta de Screenshots usando
// Gemini (visión + structured output) vía REST. Sin dependencias nuevas.
//
// Formato de salida: estilo "Extractor" (Proyecto Ballena), listo para pegar en
// Google Sheets. Columnas: Estado, Fecha, Proveedor, Cantidad, Descripción, Link,
// Entrega, Requisitor, Orden_Trabajo, Empresa (+ Archivo para trazabilidad).
// Una fila por línea de compra; estandarización en español.
//
// Uso:
//   node scripts/extraer-compras.mjs                 # procesa todos los meses
//   node scripts/extraer-compras.mjs --month 2026-06 # solo un mes
//   node scripts/extraer-compras.mjs --limit 20      # tope de imágenes (prueba)
//   node scripts/extraer-compras.mjs --dry-run       # lista lo que haría, sin API
//   node scripts/extraer-compras.mjs --consolidate   # solo regenera el CSV desde los JSON
//
// Variables de entorno (de .env.local o del shell):
//   GEMINI_API_KEY   (obligatoria)
//   GEMINI_MODEL     (opcional, default "gemini-3.7-flash")
//   CONCURRENCY      (opcional, default 4)

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(__dirname, "..")
const CARPETA_COMPRAS = "C:/Users/emili/Pictures/Screenshots/Compras"
const SALIDA_DIR = path.join(REPO, "data", "extraccion")
const CSV_PATH = path.join(SALIDA_DIR, "_consolidado.csv")

// ── Config ────────────────────────────────────────────────────────────────────
cargarEnvLocal()
const API_KEY = process.env.GEMINI_API_KEY
const MODELO = process.env.GEMINI_MODEL || "gemini-3.7-flash"
const CONCURRENCY = Number(process.env.CONCURRENCY || 4)

const args = process.argv.slice(2)
const FLAG = (n) => args.includes(n)
const VAL = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined }
const SOLO_MES = VAL("--month")
const LIMITE = VAL("--limit") ? Number(VAL("--limit")) : Infinity
const DRY_RUN = FLAG("--dry-run")
const SOLO_CONSOLIDAR = FLAG("--consolidate")

// Columnas del CSV (encabezados como en Ballena) y sus claves en el objeto fila.
const COLUMNAS = [
  ["Estado", "estado"],
  ["Fecha", "fecha"],
  ["Proveedor", "proveedor"],
  ["Cantidad", "cantidad"],
  ["Descripción", "descripcion"],
  ["Precio_Unitario", "precioUnitario"],
  ["Total", "total"],
  ["Moneda", "moneda"],
  ["Link", "link"],
  ["Entrega", "entrega"],
  ["Requisitor", "requisitor"],
  ["Orden_Trabajo", "ordenTrabajo"],
  ["Empresa", "empresa"],
  ["Archivo", "archivo"],
]

// ── Schema de structured output (subset OpenAPI que entiende Gemini) ───────────
const FILA = {
  type: "object",
  properties: {
    estado: { type: "string", enum: ["Entregado", "Comprado", "Pendiente", "Cancelado"] },
    fecha: { type: "string" },           // DD/MM/YYYY de compra/pedido, o ""
    proveedor: { type: "string" },       // formato Título
    cantidad: { type: "number" },        // 0 si no se sabe
    descripcion: { type: "string" },     // español, limpia
    precioUnitario: { type: "number" },  // precio por unidad, 0 si no aparece
    total: { type: "number" },           // total de la línea, 0 si no aparece
    moneda: { type: "string" },          // "USD" o "MXN", default "USD"
    link: { type: "string" },            // URL del producto, o ""
    entrega: { type: "string" },         // DD/MM/YYYY de entrega/guía, o ""
    empresa: { type: "string" },         // empresa visible en pantalla, o ""
    ordenTrabajo: { type: "string" },    // PO/OT visible en pantalla, o ""
  },
  required: ["estado", "fecha", "proveedor", "cantidad", "descripcion", "precioUnitario", "total", "moneda", "link", "entrega", "empresa", "ordenTrabajo"],
}
const RESPONSE_SCHEMA = {
  type: "object",
  properties: { registros: { type: "array", items: FILA } },
  required: ["registros"],
}

const PROMPT = `Extrae la información de las órdenes de compra de esta captura de pantalla.
Devuelve "registros" con un elemento por cada LÍNEA de compra (si una orden tiene
varios productos o es una tabla con varias filas, devuelve una fila por producto).
Si la imagen es solo una PÁGINA DE PRODUCTO sin compra confirmada (sin número de orden,
sin confirmación de pago), igualmente extrae lo que puedas y pon descripcion =
"(página de producto, sin compra confirmada)" con estado "Pendiente".

Para cada fila:
- estado: clasifícalo OBLIGATORIAMENTE en uno de: "Entregado", "Comprado", "Pendiente", "Cancelado".
  Mercado Libre "Entregado"/"Llegó" → Entregado. eBay/Amazon "Order confirmed"/"Comprado" → Comprado.
  McMaster-Carr con número de orden confirmado → Comprado o Entregado según corresponda.
  Digi-Key/Mouser con orden confirmada → Comprado.
  Solo página de producto o carrito → Pendiente.
- fecha: fecha de COMPRA o del pedido, formato estricto DD/MM/YYYY. "" si no aparece.
- proveedor: el VENDEDOR/seller si aparece (en eBay/Amazon), si no el marketplace.
  Escríbelo en formato Título (ej. "Home Depot", "Mercado Libre", "Mc Master Carr").
- cantidad: número de artículos de esa línea (entero). 0 si no se distingue.
- descripcion: descripción del producto, TRADUCIDA al español de forma natural y limpia
  (sin comillas ni caracteres raros).
- link: la URL del producto si es visible (mírala también en la barra de direcciones). "" si no hay.
- precioUnitario: precio UNITARIO de esa línea (número, sin símbolo). 0 si no aparece.
- total: total de esa línea (cantidad × precioUnitario, o el monto mostrado). 0 si no aparece.
- moneda: "USD" si el precio aparece en dólares, "MXN" si en pesos. "USD" por defecto.
- entrega: fecha de entrega o de guía, formato DD/MM/YYYY. "" si no aparece.
- empresa: empresa para la que se realiza la compra, si aparece visible en pantalla.
  En McMaster-Carr busca en los detalles del pedido el campo "Company", "Empresa" o "Account".
  En Digi-Key o Mouser busca el nombre de la empresa en la dirección de envío o encabezado.
  Si ves "SilTech" en la pantalla, usa "SilTech". Si ves "SMV" o "Vázquez", usa "SMV Maquinados".
  Si no hay ningún nombre de empresa visible, usa "".
- ordenTrabajo: número o código de orden de trabajo/PO si aparece en pantalla.
  En McMaster-Carr busca campos como "PO Number", "Job #", "Order Reference" o similares.
  Si no aparece, usa "".
Usa "" o 0 donde no haya dato con certeza. No inventes valores.`

// ── Recolección de archivos ───────────────────────────────────────────────────
function listarMeses() {
  return fs.readdirSync(CARPETA_COMPRAS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((m) => !SOLO_MES || m === SOLO_MES)
    .sort()
}

function listarImagenes(mes) {
  const dir = path.join(CARPETA_COMPRAS, mes)
  return fs.readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".png"))
    .sort()
    .map((f) => ({ mes, archivo: `${mes}/${f}`, ruta: path.join(dir, f) }))
}

function cargarExistentes(mes) {
  const f = path.join(SALIDA_DIR, `${mes}.json`)
  if (!fs.existsSync(f)) return []
  try { return JSON.parse(fs.readFileSync(f, "utf8")) } catch { return [] }
}

// ── Llamada a Gemini ──────────────────────────────────────────────────────────
async function extraer(ruta, mes) {
  const base64 = fs.readFileSync(ruta).toString("base64")
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${API_KEY}`
  const contexto = `\n\nCONTEXTO: esta captura se tomó en ${mes} (año-mes). Si una fecha no muestra el año, asume el año de ese contexto. NUNCA inventes años (como 2020 o 2024): si dudas del año, usa el de ${mes}.`
  const body = {
    contents: [{
      role: "user",
      parts: [
        { inline_data: { mime_type: "image/png", data: base64 } },
        { text: PROMPT + contexto },
      ],
    }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.1,
    },
  }

  for (let intento = 1; intento <= 5; intento++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    if (res.status === 429 || res.status >= 500) {
      await sleep(Math.min(60000, 2000 * 2 ** (intento - 1)))
      continue
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
    const json = await res.json()
    const texto = json?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!texto) throw new Error("Respuesta sin texto estructurado")
    return JSON.parse(texto).registros ?? []
  }
  throw new Error("Agotados los reintentos (rate limit / 5xx)")
}

// Normaliza una fila al shape completo. empresa y ordenTrabajo vienen de Gemini cuando
// son visibles en pantalla (McMaster los muestra); requisitor siempre queda vacío.
function normalizar(archivo, r) {
  return {
    estado: r.estado || "Pendiente",
    fecha: r.fecha || "",
    proveedor: r.proveedor || "",
    cantidad: typeof r.cantidad === "number" ? r.cantidad : 0,
    descripcion: r.descripcion || "",
    link: r.link || "",
    entrega: r.entrega || "",
    precioUnitario: typeof r.precioUnitario === "number" ? r.precioUnitario : 0,
    total: typeof r.total === "number" ? r.total : 0,
    moneda: r.moneda || "USD",
    requisitor: "",
    ordenTrabajo: r.ordenTrabajo || "",
    empresa: r.empresa || "",
    archivo,
  }
}

// ── Loop principal ────────────────────────────────────────────────────────────
async function main() {
  if (SOLO_CONSOLIDAR) { consolidarCSV(); return }
  if (!API_KEY) { console.error("Falta GEMINI_API_KEY (revisa .env.local)"); process.exit(1) }
  fs.mkdirSync(SALIDA_DIR, { recursive: true })

  let procesadasTotal = 0
  for (const mes of listarMeses()) {
    const existentes = cargarExistentes(mes)
    const yaHechos = new Set(existentes.map((r) => r.archivo))
    const pendientes = listarImagenes(mes).filter((i) => !yaHechos.has(i.archivo))
    if (pendientes.length === 0) { console.log(`${mes}: 0 pendientes (${existentes.length} filas ya extraídas)`); continue }

    console.log(`${mes}: ${pendientes.length} imágenes pendientes`)
    if (DRY_RUN) { procesadasTotal += pendientes.length; continue }

    const filas = [...existentes]
    let i = 0
    async function worker() {
      while (i < pendientes.length && procesadasTotal < LIMITE) {
        const img = pendientes[i++]; procesadasTotal++
        try {
          const registros = await extraer(img.ruta, img.mes)
          if (registros.length === 0) {
            filas.push(normalizar(img.archivo, { estado: "Pendiente", descripcion: "(sin datos legibles)" }))
          } else {
            for (const r of registros) filas.push(normalizar(img.archivo, r))
          }
          console.log(`  ✓ ${img.archivo} → ${registros.length} fila(s)`)
        } catch (e) {
          filas.push({ ...normalizar(img.archivo, { descripcion: "(error de extracción)" }), error: String(e.message || e) })
          console.log(`  ✗ ${img.archivo} → ${e.message || e}`)
        }
        guardar(mes, filas) // persistencia incremental
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    console.log(`${mes}: guardado data/extraccion/${mes}.json (${filas.length} filas)`)
    if (procesadasTotal >= LIMITE) break
  }
  consolidarCSV()
  console.log(`\nListo. Imágenes procesadas en esta corrida: ${Math.min(procesadasTotal, LIMITE)}`)
}

// ── Consolidación a CSV (BOM para Excel/Sheets) ───────────────────────────────
function consolidarCSV() {
  const filas = []
  for (const f of fs.readdirSync(SALIDA_DIR)) {
    if (!f.endsWith(".json")) continue
    try { filas.push(...JSON.parse(fs.readFileSync(path.join(SALIDA_DIR, f), "utf8"))) } catch {}
  }
  filas.sort((a, b) => String(a.archivo).localeCompare(String(b.archivo)))
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`
  const lineas = [COLUMNAS.map(([h]) => h).join(",")]
  for (const fila of filas) lineas.push(COLUMNAS.map(([, k]) => esc(fila[k])).join(","))
  fs.writeFileSync(CSV_PATH, "﻿" + lineas.join("\r\n") + "\r\n")
  console.log(`CSV consolidado: data/extraccion/_consolidado.csv (${filas.length} filas)`)
}

// ── Utilidades ────────────────────────────────────────────────────────────────
function guardar(mes, filas) {
  fs.writeFileSync(path.join(SALIDA_DIR, `${mes}.json`), JSON.stringify(filas, null, 2) + "\n")
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }
function cargarEnvLocal() {
  const f = path.join(REPO, ".env.local")
  if (!fs.existsSync(f)) return
  for (const linea of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
