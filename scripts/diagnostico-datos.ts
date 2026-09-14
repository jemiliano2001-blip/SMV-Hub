/**
 * Diagnóstico de datos reales — SOLO LECTURA.
 *
 * Fase 0 del spec de memoria operativa (docs/superpowers/specs/2026-09-13-memoria-operativa-design.md).
 * Lee las colecciones operativas con Admin SDK y reporta agregados: conteos, porcentajes,
 * distribuciones, huecos de estructura y tamaño estimado del índice semántico.
 *
 * Nunca escribe. Nunca imprime filas con descripciones ni precios individuales — solo
 * nombres de proveedor (fantasmas) y formatos de texto libre, porque son lo accionable.
 *
 *   npx tsx scripts/diagnostico-datos.ts [projectId=smv-brain]
 *
 * Credenciales: GOOGLE_APPLICATION_CREDENTIALS en .env.local o .env.admin.local
 * (service account de solo lectura, roles/datastore.viewer).
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import {
  generarLlavePieza,
  normalizarNombreProveedor,
  matchProveedorPorNombre,
} from "../lib/pieza-matching"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const projectId = process.argv[2] || "smv-brain"

function cargarEnvLocal() {
  for (const nombre of [".env.local", ".env.admin.local"]) {
    const envPath = resolve(root, nombre)
    if (!existsSync(envPath)) continue
    const raw = readFileSync(envPath, "utf8")
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.startsWith("#")) continue
      const eq = line.indexOf("=")
      if (eq <= 0) continue
      const key = line.slice(0, eq).trim()
      let value = line.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (key === "GOOGLE_APPLICATION_CREDENTIALS" && !value.startsWith("/") && !/^[A-Za-z]:/.test(value)) {
        value = resolve(root, value)
      }
      if (!process.env[key]) process.env[key] = value
    }
  }
}
cargarEnvLocal()
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS en .env.local o .env.admin.local")
  process.exit(1)
}

const require = createRequire(import.meta.url)
const { initializeApp } = require("firebase-admin/app") as typeof import("firebase-admin/app")
const { getFirestore } = require("firebase-admin/firestore") as typeof import("firebase-admin/firestore")
initializeApp({ projectId })
const db = getFirestore("compras-americanas")

// ── helpers de reporte ──────────────────────────────────────────────────────

type Doc = Record<string, unknown>

function pct(n: number, total: number): string {
  if (total === 0) return "—"
  return `${((n / total) * 100).toFixed(0)}%`
}
function linea(etiqueta: string, n: number, total?: number) {
  const val = total === undefined ? String(n) : `${n} (${pct(n, total)})`
  console.log(`  ${etiqueta.padEnd(46)} ${val}`)
}
function titulo(t: string) {
  console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`)
}
function distribucion(etiqueta: string, mapa: Map<string, number>, total: number, top = 10) {
  const filas = [...mapa.entries()].sort((a, b) => b[1] - a[1]).slice(0, top)
  console.log(`  ${etiqueta}:`)
  for (const [k, v] of filas) console.log(`    ${k.padEnd(40)} ${String(v).padStart(5)}  ${pct(v, total)}`)
  if (mapa.size > top) console.log(`    … y ${mapa.size - top} más`)
}
function inc(mapa: Map<string, number>, k: string) {
  mapa.set(k, (mapa.get(k) ?? 0) + 1)
}
function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}
function vacio(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "")
}

async function leer(col: string): Promise<Doc[]> {
  const snap = await db.collection(col).get()
  return snap.docs.map((d) => ({ __id: d.id, ...d.data() }))
}

/** "3 dias" → {min:3,max:3}; "20-30 dias" → {min:20,max:30}; "2 semanas" → semanas; sin número → null */
function clasificarDiasHabiles(raw: string): "rango" | "numero" | "semanas_o_meses" | "sin_numero" {
  const s = raw.toLowerCase()
  if (/semana|mes(es)?\b/.test(s)) return "semanas_o_meses"
  if (/\d+\s*(-|–|a|to)\s*\d+/.test(s)) return "rango"
  if (/\d+/.test(s)) return "numero"
  return "sin_numero"
}

// ── diagnóstico ─────────────────────────────────────────────────────────────

async function main() {
  const t0 = Date.now()
  console.log(`Diagnóstico de datos · proyecto=${projectId} · base=compras-americanas · ${new Date().toISOString()}`)

  // A. Volúmenes
  titulo("A. Volúmenes por colección")
  const colecciones = [
    "ordenes", "cotizaciones", "requisiciones", "proveedores",
    "cotizaciones_requisicion", "evaluaciones_proveedores",
    "compras_odoo_po", "compras_odoo_items", "compras_odoo_facturas",
    "sat_asignaciones", "clasificacion_ia_mapeos",
    "busqueda_indice", "endmills-medidas", "auditoria",
  ]
  const conteos = new Map<string, number>()
  for (const c of colecciones) {
    const snap = await db.collection(c).count().get()
    conteos.set(c, snap.data().count)
    linea(c, snap.data().count)
  }

  // B. Proveedores (catálogo)
  titulo("B. Proveedores — catálogo")
  const proveedores = await leer("proveedores")
  const catalogo = proveedores.map((p) => ({ id: String(p.__id), nombre: str(p.nombre) })).filter((p) => p.nombre)
  const porMercado = new Map<string, number>()
  const porEstatus = new Map<string, number>()
  let sinMercado = 0
  for (const p of proveedores) {
    const m = str(p.mercado)
    if (!m) sinMercado++
    inc(porMercado, m || "(sin mercado)")
    inc(porEstatus, str(p.estatus) || "(sin estatus)")
  }
  linea("total", proveedores.length)
  linea("sin campo mercado", sinMercado, proveedores.length)
  distribucion("por mercado", porMercado, proveedores.length)
  distribucion("por estatus", porEstatus, proveedores.length)

  // C. Órdenes
  titulo("C. Órdenes (compras americanas)")
  const ordenes = await leer("ordenes")
  const nO = ordenes.length
  let itemsTotal = 0
  let sinProveedorId = 0
  let sinFechaFactura = 0
  let itemsPrecioNulo = 0
  let itemsSinClave = 0
  let itemsSatPendiente = 0
  let itemsSinEmpresa = 0
  let itemsSinCuenta = 0
  let itemsSinRequisitor = 0
  let itemsSinDescSimplificada = 0
  const monedaO = new Map<string, number>()
  const nombresLibres = new Map<string, number>() // normalizado → # órdenes
  const fantasmasO = new Map<string, number>()
  const llavesO = new Map<string, number>() // llave → # ítems
  const llaveProveedores = new Map<string, Set<string>>()
  for (const o of ordenes) {
    inc(monedaO, str(o.moneda) || "(sin moneda)")
    if (vacio(o.proveedorId)) sinProveedorId++
    if (vacio(o.fechaFactura)) sinFechaFactura++
    const nombre = str(o.proveedor)
    const norm = normalizarNombreProveedor(nombre)
    if (norm) {
      inc(nombresLibres, norm)
      if (vacio(o.proveedorId) && !matchProveedorPorNombre(nombre, catalogo)) inc(fantasmasO, norm)
    }
    const items = Array.isArray(o.items) ? (o.items as Doc[]) : []
    itemsTotal += items.length
    for (const it of items) {
      const precio = num(it.precioUnitario)
      if (precio === null || precio <= 0) itemsPrecioNulo++
      if (vacio(it.claveProdServ)) itemsSinClave++
      if (it.satPendiente === true) itemsSatPendiente++
      if (vacio(it.empresa) && vacio(o.empresa)) itemsSinEmpresa++
      if (vacio(it.cuentaCargo) && vacio(o.cuentaCargo)) itemsSinCuenta++
      if (vacio(it.requisitor) && vacio(o.requisitor)) itemsSinRequisitor++
      if (vacio(it.descripcionSimplificada)) itemsSinDescSimplificada++
      const llave = generarLlavePieza(null, str(it.descripcion))
      if (llave !== "|") {
        inc(llavesO, llave)
        if (!llaveProveedores.has(llave)) llaveProveedores.set(llave, new Set())
        llaveProveedores.get(llave)!.add(norm)
      }
    }
  }
  const llavesRepetidas = [...llavesO.values()].filter((n) => n >= 2).length
  const itemsConHistorial = [...llavesO.values()].filter((n) => n >= 2).reduce((a, b) => a + b, 0)
  const llavesMultiProveedor = [...llaveProveedores.values()].filter((s) => s.size >= 2).length
  linea("órdenes", nO)
  linea("ítems totales", itemsTotal)
  linea("ítems por orden (promedio)", Math.round((itemsTotal / Math.max(nO, 1)) * 10) / 10)
  distribucion("por moneda", monedaO, nO)
  linea("órdenes sin fechaFactura", sinFechaFactura, nO)
  linea("órdenes sin proveedorId (FK)", sinProveedorId, nO)
  linea("nombres de proveedor distintos (normalizados)", nombresLibres.size)
  linea("  de esos, fantasma (sin FK y sin match en catálogo)", fantasmasO.size)
  distribucion("  top fantasmas por # órdenes", fantasmasO, nO)
  linea("ítems con precioUnitario nulo o 0", itemsPrecioNulo, itemsTotal)
  linea("ítems sin claveProdServ", itemsSinClave, itemsTotal)
  linea("ítems con satPendiente=true", itemsSatPendiente, itemsTotal)
  linea("ítems sin empresa (ni en orden)", itemsSinEmpresa, itemsTotal)
  linea("ítems sin cuentaCargo (ni en orden)", itemsSinCuenta, itemsTotal)
  linea("ítems sin requisitor (ni en orden)", itemsSinRequisitor, itemsTotal)
  linea("ítems sin descripcionSimplificada", itemsSinDescSimplificada, itemsTotal)
  linea("llaves de pieza distintas", llavesO.size)
  linea("  llaves compradas ≥2 veces", llavesRepetidas, llavesO.size)
  linea("  ítems que tendrían 'comprado antes'", itemsConHistorial, itemsTotal)
  linea("  llaves compradas a ≥2 proveedores", llavesMultiProveedor, llavesO.size)

  // D. Cotizaciones
  titulo("D. Cotizaciones")
  const cotizaciones = await leer("cotizaciones")
  const nC = cotizaciones.length
  const origenC = new Map<string, number>()
  const ubicacionC = new Map<string, number>()
  const estatusC = new Map<string, number>()
  const monedaC = new Map<string, number>()
  const diasClase = new Map<string, number>()
  const diasFormatosRaros = new Map<string, number>()
  let cPrecioNulo = 0
  let cSinLlave = 0
  let cSinProveedorId = 0
  let cSinNumeroParte = 0
  let cDiasNull = 0
  let cCompraSinOrigenId = 0
  const fantasmasC = new Map<string, number>()
  const llavesC = new Map<string, number>()
  const llavesCProv = new Map<string, Set<string>>()
  for (const c of cotizaciones) {
    const origen = str(c.origen) || "(sin origen)"
    inc(origenC, origen)
    inc(ubicacionC, str(c.ubicacion) || "(sin ubicación)")
    inc(estatusC, str(c.estatus) || "(sin estatus)")
    inc(monedaC, str(c.moneda) || "(sin moneda)")
    const precio = num(c.precioUnitario)
    if (precio === null || precio <= 0) cPrecioNulo++
    if (vacio(c.llavePieza)) cSinLlave++
    if (vacio(c.numeroParte)) cSinNumeroParte++
    if (origen === "compra" && vacio(c.ordenIdOrigen)) cCompraSinOrigenId++
    const nombre = str(c.proveedor)
    const norm = normalizarNombreProveedor(nombre)
    if (vacio(c.proveedorId)) {
      cSinProveedorId++
      if (norm && !matchProveedorPorNombre(nombre, catalogo)) inc(fantasmasC, norm)
    }
    const dias = c.diasHabiles
    if (vacio(dias)) cDiasNull++
    else {
      const clase = clasificarDiasHabiles(String(dias))
      inc(diasClase, clase)
      if (clase === "sin_numero" || clase === "semanas_o_meses") inc(diasFormatosRaros, String(dias).toLowerCase().slice(0, 30))
    }
    const llave = generarLlavePieza(str(c.numeroParte) || null, str(c.descripcion))
    if (llave !== "|") {
      inc(llavesC, llave)
      if (!llavesCProv.has(llave)) llavesCProv.set(llave, new Set())
      llavesCProv.get(llave)!.add(norm)
    }
  }
  const cManuales = nC - (origenC.get("compra") ?? 0)
  linea("cotizaciones", nC)
  distribucion("por origen", origenC, nC)
  linea("  manuales (origen ≠ compra) → candidatas a índice", cManuales, nC)
  linea("  origen=compra sin ordenIdOrigen", cCompraSinOrigenId, origenC.get("compra") ?? 0)
  distribucion("por ubicación", ubicacionC, nC)
  distribucion("por estatus", estatusC, nC)
  distribucion("por moneda", monedaC, nC)
  linea("precioUnitario nulo o 0", cPrecioNulo, nC)
  linea("sin numeroParte", cSinNumeroParte, nC)
  linea("sin llavePieza persistida", cSinLlave, nC)
  linea("sin proveedorId (FK)", cSinProveedorId, nC)
  linea("  de esos, nombre fantasma distinto", fantasmasC.size)
  distribucion("  top fantasmas por # filas", fantasmasC, nC)
  linea("diasHabiles null", cDiasNull, nC)
  distribucion("diasHabiles (no nulos) por formato", diasClase, nC - cDiasNull)
  distribucion("  formatos sin número / en semanas-meses", diasFormatosRaros, nC - cDiasNull, 8)
  linea("llaves de pieza distintas (calculadas)", llavesC.size)
  linea("  llaves con ≥2 filas (historial de precio)", [...llavesC.values()].filter((n) => n >= 2).length, llavesC.size)
  linea("  llaves con ≥2 proveedores (comparables)", [...llavesCProv.values()].filter((s) => s.size >= 2).length, llavesC.size)

  // E. Requisiciones + cotizaciones de requisición
  titulo("E. Requisiciones")
  const requisiciones = await leer("requisiciones")
  const tipoR = new Map<string, number>()
  const estadoR = new Map<string, number>()
  const cantidadR = new Map<string, number>()
  for (const r of requisiciones) {
    inc(tipoR, str(r.tipo) || "(sin tipo)")
    inc(estadoR, str(r.estado) || "(sin estado)")
    const cant = str(r.cantidad)
    inc(cantidadR, !cant ? "null" : /^\d+(\.\d+)?$/.test(cant) ? "numero_puro" : /\d/.test(cant) ? "numero_con_unidad" : "sin_numero")
  }
  linea("requisiciones", requisiciones.length)
  distribucion("por tipo", tipoR, requisiciones.length)
  distribucion("por estado", estadoR, requisiciones.length)
  distribucion("cantidad por formato", cantidadR, requisiciones.length)
  linea("cotizaciones_requisicion", conteos.get("cotizaciones_requisicion") ?? 0)
  linea("evaluaciones_proveedores", conteos.get("evaluaciones_proveedores") ?? 0)

  // F. Compras Odoo (MX)
  titulo("F. Compras Odoo MX (espejo)")
  const odooItems = await leer("compras_odoo_items")
  const nOd = odooItems.length
  const catOd = new Map<string, number>()
  const monedaOd = new Map<string, number>()
  const provOd = new Map<string, number>()
  let odPrecio0 = 0
  let odRfq = 0
  let odSinClave = 0
  let odSinTipo = 0
  for (const it of odooItems) {
    inc(catOd, str(it.categoriaId) || "(sin categoría)")
    inc(monedaOd, str(it.moneda) || "(sin moneda)")
    inc(provOd, normalizarNombreProveedor(str(it.proveedorNombre)) || "(sin proveedor)")
    const p = num(it.precioUnitario)
    if (p === null || p <= 0) odPrecio0++
    if (it.esRfq === true) odRfq++
    if (vacio(it.claveProdServ)) odSinClave++
    if (vacio(it.tipoInsumo) && vacio(it.tipoMetal)) odSinTipo++
  }
  linea("ítems Odoo", nOd)
  linea("proveedores Odoo distintos", provOd.size)
  linea("precioUnitario 0 (no comprables)", odPrecio0, nOd)
  linea("esRfq=true (PO no aprobada)", odRfq, nOd)
  linea("sin claveProdServ", odSinClave, nOd)
  linea("sin tipoInsumo/tipoMetal (familia sin detalle)", odSinTipo, nOd)
  distribucion("por categoría (familia)", catOd, nOd, 12)
  distribucion("por moneda", monedaOd, nOd)

  // G. Memorias de corrección
  titulo("G. Memorias de corrección existentes")
  linea("sat_asignaciones (claves SAT validadas)", conteos.get("sat_asignaciones") ?? 0)
  linea("clasificacion_ia_mapeos (familias aprobadas)", conteos.get("clasificacion_ia_mapeos") ?? 0)
  linea("evaluaciones_proveedores (scorecards manuales)", conteos.get("evaluaciones_proveedores") ?? 0)

  // H. Índice semántico
  titulo("H. Índice semántico (busqueda_indice)")
  const indice = await leer("busqueda_indice")
  const fuenteI = new Map<string, number>()
  const modeloI = new Map<string, number>()
  let bytesMuestra = 0
  for (const e of indice) {
    inc(fuenteI, str(e.fuente) || "(sin fuente)")
    inc(modeloI, `${str(e.modelo) || "?"} · ${num(e.dimensiones) ?? "?"}d`)
  }
  if (indice.length > 0) bytesMuestra = Buffer.byteLength(JSON.stringify(indice[0]))
  const estado = await db.collection("busqueda_indice_sync_state").doc("estado").get()
  const est = (estado.exists ? estado.data() : {}) as Doc
  linea("entradas", indice.length)
  distribucion("por fuente", fuenteI, indice.length)
  distribucion("por modelo · dimensiones", modeloI, indice.length)
  linea("bytes por entrada (muestra, JSON)", bytesMuestra)
  linea("última corrida del sync", 0)
  console.log(`    ultimaCorridaEn=${est.ultimaCorridaEn instanceof Object && "toDate" in est.ultimaCorridaEn ? (est.ultimaCorridaEn as { toDate(): Date }).toDate().toISOString() : String(est.ultimaCorridaEn ?? "—")}  esperadas=${est.entradasEsperadas ?? "—"}  reembebidas=${est.reembebidas ?? "—"}  error=${est.ultimoError ?? "ninguno"}`)

  // I. Proyección del índice ampliado
  titulo("I. Proyección del índice ampliado (regla de corte del spec: 1,500)")
  const actual = indice.length
  const conCotizaciones = actual + cManuales
  const conRequisiciones = conCotizaciones + requisiciones.length
  const conOdoo = conRequisiciones + (nOd - odPrecio0)
  const mb = (n: number) => `${((n * Math.max(bytesMuestra, 3000)) / 1024 / 1024).toFixed(1)} MB`
  linea("hoy (orden-item + proveedor)", actual)
  linea(`+ cotizaciones manuales (${cManuales})`, conCotizaciones)
  linea(`+ requisiciones (${requisiciones.length})`, conRequisiciones)
  linea(`+ ítems Odoo con precio (${nOd - odPrecio0})`, conOdoo)
  console.log(`  lectura fría estimada por consulta: sin Odoo ${mb(conRequisiciones)} · con Odoo ${mb(conOdoo)}`)
  console.log(`  veredicto: sin Odoo ${conRequisiciones <= 1500 ? "CABE" : "EXCEDE"} el corte · con Odoo ${conOdoo <= 1500 ? "CABE" : "EXCEDE"} el corte`)

  console.log(`\nListo · ${Date.now() - t0} ms · solo lecturas`)
}

main().catch((err) => {
  console.error("Diagnóstico falló:", err instanceof Error ? err.message : err)
  process.exit(1)
})
