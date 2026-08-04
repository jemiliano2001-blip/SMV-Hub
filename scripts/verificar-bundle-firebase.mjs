import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const serverDir = join(process.cwd(), ".next", "server")
const staticDir = join(process.cwd(), ".next", "static")
const hashedFirebaseAdmin = /firebase-admin-[a-f0-9]{16,}/

if (!existsSync(serverDir)) {
  throw new Error("No existe .next/server. Ejecuta el build antes de verificar el bundle.")
}

function archivosJavaScript(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const ruta = join(dir, entry.name)
    if (entry.isDirectory()) return archivosJavaScript(ruta)
    return entry.isFile() && ruta.endsWith(".js") ? [ruta] : []
  })
}

const archivoConAlias = archivosJavaScript(serverDir).find((archivo) =>
  hashedFirebaseAdmin.test(readFileSync(archivo, "utf8"))
)

if (archivoConAlias) {
  throw new Error(
    `El bundle contiene un alias de firebase-admin incompatible con Firebase Hosting: ${archivoConAlias}`
  )
}

if (process.env.FIREBASE_DEPLOY_PROJECT === "smv-brain") {
  const archivosCliente = existsSync(staticDir) ? archivosJavaScript(staticDir) : []
  const archivoConDev = [...archivosCliente, ...archivosJavaScript(serverDir)].find((archivo) =>
    readFileSync(archivo, "utf8").includes("smv-brain-dev")
  )
  if (archivoConDev) {
    throw new Error(
      `El bundle de produccion contiene configuracion de smv-brain-dev: ${archivoConDev}`
    )
  }
}

console.log("Bundle SSR compatible con Firebase Hosting: sin alias hash de firebase-admin.")
