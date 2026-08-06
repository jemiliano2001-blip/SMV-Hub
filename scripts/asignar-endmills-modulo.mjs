// Añade el módulo endmills solo a matrices admin/compras que coinciden
// exactamente con la plantilla predeterminada anterior. Dry-run por defecto.
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { getApps, initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

const DATABASE_ID = "compras-americanas"

const MODULOS_PREVIOS = {
  admin: [
    "nueva-compra", "ordenes", "claves-sat", "cotizaciones", "requisiciones",
    "proveedores", "reportes", "caja-chica", "almacen", "pedidos-almacen",
    "operadores", "horas-extra", "banos", "notificaciones", "documentos-venta",
    "finanzas", "auditoria", "usuarios",
  ],
  compras: [
    "nueva-compra", "cotizaciones", "requisiciones", "proveedores", "caja-chica",
    "almacen", "pedidos-almacen", "operadores", "horas-extra", "banos",
    "notificaciones", "documentos-venta",
  ],
}

function argumentos(argv) {
  const resultado = { project: "", apply: false, email: "", includeCustom: false }
  for (let indice = 0; indice < argv.length; indice++) {
    if (argv[indice] === "--apply") resultado.apply = true
    else if (argv[indice] === "--project") resultado.project = argv[++indice] ?? ""
    else if (argv[indice] === "--email") resultado.email = (argv[++indice] ?? "").trim().toLowerCase()
    else if (argv[indice] === "--include-custom") resultado.includeCustom = true
    else throw new Error(`Argumento desconocido: ${argv[indice]}`)
  }
  if (!new Set(["smv-brain-dev", "smv-brain"]).has(resultado.project)) {
    throw new Error("Indica --project smv-brain-dev o smv-brain")
  }
  return resultado
}

function mismosModulos(actuales, esperados) {
  return Array.isArray(actuales) &&
    actuales.length === esperados.length &&
    esperados.every((modulo) => actuales.includes(modulo))
}

function configurarCredenciales(projectId) {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const adc = join(
      homedir(),
      "AppData", "Roaming", "firebase",
      "jemiliano2001_gmail_com_application_default_credentials.json"
    )
    if (existsSync(adc)) process.env.GOOGLE_APPLICATION_CREDENTIALS = adc
  }
  process.env.GOOGLE_CLOUD_QUOTA_PROJECT ??= projectId
}

const opciones = argumentos(process.argv.slice(2))
configurarCredenciales(opciones.project)
if (getApps().length === 0) initializeApp({ projectId: opciones.project })
const db = getFirestore(DATABASE_ID)
const snapshot = await db.collection("usuarios").get()

const candidatas = []
let yaAsignadas = 0
let personalizadas = 0
let noAplican = 0

for (const documento of snapshot.docs) {
  const data = documento.data()
  const plantilla = data.plantilla ?? data.rol
  const coincideEmail = !opciones.email || String(data.email ?? "").toLowerCase() === opciones.email
  if (!coincideEmail) continue
  if (Array.isArray(data.modulos) && data.modulos.includes("endmills")) {
    yaAsignadas++
    continue
  }
  if (plantilla !== "admin" && plantilla !== "compras") {
    noAplican++
    continue
  }
  if (opciones.email) {
    const modulos = Array.isArray(data.modulos) && data.modulos.length > 0
      ? [...data.modulos, "endmills"]
      : [...MODULOS_PREVIOS[plantilla], "endmills"]
    candidatas.push({ ref: documento.ref, modulos })
    continue
  }
  if (mismosModulos(data.modulos, MODULOS_PREVIOS[plantilla])) {
    candidatas.push({ ref: documento.ref, modulos: [...data.modulos, "endmills"] })
  } else if (opciones.includeCustom && Array.isArray(data.modulos)) {
    candidatas.push({ ref: documento.ref, modulos: [...data.modulos, "endmills"] })
  } else {
    personalizadas++
  }
}

console.log(`Proyecto: ${opciones.project}/${DATABASE_ID}`)
if (opciones.email) console.log("Modo dirigido: un correo explícito")
console.log(`Usuarios revisados: ${snapshot.size}`)
console.log(`Matrices predeterminadas por ampliar: ${candidatas.length}`)
console.log(`Ya tienen endmills: ${yaAsignadas}`)
console.log(`Matrices personalizadas sin cambios: ${personalizadas}`)
console.log(`Plantillas no aplicables: ${noAplican}`)

if (!opciones.apply) {
  console.log("DRY-RUN: no se escribió nada. Agrega --apply para confirmar.")
  process.exit(0)
}

if (candidatas.length === 0) {
  console.log("NO-OP: no hay matrices predeterminadas pendientes.")
  process.exit(0)
}

const batch = db.batch()
for (const candidata of candidatas) {
  batch.update(candidata.ref, { modulos: candidata.modulos, actualizadoEn: new Date() })
}
await batch.commit()
console.log(`ASIGNACIÓN COMPLETA: ${candidatas.length} usuarios actualizados.`)
