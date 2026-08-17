// Backfill: rol legacy → plantilla + modulos + esSuperAdmin.
// Idempotente. Correr tras desplegar el código con compat de lectura.
//
// Uso (desde la raíz del repo, con Firebase CLI autenticado):
//   node scripts/backfill-modulos-usuarios.mjs --dry-run --proyecto=smv-brain-dev   # ensayo
//   node scripts/backfill-modulos-usuarios.mjs --proyecto=smv-brain-dev             # aplica en dev
//   node scripts/backfill-modulos-usuarios.mjs                                      # aplica en PRODUCCIÓN
//
// --dry-run reporta exactamente lo que haría sin escribir nada.
//
import { existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"
import { initializeApp } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

const args = process.argv.slice(2)
const DRY_RUN = args.includes("--dry-run")
const PROYECTO = args.find((a) => a.startsWith("--proyecto="))?.split("=")[1] || "smv-brain"
const BASE = "compras-americanas"

const MODULOS_POR_PLANTILLA = {
  admin: [
    "nueva-compra",
    "ordenes",
    "claves-sat",
    "cotizaciones",
    "compras-odoo",
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
    "compras-odoo",
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

// Módulos agregados a las matrices predeterminadas después de un despliegue, en orden
// cronológico. Si la matriz guardada de un usuario coincide EXACTAMENTE con la
// predeterminada previa a una de estas ampliaciones, se amplía sola hasta la vigente.
// Cualquier otra combinación se considera una matriz personalizada y se deja intacta
// para revisión humana.
//
// Al agregar un módulo nuevo a PLANTILLA_ADMIN/PLANTILLA_COMPRAS en `lib/roles.ts`,
// agrégalo también arriba y añade aquí su entrada al final de la lista.
const AMPLIACIONES = [
  { modulo: "endmills", plantillas: ["admin", "compras"] },
  { modulo: "compras-odoo", plantillas: ["admin", "compras"] },
]

/**
 * Matriz predeterminada tal como era justo antes de la ampliación `indice`: la vigente
 * menos esa ampliación y todas las posteriores. Así, un usuario que quedó congelado en la
 * era pre-Endmills se reconoce aunque desde entonces se hayan agregado más módulos.
 */
function matrizPreviaA(indice, plantilla) {
  const posteriores = AMPLIACIONES.slice(indice).map((ampliacion) => ampliacion.modulo)
  return MODULOS_POR_PLANTILLA[plantilla].filter((modulo) => !posteriores.includes(modulo))
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

console.log(
  `Proyecto: ${PROYECTO} · base: ${BASE}${DRY_RUN ? " · MODO ENSAYO (no escribe nada)" : " · ESCRITURA REAL"}`
)

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
    // ¿La matriz guardada es una predeterminada anterior? Se amplía hasta la vigente.
    // Se evalúa de la ampliación más antigua a la más nueva.
    const aplicables = AMPLIACIONES.map((ampliacion, indice) => ({ ...ampliacion, indice })).filter(
      (ampliacion) => ampliacion.plantillas.includes(plantilla)
    )

    const previa = aplicables.find((ampliacion) =>
      mismosModulos(data.modulos, matrizPreviaA(ampliacion.indice, plantilla))
    )

    if (previa) {
      const agregados = AMPLIACIONES.slice(previa.indice)
        .filter((ampliacion) => ampliacion.plantillas.includes(plantilla))
        .map((ampliacion) => ampliacion.modulo)

      if (!DRY_RUN) {
        await doc.ref.update({
          modulos: MODULOS_POR_PLANTILLA[plantilla],
          actualizadoEn: new Date(),
        })
      }
      console.log(
        `✓ ${data.email}: matriz predeterminada ampliada con ${agregados.join(", ")}${DRY_RUN ? " [ensayo]" : ""}`
      )
      actualizados++
      continue
    }

    const faltantes = aplicables
      .filter((ampliacion) => !data.modulos.includes(ampliacion.modulo))
      .map((ampliacion) => ampliacion.modulo)

    if (faltantes.length > 0) {
      console.log(
        `! ${data.email}: matriz personalizada sin ${faltantes.join(", ")} — revisar manualmente`
      )
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

  if (!DRY_RUN) {
    await doc.ref.update({
      plantilla,
      rol: plantilla,
      modulos,
      esSuperAdmin,
      actualizadoEn: new Date(),
    })
  }

  console.log(
    `✓ ${data.email} | plantilla=${plantilla} | módulos=${modulos.length} | esSuperAdmin=${esSuperAdmin}${DRY_RUN ? " [ensayo]" : ""}`
  )
  actualizados++
}

console.log(`Backfill completo. Actualizados: ${actualizados}. Omitidos: ${omitidos}.`)
