/**
 * C0 · Calibración read-only de la memoria operativa (frente C, T0.1–T0.3).
 *
 *   npx tsx scripts/calibracion-memoria-operativa.ts [projectId] [--fixture ruta.json]
 *
 * Qué hace (sin escribir en Firestore):
 *   (a) toma las llaves de pieza de órdenes que se repiten (empate exacto conocido) y
 *   (b) 20 ítems recientes cuya llave no se repite (sin empate exacto);
 *   embebe cada descripción como consulta (RETRIEVAL_QUERY y SEMANTIC_SIMILARITY, 768d) y la
 *   compara contra todo el índice `busqueda_indice` (fuente orden-item), excluyendo la entrada
 *   del propio ítem. Reporta la distribución de coseno "misma llave" vs "otra llave", un barrido
 *   de umbrales (recall de exactos vs. ruido por consulta) y las 30 descripciones más frecuentes de
 *   cotizaciones manuales para elegir las 10 búsquedas de prueba (T0.3).
 *
 * Credenciales: GOOGLE_APPLICATION_CREDENTIALS (solo lectura) en .env.local o .env.admin.local;
 * GEMINI_API_KEY en .env.local (≈ 80 embeddings de consulta, nada más).
 *
 * Con --fixture escribe el golden para los tests de C2 (única escritura, en disco).
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

import { generarLlavePieza, llavesCoinciden, normalizarTextoPieza } from "../lib/pieza-matching"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const args = process.argv.slice(2)
const projectId = args.find((a) => !a.startsWith("--")) || "smv-brain"
const fixtureIdx = args.indexOf("--fixture")
const fixturePath = fixtureIdx >= 0 ? resolve(root, args[fixtureIdx + 1]) : null

const DIMENSIONES = 768
const MAX_REPETIDAS = 20
const MAX_SIN_EMPATE = 20
const TOP_K = 5
const UMBRALES = [0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95]

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
      process.env[key] = value
    }
  }
}

cargarEnvLocal()
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("Falta GOOGLE_APPLICATION_CREDENTIALS en .env.local o .env.admin.local")
  process.exit(1)
}
if (!process.env.GEMINI_API_KEY && !process.env.HUB_GEMINI_API_KEY) {
  console.error("Falta GEMINI_API_KEY en .env.local")
  process.exit(1)
}

const require = createRequire(import.meta.url)
const { initializeApp } = require("firebase-admin/app") as typeof import("firebase-admin/app")
const { getFirestore } = require("firebase-admin/firestore") as typeof import("firebase-admin/firestore")
initializeApp({ projectId })
const db = getFirestore("compras-americanas")

type ItemOrden = {
  refId: string
  ordenId: string
  indice: number
  descripcion: string
  llave: string
  proveedor: string
  precio: number | null
  moneda: string
  fecha: string
}

type EntradaIndice = {
  id: string
  titulo: string
  llave: string
  embedding: number[]
  proveedorNombre: string
  precio: number | null
  fecha: string
}

type Candidato = { refId: string; titulo: string; score: number; llave: string; exacto: boolean; proveedor: string }

type Muestra = {
  grupo: "repetida" | "sin_empate"
  refId: string
  descripcion: string
  llave: string
  proveedor: string
  fecha: string
  exactosEnIndice: number
  mejorMismaLlave: number | null
  mejorOtraLlave: number | null
  top: Candidato[]
}

function coseno(a: readonly number[], b: readonly number[]): number {
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

function percentil(valores: number[], p: number): number | null {
  if (valores.length === 0) return null
  const s = [...valores].sort((x, y) => x - y)
  const idx = Math.min(s.length - 1, Math.max(0, Math.round((p / 100) * (s.length - 1))))
  return s[idx]
}

function f(n: number | null | undefined, d = 3): string {
  return n == null ? "—" : n.toFixed(d)
}

function tokens(s: string): Set<string> {
  return new Set(normalizarTextoPieza(s).split(/\s+/).filter((t) => t.length >= 3))
}

function jaccard(a: string, b: string): number {
  const ta = tokens(a)
  const tb = tokens(b)
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter / (ta.size + tb.size - inter)
}

async function leerItemsOrdenes(): Promise<ItemOrden[]> {
  const snap = await db.collection("ordenes").get()
  const items: ItemOrden[] = []
  for (const doc of snap.docs) {
    const d = doc.data()
    const lista = Array.isArray(d.items) ? d.items : []
    const fecha =
      typeof d.fechaFactura === "string" && d.fechaFactura
        ? d.fechaFactura
        : d.creadoEn?.toDate?.()?.toISOString().slice(0, 10) ?? ""
    lista.forEach((it: Record<string, unknown>, indice: number) => {
      const descripcion = typeof it.descripcion === "string" ? it.descripcion.trim() : ""
      if (!descripcion) return
      const precio = typeof it.precioUnitario === "number" ? it.precioUnitario : null
      items.push({
        refId: `${doc.id}#${indice}`,
        ordenId: doc.id,
        indice,
        descripcion,
        llave: generarLlavePieza(null, descripcion),
        proveedor: typeof d.proveedor === "string" ? d.proveedor : "",
        precio,
        moneda: typeof d.moneda === "string" ? d.moneda : "USD",
        fecha,
      })
    })
  }
  return items
}

async function leerIndiceOrdenItems(): Promise<EntradaIndice[]> {
  const snap = await db.collection("busqueda_indice").where("fuente", "==", "orden-item").get()
  const entradas: EntradaIndice[] = []
  let malas = 0
  for (const doc of snap.docs) {
    const d = doc.data()
    const embedding = Array.isArray(d.embedding) ? (d.embedding as number[]) : []
    if (embedding.length !== DIMENSIONES) {
      malas++
      continue
    }
    const titulo = typeof d.titulo === "string" ? d.titulo : ""
    const md = (d.metadata ?? {}) as Record<string, unknown>
    entradas.push({
      id: doc.id,
      titulo,
      llave: generarLlavePieza(null, titulo),
      embedding,
      proveedorNombre: typeof md.proveedorNombre === "string" ? md.proveedorNombre : "",
      precio: typeof md.precio === "number" ? md.precio : null,
      fecha: typeof md.fecha === "string" ? md.fecha : "",
    })
  }
  if (malas > 0) console.warn(`  (${malas} entradas con dimensión ≠ ${DIMENSIONES} omitidas)`)
  return entradas
}

async function leerDescripcionesCotizacionesManuales(): Promise<Array<{ descripcion: string; n: number; ubicaciones: Set<string>; proveedores: Set<string> }>> {
  const snap = await db.collection("cotizaciones").get()
  const porDesc = new Map<string, { descripcion: string; n: number; ubicaciones: Set<string>; proveedores: Set<string> }>()
  for (const doc of snap.docs) {
    const d = doc.data()
    if (d.origen === "compra") continue
    const descripcion = typeof d.descripcion === "string" ? d.descripcion.trim() : ""
    if (!descripcion) continue
    const k = normalizarTextoPieza(descripcion)
    const cur = porDesc.get(k) ?? { descripcion, n: 0, ubicaciones: new Set<string>(), proveedores: new Set<string>() }
    cur.n++
    if (typeof d.ubicacion === "string") cur.ubicaciones.add(d.ubicacion)
    if (typeof d.proveedor === "string" && d.proveedor.trim()) cur.proveedores.add(d.proveedor.trim())
    porDesc.set(k, cur)
  }
  return [...porDesc.values()].sort((a, b) => b.n - a.n)
}

function evaluar(
  muestras: Array<{ grupo: "repetida" | "sin_empate"; item: ItemOrden }>,
  vectores: number[][],
  indice: EntradaIndice[]
): Muestra[] {
  return muestras.map(({ grupo, item }, i) => {
    const v = vectores[i]
    const scored: Array<{ e: EntradaIndice; score: number }> = []
    for (const e of indice) {
      if (e.id === item.refId) continue // el propio ítem no cuenta
      scored.push({ e, score: coseno(v, e.embedding) })
    }
    scored.sort((a, b) => b.score - a.score)
    const misma = scored.filter((s) => llavesCoinciden(s.e.llave, item.llave))
    const otra = scored.filter((s) => !llavesCoinciden(s.e.llave, item.llave))
    return {
      grupo,
      refId: item.refId,
      descripcion: item.descripcion,
      llave: item.llave,
      proveedor: item.proveedor,
      fecha: item.fecha,
      exactosEnIndice: misma.length,
      mejorMismaLlave: misma[0]?.score ?? null,
      mejorOtraLlave: otra[0]?.score ?? null,
      top: scored.slice(0, TOP_K).map(({ e, score }) => ({
        refId: e.id,
        titulo: e.titulo,
        score: Number(score.toFixed(4)),
        llave: e.llave,
        exacto: llavesCoinciden(e.llave, item.llave),
        proveedor: e.proveedorNombre,
      })),
    }
  })
}

function reportar(etiqueta: string, res: Muestra[]) {
  console.log(`\n══ ${etiqueta} ═══════════════════════════════════════════════════════`)
  const rep = res.filter((m) => m.grupo === "repetida")
  const sin = res.filter((m) => m.grupo === "sin_empate")

  const mismas = rep.map((m) => m.mejorMismaLlave).filter((x): x is number => x != null)
  const otrasRep = rep.map((m) => m.mejorOtraLlave).filter((x): x is number => x != null)
  const otrasSin = sin.map((m) => m.mejorOtraLlave).filter((x): x is number => x != null)

  console.log(`\n(a) ${rep.length} llaves repetidas — coseno del MEJOR empate exacto (misma llave):`)
  console.log(`    min ${f(percentil(mismas, 0))} · p10 ${f(percentil(mismas, 10))} · p50 ${f(percentil(mismas, 50))} · p90 ${f(percentil(mismas, 90))} · max ${f(percentil(mismas, 100))}`)
  console.log(`    coseno del mejor VECINO (otra llave) en las mismas consultas:`)
  console.log(`    min ${f(percentil(otrasRep, 0))} · p10 ${f(percentil(otrasRep, 10))} · p50 ${f(percentil(otrasRep, 50))} · p90 ${f(percentil(otrasRep, 90))} · max ${f(percentil(otrasRep, 100))}`)
  console.log(`\n(b) ${sin.length} ítems sin empate exacto — coseno del mejor vecino:`)
  console.log(`    min ${f(percentil(otrasSin, 0))} · p10 ${f(percentil(otrasSin, 10))} · p50 ${f(percentil(otrasSin, 50))} · p90 ${f(percentil(otrasSin, 90))} · max ${f(percentil(otrasSin, 100))}`)

  console.log(`\nBarrido de umbral (sobre las ${res.length} consultas):`)
  console.log(`  umbral  recall exactos(a)  vecinos≥t/consulta(a)  vecinos≥t/consulta(b)  consultas(b) con ≥1 vecino`)
  for (const t of UMBRALES) {
    const recall = rep.length ? rep.filter((m) => (m.mejorMismaLlave ?? 0) >= t).length / rep.length : 0
    const ruidoA = rep.length ? rep.reduce((acc, m) => acc + m.top.filter((c) => !c.exacto && c.score >= t).length, 0) / rep.length : 0
    const ruidoB = sin.length ? sin.reduce((acc, m) => acc + m.top.filter((c) => c.score >= t).length, 0) / sin.length : 0
    const conVecino = sin.filter((m) => (m.mejorOtraLlave ?? 0) >= t).length
    console.log(`  ${t.toFixed(2)}    ${(recall * 100).toFixed(0).padStart(5)} %          ${ruidoA.toFixed(2).padStart(5)}                 ${ruidoB.toFixed(2).padStart(5)}                 ${conVecino}/${sin.length}`)
  }

  console.log(`\n(a) detalle — consulta → mejor exacto | mejor vecino:`)
  for (const m of rep) {
    const ex = m.top.find((c) => c.exacto)
    const ve = m.top.find((c) => !c.exacto)
    console.log(`  [${f(m.mejorMismaLlave)}|${f(m.mejorOtraLlave)}] ${m.descripcion.slice(0, 60)}`)
    if (ex) console.log(`      = ${ex.titulo.slice(0, 60)}  (${ex.proveedor})`)
    if (ve) console.log(`      ~ ${ve.titulo.slice(0, 60)}  (${ve.proveedor})`)
  }

  console.log(`\n(b) detalle — consulta → top 3 vecinos con coseno y solapamiento de tokens (jaccard):`)
  for (const m of sin) {
    console.log(`  ${m.descripcion.slice(0, 70)}  [${m.proveedor} · ${m.fecha}]`)
    for (const c of m.top.slice(0, 3)) {
      console.log(`      ${f(c.score)}  j=${jaccard(m.descripcion, c.titulo).toFixed(2)}  ${c.titulo.slice(0, 60)}  (${c.proveedor})`)
    }
  }
}

async function main() {
  const { generarEmbeddingsLote } = await import("../lib/embeddings-ia")

  console.log(`Calibración memoria operativa · proyecto=${projectId} · base=compras-americanas · ${new Date().toISOString()}`)

  const [items, indice, descCot] = await Promise.all([leerItemsOrdenes(), leerIndiceOrdenItems(), leerDescripcionesCotizacionesManuales()])
  console.log(`\nÍtems de órdenes: ${items.length} · entradas orden-item en el índice: ${indice.length}`)

  const idsIndice = new Set(indice.map((e) => e.id))
  const porLlave = new Map<string, ItemOrden[]>()
  for (const it of items) {
    const arr = porLlave.get(it.llave) ?? []
    arr.push(it)
    porLlave.set(it.llave, arr)
  }
  const repetidas = [...porLlave.values()]
    .filter((arr) => arr.length >= 2)
    .map((arr) => [...arr].sort((a, b) => b.fecha.localeCompare(a.fecha)))
    .sort((a, b) => b.length - a.length)
  console.log(`Llaves distintas: ${porLlave.size} · repetidas (≥2 ítems): ${repetidas.length}`)

  // (a) consulta = el ítem más reciente de cada llave repetida; los demás son el exacto esperado.
  const muestraA = repetidas.slice(0, MAX_REPETIDAS).map((arr) => ({ grupo: "repetida" as const, item: arr[0] }))
  // (b) ítems recientes con llave única, sin repetir llave ni orden, y que sí estén en el índice.
  const usadas = new Set(muestraA.map((m) => m.item.llave))
  const ordenesUsadas = new Set<string>()
  const muestraB: Array<{ grupo: "sin_empate"; item: ItemOrden }> = []
  for (const it of [...items].sort((a, b) => b.fecha.localeCompare(a.fecha))) {
    if (muestraB.length >= MAX_SIN_EMPATE) break
    if ((porLlave.get(it.llave)?.length ?? 0) !== 1) continue
    if (usadas.has(it.llave) || ordenesUsadas.has(it.ordenId)) continue
    if (!idsIndice.has(it.refId)) continue
    if (it.descripcion.length < 12) continue
    usadas.add(it.llave)
    ordenesUsadas.add(it.ordenId)
    muestraB.push({ grupo: "sin_empate", item: it })
  }
  const muestras = [...muestraA, ...muestraB]
  console.log(`Muestra: ${muestraA.length} repetidas + ${muestraB.length} sin empate = ${muestras.length} consultas`)

  const textos = muestras.map((m) => m.item.descripcion)
  console.log(`\nEmbebiendo ${textos.length} consultas × 2 task types (RETRIEVAL_QUERY, SEMANTIC_SIMILARITY)…`)
  const [vQuery, vSim] = await Promise.all([
    generarEmbeddingsLote(textos, { taskType: "RETRIEVAL_QUERY", outputDimensionality: DIMENSIONES }),
    generarEmbeddingsLote(textos, { taskType: "SEMANTIC_SIMILARITY", outputDimensionality: DIMENSIONES }),
  ])

  const resQuery = evaluar(muestras, vQuery, indice)
  const resSim = evaluar(muestras, vSim, indice)
  reportar("RETRIEVAL_QUERY (lo que usa Cmd+K hoy)", resQuery)
  reportar("SEMANTIC_SIMILARITY (ítem contra ítem)", resSim)

  console.log(`\n══ T0.3 · descripciones más frecuentes en cotizaciones manuales (origen ≠ compra) ══`)
  for (const d of descCot.slice(0, 30)) {
    console.log(`  ${String(d.n).padStart(3)}×  [${[...d.ubicaciones].join("/") || "?"}]  ${d.descripcion.slice(0, 70)}  ← ${[...d.proveedores].slice(0, 3).join(", ")}`)
  }

  console.log(`\n══ T0.2 · tamaño y costo ══`)
  const manuales = descCot.reduce((acc, d) => acc + d.n, 0)
  const proyectado = indice.length + manuales
  console.log(`  índice orden-item hoy ${indice.length} + cotizaciones manuales ${manuales} = ${proyectado} entradas (+ proveedores)`)
  console.log(`  a ~10 KB/entrada ≈ ${(proyectado * 10 / 1024).toFixed(1)} MB por lectura fría; corte del spec: 1,500`)

  if (fixturePath) {
    const golden = {
      generadoEn: new Date().toISOString(),
      proyecto: projectId,
      dimensiones: DIMENSIONES,
      taskTypeConsulta: "RETRIEVAL_QUERY",
      umbralSugerido: null as number | null,
      muestras: resQuery,
    }
    writeFileSync(fixturePath, JSON.stringify(golden, null, 2) + "\n", "utf8")
    console.log(`\nFixture escrito: ${fixturePath} (${resQuery.length} muestras; umbralSugerido se fija a mano tras revisar)`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
