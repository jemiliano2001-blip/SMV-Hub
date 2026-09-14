/**
 * Calibración B0 del frente B (estructura y normalización) — SOLO LECTURA.
 *
 * Spec: docs/superpowers/specs/2026-09-13-estructura-datos-normalizacion-design.md
 *
 * Produce las cuatro listas que el spec pide revisar antes de tocar datos:
 *   1. Mapeos aprobados vs ítems Odoo: cuántos ítems empata cada regla (exacta / cliente /
 *      propuesta para el sync) y muestras para calibrar el umbral de "incluye".
 *   2. Fantasmas de proveedor (órdenes y cotizaciones) con sugerencia de catálogo y acción.
 *   3. `diasHabiles`: cada valor distinto con el parseo propuesto (semanas ×5, meses ×20, stock=0).
 *   4. Proveedores con odooPartnerId + USD (revisar `mercado` a mano) y los que no vienen de Odoo.
 *
 * Nunca escribe. Imprime nombres de proveedor y descripciones truncadas porque son lo que hay
 * que revisar; nunca precios.
 *
 *   npx tsx scripts/calibracion-frente-b.ts [projectId=smv-brain]
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import { normalizarNombreProveedor, matchProveedorPorNombre } from "../lib/pieza-matching"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const projectId = process.argv[2] || "smv-brain"

function cargarEnvLocal() {
  for (const nombre of [".env.local", ".env.admin.local"]) {
    const envPath = resolve(root, nombre)
    if (!existsSync(envPath)) continue
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      if (!line || line.startsWith("#")) continue
      const eq = line.indexOf("=")
      if (eq <= 0) continue
      const key = line.slice(0, eq).trim()
      let value = line.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
      if (key === "GOOGLE_APPLICATION_CREDENTIALS" && !value.startsWith("/") && !/^[A-Za-z]:/.test(value)) value = resolve(root, value)
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

type Doc = Record<string, unknown>
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)
const vacio = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "")
const pct = (n: number, t: number) => (t === 0 ? "—" : `${((n / t) * 100).toFixed(0)}%`)
const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s)
function titulo(t: string) {
  console.log(`\n── ${t} ${"─".repeat(Math.max(0, 76 - t.length))}`)
}
async function leer(col: string): Promise<Doc[]> {
  const snap = await db.collection(col).get()
  return snap.docs.map((d) => ({ __id: d.id, ...d.data() }))
}

// ── 1. Mapeos aprobados vs ítems Odoo ───────────────────────────────────────

/** Copia literal de lib/compras-odoo/mapeos-clasificacion.ts (ese módulo importa el SDK cliente). */
function normalizarDescripcionMapeo(desc: string): string {
  return desc.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim()
}

type Mapeo = { norm: string; categoriaId: string; tipoInsumo: string | null; ejemplo: string }
type Regla = "A_exacta" | "B_cliente" | "C_sync" | "D_sync_sku"

function empatar(norm: string, mapeos: Mapeo[], regla: Regla): { mapeo: Mapeo; via: "exacto" | "incluye" } | null {
  const exacto = mapeos.find((m) => m.norm === norm)
  if (exacto) return { mapeo: exacto, via: "exacto" }
  if (regla === "A_exacta") return null
  for (const m of mapeos) {
    const incluye = norm.includes(m.norm) || m.norm.includes(norm)
    if (!incluye) continue
    if (regla === "B_cliente" && m.norm.length > 5) return { mapeo: m, via: "incluye" }
    if (regla === "C_sync") {
      const corto = Math.min(norm.length, m.norm.length)
      const largo = Math.max(norm.length, m.norm.length)
      if (m.norm.length >= 12 && corto / largo >= 0.6) return { mapeo: m, via: "incluye" }
    }
    if (regla === "D_sync_sku") {
      // Solo ítem ⊇ mapeo, con límite de palabra, y el mapeo debe ser específico:
      // ≥ 12 caracteres o contener dígitos (SKU/medida). Nunca al revés (ítem más corto).
      const especifico = m.norm.length >= 12 || /\d/.test(m.norm)
      // norm y m.norm solo contienen [a-z0-9 ] (ya normalizados): bordear con espacios = límite de palabra.
      const enLimite = ` ${norm} `.includes(` ${m.norm} `)
      if (especifico && m.norm.length >= 5 && enLimite && m.categoriaId !== "otros") return { mapeo: m, via: "incluye" }
    }
  }
  return null
}

async function calibrarMapeos() {
  titulo("1. Mapeos aprobados vs ítems Odoo (umbral de 'incluye' para el sync)")
  const mapeosDocs = await leer("clasificacion_ia_mapeos")
  const mapeos: Mapeo[] = mapeosDocs
    .map((m) => ({
      norm: str(m.descripcionNormalizada) || normalizarDescripcionMapeo(str(m.descripcionEjemplo)),
      categoriaId: str(m.categoriaId),
      tipoInsumo: str(m.tipoInsumo) || null,
      ejemplo: str(m.descripcionEjemplo),
    }))
    .filter((m) => m.norm && m.categoriaId)
  const items = await leer("compras_odoo_items")
  const n = items.length
  const otrosHoy = items.filter((i) => str(i.categoriaId) === "otros").length
  console.log(`  mapeos aprobados: ${mapeos.length}  ·  ítems Odoo: ${n}  ·  en 'otros' hoy: ${otrosHoy} (${pct(otrosHoy, n)})`)
  console.log(`  longitud de mapeos: <12 chars → ${mapeos.filter((m) => m.norm.length < 12).length}, ≥12 → ${mapeos.filter((m) => m.norm.length >= 12).length}`)

  const reglas: Regla[] = ["A_exacta", "B_cliente", "C_sync", "D_sync_sku"]
  const rechazadosPorC: string[] = []
  const aceptadosPorCIncluye: string[] = []
  let conflictoBC = 0
  for (const regla of reglas) {
    let empatados = 0
    let viaIncluye = 0
    let otrosResueltos = 0
    let cambianNoOtros = 0
    let sinCambio = 0
    for (const it of items) {
      const norm = normalizarDescripcionMapeo(str(it.descripcion))
      if (!norm) continue
      const r = empatar(norm, mapeos, regla)
      if (!r) continue
      empatados++
      if (r.via === "incluye") viaIncluye++
      const catHoy = str(it.categoriaId)
      if (r.mapeo.categoriaId === catHoy) sinCambio++
      else if (catHoy === "otros") otrosResueltos++
      else cambianNoOtros++
      if (regla === "D_sync_sku") {
        const rb = empatar(norm, mapeos, "B_cliente")
        if (rb && rb.mapeo !== r.mapeo) conflictoBC++
        if (r.via === "incluye" && aceptadosPorCIncluye.length < 14)
          aceptadosPorCIncluye.push(`[${r.mapeo.categoriaId}] "${trunc(r.mapeo.ejemplo, 40)}"  ⇐  "${trunc(str(it.descripcion), 60)}"`)
      }
      if (regla === "B_cliente" && r.via === "incluye") {
        const rc = empatar(norm, mapeos, "D_sync_sku")
        if (!rc && rechazadosPorC.length < 14)
          rechazadosPorC.push(`[${r.mapeo.categoriaId}] "${trunc(r.mapeo.ejemplo, 40)}"  ⇐  "${trunc(str(it.descripcion), 60)}"`)
      }
    }
    const otrosDespues = otrosHoy - otrosResueltos
    console.log(`\n  Regla ${regla.padEnd(10)} empata ${String(empatados).padStart(4)} ítems (${pct(empatados, n)}) · vía incluye ${viaIncluye} · ya coinciden ${sinCambio} · 'otros' resueltos ${otrosResueltos} · no-otros que cambian ${cambianNoOtros}`)
    console.log(`  ${"".padEnd(17)} 'otros' quedaría en ${otrosDespues} (${pct(otrosDespues, n)})`)
  }
  console.log(`\n  ítems donde B y D eligen mapeos distintos: ${conflictoBC}`)
  console.log(`\n  Muestra — empates 'incluye' que B acepta y D rechaza:`)
  for (const l of rechazadosPorC) console.log(`    ${l}`)
  if (rechazadosPorC.length === 0) console.log("    (ninguno)")
  console.log(`\n  Muestra — empates 'incluye' que D acepta (revisar que sean correctos):`)
  for (const l of aceptadosPorCIncluye) console.log(`    ${l}`)
  if (aceptadosPorCIncluye.length === 0) console.log("    (ninguno)")
}

// ── 2. Fantasmas de proveedor con sugerencia ────────────────────────────────

const MARKETPLACE = /\b(ebay|amazon|ali ?express|alibaba|mercado ?libre|walmart|temu)\b/i

async function calibrarFantasmas(catalogo: { id: string; nombre: string }[]) {
  titulo("2. Fantasmas de proveedor — sugerencia y acción propuesta")
  const ordenes = await leer("ordenes")
  const cotizaciones = await leer("cotizaciones")
  const catalogoNorm = new Set(catalogo.map((p) => normalizarNombreProveedor(p.nombre)))

  function analizar(docs: Doc[], etiqueta: string, top: number) {
    const porNombre = new Map<string, { raw: string; n: number }>()
    let sinFk = 0
    for (const d of docs) {
      if (!vacio(d.proveedorId)) continue
      sinFk++
      const raw = str(d.proveedor)
      const norm = normalizarNombreProveedor(raw)
      if (!norm) continue
      const e = porNombre.get(norm) ?? { raw, n: 0 }
      e.n++
      porNombre.set(norm, e)
    }
    const filas = [...porNombre.entries()].sort((a, b) => b[1].n - a[1].n)
    const acciones = new Map<string, number>()
    const lineas: string[] = []
    for (const [norm, e] of filas) {
      const exacto = catalogoNorm.has(norm)
      const sug = matchProveedorPorNombre(e.raw, catalogo)
      let accion: string
      if (exacto) accion = `vincular exacto → ${sug?.nombre ?? "?"}`
      else if (MARKETPLACE.test(e.raw)) accion = "alta como MARKETPLACE"
      else if (sug) accion = `sugerir → ${sug.nombre}`
      else accion = "alta nuevo"
      const clave = accion.startsWith("vincular") ? "vincular exacto" : accion.startsWith("sugerir") ? "sugerir (revisar)" : accion.startsWith("alta como") ? "alta marketplace" : "alta nuevo"
      acciones.set(clave, (acciones.get(clave) ?? 0) + e.n)
      lineas.push(`    ${trunc(e.raw, 34).padEnd(35)} ${String(e.n).padStart(4)}   ${accion}`)
    }
    console.log(`\n  ${etiqueta}: ${sinFk} docs sin proveedorId · ${filas.length} nombres distintos`)
    console.log(`  docs por acción: ${[...acciones.entries()].map(([k, v]) => `${k}=${v}`).join(" · ")}`)
    for (const l of lineas.slice(0, top)) console.log(l)
    if (lineas.length > top) console.log(`    … y ${lineas.length - top} nombres más (1–2 docs cada uno)`)

    // Variantes: nombres distintos que comparten primer token (digikey / digikey electronics)
    const grupos = new Map<string, string[]>()
    for (const [norm, e] of filas) {
      const raiz = norm.split(" ")[0]
      if (raiz.length < 4) continue
      grupos.set(raiz, [...(grupos.get(raiz) ?? []), `${e.raw} (${e.n})`])
    }
    const variantes = [...grupos.entries()].filter(([, v]) => v.length >= 2)
    if (variantes.length) {
      console.log(`  variantes probables del mismo proveedor (${variantes.length} grupos):`)
      for (const [raiz, v] of variantes) console.log(`    ${raiz.padEnd(14)} ${v.join(" | ")}`)
    }
  }
  analizar(ordenes, "ÓRDENES", 40)
  analizar(cotizaciones, "COTIZACIONES", 40)
}

// ── 3. diasHabiles → parseo propuesto ───────────────────────────────────────

type LeadTime = { min: number; max: number; tipo: "numero" | "rango" | "semanas" | "meses" | "horas" | "stock" }
type Descarte = "moneda" | "fecha" | "fuera_de_rango" | "sin_numero"

/** Propuesta B3 (spec): semanas ×5 hábiles, meses ×20, stock/inmediato = 0, sin número = null. */
/** Nombres de mes / día de semana (es + en abreviado): si aparecen, es una fecha, no una duración. */
const MESES_DIAS =
  /\b(ene(ro)?|feb(rero)?|mar(zo)?|abr(il)?|mayo|jun(io)?|jul(io)?|ago(sto)?|sep(t|tiembre)?|oct(ubre)?|nov(iembre)?|dic(iembre)?|jan|apr|aug|dec|lunes|martes|miercoles|jueves|viernes|sabado|domingo|mon|tue|wed|thu|fri|sat|sun)\b/

function parsearDiasHabiles(raw: string): LeadTime | Descarte {
  const s = raw.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()
  const tieneUnidad = /\b(dias?|dia|semanas?|mes(es)?|hrs?|horas?)\b/.test(s)
  // "$1,00", "precios 2026", "10 dlls": la columna trae dinero, no días — error de captura/CSV.
  if (/[$€]|\bdlls?\b|\busd\b|\bmxn\b|\bprecios?\b/.test(s) && !tieneUnidad) return "moneda"
  // "18 diciembre - 5 enero", "Tue, Aug 25": es una fecha; convertirla a días requiere la fecha base (v2).
  if (MESES_DIAS.test(s)) return "fecha"
  const esStock = /\b(stock|stocl|inmediat\w*|immediately|disponibl\w*|existencia\w*|local)\b/.test(s)
  // "10 piezas disponibles", "In Stock: 24 Can Ship": el número es cantidad, no días.
  if (esStock && !tieneUnidad) return { min: 0, max: 0, tipo: "stock" }
  const nums = [...s.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => Number(m[0].replace(",", ".")))
  if (nums.length === 0) return esStock ? { min: 0, max: 0, tipo: "stock" } : "sin_numero"
  let factor = 1
  let tipo: LeadTime["tipo"] = nums.length >= 2 ? "rango" : "numero"
  if (/seman/.test(s)) { factor = 5; tipo = "semanas" }
  else if (/\bmes(es)?\b/.test(s)) { factor = 20; tipo = "meses" }
  else if (/\b(hrs?|horas?)\b/.test(s) && !/\bdias?\b/.test(s)) { factor = 1 / 24; tipo = "horas" }
  if (Math.max(nums[0], nums[1] ?? nums[0]) * factor > 365) return "fuera_de_rango"
  const a = nums[0]
  const b = nums.length >= 2 ? nums[1] : nums[0]
  const min = Math.max(0, Math.round(Math.min(a, b) * factor))
  const max = Math.max(min, Math.round(Math.max(a, b) * factor))
  return { min: tipo === "horas" ? Math.max(1, min) : min, max: tipo === "horas" ? Math.max(1, max) : max, tipo }
}

async function calibrarLeadTime() {
  titulo("3. diasHabiles — parseo propuesto para cada valor distinto")
  const cotizaciones = await leer("cotizaciones")
  const distintos = new Map<string, number>()
  for (const c of cotizaciones) {
    const raw = str(c.diasHabiles)
    if (!raw) continue
    distintos.set(raw, (distintos.get(raw) ?? 0) + 1)
  }
  const porTipo = new Map<string, number>()
  const filas = [...distintos.entries()].sort((a, b) => b[1] - a[1])
  const lineas: string[] = []
  for (const [raw, n] of filas) {
    const r = parsearDiasHabiles(raw)
    const tipo = typeof r === "string" ? `null:${r}` : r.tipo
    porTipo.set(tipo, (porTipo.get(tipo) ?? 0) + n)
    lineas.push(`    ${trunc(raw, 32).padEnd(33)} ${String(n).padStart(3)}   → ${typeof r === "string" ? `null (${r})` : `${r.min}–${r.max} días hábiles (${r.tipo})`}`)
  }
  const total = [...distintos.values()].reduce((a, b) => a + b, 0)
  console.log(`  valores no nulos: ${total} · distintos: ${distintos.size}`)
  console.log(`  por resultado: ${[...porTipo.entries()].map(([k, v]) => `${k}=${v} (${pct(v, total)})`).join(" · ")}`)
  console.log(`  tabla completa (valor · n · parseo):`)
  for (const l of lineas) console.log(l)
}

// ── 4. Proveedores: mercado a revisar ───────────────────────────────────────

async function calibrarMercado(proveedores: Doc[]) {
  titulo("4. Proveedores — revisión de `mercado` antes del backfill")
  const usdOdoo = proveedores.filter((p) => num(p.odooPartnerId) !== null && str(p.moneda) === "USD")
  const sinOdoo = proveedores.filter((p) => num(p.odooPartnerId) === null)
  const sinMercado = proveedores.filter((p) => vacio(p.mercado))
  console.log(`  total ${proveedores.length} · sin mercado ${sinMercado.length} · con odooPartnerId ${proveedores.length - sinOdoo.length} · sin odooPartnerId ${sinOdoo.length}`)
  console.log(`\n  Con odooPartnerId y moneda USD (la regla los marca 'mexico'; confirmar a mano) — ${usdOdoo.length}:`)
  for (const p of usdOdoo) console.log(`    ${trunc(str(p.nombre), 40).padEnd(41)} país=${str(p.pais) || "—"}  ordenesOdoo=${num(p.ordenesOdoo) ?? "—"}  mercado=${str(p.mercado) || "(vacío)"}`)
  if (usdOdoo.length === 0) console.log("    (ninguno)")
  console.log(`\n  Sin odooPartnerId (la regla los marca 'usa') — ${sinOdoo.length}:`)
  for (const p of sinOdoo) console.log(`    ${trunc(str(p.nombre), 40).padEnd(41)} país=${str(p.pais) || "—"}  moneda=${str(p.moneda) || "—"}  mercado=${str(p.mercado) || "(vacío)"}  origen=${str(p.origenProveedor) || "—"}`)
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  const t0 = Date.now()
  console.log(`Calibración B0 · proyecto=${projectId} · base=compras-americanas · ${new Date().toISOString()}`)
  const proveedores = await leer("proveedores")
  const catalogo = proveedores.map((p) => ({ id: String(p.__id), nombre: str(p.nombre) })).filter((p) => p.nombre)
  await calibrarMapeos()
  await calibrarFantasmas(catalogo)
  await calibrarLeadTime()
  await calibrarMercado(proveedores)
  console.log(`\nListo · ${Date.now() - t0} ms · solo lecturas`)
}

main().catch((err) => {
  console.error("Calibración falló:", err instanceof Error ? err.message : err)
  process.exit(1)
})
