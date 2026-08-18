/**
 * Ejecuta sincronizarIndiceBusqueda contra el proyecto indicado (dev por defecto).
 * Usa ADC (firebase login / gcloud auth application-default login).
 *
 *   node scripts/ejecutar-sync-busqueda-indice.mjs [projectId]
 */
import { createRequire } from "node:module"
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const projectId = process.argv[2] || "smv-brain-dev"

function cargarEnvLocal() {
  for (const nombre of [".env.local", ".env.admin.local"]) {
    const envPath = resolve(root, nombre)
    if (!existsSync(envPath)) continue
    const raw = readFileSync(envPath, "utf8")
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.startsWith("#")) continue
      const eq = line.indexOf("=")
      if (eq <= 0) continue
      const key = line.slice(0, eq).trim()
      let value = line.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (key === "GOOGLE_APPLICATION_CREDENTIALS" && !value.startsWith("/") && !/^[A-Za-z]:/.test(value)) {
        value = resolve(root, value)
      }
      if (!process.env[key]) process.env[key] = value
    }
  }
}

function cargarGeminiKey() {
  const value = process.env.GEMINI_API_KEY
  if (!value) throw new Error("GEMINI_API_KEY no encontrada en .env.local")
  return value
}

cargarEnvLocal()

const require = createRequire(resolve(root, "functions/package.json"))
const { initializeApp } = require("firebase-admin/app")
const { getFirestore } = require("firebase-admin/firestore")

process.env.GCLOUD_PROJECT = projectId
initializeApp({ projectId })

// Resuelve la base nombrada antes de cargar busqueda-indice-escritura (getDb a nivel módulo).
getFirestore("compras-americanas")

const { sincronizarIndiceBusqueda } = require("../functions/lib/busqueda-indice-escritura.js")

const apiKey = cargarGeminiKey()
console.log(`[sync] proyecto=${projectId} base=compras-americanas`)

const resultado = await sincronizarIndiceBusqueda(apiKey)
console.log("[sync] OK:", JSON.stringify(resultado, null, 2))
