/**
 * Valida las búsquedas de prueba contra el índice real:
 *   - las 10 del spec 2026-08-17 (órdenes + proveedores), y
 *   - las 10 de cotizaciones del frente C (plan 2026-09-15, T0.3; criterio #3) con `--cotizaciones`.
 *
 *   npx tsx scripts/validar-busquedas-prueba.ts [projectId] [--cotizaciones]
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, "..")
const args = process.argv.slice(2)
const projectId = args.find((a) => !a.startsWith("--")) || "smv-brain"
const modoCotizaciones = args.includes("--cotizaciones")

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

/** Frente C · T0.3 (aprobadas el 2026-09-15): consultas en español sobre cotizaciones manuales. */
const BUSQUEDAS_COTIZACIONES: Array<{ q: string; debe: RegExp }> = [
  { q: "pistón neumático SMC", debe: /piston|pistón|smc|higoh|cdm2b/i },
  { q: "coroplast antiestático 4 mm", debe: /coroplast|esd/i },
  { q: "sensor de visión compacto Keyence", debe: /keyence|vision|visión/i },
  { q: "sensores de proximidad M5 Omron", debe: /proximidad|omron|m5/i },
  { q: "grasa Molykote BR-2", debe: /molykote|br-2|grasa/i },
  { q: "sello para compresor Husky", debe: /husky|seal|c603h/i },
  { q: "aspiradora GunVac Guardair", debe: /gunvac|guardair|aspiradora/i },
  { q: "adaptador Ethernet/IP Allen-Bradley 1734", debe: /1734|allen|bradley|ethernet/i },
  { q: "PTR de 4 pulgadas calibre 14", debe: /ptr|calibre/i },
  { q: "impresora 3D QIDI", debe: /qidi|impresora 3d/i },
]

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
      process.env[key] = value
    }
  }
}

async function main() {
  cargarEnvLocal()
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = projectId
  process.env.FIREBASE_PROJECT_ID = projectId

  const { buscarEnCatalogoSemantico } = await import("../lib/busqueda-semantica-catalogo")

  // Con --cotizaciones se busca SOLO en esa fuente: mide la calidad del índice nuevo, no si las
  // órdenes lo tapan en el ranking (el filtro por permisos hace lo mismo para un usuario de cotizaciones).
  const fuentes = modoCotizaciones ? (["cotizacion"] as const) : (["orden-item", "proveedor"] as const)
  const busquedas = modoCotizaciones ? BUSQUEDAS_COTIZACIONES : BUSQUEDAS
  let aciertos = 0

  console.log(`[validar] proyecto=${projectId} · fuentes=${fuentes.join(",")} · ${busquedas.length} búsquedas`)

  for (let i = 0; i < busquedas.length; i++) {
    const { q, debe } = busquedas[i]
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

  console.log(`\nResultado: ${aciertos}/${busquedas.length} en top 3 (meta ≥8)`)
  process.exit(aciertos >= 8 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
