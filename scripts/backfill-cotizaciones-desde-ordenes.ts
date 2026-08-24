// Indexa líneas de órdenes americanas como filas buscables en cotizaciones.
// Idempotente. Misma clave (proveedor + pieza, sin fecha) = una fila; gana la
// compra más reciente. Keep in sync with lib/cotizaciones-desde-ordenes.ts
//
// Uso (desde la raíz del repo, con Firebase CLI autenticado):
//   npm run cotizaciones:backfill-ordenes -- --dry-run --proyecto=smv-brain-dev
//   npm run cotizaciones:backfill-ordenes -- --proyecto=smv-brain-dev
//   npm run cotizaciones:backfill-ordenes
//
import { existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"
import { initializeApp } from "firebase-admin/app"
import { FieldValue, getFirestore, type DocumentData, type QueryDocumentSnapshot } from "firebase-admin/firestore"
import {
  debeActualizarCompraExistente,
  generarClaveUpsertCompra,
  payloadsCotizacionDesdeOrden,
  type OrdenParaCotizacion,
} from "../lib/cotizaciones-desde-ordenes"

const args = process.argv.slice(2)
const DRY_RUN = args.includes("--dry-run")
const PROYECTO = args.find((a) => a.startsWith("--proyecto="))?.split("=")[1] || "smv-brain"
const BASE = "compras-americanas"
const TAMANO_PAGINA = 200
const TAMANO_BATCH = 400

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const adcCli = join(
    homedir(),
    "AppData",
    "Roaming",
    "firebase",
    "jemiliano2001_gmail_com_application_default_credentials.json"
  )
  if (existsSync(adcCli)) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = adcCli
  }
}
process.env.GOOGLE_CLOUD_QUOTA_PROJECT ??= PROYECTO

initializeApp({ projectId: PROYECTO })
const db = getFirestore(BASE)

type FilaIndice = { id: string; fecha: string | null; tieneClave: boolean }

function claveDeCotizacion(data: DocumentData): string {
  if (typeof data.claveUpsertCompra === "string" && data.claveUpsertCompra.length > 0) {
    return data.claveUpsertCompra
  }
  return generarClaveUpsertCompra({
    proveedor: typeof data.proveedor === "string" ? data.proveedor : "",
    numeroParte: typeof data.numeroParte === "string" ? data.numeroParte : null,
    descripcion: typeof data.descripcion === "string" ? data.descripcion : "",
  })
}

function ordenDesdeDoc(
  id: string,
  data: DocumentData
): OrdenParaCotizacion | null {
  if (typeof data.proveedor !== "string" || !data.proveedor.trim()) return null
  const itemsRaw = Array.isArray(data.items) ? data.items : []
  const creadoEn = data.creadoEn?.toDate instanceof Function ? data.creadoEn.toDate() : undefined
  return {
    id,
    proveedor: data.proveedor,
    proveedorId: typeof data.proveedorId === "string" ? data.proveedorId : null,
    numeroFactura: typeof data.numeroFactura === "string" ? data.numeroFactura : null,
    fechaFactura: typeof data.fechaFactura === "string" ? data.fechaFactura : null,
    moneda: typeof data.moneda === "string" ? data.moneda : "USD",
    linkProveedor: typeof data.linkProveedor === "string" ? data.linkProveedor : null,
    requisitor: typeof data.requisitor === "string" ? data.requisitor : "",
    creadoEn,
    items: itemsRaw.map((item: Record<string, unknown>) => ({
      descripcion: typeof item.descripcion === "string" ? item.descripcion : "",
      cantidad: typeof item.cantidad === "number" ? item.cantidad : null,
      precioUnitario: typeof item.precioUnitario === "number" ? item.precioUnitario : null,
      total: typeof item.total === "number" ? item.total : null,
      requisitor: typeof item.requisitor === "string" ? item.requisitor : "",
    })),
  }
}

async function main(): Promise<void> {
  console.log(
    `Proyecto: ${PROYECTO} · base: ${BASE}${DRY_RUN ? " · MODO ENSAYO (no escribe nada)" : " · ESCRITURA REAL"}`
  )

  const cotizacionesSnap = await db.collection("cotizaciones").get()
  const indice = new Map<string, FilaIndice>()
  for (const doc of cotizacionesSnap.docs) {
    const data = doc.data()
    const clave = claveDeCotizacion(data)
    if (!clave || indice.has(clave)) continue
    indice.set(clave, {
      id: doc.id,
      fecha: typeof data.fecha === "string" ? data.fecha : null,
      tieneClave: typeof data.claveUpsertCompra === "string" && data.claveUpsertCompra.length > 0,
    })
  }
  console.log(`Cotizaciones cargadas: ${cotizacionesSnap.size} · claves únicas: ${indice.size}`)

  let creadas = 0
  let actualizadas = 0
  let omitidas = 0
  let lineas = 0
  let batch = db.batch()
  let opsEnBatch = 0

  async function flush(): Promise<void> {
    if (opsEnBatch === 0) return
    if (!DRY_RUN) await batch.commit()
    batch = db.batch()
    opsEnBatch = 0
  }

  async function enqueue(escribir: () => void): Promise<void> {
    if (!DRY_RUN) escribir()
    opsEnBatch += 1
    if (opsEnBatch >= TAMANO_BATCH) await flush()
  }

  let ultimo: QueryDocumentSnapshot | null = null
  while (true) {
    let consulta = db.collection("ordenes").orderBy("creadoEn", "asc").limit(TAMANO_PAGINA)
    if (ultimo) consulta = consulta.startAfter(ultimo)
    const pagina = await consulta.get()
    if (pagina.empty) break

    for (const doc of pagina.docs) {
      const orden = ordenDesdeDoc(doc.id, doc.data())
      if (!orden) continue
      const payloads = payloadsCotizacionDesdeOrden(orden)
      lineas += payloads.length

      for (const payload of payloads) {
        const existente = indice.get(payload.claveUpsertCompra)
        if (!existente) {
          const ref = db.collection("cotizaciones").doc()
          await enqueue(() => {
            batch.set(ref, {
              ...payload,
              creadoEn: FieldValue.serverTimestamp(),
              actualizadoEn: FieldValue.serverTimestamp(),
            })
          })
          indice.set(payload.claveUpsertCompra, {
            id: ref.id,
            fecha: payload.fecha,
            tieneClave: true,
          })
          creadas += 1
          continue
        }

        const ref = db.collection("cotizaciones").doc(existente.id)
        if (!debeActualizarCompraExistente(existente.fecha, payload.fecha)) {
          if (!existente.tieneClave) {
            await enqueue(() => {
              batch.update(ref, {
                claveUpsertCompra: payload.claveUpsertCompra,
                actualizadoEn: FieldValue.serverTimestamp(),
              })
            })
            existente.tieneClave = true
          }
          omitidas += 1
          continue
        }

        await enqueue(() => {
          batch.update(ref, {
            fecha: payload.fecha,
            precioUnitario: payload.precioUnitario,
            cantidad: payload.cantidad,
            total: payload.total,
            moneda: payload.moneda,
            origen: "compra",
            ordenIdOrigen: payload.ordenIdOrigen,
            notas: payload.notas,
            claveUpsertCompra: payload.claveUpsertCompra,
            llavePieza: payload.llavePieza,
            solicitante: payload.solicitante,
            proveedorId: payload.proveedorId,
            ...(payload.link ? { link: payload.link } : {}),
            actualizadoEn: FieldValue.serverTimestamp(),
          })
        })
        existente.fecha = payload.fecha
        existente.tieneClave = true
        actualizadas += 1
      }
    }

    ultimo = pagina.docs[pagina.docs.length - 1] ?? null
    if (pagina.size < TAMANO_PAGINA) break
  }

  await flush()

  console.log(
    `Listo. Líneas útiles: ${lineas}. Creadas: ${creadas}. Actualizadas: ${actualizadas}. Omitidas (más nuevas): ${omitidas}.${DRY_RUN ? " [ensayo]" : ""}`
  )
}

void main().catch((err: unknown) => {
  console.error(err)
  process.exit(1)
})
