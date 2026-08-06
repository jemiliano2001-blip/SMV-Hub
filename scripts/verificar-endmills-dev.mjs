// Smoke real y autolimpiable para reglas Endmills en smv-brain-dev.
// Crea exclusivamente recursos con prefijo codex-endmills-e2e y aborta si
// alguno ya existe. No imprime credenciales ni toca las 47 medidas importadas.
import { randomBytes } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import {
  deleteApp as deleteAdminApp,
  getApps as getAdminApps,
  initializeApp as initializeAdminApp,
} from "firebase-admin/app"
import { getAuth as getAdminAuth } from "firebase-admin/auth"
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore"
import { deleteApp, initializeApp } from "firebase/app"
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth"
import {
  Timestamp,
  doc,
  getDocFromServer,
  getFirestore,
  runTransaction,
  setDoc,
} from "firebase/firestore"

const PROJECT_ID = "smv-brain-dev"
const DATABASE_ID = "compras-americanas"
const UID = "codex-endmills-e2e"
const EMAIL = "codex-endmills-e2e@smv.test"
const MEDIDA_ID = "codex-endmills-e2e-medida"
const PEDIDO_ID = "codex-endmills-e2e-pedido"
const PEDIDO_MXN_ID = "codex-endmills-e2e-pedido-mxn"
const PARTIDA_ID = `${PEDIDO_ID}_${MEDIDA_ID}`

function cargarEnvLocal() {
  const envPath = join(process.cwd(), ".env.local")
  if (!existsSync(envPath)) throw new Error("Falta .env.local para el cliente Firebase")
  for (const linea of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const limpia = linea.trim()
    if (!limpia || limpia.startsWith("#")) continue
    const indice = limpia.indexOf("=")
    if (indice < 1) continue
    const clave = limpia.slice(0, indice).trim()
    let valor = limpia.slice(indice + 1).trim()
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1)
    }
    process.env[clave] ??= valor
  }
}

function configurarCredencialesAdmin() {
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
  process.env.GOOGLE_CLOUD_QUOTA_PROJECT ??= PROJECT_ID
}

async function debeFallarPermiso(accion, etiqueta) {
  try {
    await accion()
  } catch (error) {
    if (error?.code === "permission-denied" || error?.code === "firestore/permission-denied") {
      console.log(`✓ ${etiqueta}`)
      return
    }
    throw error
  }
  throw new Error(`${etiqueta}: la operación debía ser rechazada`)
}

cargarEnvLocal()
configurarCredencialesAdmin()

if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== PROJECT_ID) {
  throw new Error(`.env.local no apunta a ${PROJECT_ID}; abortado`)
}

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
if (!apiKey) throw new Error("Falta NEXT_PUBLIC_FIREBASE_API_KEY")

const adminApp = getAdminApps().length === 0
  ? initializeAdminApp({ projectId: PROJECT_ID })
  : getAdminApps()[0]
const adminDb = getAdminFirestore(adminApp, DATABASE_ID)
const adminAuth = getAdminAuth(adminApp)
const refsAdmin = {
  usuario: adminDb.collection("usuarios").doc(UID),
  medida: adminDb.collection("endmills-medidas").doc(MEDIDA_ID),
  pedido: adminDb.collection("endmills-pedidos").doc(PEDIDO_ID),
  pedidoMxn: adminDb.collection("endmills-pedidos").doc(PEDIDO_MXN_ID),
  partida: adminDb.collection("endmills-pedido-partidas").doc(PARTIDA_ID),
}

let authCreado = false
let datosCreados = false
let clientApp

try {
  const existentes = await adminDb.getAll(...Object.values(refsAdmin))
  if (existentes.some((snapshot) => snapshot.exists)) {
    throw new Error("Ya existe un recurso temporal codex-endmills-e2e; abortado sin borrar")
  }
  try {
    await adminAuth.getUser(UID)
    throw new Error("Ya existe el usuario Auth temporal; abortado sin borrar")
  } catch (error) {
    if (error?.code !== "auth/user-not-found") throw error
  }

  const password = randomBytes(24).toString("base64url")
  await adminAuth.createUser({ uid: UID, email: EMAIL, emailVerified: true, password })
  authCreado = true
  const ahoraAdmin = new Date()
  await refsAdmin.usuario.create({
    email: EMAIL,
    nombre: "Verificación Endmills",
    activo: true,
    rol: "compras",
    plantilla: "compras",
    modulos: ["endmills"],
    esSuperAdmin: false,
    creadoEn: ahoraAdmin,
    actualizadoEn: ahoraAdmin,
  })
  await refsAdmin.medida.create({
    orden: 9999,
    categoria: "FLAT",
    medidaPulgadas: "E2E",
    descripcion: "Medida temporal de verificación",
    stockActual: 2,
    stockActualizadoEn: ahoraAdmin,
    precioActualUSD: 4,
    cotizacionFecha: "2026-08-06",
    specPropuesta: "E2E-SPEC",
    requiereConfirmacion: false,
    notas: null,
    objetivoPar: null,
    ultimoPedidoId: null,
    creadoEn: ahoraAdmin,
    actualizadoEn: ahoraAdmin,
  })
  datosCreados = true

  clientApp = initializeApp({
    apiKey,
    authDomain: `${PROJECT_ID}.firebaseapp.com`,
    projectId: PROJECT_ID,
  }, "endmills-dev-rules-verification")
  const clientAuth = getAuth(clientApp)
  await signInWithEmailAndPassword(clientAuth, EMAIL, password)
  const clientDb = getFirestore(clientApp, DATABASE_ID)
  const medidaRef = doc(clientDb, "endmills-medidas", MEDIDA_ID)
  const pedidoRef = doc(clientDb, "endmills-pedidos", PEDIDO_ID)
  const pedidoMxnRef = doc(clientDb, "endmills-pedidos", PEDIDO_MXN_ID)
  const partidaRef = doc(clientDb, "endmills-pedido-partidas", PARTIDA_ID)

  const lectura = await getDocFromServer(medidaRef)
  if (!lectura.exists() || lectura.data().stockActual !== 2) {
    throw new Error("La lectura autenticada no devolvió la medida temporal")
  }
  console.log("✓ usuario con módulo puede leer Endmills")

  const ahora = Timestamp.now()
  const proveedor = {
    nombre: "ChangZhou North Alloy Tool Co.,Ltd",
    contacto: "Rita",
    email: "bfl9@bfltool.com",
    origen: "China",
  }
  const pedido = {
    fecha: "2026-08-06",
    numeroProveedor: "E2E-DEV",
    estado: "confirmado",
    proveedor,
    moneda: "USD",
    costoItemsUSD: 20,
    aliCostUSD: 0,
    shippingUSD: 0,
    totalUSD: 20,
    costosAdicionalesConfirmados: true,
    numeroPartidas: 1,
    numeroPiezas: 5,
    origen: "manual",
    motivoCancelacion: null,
    creadoPorUid: UID,
    creadoPorNombre: "Verificación Endmills",
    creadoEn: ahora,
    actualizadoEn: ahora,
  }
  const partida = {
    pedidoId: PEDIDO_ID,
    fechaPedido: "2026-08-06",
    tipo: "catalogada",
    medidaId: MEDIDA_ID,
    categoria: "FLAT",
    medidaPulgadas: "E2E",
    descripcion: "Medida temporal de verificación",
    spec: "E2E-SPEC",
    stockAntesPedido: 2,
    cantidadPedida: 5,
    cantidadRecibida: 0,
    precioUnitarioUSD: 4,
    subtotalUSD: 20,
    objetivoPar: 7,
    requiereConfirmacionAlCrear: false,
    confirmacionResuelta: true,
    creadoEn: ahora,
    actualizadoEn: ahora,
  }

  await runTransaction(clientDb, async (transaction) => {
    const snapshot = await transaction.get(medidaRef)
    if (!snapshot.exists() || snapshot.data().stockActual !== 2) {
      throw new Error("Stock temporal inesperado antes del pedido")
    }
    transaction.set(pedidoRef, pedido)
    transaction.set(partidaRef, partida)
    transaction.update(medidaRef, {
      objetivoPar: 7,
      ultimoPedidoId: PEDIDO_ID,
      actualizadoEn: ahora,
    })
  })
  const trasPedido = await getDocFromServer(medidaRef)
  if (trasPedido.data()?.stockActual !== 2 || trasPedido.data()?.objetivoPar !== 7) {
    throw new Error("Registrar el pedido alteró stock o no estableció el objetivo")
  }
  console.log("✓ pedido atómico establece objetivo sin aumentar stock")

  await debeFallarPermiso(
    () => setDoc(pedidoMxnRef, { ...pedido, moneda: "MXN" }),
    "reglas rechazan pedido con moneda MXN"
  )

  const recepcion = Timestamp.now()
  await runTransaction(clientDb, async (transaction) => {
    const [medidaSnapshot, partidaSnapshot, pedidoSnapshot] = await Promise.all([
      transaction.get(medidaRef),
      transaction.get(partidaRef),
      transaction.get(pedidoRef),
    ])
    if (!medidaSnapshot.exists() || !partidaSnapshot.exists() || !pedidoSnapshot.exists()) {
      throw new Error("Faltan documentos antes de recibir")
    }
    transaction.update(medidaRef, {
      stockActual: 7,
      stockActualizadoEn: recepcion,
      actualizadoEn: recepcion,
    })
    transaction.update(partidaRef, { cantidadRecibida: 5, actualizadoEn: recepcion })
    transaction.update(pedidoRef, { estado: "recibido", actualizadoEn: recepcion })
  })
  const trasRecepcion = await getDocFromServer(medidaRef)
  const pedidoRecibido = await getDocFromServer(pedidoRef)
  if (trasRecepcion.data()?.stockActual !== 7 || pedidoRecibido.data()?.estado !== "recibido") {
    throw new Error("La recepción no persistió stock/estado")
  }
  console.log("✓ recepción completa incrementa stock y persiste estado")

  await refsAdmin.usuario.update({ modulos: [], actualizadoEn: new Date() })
  await debeFallarPermiso(
    () => getDocFromServer(medidaRef),
    "usuario sin módulo no puede leer Endmills"
  )

  await signOut(clientAuth)
  console.log("VERIFICACIÓN ENDMILLS DEV COMPLETA")
} finally {
  if (clientApp) await deleteApp(clientApp).catch(() => undefined)
  if (datosCreados) {
    await Promise.allSettled([
      refsAdmin.partida.delete(),
      refsAdmin.pedido.delete(),
      refsAdmin.pedidoMxn.delete(),
      refsAdmin.medida.delete(),
      refsAdmin.usuario.delete(),
    ])
  }
  if (authCreado) await adminAuth.deleteUser(UID).catch(() => undefined)
  await deleteAdminApp(adminApp).catch(() => undefined)
  console.log("✓ recursos temporales eliminados")
}
