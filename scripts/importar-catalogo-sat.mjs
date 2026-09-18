import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"
import ExcelJS from "exceljs"

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

async function readWorkbookRows(inputPath) {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(inputPath)
  const worksheet = workbook.worksheets[0]
  if (!worksheet) {
    throw new Error("El archivo no contiene hojas para leer")
  }

  const rows = []
  const headers = []
  worksheet.eachRow((row, rowNumber) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : []
    if (rowNumber === 1) {
      values.forEach((v) => headers.push(String(v ?? "").trim()))
    } else {
      const obj = {}
      headers.forEach((h, idx) => {
        const val = values[idx]
        obj[h] = val !== undefined && val !== null ? String(val).trim() : ""
      })
      rows.push(obj)
    }
  })
  return rows
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
  const rows = await readWorkbookRows(absoluteInput)
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
