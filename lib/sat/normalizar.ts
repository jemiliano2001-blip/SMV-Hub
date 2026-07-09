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

export function normalizarClaveProdServ(value: string | null | undefined): string | null {
  if (!value) return null
  const soloDigitos = value.replace(/\D+/g, "")
  return /^\d{8}$/.test(soloDigitos) ? soloDigitos : null
}

export function esClaveProdServ(value: string | null | undefined): boolean {
  return normalizarClaveProdServ(value) !== null
}
