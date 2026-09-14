/**
 * B2 · T2.3 — Con el emulator: las clasificaciones aprobadas sobreviven a la reconstrucción del
 * espejo `compras_odoo_items` (criterio #3 del spec de estructura y normalización).
 *
 * Reproduce el camino real del sync sin Odoo ni red: `cargarMapeosAprobados(db)` →
 * `itemsDesdePoCrudo(po, { mapeosAprobados })` → `set()` sin merge (idéntico a `escribirLotes`).
 * Corre bajo `npm run test:emulator`; sin FIRESTORE_EMULATOR_HOST se salta.
 */
import { createRequire } from "node:module"
import { resolve } from "node:path"
import type { App } from "firebase-admin/app"
import type { Firestore } from "firebase-admin/firestore"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { cargarMapeosAprobados } from "../functions/src/compras-odoo/mapeos-aprobados"
import { itemsDesdePoCrudo, mapearPoOdoo, type OdooPoRaw } from "../functions/src/odoo-compras-mapeo"

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST
const describeWithEmulator = emulatorHost ? describe : describe.skip
const projectId = "smv-hub-compras-odoo-mapeos"
const databaseId = "compras-americanas"
const functionsRequire = createRequire(resolve(import.meta.dirname, "..", "functions", "package.json"))
const adminApp = functionsRequire("firebase-admin/app") as typeof import("firebase-admin/app")
const adminFirestore = functionsRequire("firebase-admin/firestore") as typeof import("firebase-admin/firestore")

let app: App
let db: Firestore

const ahora = new Date("2026-09-13T20:00:00Z")

/** Misma forma que escribe `aprobarYGuardarClasificacion` en el cliente. */
function docMapeo(descripcionEjemplo: string, descripcionNormalizada: string, categoriaId: string, tipoInsumo: string | null, medida: string | null) {
  const ts = adminFirestore.Timestamp.fromDate(ahora)
  return { descripcionNormalizada, descripcionEjemplo, categoriaId, tipoInsumo, medida, aprobadoPor: "compras@smv.com", creadoEn: ts, actualizadoEn: ts }
}

const MAPEOS: Array<Parameters<typeof docMapeo>> = [
  ["balero 20mm LM20UU", "balero 20mm lm20uu", "tools", "balero_lineal", "20mm"],
  ["CDQ2B12-10DZ", "cdq2b12 10dz", "neumatica", "cilindro_compacto", null],
  ["Jabon liquido para manos", "jabon liquido para manos", "quimicos", null, null],
  ['Acero M2 1/2 x 7/8 x 20"', "acero m2 1 2 x 7 8 x 20", "metals", "acero_m2", '1/2 x 7/8 x 20"'],
  ["Cable conector recto hembra M8", "cable conector recto hembra m8", "electronica", "conector", "M8"],
]

/** 20 líneas: 5 con mapeo aplicable (exacto o SKU dentro), 15 sin. */
const LINEAS = [
  "balero 20mm LM20UU",
  "piston CDQ2B12-10DZ con sensores",
  "Jabon liquido para manos. Porrón",
  'Barra Acero M2 1/2 x 7/8 x 20" rectificada',
  "Cable conector recto hembra M8",
  "Placa nylon 10mm",
  "Fresa carburo 1/4",
  "Tornillo hexagonal 3/8 x 2",
  "Servicio de fletes",
  "Papel bond carta",
  "Aceite soluble 19 L",
  "Disco de corte 4-1/2",
  "Guantes de nitrilo",
  "Cinta aislante",
  "Broca cobalto 5/16",
  "Manguera neumatica 8mm",
  "Cable calibre 12",
  "Lija grano 120",
  "Silicon transparente",
  "Foco led 9w",
]

function poRaw(): OdooPoRaw {
  return {
    id: 501,
    name: "P00501",
    partner_id: [100, "PROVEEDOR PRUEBA"],
    date_order: "2026-09-10 10:00:00",
    date_planned: "2026-09-15 00:00:00",
    amount_total: 0,
    currency_id: [33, "MXN"],
    state: "purchase",
    user_id: [5, "Compras"],
    company_id: [1, "Maquinados Vazquez"],
    order_line: LINEAS.map((_, i) => i + 1),
    _lineas: LINEAS.map((name, i) => ({
      id: i + 1,
      name,
      product_id: [1000 + i, name],
      product_qty: 1,
      price_unit: 10,
      price_subtotal: 10,
      clave_prod_serv: false,
    })),
  } as unknown as OdooPoRaw
}

/** Idéntico a `escribirLotes` del sync: set sin merge, conservando creadoEn. */
async function reconstruirEspejo(mapeosAprobados: Awaited<ReturnType<typeof cargarMapeosAprobados>>) {
  const po = mapearPoOdoo(poRaw(), ahora)
  const items = itemsDesdePoCrudo(po, { mapeosAprobados })
  const batch = db.batch()
  for (const it of items) {
    batch.set(db.collection("compras_odoo_items").doc(it.id), { ...it, sincronizadoEn: ahora, creadoEn: ahora, actualizadoEn: ahora })
  }
  await batch.commit()
  return items
}

async function clearNamedDatabase(): Promise<void> {
  const collections = await db.listCollections()
  for (const collection of collections) await db.recursiveDelete(collection)
}

describeWithEmulator("Sync de compras Odoo aplica clasificacion_ia_mapeos (emulator)", () => {
  beforeAll(() => {
    app = adminApp.initializeApp({ projectId }, `compras-mapeos-emulator-${process.pid}`)
    db = adminFirestore.getFirestore(app, databaseId)
  })

  beforeEach(async () => {
    await clearNamedDatabase()
  })

  afterAll(async () => {
    if (app) await adminApp.deleteApp(app)
  })

  it("carga los mapeos de Firestore con la forma que escribe el cliente", async () => {
    for (const m of MAPEOS) await db.collection("clasificacion_ia_mapeos").add(docMapeo(...m))
    // Un doc incompleto (sin categoría) no rompe la carga: se ignora.
    await db.collection("clasificacion_ia_mapeos").add({ descripcionNormalizada: "basura" })

    const indice = await cargarMapeosAprobados(db)
    expect(indice).not.toBeNull()
    expect(indice?.total).toBe(5)
    expect(indice?.exactos.get("cdq2b12 10dz")?.categoriaId).toBe("neumatica")
  })

  it("tras reconstruir el espejo, los 5 ítems con mapeo llevan la categoría aprobada y los 15 restantes la heurística", async () => {
    for (const m of MAPEOS) await db.collection("clasificacion_ia_mapeos").add(docMapeo(...m))
    const mapeosAprobados = await cargarMapeosAprobados(db)

    // Primero: reconstrucción sin mapeos (el comportamiento anterior a B2) para tener la línea base
    // heurística de cada ítem.
    const heuristicos = await reconstruirEspejo(null)
    const baseHeuristica = new Map(heuristicos.map((it) => [it.id, it.categoriaId]))

    // Segunda corrida, ahora como el sync real: con los mapeos aprobados.
    await reconstruirEspejo(mapeosAprobados)
    const snap = await db.collection("compras_odoo_items").get()
    const porMapeo = snap.docs.filter((d) => d.data().clasificadoPorMapeo === true)
    const heuristica = snap.docs.filter((d) => d.data().clasificadoPorMapeo !== true)

    expect(snap.size).toBe(20)
    expect(porMapeo).toHaveLength(5)
    expect(heuristica).toHaveLength(15)

    const categoriasPorDescripcion = new Map(snap.docs.map((d) => [d.data().descripcion as string, d.data().categoriaId as string]))
    expect(categoriasPorDescripcion.get("balero 20mm LM20UU")).toBe("tools")
    expect(categoriasPorDescripcion.get("piston CDQ2B12-10DZ con sensores")).toBe("neumatica")
    expect(categoriasPorDescripcion.get("Jabon liquido para manos. Porrón")).toBe("quimicos")
    expect(categoriasPorDescripcion.get('Barra Acero M2 1/2 x 7/8 x 20" rectificada')).toBe("metals")
    expect(categoriasPorDescripcion.get("Cable conector recto hembra M8")).toBe("electronica")

    // Los ítems sin mapeo conservan exactamente su categoría heurística.
    for (const d of heuristica) {
      expect(d.data().categoriaId).toBe(baseHeuristica.get(d.id))
      expect(d.data().clasificadoPorIa).toBe(false)
    }
    // Los ítems con mapeo quedan en el mismo estado que deja la aprobación en el cliente.
    for (const d of porMapeo) expect(d.data().clasificadoPorIa).toBe(true)
  })

  it("una aprobación previa sobrevive a la siguiente corrida solo si existe su mapeo (el bug de antes de B2)", async () => {
    // Estado tras aprobar en el panel: el ítem quedó en tools + clasificadoPorIa, y el mapeo persistido.
    await reconstruirEspejo(null)
    const id = "po_501_1" // "balero 20mm LM20UU"
    await db.collection("compras_odoo_items").doc(id).update({ categoriaId: "tools", tipoInsumo: "balero_lineal", clasificadoPorIa: true })
    expect((await db.collection("compras_odoo_items").doc(id).get()).data()?.categoriaId).toBe("tools")

    // Sin mapeo en la colección (o sin leerlo, como antes de B2): la corrida lo pisa.
    await reconstruirEspejo(null)
    expect((await db.collection("compras_odoo_items").doc(id).get()).data()?.categoriaId).not.toBe("tools")

    // Con el mapeo guardado y cargado, como hace el sync desde B2: sobrevive.
    await db.collection("clasificacion_ia_mapeos").add(docMapeo(...MAPEOS[0]))
    await reconstruirEspejo(await cargarMapeosAprobados(db))
    const final = (await db.collection("compras_odoo_items").doc(id).get()).data()
    expect(final?.categoriaId).toBe("tools")
    expect(final?.tipoInsumo).toBe("balero_lineal")
    expect(final?.clasificadoPorMapeo).toBe(true)
  })
})
