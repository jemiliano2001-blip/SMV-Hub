import { readFileSync } from "node:fs"
import { join } from "node:path"

const PRODUCTION_PROJECT = "smv-brain"
const PRODUCTION_AUTH_DOMAIN = "smv-brain.firebaseapp.com"

/** @type {(path: string, encoding: "utf8") => string} */
const readUtf8 = (path, encoding) => readFileSync(path, encoding)

export function parseEnvFile(source) {
  const values = {}
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const separator = line.indexOf("=")
    if (separator <= 0) continue
    const key = line.slice(0, separator).trim()
    let value = line.slice(separator + 1).trim()
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1)
    }
    values[key] = value
  }
  return values
}

export function projectFromFirebaseArgs(args) {
  const equalsArg = args.find((arg) => arg.startsWith("--project="))
  if (equalsArg) return equalsArg.slice("--project=".length)
  const index = args.indexOf("--project")
  return index >= 0 ? args[index + 1] ?? null : null
}

export function includesHostingDeploy(args) {
  if (!args.includes("deploy")) return false
  const onlyEquals = args.find((arg) => arg.startsWith("--only="))
  const onlyIndex = args.indexOf("--only")
  const targets =
    onlyEquals?.slice("--only=".length) ??
    (onlyIndex >= 0 ? args[onlyIndex + 1] : null)
  if (!targets) return true
  return targets
    .split(",")
    .some((target) => target === "hosting" || target.startsWith("hosting:"))
}

export function resolveFirebaseDeployEnv({
  args,
  cwd,
  baseEnv = {},
  readFile = readUtf8,
}) {
  const project = projectFromFirebaseArgs(args)
  if (includesHostingDeploy(args) && !project) {
    throw new Error(
      "El deploy de Hosting requiere --project explícito para no mezclar desarrollo y producción."
    )
  }
  if (project !== PRODUCTION_PROJECT) return { ...baseEnv }

  const productionPath = join(cwd, ".env.production")
  const productionEnv = parseEnvFile(readFile(productionPath, "utf8"))
  if (
    productionEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== PRODUCTION_PROJECT ||
    productionEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN !== PRODUCTION_AUTH_DOMAIN
  ) {
    throw new Error(
      ".env.production no contiene la configuración Firebase esperada para smv-brain."
    )
  }

  return {
    ...baseEnv,
    ...productionEnv,
  }
}
