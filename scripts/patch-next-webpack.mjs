/**
 * Parchea / restaura el binario de Next para forzar `build --webpack`.
 *
 * Firebase Hosting (frameworksBackend) invoca `next build` sin flags. En Next 16
 * el default es Turbopack, que emite aliases hasheados de firebase-admin que la
 * función SSR no resuelve → 500 en /api/*.
 *
 * Uso:
 *   node scripts/patch-next-webpack.mjs apply
 *   node scripts/patch-next-webpack.mjs restore
 */
import { copyFileSync, existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const NEXT_BIN = join(process.cwd(), "node_modules", "next", "dist", "bin", "next")
const BACKUP = `${NEXT_BIN}.smv-webpack-bak`
const INJECT_MARKER = "SMV Hub: force webpack for Firebase Hosting deploys"
const INJECT = `
// ${INJECT_MARKER}
if (process.argv.includes("build") && !process.argv.includes("--webpack") && !process.argv.includes("--turbopack")) {
  process.argv.push("--webpack");
}
`

function apply() {
  if (!existsSync(NEXT_BIN)) {
    throw new Error(`No se encontró el binario de Next: ${NEXT_BIN}. Corre npm install.`)
  }
  const original = readFileSync(NEXT_BIN, "utf8")
  if (original.includes(INJECT_MARKER)) {
    console.log("→ next bin ya forzaba --webpack")
    return
  }
  if (!original.includes('"use strict";')) {
    throw new Error("Formato inesperado de node_modules/next/dist/bin/next; abortando parche.")
  }
  copyFileSync(NEXT_BIN, BACKUP)
  writeFileSync(NEXT_BIN, original.replace('"use strict";', `"use strict";${INJECT}`), "utf8")
  console.log("→ next bin parcheado: build → build --webpack")
}

function restore() {
  if (!existsSync(BACKUP)) {
    console.log("→ no hay backup de next bin (nada que restaurar)")
    return
  }
  copyFileSync(BACKUP, NEXT_BIN)
  unlinkSync(BACKUP)
  console.log("→ next bin restaurado")
}

const cmd = process.argv[2]
if (cmd === "apply") {
  apply()
} else if (cmd === "restore") {
  restore()
} else {
  console.error("Uso: node scripts/patch-next-webpack.mjs <apply|restore>")
  process.exit(1)
}
