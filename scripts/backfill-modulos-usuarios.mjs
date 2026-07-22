// Backfill: rol legacy → plantilla + modulos + esSuperAdmin.
// Idempotente. Correr tras desplegar el código con compat de lectura.
//
// Uso (desde la raíz del repo, con Firebase CLI autenticado):
//   node scripts/backfill-modulos-usuarios.mjs
//
import { existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"
import { initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

const PROYECTO = "smv-brain"
const BASE = "compras-americanas"

const MODULOS_POR_PLANTILLA = {
  admin: [
    "nueva-compra",
    "ordenes",
    "claves-sat",
    "cotizaciones",
    "requisiciones",
    "proveedores",
    "reportes",
    "caja-chica",
    "almacen",
    "reabastecimiento-rop",
    "pedidos-almacen",
    "ordenes-servicio",
    "operadores",
    "horas-extra",
    "banos",
    "finanzas",
    "auditoria",
    "usuarios",
  ],
  compras: [
    "nueva-compra",
    "cotizaciones",
    "requisiciones",
    "proveedores",
    "caja-chica",
    "almacen",
    "reabastecimiento-rop",
    "pedidos-almacen",
    "ordenes-servicio",
    "operadores",
    "horas-extra",
    "banos",
  ],
  diseno: ["cotizaciones", "requisiciones", "horas-extra"],
  almacen: ["almacen", "pedidos-almacen", "banos"],
}

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

const snap = await db.collection("usuarios").get()
console.log(`Documentos en usuarios/: ${snap.size}`)

let actualizados = 0
let omitidos = 0

for (const doc of snap.docs) {
  const data = doc.data()
  const plantilla =
    data.plantilla === "admin" ||
    data.plantilla === "compras" ||
    data.plantilla === "diseno" ||
    data.plantilla === "almacen"
      ? data.plantilla
      : data.rol === "admin" ||
          data.rol === "compras" ||
          data.rol === "diseno" ||
          data.rol === "almacen"
        ? data.rol
        : null

  if (!plantilla) {
    console.log(`✗ ${data.email ?? doc.id}: rol/plantilla inválidos — omitido`)
    omitidos++
    continue
  }

  const modulosYaOk =
    Array.isArray(data.modulos) &&
    data.modulos.length > 0 &&
    data.plantilla === plantilla &&
    typeof data.esSuperAdmin === "boolean"

  if (modulosYaOk) {
    console.log(`· ${data.email}: ya migrado (${data.modulos.length} módulos)`)
    omitidos++
    continue
  }

  const modulos = Array.isArray(data.modulos) && data.modulos.length > 0
    ? data.modulos
    : MODULOS_POR_PLANTILLA[plantilla]

  const esSuperAdmin =
    data.esSuperAdmin === true || plantilla === "admin" || data.rol === "admin"

  await doc.ref.update({
    plantilla,
    rol: plantilla,
    modulos,
    esSuperAdmin,
    actualizadoEn: new Date(),
  })

  console.log(
    `✓ ${data.email} | plantilla=${plantilla} | módulos=${modulos.length} | esSuperAdmin=${esSuperAdmin}`
  )
  actualizados++
}

console.log(`Backfill completo. Actualizados: ${actualizados}. Omitidos: ${omitidos}.`)
