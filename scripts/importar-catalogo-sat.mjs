import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import * as XLSX from "xlsx"

const ROOT = process.cwd()
const OUTPUT_PATH = path.join(ROOT, "data", "sat", "catalogo.json")

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9/.\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function tokenize(value) {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
}

function ensureEightDigits(value) {
  const digits = String(value ?? "").replace(/\D+/g, "")
  return /^\d{8}$/.test(digits) ? digits : null
}

function readWorkbookRows(inputPath) {
  const workbook = XLSX.readFile(inputPath, { cellDates: false })
  const [firstSheetName] = workbook.SheetNames
  if (!firstSheetName) {
    throw new Error("El archivo no contiene hojas para leer")
  }

  return XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], {
    defval: "",
    raw: false,
  })
}

function detectField(row, candidates) {
  for (const candidate of candidates) {
    const value = row[candidate]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return ""
}

function mapRow(row) {
  const clave = ensureEightDigits(
    detectField(row, ["c_ClaveProdServ", "ClaveProdServ", "Clave", "clave", "Codigo", "Código"])
  )
  const descripcion = detectField(row, ["Descripción", "Descripcion", "descripcion", "Nombre", "nombre"])
  if (!clave || !descripcion) return null

  const division = detectField(row, ["División", "Division", "division"])
  const grupo = detectField(row, ["Grupo", "grupo"])
  const clase = detectField(row, ["Clase", "clase"])
  const tipo = detectField(row, ["Tipo", "tipo"])

  return {
    clave,
    descripcion,
    tipo: tipo || null,
    division: division || null,
    grupo: grupo || null,
    clase: clase || null,
    palabrasClave: Array.from(
      new Set([
        ...tokenize(descripcion),
        ...tokenize([division, grupo, clase].filter(Boolean).join(" ")),
      ])
    ),
  }
}

async function main() {
  const inputPath = process.argv[2]
  if (!inputPath) {
    throw new Error("Uso: node scripts/importar-catalogo-sat.mjs <ruta-al-archivo-xlsx>")
  }

  const absoluteInput = path.resolve(ROOT, inputPath)
  const rows = readWorkbookRows(absoluteInput)
  const entries = rows.map(mapRow).filter(Boolean)

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
  await fs.writeFile(
    OUTPUT_PATH,
    JSON.stringify(
      {
        version: path.basename(absoluteInput),
        updatedAtUtc: new Date().toISOString(),
        entries,
      },
      null,
      2
    ) + "\n",
    "utf8"
  )

  console.log(`SAT_IMPORT_OK entries=${entries.length} output=${OUTPUT_PATH}`)
}

main().catch((error) => {
  console.error(`SAT_IMPORT_ERROR ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
