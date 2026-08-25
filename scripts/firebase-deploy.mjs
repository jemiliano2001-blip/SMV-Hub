/**
 * Wrapper de `firebase deploy` que fuerza `next build --webpack`.
 *
 * Ver scripts/patch-next-webpack.mjs y el issue upstream:
 * https://github.com/firebase/firebase-tools/issues/9749
 *
 * Uso:
 *   node scripts/firebase-deploy.mjs deploy --project smv-brain --only hosting:smv-hub
 *   npm run deploy:hosting
 */
import { spawn, spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  filterEnvLocalForProductionBuild,
  projectFromFirebaseArgs,
  resolveFirebaseDeployEnv,
} from "./firebase-deploy-env.mjs"

const patchScript = join(fileURLToPath(new URL(".", import.meta.url)), "patch-next-webpack.mjs")

function runPatch(cmd) {
  const r = spawnSync(process.execPath, [patchScript, cmd], { stdio: "inherit" })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

const firebaseArgs = process.argv.slice(2)
if (firebaseArgs.length === 0) {
  console.error("Uso: node scripts/firebase-deploy.mjs <args de firebase>")
  console.error(
    "Ej.: node scripts/firebase-deploy.mjs deploy --project smv-brain --only hosting:smv-hub"
  )
  process.exit(1)
}

let resolvedEnv
try {
  resolvedEnv = resolveFirebaseDeployEnv({
    args: firebaseArgs,
    cwd: process.cwd(),
    baseEnv: process.env,
  })
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}

if (projectFromFirebaseArgs(firebaseArgs) === "smv-brain") {
  console.log("→ configuración web Firebase fijada a smv-brain desde .env.production")
}

const envLocalPath = join(process.cwd(), ".env.local")
let envLocalBackup = null
if (
  projectFromFirebaseArgs(firebaseArgs) === "smv-brain" &&
  existsSync(envLocalPath)
) {
  const original = readFileSync(envLocalPath, "utf8")
  const filtered = filterEnvLocalForProductionBuild(original)
  if (filtered !== original) {
    envLocalBackup = original
    writeFileSync(envLocalPath, filtered, "utf8")
    console.log("→ GOOGLE_APPLICATION_CREDENTIALS omitida de .env.local durante el build de producción")
  }
}

// Parchear firebase.json temporalmente con vars server-side para la Cloud Run SSR.
// frameworksBackend.environmentVariables las inyecta en el runtime de Cloud Run.
// Se restaura tras el deploy para no almacenar secrets en el repo.
const firebaseJsonPath = join(process.cwd(), "firebase.json")
let firebaseJsonBackup = null
if (projectFromFirebaseArgs(firebaseArgs) === "smv-brain" && existsSync(firebaseJsonPath)) {
  const SERVER_ONLY_VARS = [
    "GEMINI_API_KEY",
    "GEMINI_MODEL",
    "GEMINI_MODEL_SAT",
    "GEMINI_MODEL_SAT_ESCALADO",
    "HUB_GEMINI_API_KEY",
  ]
  const envVarsToInject = {}
  for (const key of SERVER_ONLY_VARS) {
    if (resolvedEnv[key]) envVarsToInject[key] = resolvedEnv[key]
  }
  if (Object.keys(envVarsToInject).length > 0) {
    firebaseJsonBackup = readFileSync(firebaseJsonPath, "utf8")
    const firebaseConfig = JSON.parse(firebaseJsonBackup)
    if (firebaseConfig.hosting?.frameworksBackend) {
      firebaseConfig.hosting.frameworksBackend.environmentVariables = {
        ...firebaseConfig.hosting.frameworksBackend.environmentVariables,
        ...envVarsToInject,
      }
      writeFileSync(firebaseJsonPath, JSON.stringify(firebaseConfig, null, 2) + "\n", "utf8")
      console.log(`→ vars server-side inyectadas en firebase.json[frameworksBackend]: ${Object.keys(envVarsToInject).join(", ")}`)
    }
  }
}

runPatch("apply")

const nodeOptions = resolvedEnv.NODE_OPTIONS || ""
let windowsShimDir = null

function deployPath() {
  if (process.platform !== "win32") return process.env.PATH
  const esbuildCmd = join(
    process.cwd(),
    "node_modules",
    ".bin",
    "esbuild.cmd"
  )
  if (!existsSync(esbuildCmd)) return process.env.PATH

  windowsShimDir = mkdtempSync(join(tmpdir(), "smv-firebase-shim-"))
  writeFileSync(
    join(windowsShimDir, "which.cmd"),
    [
      "@echo off",
      'if /I "%~1"=="esbuild" (',
      `  echo ${esbuildCmd}`,
      "  exit /b 0",
      ")",
      "where %*",
      "",
    ].join("\r\n"),
    "utf8"
  )
  return `${windowsShimDir}${delimiter}${process.env.PATH || ""}`
}

const deployEnv = {
  ...resolvedEnv,
  FIREBASE_DEPLOY_PROJECT: projectFromFirebaseArgs(firebaseArgs) ?? "",
  PATH: deployPath(),
  NODE_OPTIONS: /--max[_-]old[_-]space[_-]size/i.test(nodeOptions)
    ? nodeOptions
    : `${nodeOptions} --max_old_space_size=4096`.trim(),
}

let restaurado = false
function limpiarShim() {
  if (!windowsShimDir) return
  rmSync(windowsShimDir, { recursive: true, force: true })
  windowsShimDir = null
}

/**
 * Devuelve al disco los archivos que este script parchea en caliente.
 * Es sincrona y sin dependencias para poder correr tambien dentro de `process.on("exit")`:
 * si el proceso muere sin pasar por `restaurarUnaVez()`, la GEMINI_API_KEY inyectada en
 * firebase.json quedaria escrita en el repo y podria commitearse por accidente.
 */
function restaurarArchivos() {
  if (envLocalBackup !== null) {
    writeFileSync(envLocalPath, envLocalBackup, "utf8")
    envLocalBackup = null
  }
  if (firebaseJsonBackup !== null) {
    writeFileSync(firebaseJsonPath, firebaseJsonBackup, "utf8")
    firebaseJsonBackup = null
  }
}

function restaurarUnaVez() {
  if (restaurado) return
  restaurado = true
  restaurarArchivos()
  runPatch("restore")
  limpiarShim()
}

process.on("exit", () => {
  if (!restaurado) {
    restaurarArchivos()
    try {
      spawnSync(process.execPath, [patchScript, "restore"], { stdio: "inherit" })
    } catch {
      /* ignore */
    }
  }
  limpiarShim()
})
process.on("SIGINT", () => {
  restaurarUnaVez()
  process.exit(130)
})
process.on("SIGTERM", () => {
  restaurarUnaVez()
  process.exit(143)
})

const child = spawn("firebase", firebaseArgs, {
  stdio: "inherit",
  shell: true,
  cwd: process.cwd(),
  env: deployEnv,
})

child.on("error", (err) => {
  console.error("Error lanzando firebase:", err)
  restaurarUnaVez()
  process.exit(1)
})

child.on("exit", (code, signal) => {
  restaurarUnaVez()
  if (signal) process.exit(1)
  process.exit(code ?? 1)
})
