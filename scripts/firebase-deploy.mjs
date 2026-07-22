/**
 * Wrapper de `firebase deploy` que fuerza `next build --webpack`.
 *
 * Ver scripts/patch-next-webpack.mjs y el issue upstream:
 * https://github.com/firebase/firebase-tools/issues/9749
 *
 * Uso:
 *   node scripts/firebase-deploy.mjs deploy --only hosting
 *   npm run deploy:hosting
 */
import { spawn, spawnSync } from "node:child_process"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const patchScript = join(fileURLToPath(new URL(".", import.meta.url)), "patch-next-webpack.mjs")

function runPatch(cmd) {
  const r = spawnSync(process.execPath, [patchScript, cmd], { stdio: "inherit" })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

const firebaseArgs = process.argv.slice(2)
if (firebaseArgs.length === 0) {
  console.error("Uso: node scripts/firebase-deploy.mjs <args de firebase>")
  console.error("Ej.: node scripts/firebase-deploy.mjs deploy --only hosting")
  process.exit(1)
}

runPatch("apply")

let restaurado = false
function restaurarUnaVez() {
  if (restaurado) return
  restaurado = true
  runPatch("restore")
}

process.on("exit", () => {
  if (!restaurado) {
    try {
      spawnSync(process.execPath, [patchScript, "restore"], { stdio: "inherit" })
    } catch {
      /* ignore */
    }
  }
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
  env: process.env,
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
