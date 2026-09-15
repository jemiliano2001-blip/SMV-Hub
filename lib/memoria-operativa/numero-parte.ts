/**
 * Números de parte embebidos en una descripción de factura o cotización.
 *
 * Hallazgo de C0 (plan 2026-09-15): el coseno no separa "misma pieza" de "misma familia" — un
 * resorte 9657K266 y uno 9657K493 puntúan igual que dos descripciones idénticas. Lo que sí los
 * separa es el número de parte, que casi siempre viene pegado en la descripción aunque
 * `ItemFactura` no tenga campo para él (McMaster 9657K266, DigiKey 1866-1030-ND, Murr
 * 7700-44711-S7V1500, Omron V680S-D2KF68M, Allen-Bradley 140M-C2E-C20).
 *
 * Regla probada en seco sobre las 40 muestras del golden: tokens alfanuméricos de ≥ 6 caracteres
 * con al menos una letra y un dígito, sin unidades ("120VAC", "4-pole", "22AWG"), dimensiones
 * ("30X47X6"), listados de eBay (9+ dígitos entre paréntesis), tracking UPS ("1Z…"), referencias
 * de venta ("S01251") ni la cola "your reference …" de McMaster. Se comparan sin guiones y en
 * mayúsculas.
 */

import { normalizarNumeroParte } from "@/lib/pieza-matching"

const UNIDAD =
  /^\d+(?:\.\d+)?(?:V|VDC|VAC|W|KW|A|MA|MM|MM2|CM|M|FT|IN|OZ|LB|LBS|KG|G|AWG|PCS|PC|HZ|HP|RPM|PSI|BAR|GRIT|K|X|POLE|POLES|PIN|PINS|WAY|PACK|PK|FL|FLUTE|FLUTES|GA|GAUGE|TPI|DEG|AMP|AMPS|PH|PHASE|WIRE|CORE|MTS|PZAS|PZA|UNIDADES|PIEZAS|PIECE|PIECES)$/i
const DIMENSION = /^\d+(?:\.\d+)?X\d+(?:\.\d+)?(?:X\d+(?:\.\d+)?)?(?:MM|CM|IN)?$/i
const TRACKING_UPS = /^1Z[0-9A-Z]{16}$/i
const REFERENCIA_VENTA = /^S0\d{4,}$/i
/** Prefijos genéricos cortos que llevan dígitos pero no identifican una pieza (Cat5e, RJ45, IP67, M12). */
const PREFIJO_GENERICO = /^(?:CAT\d|RJ\d|IP\d|M\d{1,2})/i
const LISTADO_EBAY = /\(\d{9,}\)/g
const COLA_REFERENCIA = /\byour reference\b/i
/** Token con letra y dígito, ≥ 6 caracteres, guiones internos permitidos. */
const TOKEN = /(?<![A-Za-z0-9])(?=[A-Za-z0-9-]*\d)(?=[A-Za-z0-9-]*[A-Za-z])[A-Za-z0-9][A-Za-z0-9-]{5,}(?![A-Za-z0-9])/g

function esRuido(token: string): boolean {
  if (token.length < 6) return true
  if (UNIDAD.test(token)) return true
  if (DIMENSION.test(token)) return true
  if (TRACKING_UPS.test(token)) return true
  if (REFERENCIA_VENTA.test(token)) return true
  if (PREFIJO_GENERICO.test(token) && token.length <= 6) return true
  return false
}

/** Números de parte embebidos, normalizados (mayúsculas, solo [A-Z0-9]), únicos y en orden de aparición. */
export function extraerNumerosParte(descripcion: string | null | undefined): string[] {
  if (!descripcion) return []
  const limpio = descripcion.replace(LISTADO_EBAY, " ").split(COLA_REFERENCIA)[0]
  const vistos = new Set<string>()
  const resultado: string[] = []
  for (const crudo of limpio.match(TOKEN) ?? []) {
    const token = crudo.replace(/^-+|-+$/g, "").replace(/[^A-Za-z0-9]/g, "")
    if (esRuido(token)) continue
    const norm = token.toUpperCase()
    if (vistos.has(norm)) continue
    vistos.add(norm)
    resultado.push(norm)
  }
  return resultado
}

/**
 * Números de parte de una pieza: el explícito (si lo hay) más los embebidos en la descripción.
 * El explícito va primero para que `compararNumerosParte` lo considere aunque la descripción
 * traiga otros tokens.
 */
export function numerosParteDePieza(numeroParte: string | null | undefined, descripcion: string): string[] {
  const explicito = normalizarNumeroParte(numeroParte)
  const embebidos = extraerNumerosParte(descripcion)
  if (!explicito) return embebidos
  return [explicito, ...embebidos.filter((n) => n !== explicito)]
}

export type ComparacionNumerosParte = "igual" | "distinto" | "indeterminado"

/**
 * igual → comparten al menos un número de parte (misma pieza);
 * distinto → ambos tienen números y ninguno coincide (hermanos de familia);
 * indeterminado → alguno no trae número: decide la llave o el coseno.
 */
export function compararNumerosParte(a: readonly string[], b: readonly string[]): ComparacionNumerosParte {
  if (a.length === 0 || b.length === 0) return "indeterminado"
  const setB = new Set(b)
  for (const n of a) if (setB.has(n)) return "igual"
  return "distinto"
}
