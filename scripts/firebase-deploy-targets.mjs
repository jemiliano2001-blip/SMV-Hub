import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

const FUNCTIONS = [
  "functions:syncOdooFacturasScheduled",
  "functions:syncOdooFacturasManual",
  "functions:syncOdooComprasScheduled",
  "functions:syncOdooComprasManual",
]

export const TARGETS_COMPLETOS = [
  "hosting",
  ...FUNCTIONS,
  "firestore:rules",
  "storage",
].join(",")

const ARCHIVOS_SIN_DEPLOY = new Set([
  ".env.example",
  ".gitignore",
  "AGENTS.md",
  "CLAUDE.md",
  "PROJECT.md",
  "playwright.config.ts",
  "skills-lock.json",
  "vitest.config.ts",
])

function normalizarRuta(ruta) {
  return ruta.trim().replaceAll("\\", "/")
}

function esCambioSinDeploy(ruta) {
  return (
    !ruta ||
    ARCHIVOS_SIN_DEPLOY.has(ruta) ||
    ruta.startsWith(".github/") ||
    ruta.startsWith("docs/") ||
    ruta.startsWith("e2e/") ||
    ruta.startsWith("tests/") ||
    ruta.endsWith(".md") ||
    ruta.endsWith(".mdx")
  )
}

export function determinarTargetsDeploy(rutas) {
  const targets = new Set()

  for (const entrada of rutas) {
    const ruta = normalizarRuta(entrada)
    if (esCambioSinDeploy(ruta)) continue

    if (ruta === "firebase.json") return TARGETS_COMPLETOS

    if (ruta.startsWith("functions/")) {
      FUNCTIONS.forEach((target) => targets.add(target))
      continue
    }

    if (ruta === "firestore.rules") {
      targets.add("firestore:rules")
      continue
    }

    if (ruta === "storage.rules") {
      targets.add("storage")
      continue
    }

    if (ruta === "firestore.indexes.json") {
      targets.add("firestore:indexes")
      continue
    }

    targets.add("hosting")
  }

  const orden = [
    "hosting",
    ...FUNCTIONS,
    "firestore:rules",
    "firestore:indexes",
    "storage",
  ]
  return orden.filter((target) => targets.has(target)).join(",")
}

const ejecutadoDirectamente = process.argv[1]
  && fileURLToPath(import.meta.url) === process.argv[1]

if (ejecutadoDirectamente) {
  if (process.argv.includes("--full")) {
    console.log(TARGETS_COMPLETOS)
  } else {
    const rutas = readFileSync(0, "utf8").split(/\r?\n/)
    console.log(determinarTargetsDeploy(rutas))
  }
}
