/**
 * Lead time numérico a partir de `diasHabiles` (texto libre) — frente B, B3.
 *
 * `diasHabiles` se conserva tal cual lo escribe el usuario (es lo que dijo el proveedor); de aquí
 * salen `leadTimeMinDias` / `leadTimeMaxDias`, que son los que consumen el recomendador de
 * proveedores y la inteligencia cruzada. Reglas calibradas con los 110 valores distintos reales
 * de producción (docs/superpowers/plans/2026-09-13-estructura-datos-normalizacion.md, B0.3 y T3.0):
 *
 *   "5 dias", "1 dia", "3 dis habiles"        → 5–5 (número)
 *   "3 - 4", "20-30 dias", "7 a 8 dias"        → 3–4 (rango)
 *   "2 - 3 semanas", "17 semanas"              → ×5 días hábiles (decisión 2026-09-13)
 *   "1 mes", "1-2 meses"                       → ×20
 *   "24-48 hrs"                                → horas / 24, mínimo 1
 *   "stock", "entrega inmediata", "In Stock: 24 Can Ship Immediately", "10 piezas disponibles"
 *                                              → 0–0 (stock; el número es cantidad, no días)
 *   "$1,00", "$5,00", "$15,00"                 → 1, 5, 15: columna de días con formato de moneda
 *                                                en la hoja de origen (T3.0: cantidad × precio =
 *                                                total cuadra en todas esas filas; NO son precios)
 *   "$88.978,54", "precios 2026", "10 dlls"    → null (moneda: dinero o nota de precio)
 *   "18 diciembre - 5 enero", "Tue, Aug 25…"   → null (fecha: convertirla necesita la fecha base)
 *   "Sin stock", "Out of Stock", "agotado"     → null (sin stock: no hay entrega que estimar)
 *   "pte", "N/A", "No tienen", ""              → null (sin número)
 *   > 365 días                                  → null (fuera de rango)
 *
 * Determinista y puro: nada de IA. Se aplica al guardar (form, CSV, extracción IA) y en el
 * backfill; el input sigue siendo texto libre y el guardado nunca se bloquea por esto.
 */

export type TipoLeadTime = "numero" | "rango" | "semanas" | "meses" | "horas" | "stock" | "moneda_formato"

export type MotivoLeadTimeNulo = "moneda" | "fecha" | "sin_stock" | "sin_numero" | "fuera_de_rango"

export type LeadTimeParseado = {
  ok: true
  /** Días hábiles. */
  min: number
  max: number
  tipo: TipoLeadTime
}

export type LeadTimeNulo = {
  ok: false
  motivo: MotivoLeadTimeNulo
}

export type ResultadoLeadTime = LeadTimeParseado | LeadTimeNulo

const DIAS_HABILES_POR_SEMANA = 5
const DIAS_HABILES_POR_MES = 20
const MAX_DIAS = 365
/** "$N,00" solo se acepta como días si N es un lead time creíble; arriba de esto es dinero. */
const MAX_DIAS_FORMATO_MONEDA = 60

const MESES_Y_DIAS_SEMANA =
  /\b(ene(ro)?|feb(rero)?|mar(zo)?|abr(il)?|mayo|jun(io)?|jul(io)?|ago(sto)?|sep(t|tiembre)?|oct(ubre)?|nov(iembre)?|dic(iembre)?|jan|apr|aug|dec|lunes|martes|miercoles|jueves|viernes|sabado|domingo|mon|tue|wed|thu|fri|sat|sun)\b/
const UNIDAD_TIEMPO = /\b(dias?|dia|dis|semanas?|mes(es)?|hrs?|horas?)\b/
const SIN_STOCK = /\b(sin|out of|no hay|agotad\w*)\b.*\b(stock|stocl|existencia\w*|inventario)\b|\bagotad\w*\b|\bno tienen\b/
const STOCK = /\b(stock|stocl|inmediat\w*|immediately|disponibl\w*|existencia\w*|local)\b/
const MONEDA = /[$€]|\bdlls?\b|\busd\b|\bmxn\b|\bprecios?\b|\bpesos\b/
/** "$1,00" / "$15.00" / "$ 5,00": entero pequeño con dos decimales en cero. */
const MONEDA_FORMATO_DIAS = /^\$?\s*(\d{1,3})[.,]00$/

function normalizar(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

export function parsearDiasHabiles(raw: string | null | undefined): ResultadoLeadTime {
  const s = normalizar(raw ?? "")
  if (!s) return { ok: false, motivo: "sin_numero" }

  // Columna de días exportada con formato de moneda (T3.0). Va antes que la regla de moneda.
  const formatoMoneda = s.match(MONEDA_FORMATO_DIAS)
  if (formatoMoneda) {
    const dias = Number(formatoMoneda[1])
    if (dias > 0 && dias <= MAX_DIAS_FORMATO_MONEDA) return { ok: true, min: dias, max: dias, tipo: "moneda_formato" }
    return { ok: false, motivo: "moneda" }
  }

  const tieneUnidad = UNIDAD_TIEMPO.test(s)
  if (MONEDA.test(s) && !tieneUnidad) return { ok: false, motivo: "moneda" }
  if (MESES_Y_DIAS_SEMANA.test(s)) return { ok: false, motivo: "fecha" }
  if (SIN_STOCK.test(s)) return { ok: false, motivo: "sin_stock" }

  const esStock = STOCK.test(s)
  // "10 piezas disponibles", "In Stock: 24 Can Ship": el número es cantidad, no días.
  if (esStock && !tieneUnidad) return { ok: true, min: 0, max: 0, tipo: "stock" }

  // Cantidades disponibles no son días: "En stock (10 disponibles…) / Tiempo de fábrica: 4 semanas".
  const sinCantidades = s
    .replace(/\b\d+\s*(piezas?|pzas?|pz|unidades?|disponibles?)\b/g, " ")
    .replace(/\bin stock:?\s*\d+/g, " ")
  const nums = [...sinCantidades.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => Number(m[0].replace(",", ".")))
  if (nums.length === 0) return esStock ? { ok: true, min: 0, max: 0, tipo: "stock" } : { ok: false, motivo: "sin_numero" }

  let factor = 1
  let tipo: TipoLeadTime = nums.length >= 2 ? "rango" : "numero"
  if (/seman/.test(s)) {
    factor = DIAS_HABILES_POR_SEMANA
    tipo = "semanas"
  } else if (/\bmes(es)?\b/.test(s)) {
    factor = DIAS_HABILES_POR_MES
    tipo = "meses"
  } else if (/\b(hrs?|horas?)\b/.test(s) && !/\bdias?\b/.test(s)) {
    factor = 1 / 24
    tipo = "horas"
  }

  const a = nums[0]
  const b = nums.length >= 2 ? nums[1] : nums[0]
  if (Math.max(a, b) * factor > MAX_DIAS) return { ok: false, motivo: "fuera_de_rango" }

  let min = Math.max(0, Math.round(Math.min(a, b) * factor))
  let max = Math.max(min, Math.round(Math.max(a, b) * factor))
  if (tipo === "horas") {
    min = Math.max(1, min)
    max = Math.max(min, max)
  }
  return { ok: true, min, max, tipo }
}

/** Campos derivados listos para persistir junto a `diasHabiles`. */
export function leadTimeDesdeDiasHabiles(diasHabiles: string | null | undefined): {
  leadTimeMinDias: number | null
  leadTimeMaxDias: number | null
} {
  const r = parsearDiasHabiles(diasHabiles)
  return r.ok ? { leadTimeMinDias: r.min, leadTimeMaxDias: r.max } : { leadTimeMinDias: null, leadTimeMaxDias: null }
}

/** Texto corto para mostrar junto al input ("→ 10–15 días hábiles" / "no se entiende…"). */
export function describirLeadTime(diasHabiles: string | null | undefined): string | null {
  const s = (diasHabiles ?? "").trim()
  if (!s) return null
  const r = parsearDiasHabiles(s)
  if (!r.ok) {
    const motivos: Record<MotivoLeadTimeNulo, string> = {
      moneda: "parece un precio, no días",
      fecha: "es una fecha; escribe los días",
      sin_stock: "sin existencia: sin tiempo de entrega",
      sin_numero: "no se entiende; escribe un número de días",
      fuera_de_rango: "más de un año: revisa el valor",
    }
    return motivos[r.motivo]
  }
  if (r.tipo === "stock") return "en stock: 0 días"
  return r.min === r.max ? `${r.min} días hábiles` : `${r.min}–${r.max} días hábiles`
}

// ── Backfill (B3 · T3.5) ────────────────────────────────────────────────────

export type CambioLeadTime = {
  id: string
  diasHabiles: string
  leadTimeMinDias: number | null
  leadTimeMaxDias: number | null
  /** Por qué quedó así: tipo parseado o motivo del null. */
  detalle: TipoLeadTime | MotivoLeadTimeNulo
}

export type PlanBackfillLeadTime = {
  /** Solo documentos cuyo valor persistido difiere del calculado (idempotente). */
  cambios: CambioLeadTime[]
  total: number
  conTexto: number
  yaCorrectos: number
  parseadas: number
  nulas: number
  porDetalle: Record<string, number>
}

/**
 * Plan del backfill de lead time sobre cotizaciones: recalcula `leadTimeMin/MaxDias` desde
 * `diasHabiles` y propone escribir solo donde difiere. Los no parseables quedan explícitamente
 * en null (así "sin valor" significa "revisado y no se entiende", no "nunca procesado").
 */
export function planBackfillLeadTime(
  docs: Array<{ id: string; diasHabiles?: unknown; leadTimeMinDias?: unknown; leadTimeMaxDias?: unknown }>
): PlanBackfillLeadTime {
  const cambios: CambioLeadTime[] = []
  const porDetalle: Record<string, number> = {}
  let conTexto = 0
  let yaCorrectos = 0
  let parseadas = 0
  let nulas = 0
  for (const doc of docs) {
    const texto = typeof doc.diasHabiles === "string" ? doc.diasHabiles.trim() : ""
    if (!texto) continue
    conTexto++
    const r = parsearDiasHabiles(texto)
    const min = r.ok ? r.min : null
    const max = r.ok ? r.max : null
    const detalle = r.ok ? r.tipo : r.motivo
    porDetalle[detalle] = (porDetalle[detalle] ?? 0) + 1
    if (r.ok) parseadas++
    else nulas++
    const minActual = typeof doc.leadTimeMinDias === "number" ? doc.leadTimeMinDias : null
    const maxActual = typeof doc.leadTimeMaxDias === "number" ? doc.leadTimeMaxDias : null
    const yaTieneNullExplicito = !r.ok && "leadTimeMinDias" in doc && doc.leadTimeMinDias === null
    if (minActual === min && maxActual === max && (r.ok || yaTieneNullExplicito)) {
      yaCorrectos++
      continue
    }
    cambios.push({ id: doc.id, diasHabiles: texto, leadTimeMinDias: min, leadTimeMaxDias: max, detalle })
  }
  return { cambios, total: docs.length, conTexto, yaCorrectos, parseadas, nulas, porDetalle }
}
