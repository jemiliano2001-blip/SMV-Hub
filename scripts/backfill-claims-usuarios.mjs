// Estampa los custom claims usados por storage.rules a todos los
// usuarios existentes de la colección `usuarios`. Idempotente: se puede correr
// las veces que haga falta. Necesario solo para cuentas creadas antes de que
// lib/usuarios-admin.ts sincronizara el claim automáticamente (o creadas desde
// un hosting desplegado con código anterior a ese cambio).
//
// Uso (desde la raíz del repo, con el Firebase CLI ya autenticado):
//   node scripts/backfill-claims-usuarios.mjs
//
// Credenciales: usa GOOGLE_APPLICATION_CREDENTIALS si está definida; si no,
// cae a las Application Default Credentials guardadas por `firebase login`.
import { existsSync } from "node:fs"
import { join } from "node:path"
import { homedir } from "node:os"
import { initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getFirestore } from "firebase-admin/firestore"

const PROYECTO = "smv-brain"
const BASE = "compras-americanas"

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
const auth = getAuth()
const db = getFirestore(BASE)

const snap = await db.collection("usuarios").get()
console.log(`Documentos en usuarios/: ${snap.size}`)

for (const doc of snap.docs) {
  const data = doc.data()
  const activo = data.activo === true
  const plantilla = data.plantilla ?? data.rol
  const modulos = Array.isArray(data.modulos)
    ? data.modulos.filter((modulo) => typeof modulo === "string")
    : (["admin", "compras"].includes(plantilla) ? ["caja-chica"] : [])

  let cuenta
  try {
    cuenta = await auth.getUser(doc.id)
  } catch (err) {
    console.log(`✗ ${data.email} (${doc.id}): sin cuenta en Auth — ${err.code ?? err.message}`)
    continue
  }

  const providers = cuenta.providerData.map((p) => p.providerId).join(", ") || "(ninguno)"
  const claimsAntes = JSON.stringify(cuenta.customClaims ?? {})

  await auth.setCustomUserClaims(doc.id, {
    smvHubActivo: activo,
    smvHubModulos: modulos,
  })

  console.log(
    `✓ ${data.email} | rol=${data.rol} activo=${activo} | modulos=${modulos.length} | providers=[${providers}] | claims antes=${claimsAntes} → claims SMV actualizados | disabled=${cuenta.disabled}`
  )
}

console.log("Backfill completo. Los usuarios verán el claim en su siguiente inicio de sesión o refresh de token (≤1 h).")
