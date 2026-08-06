// Importador privado y seguro para las 47 medidas reales de Endmills China.
// Dry-run por defecto. Para escribir se requieren --project y --apply.
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { isAbsolute, join, resolve } from "node:path"
import { getApps, initializeApp } from "firebase-admin/app"
import { FieldValue, getFirestore } from "firebase-admin/firestore"

const BASE = "compras-americanas"
const PEDIDO_ID = "pedido-2026-03-06-bfl20260306mlv"
const IMPORTACION_ID = "seed-2026-08-06"
const FECHA_COTIZACION = "2026-08-06"
const FECHA_PEDIDO = "2026-03-06"

function args(argv) {
  const result = { file: "endmills-seed.json", project: "", apply: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--apply") result.apply = true
    else if (arg === "--file") result.file = argv[++i] ?? ""
    else if (arg === "--project") result.project = argv[++i] ?? ""
    else throw new Error(`Argumento desconocido: ${arg}`)
  }
  if (!result.file) throw new Error("Falta valor para --file")
  if (!result.project) throw new Error("Indica --project smv-brain-dev o smv-brain")
  if (!new Set(["smv-brain-dev", "smv-brain"]).has(result.project)) {
    throw new Error("Proyecto no permitido; usa smv-brain-dev o smv-brain")
  }
  return result
}

function assert(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje)
}

function redondear(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

const CATEGORIAS = {
  FLAT: "FLAT",
  BALL: "BALL",
  "LARGO FLAT": "LARGO_FLAT",
  "LARGO BOLA": "LARGO_BOLA",
  "EXTRA LARGO FLAT": "EXTRA_LARGO_FLAT",
  "EXTRA LARGO BOLA": "EXTRA_LARGO_BOLA",
  "RUPA CARBURO": "RUPA_CARBURO",
}

function validarSeed(seed) {
  assert(seed && typeof seed === "object", "El seed debe ser un objeto JSON")
  assert(Array.isArray(seed.medidas) && seed.medidas.length === 47, "Se esperaban 47 medidas")
  assert(seed.proveedor?.email === "bfl9@bfltool.com", "Proveedor/contacto inesperado")
  const ids = new Set(seed.medidas.map((medida) => medida.id))
  assert(ids.size === 47, "Los IDs de medidas deben ser únicos")
  assert(seed.medidas.every((medida) => CATEGORIAS[medida.categoria]), "Categoría inválida")
  assert(seed.medidas.every((medida) => Number.isInteger(medida.stockActual) && medida.stockActual >= 0), "Stock inválido")
  assert(seed.medidas.every((medida) => typeof medida.precioActualUSD === "number" && medida.precioActualUSD >= 0), "Precio inválido")

  const historicas = seed.medidas.filter((medida) => medida.ordenMarzo2026?.piezasPedidas != null)
  const confirmaciones = seed.medidas
    .filter((medida) => medida.cotizacionChinaAgo2026?.requiereConfirmacion)
    .map((medida) => medida.id)
  const piezas = historicas.reduce((total, medida) => total + medida.ordenMarzo2026.piezasPedidas, 0)
  const costo = redondear(historicas.reduce((total, medida) => total + medida.ordenMarzo2026.subtotalUSD, 0))
  assert(historicas.length === 32, "Se esperaban 32 partidas rastreadas de marzo")
  assert(JSON.stringify(confirmaciones) === JSON.stringify([2, 38]), "Las confirmaciones deben ser 2 y 38")
  assert(piezas === 478, `Piezas rastreadas inesperadas: ${piezas}`)
  assert(costo === 5885.19, `Costo rastreado inesperado: ${costo}`)
  assert(seed.ordenMarzoTotales.piezasTotales === 483, "Total de piezas de marzo inválido")
  assert(seed.ordenMarzoTotales.costoItemsUSD === 5921.94, "Costo de artículos de marzo inválido")
  assert(seed.ordenMarzoTotales.totalUSD === 6159.94, "Total de marzo inválido")
  assert(
    redondear(seed.ordenMarzoTotales.costoItemsUSD + seed.ordenMarzoTotales.aliCostUSD + seed.ordenMarzoTotales.shippingUSD) === 6159.94,
    "El total de marzo no cuadra"
  )
  return { historicas, piezas, costo }
}

function idMedida(id) {
  return `endmill-${String(id).padStart(3, "0")}`
}

function construirDocumentos(seed, hash) {
  const fechaCatalogo = new Date("2026-08-06T12:00:00-05:00")
  const fechaPedido = new Date("2026-03-06T12:00:00-06:00")
  const medidas = seed.medidas.map((medida) => ({
    id: idMedida(medida.id),
    data: {
      orden: medida.id,
      categoria: CATEGORIAS[medida.categoria],
      medidaPulgadas: medida.medidaPulgadas,
      descripcion: medida.descripcion,
      stockActual: medida.stockActual,
      stockActualizadoEn: fechaCatalogo,
      precioActualUSD: medida.precioActualUSD,
      cotizacionFecha: FECHA_COTIZACION,
      specPropuesta: medida.cotizacionChinaAgo2026.specPropuesta,
      requiereConfirmacion: medida.cotizacionChinaAgo2026.requiereConfirmacion,
      notas: medida.notas,
      objetivoPar: null,
      ultimoPedidoId: null,
      creadoEn: fechaCatalogo,
      actualizadoEn: fechaCatalogo,
    },
  }))
  const historicas = seed.medidas.filter((medida) => medida.ordenMarzo2026.piezasPedidas != null)
  const partidas = historicas.map((medida) => {
    const medidaId = idMedida(medida.id)
    return {
      id: `${PEDIDO_ID}_${medidaId}`,
      data: {
        pedidoId: PEDIDO_ID,
        fechaPedido: FECHA_PEDIDO,
        tipo: "catalogada",
        medidaId,
        categoria: CATEGORIAS[medida.categoria],
        medidaPulgadas: medida.medidaPulgadas,
        descripcion: medida.descripcion,
        spec: medida.cotizacionChinaAgo2026.specPropuesta,
        stockAntesPedido: null,
        cantidadPedida: medida.ordenMarzo2026.piezasPedidas,
        cantidadRecibida: medida.ordenMarzo2026.piezasPedidas,
        precioUnitarioUSD: medida.ordenMarzo2026.precioUnitarioUSD,
        subtotalUSD: medida.ordenMarzo2026.subtotalUSD,
        objetivoPar: null,
        requiereConfirmacionAlCrear: false,
        confirmacionResuelta: true,
        creadoEn: fechaPedido,
        actualizadoEn: fechaPedido,
      },
    }
  })
  partidas.push({
    id: `${PEDIDO_ID}_fuera-catalogo-largo-bola-1-8`,
    data: {
      pedidoId: PEDIDO_ID,
      fechaPedido: FECHA_PEDIDO,
      tipo: "fuera_catalogo",
      medidaId: null,
      categoria: null,
      medidaPulgadas: "1/8",
      descripcion: "LARGO BOLA 1/8\" (fuera de las 47 medidas actuales)",
      spec: "",
      stockAntesPedido: null,
      cantidadPedida: 5,
      cantidadRecibida: 5,
      precioUnitarioUSD: 7.35,
      subtotalUSD: 36.75,
      objetivoPar: null,
      requiereConfirmacionAlCrear: false,
      confirmacionResuelta: true,
      creadoEn: fechaPedido,
      actualizadoEn: fechaPedido,
    },
  })
  const pedido = {
    fecha: FECHA_PEDIDO,
    numeroProveedor: "BFL20260306MLV",
    estado: "recibido",
    proveedor: seed.proveedor,
    moneda: "USD",
    costoItemsUSD: seed.ordenMarzoTotales.costoItemsUSD,
    aliCostUSD: seed.ordenMarzoTotales.aliCostUSD,
    shippingUSD: seed.ordenMarzoTotales.shippingUSD,
    totalUSD: seed.ordenMarzoTotales.totalUSD,
    costosAdicionalesConfirmados: true,
    numeroPartidas: partidas.length,
    numeroPiezas: seed.ordenMarzoTotales.piezasTotales,
    origen: "semilla",
    motivoCancelacion: null,
    creadoPorUid: "importacion-seed",
    creadoPorNombre: "Importación histórica Endmills",
    creadoEn: fechaPedido,
    actualizadoEn: fechaPedido,
  }
  return { medidas, partidas, pedido, hash }
}

function configurarCredenciales(projectId) {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const adc = join(
      homedir(),
      "AppData",
      "Roaming",
      "firebase",
      "jemiliano2001_gmail_com_application_default_credentials.json"
    )
    if (existsSync(adc)) process.env.GOOGLE_APPLICATION_CREDENTIALS = adc
  }
  process.env.GOOGLE_CLOUD_QUOTA_PROJECT ??= projectId
}

const options = args(process.argv.slice(2))
const filePath = isAbsolute(options.file) ? options.file : resolve(process.cwd(), options.file)
const raw = readFileSync(filePath, "utf8")
const hash = createHash("sha256").update(raw).digest("hex")
const seed = JSON.parse(raw)
const resumen = validarSeed(seed)
const documentos = construirDocumentos(seed, hash)

console.log(`Seed válido: ${seed.medidas.length} medidas, ${resumen.historicas.length} partidas rastreadas + 1 fuera de catálogo`)
console.log(`Marzo: ${seed.ordenMarzoTotales.piezasTotales} pzas · $${seed.ordenMarzoTotales.totalUSD.toFixed(2)} USD`)
console.log(`Destino: ${options.project}/${BASE}`)
console.log(`SHA-256: ${hash}`)

if (!options.apply) {
  console.log("DRY-RUN: no se escribió nada. Agrega --apply para importar.")
  process.exit(0)
}

configurarCredenciales(options.project)
if (getApps().length === 0) initializeApp({ projectId: options.project })
const db = getFirestore(BASE)
const markerRef = db.collection("endmills-importaciones").doc(IMPORTACION_ID)
const marker = await markerRef.get()
const refs = [
  ...documentos.medidas.map((item) => db.collection("endmills-medidas").doc(item.id)),
  db.collection("endmills-pedidos").doc(PEDIDO_ID),
  ...documentos.partidas.map((item) => db.collection("endmills-pedido-partidas").doc(item.id)),
]

if (marker.exists) {
  assert(marker.data()?.sha256 === hash, "Existe una importación con hash diferente; abortado")
  const docsExistentes = await db.getAll(...refs)
  assert(docsExistentes.every((item) => item.exists), "El marcador existe pero faltan documentos; requiere revisión manual")
  console.log("NO-OP: esta versión del seed ya fue importada y está completa.")
  process.exit(0)
}

const docsExistentes = await db.getAll(...refs)
assert(!docsExistentes.some((item) => item.exists), "Ya existen documentos Endmills sin marcador compatible; abortado")

const batch = db.batch()
for (const item of documentos.medidas) {
  batch.create(db.collection("endmills-medidas").doc(item.id), item.data)
}
batch.create(db.collection("endmills-pedidos").doc(PEDIDO_ID), documentos.pedido)
for (const item of documentos.partidas) {
  batch.create(db.collection("endmills-pedido-partidas").doc(item.id), item.data)
}
batch.create(markerRef, {
  sha256: hash,
  archivo: options.file,
  medidas: documentos.medidas.length,
  partidas: documentos.partidas.length,
  pedidoId: PEDIDO_ID,
  creadoEn: FieldValue.serverTimestamp(),
})
await batch.commit()
console.log(`IMPORTACIÓN COMPLETA: ${documentos.medidas.length} medidas, 1 pedido y ${documentos.partidas.length} partidas.`)

