/**
 * C1 · T1.2 — Con el emulator: el indexador lee `cotizaciones` y produce entradas `cotizacion`
 * con las mismas reglas que Cmd+K ya tenía para órdenes y proveedores (frente C, memoria
 * operativa). Gemini se sustituye por un `fetchFn` que devuelve vectores de 768 dimensiones
 * derivados del texto, así que no hay red ni costo.
 *
 * Corre bajo `npm run test:emulator`; sin FIRESTORE_EMULATOR_HOST se salta.
 */
import { createRequire } from "node:module"
import { resolve } from "node:path"
import type { App } from "firebase-admin/app"
import type { Firestore } from "firebase-admin/firestore"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST
const describeWithEmulator = emulatorHost ? describe : describe.skip
const projectId = "smv-hub-busqueda-indice-escritura"
const databaseId = "compras-americanas"
const functionsRequire = createRequire(resolve(import.meta.dirname, "..", "functions", "package.json"))
const adminApp = functionsRequire("firebase-admin/app") as typeof import("firebase-admin/app")
const adminFirestore = functionsRequire("firebase-admin/firestore") as typeof import("firebase-admin/firestore")

type Sincronizar = typeof import("../functions/src/busqueda-indice-escritura")["sincronizarIndiceBusqueda"]

let app: App
let db: Firestore
let sincronizarIndiceBusqueda: Sincronizar
let llamadasGemini = 0

/** Vector determinístico de 768 dims a partir del texto: distinto texto → distinto vector. */
function vectorDesdeTexto(texto: string): number[] {
  const v = new Array<number>(768).fill(0)
  for (let i = 0; i < texto.length; i++) v[(i * 31 + texto.charCodeAt(i)) % 768] += 1
  return v
}

const fetchFalso: typeof fetch = async (_url, init) => {
  llamadasGemini++
  const body = JSON.parse(String(init?.body)) as { requests: Array<{ content: { parts: Array<{ text: string }> } }> }
  const embeddings = body.requests.map((r) => ({ values: vectorDesdeTexto(r.content.parts.map((p) => p.text).join(" ")) }))
  return new Response(JSON.stringify({ embeddings }), { status: 200, headers: { "Content-Type": "application/json" } })
}

const ts = () => adminFirestore.Timestamp.fromDate(new Date("2026-09-15T12:00:00Z"))

async function limpiar() {
  for (const c of ["ordenes", "proveedores", "cotizaciones", "busqueda_indice"]) await db.recursiveDelete(db.collection(c))
}

async function sembrar() {
  await db.collection("ordenes").doc("ord-1").set({
    proveedor: "McMaster-Carr",
    proveedorId: "prov-mcm",
    moneda: "USD",
    fechaFactura: "2026-09-01",
    items: [{ descripcion: "Compression Spring 9657K266", precioUnitario: 4.2 }],
    creadoEn: ts(),
    actualizadoEn: ts(),
  })
  await db.collection("proveedores").doc("prov-acomee").set({ nombre: "Acomee", categorias: ["electrico"], marcas: [], mercado: "mexico" })
  const base = { solicitante: "Edgar", fecha: "2026-08-20", estatus: "cotizado", ubicacion: "MX", moneda: "MXN", cantidad: 1, total: null, diasHabiles: null, link: null, notas: null, creadoEn: ts(), actualizadoEn: ts() }
  // 1 manual normal, 1 manual con precio 0, 1 espejo de compra (origen=compra).
  await db.collection("cotizaciones").doc("cot-normal").set({ ...base, proveedor: "Acomee", proveedorId: "prov-acomee", descripcion: "Sensor IFM PN2271", numeroParte: "PN2271", precioUnitario: 850, llavePieza: "PN2271|sensor ifm pn2271" })
  await db.collection("cotizaciones").doc("cot-cero").set({ ...base, proveedor: "Risoul", descripcion: "PLC Allen Bradley 1400", numeroParte: null, precioUnitario: 0, llavePieza: "|plc allen bradley 1400" })
  await db.collection("cotizaciones").doc("cot-espejo").set({ ...base, ubicacion: "USA", moneda: "USD", proveedor: "McMaster-Carr", descripcion: "Compression Spring 9657K266", numeroParte: null, precioUnitario: 4.2, origen: "compra", ordenIdOrigen: "ord-1", llavePieza: "|compression spring 9657k266" })
}

describeWithEmulator("Indexador de busqueda_indice lee cotizaciones (emulator)", () => {
  beforeAll(async () => {
    // El indexador usa la app por defecto (getDb() → getFirestore("compras-americanas")), así que
    // hay que inicializarla ANTES de importar el módulo.
    app = adminApp.initializeApp({ projectId })
    db = adminFirestore.getFirestore(app, databaseId)
    ;({ sincronizarIndiceBusqueda } = await import("../functions/src/busqueda-indice-escritura"))
  })

  beforeEach(async () => {
    llamadasGemini = 0
    await limpiar()
    await sembrar()
  })

  afterAll(async () => {
    if (db) await limpiar()
    if (app) await adminApp.deleteApp(app)
  })

  it("3 cotizaciones → 2 entradas: excluye origen=compra y deja la de precio 0 sin `precio`", async () => {
    const r = await sincronizarIndiceBusqueda("clave-falsa", { fetchFn: fetchFalso })

    expect(r.cotizacionesLeidas).toBe(3)
    expect(r.ordenesLeidas).toBe(1)
    expect(r.proveedoresLeidos).toBe(1)
    // 1 orden-item + 1 proveedor + 2 cotizaciones
    expect(r.entradasEsperadas).toBe(4)
    expect(r.reembebidas).toBe(4)
    expect(r.podadas).toBe(0)

    const snap = await db.collection("busqueda_indice").where("fuente", "==", "cotizacion").get()
    const porId = new Map(snap.docs.map((d) => [d.id, d.data()]))
    expect([...porId.keys()].sort()).toEqual(["cot#cot-cero", "cot#cot-normal"])

    const normal = porId.get("cot#cot-normal")!
    expect(normal.refPath).toBe("/cotizaciones?id=cot-normal")
    expect(normal.titulo).toBe("Sensor IFM PN2271")
    expect(normal.embedding).toHaveLength(768)
    expect(normal.dimensiones).toBe(768)
    expect(normal.metadata).toMatchObject({
      proveedorNombre: "Acomee",
      proveedorId: "prov-acomee",
      precio: 850,
      moneda: "MXN",
      fecha: "2026-08-20",
      cotizacionId: "cot-normal",
      numeroParte: "PN2271",
      llavePieza: "PN2271|sensor ifm pn2271",
      ubicacion: "MX",
      estatus: "cotizado",
    })

    const cero = porId.get("cot#cot-cero")!
    expect("precio" in cero.metadata).toBe(false)

    // La orden-item ahora lleva el proveedorId (frente B) en metadata.
    const ordenItem = await db.collection("busqueda_indice").doc("ord-1#0").get()
    expect(ordenItem.data()?.metadata?.proveedorId).toBe("prov-mcm")
  })

  it("segunda corrida sin cambios: 0 re-embebidas, 0 llamadas a Gemini, 0 podadas", async () => {
    await sincronizarIndiceBusqueda("clave-falsa", { fetchFn: fetchFalso })
    llamadasGemini = 0

    const r = await sincronizarIndiceBusqueda("clave-falsa", { fetchFn: fetchFalso })
    expect(r.reembebidas).toBe(0)
    expect(r.metadataActualizadas).toBe(0)
    expect(r.sinCambios).toBe(4)
    expect(r.podadas).toBe(0)
    expect(llamadasGemini).toBe(0)
  })

  it("cambiar el precio de una cotización refresca metadata sin re-embeber; borrarla la poda", async () => {
    await sincronizarIndiceBusqueda("clave-falsa", { fetchFn: fetchFalso })
    llamadasGemini = 0

    await db.collection("cotizaciones").doc("cot-normal").update({ precioUnitario: 900 })
    const r1 = await sincronizarIndiceBusqueda("clave-falsa", { fetchFn: fetchFalso })
    expect(r1.reembebidas).toBe(0)
    expect(r1.metadataActualizadas).toBe(1)
    expect(llamadasGemini).toBe(0)
    const doc = await db.collection("busqueda_indice").doc("cot#cot-normal").get()
    expect(doc.data()?.metadata?.precio).toBe(900)

    await db.collection("cotizaciones").doc("cot-normal").delete()
    const r2 = await sincronizarIndiceBusqueda("clave-falsa", { fetchFn: fetchFalso })
    expect(r2.podadas).toBe(1)
    expect((await db.collection("busqueda_indice").doc("cot#cot-normal").get()).exists).toBe(false)
  })

  it("si la lectura de cotizaciones viene vacía, no poda sus entradas (guard contra fallas transitorias)", async () => {
    await sincronizarIndiceBusqueda("clave-falsa", { fetchFn: fetchFalso })
    await db.recursiveDelete(db.collection("cotizaciones"))

    const r = await sincronizarIndiceBusqueda("clave-falsa", { fetchFn: fetchFalso })
    expect(r.cotizacionesLeidas).toBe(0)
    expect(r.podadas).toBe(0)
    const snap = await db.collection("busqueda_indice").where("fuente", "==", "cotizacion").get()
    expect(snap.size).toBe(2)
  })
})
