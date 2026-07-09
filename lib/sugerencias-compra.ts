import type { ItemFactura, OrdenCompra } from "@/lib/schemas"
import { resolverCampoItem } from "@/lib/schemas"

// Campos por ítem que se pueden sugerir desde el historial.
export type CampoSugerible = "empresa" | "cuentaCargo" | "requisitor"

const CAMPOS: CampoSugerible[] = ["empresa", "cuentaCargo", "requisitor"]

// Default de dominio: las herramientas de taller suelen ir a SMV / Stock.
const EMPRESA_HERRAMIENTA = "SMV"
const CUENTA_HERRAMIENTA = "Stock"

/** Línea histórica aplanada (1 por ítem) con campos ya resueltos item→orden. */
export type ItemHistorico = {
  descripcion: string
  proveedor: string
  empresa: string
  cuentaCargo: string
  requisitor: string
  creadoEn: Date
}

const PALABRAS_HERRAMIENTA = [
  "reamer", "drill", "tap", "end mill", "endmill", "mill", "insert", "carbide",
  "holder", "collet", "chuck", "wrench", "gauge", "caliper", "micrometer",
  "deburr", "countersink", "counterbore", "boring", "tooling",
  "broca", "machuelo", "macho", "fresa", "rima", "escariador", "cortador",
  "buril", "herramienta", "calibrador", "micrometro", "calibre", "inserto",
  "boquilla", "llave", "desbarbador",
]

const PALABRAS_NO_HERRAMIENTA = [
  "tornillo", "screw", "bolt", "nut", "tuerca", "washer", "rondana", "arandela",
  "cable", "guante", "glove", "papel", "label", "etiqueta", "cleaner",
  "limpiador", "aceite", "oil", "grasa", "grease", "lija", "sandpaper",
]

const PROVEEDORES_HERRAMIENTA = ["mcmaster", "grainger", "msc", "travers"]

const STOPWORDS = new Set([
  "the", "de", "la", "el", "los", "las", "con", "para", "por", "and", "of",
  "for", "x", "in", "mm",
])

/** Minúsculas, sin acentos, espacios colapsados. */
export function normalizarTexto(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

/** Tokens significativos (≥3 chars, sin stopwords) para medir overlap. */
export function tokenizarDescripcion(s: string): string[] {
  return normalizarTexto(s)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
}

/** Heurística: ¿el ítem parece una herramienta de taller? */
export function esProbableHerramienta(descripcion: string, proveedor = ""): boolean {
  const d = normalizarTexto(descripcion)
  if (!d) return false
  if (PALABRAS_NO_HERRAMIENTA.some((p) => d.includes(p))) return false
  if (PALABRAS_HERRAMIENTA.some((p) => d.includes(p))) return true
  const prov = normalizarTexto(proveedor)
  return Boolean(prov) && PROVEEDORES_HERRAMIENTA.some((p) => prov.includes(p))
}

/** Aplana órdenes históricas a una línea por ítem, resolviendo item→orden legacy. */
export function aplanarHistorial(ordenes: OrdenCompra[]): ItemHistorico[] {
  const items: ItemHistorico[] = []
  for (const orden of ordenes) {
    const creadoEn = orden.creadoEn instanceof Date ? orden.creadoEn : new Date(orden.creadoEn)
    for (const item of orden.items) {
      items.push({
        descripcion: item.descripcion ?? "",
        proveedor: orden.proveedor ?? "",
        empresa: resolverCampoItem(item, orden, "empresa"),
        cuentaCargo: resolverCampoItem(item, orden, "cuentaCargo"),
        requisitor: resolverCampoItem(item, orden, "requisitor"),
        creadoEn,
      })
    }
  }
  return items
}

function valorCampo(r: ItemHistorico, campo: CampoSugerible): string {
  return (r[campo] ?? "").trim()
}

function overlapTokens(a: string[], setB: Set<string>): number {
  let n = 0
  for (const t of new Set(a)) if (setB.has(t)) n++
  return n
}

type Pesado = { registro: ItemHistorico; peso: number }

/** Valor más frecuente (ponderado), desempate por recencia. Ignora vacíos. */
function modaPesada(pesados: Pesado[], campo: CampoSugerible): string {
  const acc = new Map<string, { peso: number; reciente: number }>()
  for (const { registro, peso } of pesados) {
    const v = valorCampo(registro, campo)
    if (!v || peso <= 0) continue
    const t = registro.creadoEn.getTime()
    const prev = acc.get(v)
    if (prev) {
      prev.peso += peso
      if (t > prev.reciente) prev.reciente = t
    } else {
      acc.set(v, { peso, reciente: t })
    }
  }

  let mejor = ""
  let mejorPeso = 0
  let mejorReciente = 0
  for (const [v, info] of acc) {
    if (info.peso > mejorPeso || (info.peso === mejorPeso && info.reciente > mejorReciente)) {
      mejor = v
      mejorPeso = info.peso
      mejorReciente = info.reciente
    }
  }
  return mejor
}

type ContextoItem = {
  descNorm: string
  tokens: string[]
  provNorm: string
  esHerramienta: boolean
}

function sugerirCampo(
  campo: CampoSugerible,
  ctx: ContextoItem,
  historial: ItemHistorico[]
): string {
  const mismoProveedor = ctx.provNorm
    ? historial.filter((r) => normalizarTexto(r.proveedor) === ctx.provNorm)
    : []

  // 1. Misma descripción + mismo proveedor → registro más reciente.
  if (ctx.descNorm) {
    const exactos = mismoProveedor
      .filter((r) => normalizarTexto(r.descripcion) === ctx.descNorm && valorCampo(r, campo))
      .sort((a, b) => b.creadoEn.getTime() - a.creadoEn.getTime())
    if (exactos[0]) return valorCampo(exactos[0], campo)
  }

  // 2. Overlap de tokens + mismo proveedor → moda ponderada por overlap.
  if (ctx.tokens.length > 0 && mismoProveedor.length > 0) {
    const tokensCtx = new Set(ctx.tokens)
    const conOverlap: Pesado[] = mismoProveedor
      .map((registro) => ({
        registro,
        peso: overlapTokens(tokenizarDescripcion(registro.descripcion), tokensCtx),
      }))
      .filter((x) => x.peso > 0)
    const v = modaPesada(conOverlap, campo)
    if (v) return v
  }

  // 3. Mismo proveedor → moda del campo.
  if (mismoProveedor.length > 0) {
    const v = modaPesada(mismoProveedor.map((registro) => ({ registro, peso: 1 })), campo)
    if (v) return v
  }

  // 4. Herramienta → default SMV / Stock; requisitor por moda en compras de Stock.
  if (ctx.esHerramienta) {
    if (campo === "empresa") return EMPRESA_HERRAMIENTA
    if (campo === "cuentaCargo") return CUENTA_HERRAMIENTA
    const deStock = historial.filter(
      (r) =>
        normalizarTexto(r.empresa) === normalizarTexto(EMPRESA_HERRAMIENTA) &&
        normalizarTexto(r.cuentaCargo) === normalizarTexto(CUENTA_HERRAMIENTA)
    )
    const v = modaPesada(deStock.map((registro) => ({ registro, peso: 1 })), campo)
    if (v) return v
  }

  // 5. Global → moda del campo en todo el historial.
  return modaPesada(historial.map((registro) => ({ registro, peso: 1 })), campo)
}

/**
 * Completa empresa/cuentaCargo/requisitor de un ítem usando el historial.
 * Respeta lo que ya venga lleno (p. ej. lo extraído por IA); solo sugiere vacíos.
 */
export function completarCamposItem(
  item: {
    descripcion?: string
    empresa?: string
    cuentaCargo?: string
    requisitor?: string
  },
  proveedor: string,
  historial: ItemHistorico[]
): Pick<ItemFactura, "empresa" | "cuentaCargo" | "requisitor"> {
  const resultado: Record<CampoSugerible, string> = {
    empresa: item.empresa ?? "",
    cuentaCargo: item.cuentaCargo ?? "",
    requisitor: item.requisitor ?? "",
  }

  const ctx: ContextoItem = {
    descNorm: normalizarTexto(item.descripcion ?? ""),
    tokens: tokenizarDescripcion(item.descripcion ?? ""),
    provNorm: normalizarTexto(proveedor ?? ""),
    esHerramienta: esProbableHerramienta(item.descripcion ?? "", proveedor ?? ""),
  }

  for (const campo of CAMPOS) {
    if (resultado[campo].trim()) continue
    const sugerencia = sugerirCampo(campo, ctx, historial)
    if (sugerencia) resultado[campo] = sugerencia
  }

  return resultado
}
