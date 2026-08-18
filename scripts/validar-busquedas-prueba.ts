/**
 * Valida las 10 búsquedas de prueba del spec contra el índice real.
 *
 *   npx tsx scripts/validar-busquedas-prueba.ts [projectId]
 */
import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const projectId = process.argv[2] || "smv-brain"

const BUSQUEDAS: Array<{ q: string; debe: RegExp }> = [
  { q: "fresa de carburo 4 filos para acero inoxidable", debe: /carbide|fresa|end mill|changzhou|north/i },
  { q: "quién me vende rodamientos", debe: /ryasa|baleros|ret|rodamiento/i },
  { q: "sensor de proximidad inductivo M12", debe: /ifm|efector|proximidad|induct/i },
  { q: "fuente de poder riel din 24V", debe: /din rail|24v|mdr|ndr|supply/i },
  { q: "quién vende acero inoxidable en Monterrey", debe: /abinox|fortuna|iirsacero|serviacero|monterrey/i },
  { q: "pernos expulsores para moldes", debe: /ejector|expulsor|pcs/i },
  { q: "resortes de compresión", debe: /compression spring|resorte|mcmaster|9657/i },
  { q: "insertos para torno", debe: /iscar|carmex|cnmg|ccmt|inserto/i },
  { q: "conectores circulares Mouser", debe: /circular connector|mouser|shell size/i },
  { q: "cuándo fue la última vez que compré un encoder Mitsubishi", debe: /encoder|mitsubishi|ebay/i },
]

function cargarEnvLocal() {
  const envPath = resolve(root, ".env.local")
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
    process.env[key] = value
  }
}

async function main() {
  cargarEnvLocal()
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projectId
  process.env.FIREBASE_PROJECT_ID = projectId

  const { buscarEnCatalogoSemantico } = await import("../lib/busqueda-semantica-catalogo")

  const fuentes = ["orden-item", "proveedor"] as const
  let aciertos = 0

  console.log(`[validar] proyecto=${projectId}`)

  for (let i = 0; i < BUSQUEDAS.length; i++) {
    const { q, debe } = BUSQUEDAS[i]
    const resultado = await buscarEnCatalogoSemantico(q, {
      fuentesPermitidas: [...fuentes],
      topK: 5,
      minScore: 0.35,
    })
    const top3 = resultado.resultados.slice(0, 3)
    const textos = top3
      .map(({ item }) =>
        [item.titulo, item.metadata?.proveedorNombre, item.metadata?.categorias?.join(" ")]
          .filter(Boolean)
          .join(" ")
      )
      .join(" ")
    const ok = debe.test(textos)
    if (ok) aciertos++
    const topLabel = top3[0]?.item.titulo?.slice(0, 70) ?? "(vacío)"
    console.log(`${ok ? "OK" : "FAIL"} #${i + 1} "${q}" → ${topLabel}`)
  }

  console.log(`\nResultado: ${aciertos}/10 en top 3 (meta ≥8)`)
  process.exit(aciertos >= 8 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
