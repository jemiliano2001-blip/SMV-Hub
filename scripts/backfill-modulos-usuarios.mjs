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
    "endmills",
    "requisiciones",
    "proveedores",
    "reportes",
    "caja-chica",
    "almacen",
    "pedidos-almacen",
    "operadores",
    "horas-extra",
    "banos",
    "notificaciones",
    "documentos-venta",
    "finanzas",
    "auditoria",
    "usuarios",
  ],
  compras: [
    "nueva-compra",
    "cotizaciones",
    "endmills",
    "requisiciones",
    "proveedores",
    "caja-chica",
    "almacen",
    "pedidos-almacen",
    "operadores",
    "horas-extra",
    "banos",
    "notificaciones",
    "documentos-venta",
  ],
  diseno: ["cotizaciones", "requisiciones", "horas-extra"],
  automatizacion: ["cotizaciones", "requisiciones", "horas-extra", "notificaciones"],
  almacen: ["almacen", "pedidos-almacen", "banos", "notificaciones", "documentos-venta"],
}

// Matrices predeterminadas inmediatamente anteriores a Endmills. Solo estas se
// pueden ampliar con seguridad: cualquier otra combinación se considera una
// matriz personalizada y se deja intacta para revisión humana.
const MODULOS_PREVIOS_ENDMILLS = {
  admin: MODULOS_POR_PLANTILLA.admin.filter((modulo) => modulo !== "endmills"),
  compras: MODULOS_POR_PLANTILLA.compras.filter((modulo) => modulo !== "endmills"),
}

function mismosModulos(actuales, esperados) {
  return Array.isArray(actuales) &&
    actuales.length === esperados.length &&
    esperados.every((modulo) => actuales.includes(modulo))
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
    data.plantilla === "almacen" ||
    data.plantilla === "automatizacion"
      ? data.plantilla
      : data.rol === "admin" ||
          data.rol === "compras" ||
          data.rol === "diseno" ||
          data.rol === "almacen" ||
          data.rol === "automatizacion"
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
    const plantillaEndmills = plantilla === "admin" || plantilla === "compras"
    if (
      plantillaEndmills &&
      mismosModulos(data.modulos, MODULOS_PREVIOS_ENDMILLS[plantilla])
    ) {
      await doc.ref.update({
        modulos: MODULOS_POR_PLANTILLA[plantilla],
        actualizadoEn: new Date(),
      })
      console.log(`✓ ${data.email}: matriz predeterminada ampliada con endmills`)
      actualizados++
      continue
    }
    if (plantillaEndmills && !data.modulos.includes("endmills")) {
      console.log(`! ${data.email}: matriz personalizada sin endmills — revisar manualmente`)
      omitidos++
      continue
    }
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
