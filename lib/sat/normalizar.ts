const STOP_WORDS = new Set([
  "A",
  "AL",
  "CON",
  "DE",
  "DEL",
  "EL",
  "EN",
  "FOR",
  "LA",
  "LOS",
  "LAS",
  "OF",
  "OR",
  "PARA",
  "POR",
  "THE",
  "UN",
  "UNA",
  "Y",
])

export function normalizarTextoSat(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9/.\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function tokenizarTextoSat(value: string): string[] {
  return normalizarTextoSat(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOP_WORDS.has(token))
}

// ponytail: heurística simple (quita una "s" final), no gramática completa.
// Cubre el caso dominante en el catálogo (resorte/resortes, tornillo/tornillos,
// palabras terminadas en vocal+s). No cubre plurales en "-es" tras consonante
// (motor/motores) — ampliar aquí si aparece un caso real de eso.
export function stemPalabraSat(palabra: string): string {
  return palabra.length > 3 && palabra.endsWith("S") ? palabra.slice(0, -1) : palabra
}

/** Aplica stemPalabraSat a cada palabra de un texto ya normalizado (normalizarTextoSat). */
export function stemTextoSat(textoNormalizado: string): string {
  return textoNormalizado.split(" ").map(stemPalabraSat).join(" ")
}

export function normalizarClaveProdServ(value: string | null | undefined): string | null {
  if (!value) return null
  const soloDigitos = value.replace(/\D+/g, "")
  return /^\d{8}$/.test(soloDigitos) ? soloDigitos : null
}

export function esClaveProdServ(value: string | null | undefined): boolean {
  return normalizarClaveProdServ(value) !== null
}
