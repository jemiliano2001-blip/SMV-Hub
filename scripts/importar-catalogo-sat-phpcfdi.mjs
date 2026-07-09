import fs from "node:fs/promises"
import path from "node:path"
import process from "node:process"

const ROOT = process.cwd()
const OUTPUT_PATH = path.join(ROOT, "data", "sat", "catalogo.json")
const DEFAULT_SQL_URL =
  "https://raw.githubusercontent.com/phpcfdi/resources-sat-catalogs/master/database/data/cfdi_40_productos_servicios.sql"
const DEFAULT_VERSION_URL =
  "https://raw.githubusercontent.com/phpcfdi/resources-sat-catalogs/master/database/version.txt"

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

/** Parsea VALUES('a',1,'b',...) de un INSERT SQLite. */
function parseSqlValues(raw) {
  const values = []
  let i = 0

  while (i < raw.length) {
    while (i < raw.length && (raw[i] === " " || raw[i] === ",")) i++
    if (i >= raw.length) break

    if (raw[i] === "'") {
      i++
      let value = ""
      while (i < raw.length) {
        if (raw[i] === "'" && raw[i + 1] === "'") {
          value += "'"
          i += 2
          continue
        }
        if (raw[i] === "'") {
          i++
          break
        }
        value += raw[i++]
      }
      values.push(value)
      continue
    }

    const start = i
    while (i < raw.length && raw[i] !== ",") i++
    values.push(raw.slice(start, i).trim())
  }

  return values
}

function inferHierarchy(clave) {
  if (!/^\d{8}$/.test(clave)) {
    return { tipo: null, division: null, grupo: null, clase: null }
  }

  const divisionCode = clave.slice(0, 2)
  const grupoCode = clave.slice(2, 4)
  const claseCode = clave.slice(4, 6)

  return {
    tipo: divisionCode.startsWith("8") || divisionCode.startsWith("9") ? "Servicios" : "Productos",
    division: `${divisionCode}000000`,
    grupo: `${clave.slice(0, 4)}0000`,
    clase: `${clave.slice(0, 6)}00`,
  }
}

function isVigente(vigenciaDesde, vigenciaHasta, today) {
  if (vigenciaDesde && vigenciaDesde > today) return false
  if (vigenciaHasta && vigenciaHasta < today) return false
  return true
}

function mapSqlRow(values) {
  const [clave, descripcion, , , , vigenciaDesde, vigenciaHasta] = values
  if (!/^\d{8}$/.test(clave) || !descripcion?.trim()) return null

  const hierarchy = inferHierarchy(clave)

  return {
    clave,
    descripcion: descripcion.trim(),
    tipo: hierarchy.tipo,
    division: hierarchy.division,
    grupo: hierarchy.grupo,
    clase: hierarchy.clase,
    palabrasClave: tokenize(descripcion),
    vigenciaDesde: vigenciaDesde || null,
    vigenciaHasta: vigenciaHasta || null,
  }
}

async function resolveInputSql(inputArg) {
  if (inputArg) {
    return fs.readFile(path.resolve(ROOT, inputArg), "utf8")
  }

  const response = await fetch(DEFAULT_SQL_URL)
  if (!response.ok) {
    throw new Error(`No se pudo descargar el catálogo (${response.status})`)
  }
  return response.text()
}

async function resolveVersion() {
  try {
    const response = await fetch(DEFAULT_VERSION_URL)
    if (!response.ok) return "phpcfdi-resources-sat-catalogs"
    return (await response.text()).trim()
  } catch {
    return "phpcfdi-resources-sat-catalogs"
  }
}

async function main() {
  const inputArg = process.argv[2]
  const [sqlText, version] = await Promise.all([resolveInputSql(inputArg), resolveVersion()])
  const today = new Date().toISOString().slice(0, 10)

  const entries = []
  const lines = sqlText.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith("INSERT INTO cfdi_40_productos_servicios VALUES(")) continue

    const valuesRaw = trimmed.slice("INSERT INTO cfdi_40_productos_servicios VALUES(".length, -2)
    const values = parseSqlValues(valuesRaw)
    const mapped = mapSqlRow(values)
    if (!mapped) continue
    if (!isVigente(mapped.vigenciaDesde, mapped.vigenciaHasta, today)) continue

    const { vigenciaDesde: _d, vigenciaHasta: _h, ...entry } = mapped
    entries.push(entry)
  }

  entries.sort((a, b) => a.clave.localeCompare(b.clave))

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
  await fs.writeFile(
    OUTPUT_PATH,
    JSON.stringify(
      {
        version: `phpcfdi-${version}`,
        updatedAtUtc: new Date().toISOString(),
        source: inputArg ? path.basename(inputArg) : DEFAULT_SQL_URL,
        entries,
      },
      null,
      0
    ) + "\n",
    "utf8"
  )

  console.log(`SAT_IMPORT_OK entries=${entries.length} output=${OUTPUT_PATH}`)
}

main().catch((error) => {
  console.error(`SAT_IMPORT_ERROR ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
