// Crea (o actualiza, idempotente) el usuario de prueba usado por
// e2e/camino-dinero.spec.ts en el proyecto Firebase de DESARROLLO smv-brain-dev.
// Replica lo que hace lib/usuarios-admin.ts#crearUsuarioAdmin — no se puede
// importar directo desde un script .mjs suelto porque usa el alias "@/...".
//
// Uso (desde la raíz del repo, con el Firebase CLI ya autenticado contra
// smv-brain-dev o con GOOGLE_APPLICATION_CREDENTIALS apuntando ahí):
//   node scripts/crear-usuario-e2e.mjs
//
// Seguridad: el proyecto destino está hardcodeado a "smv-brain-dev" (nunca lee
// .env.local ni ninguna variable que pudiera apuntar sin querer a producción),
// mismo patrón que scripts/backfill-claims-usuarios.mjs.
import { existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"
import { initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"

const PROYECTO = "smv-brain-dev"
const BASE = "compras-americanas"
const EMAIL = "admin@smv-hub-e2e.local"
const PASSWORD = process.env.E2E_TEST_USER_PASSWORD ?? "admin1234"
const PLANTILLA = "compras"
const MODULOS = ["nueva-compra", "ordenes", "reportes"]

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

console.log(`Proyecto destino: ${PROYECTO} (base Firestore: ${BASE})`)
console.log(`Usuario: ${EMAIL} | plantilla=${PLANTILLA} | modulos=[${MODULOS.join(", ")}]`)

initializeApp({ projectId: PROYECTO })
const auth = getAuth()
const db = getFirestore(BASE)

let cuenta
try {
  cuenta = await auth.getUserByEmail(EMAIL)
  await auth.updateUser(cuenta.uid, { password: PASSWORD, emailVerified: true, disabled: false })
  console.log(`✓ Cuenta de Auth ya existía (${cuenta.uid}) — password/estado actualizados`)
} catch (err) {
  if (err.code !== "auth/user-not-found") throw err
  cuenta = await auth.createUser({ email: EMAIL, password: PASSWORD, emailVerified: true })
  console.log(`✓ Cuenta de Auth creada (${cuenta.uid})`)
}

await auth.setCustomUserClaims(cuenta.uid, {
  smvHubActivo: true,
  smvHubModulos: MODULOS,
})
console.log("✓ Custom claims sincronizados (smvHubActivo=true, smvHubModulos)")

const ahora = new Date()
const ref = db.collection("usuarios").doc(cuenta.uid)
const yaExiste = (await ref.get()).exists

await ref.set(
  {
    email: EMAIL,
    rol: PLANTILLA,
    plantilla: PLANTILLA,
    modulos: MODULOS,
    esSuperAdmin: false,
    activo: true,
    proveedor: "password",
    creadoPor: "scripts/crear-usuario-e2e.mjs",
    actualizadoEn: ahora,
    ...(yaExiste ? {} : { creadoEn: ahora }),
  },
  { merge: true }
)
console.log(`✓ Doc usuarios/${cuenta.uid} listo (activo=true)`)

console.log(
  "\nListo. El claim se refleja en el siguiente login (auth.setup.ts hace login real cada corrida, así que no hay que esperar el refresh de 1h)."
)
