export const DIAS_SEMANA = [
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
  "lunes",
  "martes",
] as const

export type DiaSemana = (typeof DIAS_SEMANA)[number]

export type ParsedHoras = { valor: number; advertencia: boolean }

const DIA_POR_JS: Record<number, DiaSemana> = {
  3: "miercoles",
  4: "jueves",
  5: "viernes",
  6: "sabado",
  0: "domingo",
  1: "lunes",
  2: "martes",
}

const ETIQUETAS_DIA: Record<DiaSemana, string> = {
  miercoles: "Mié",
  jueves: "Jue",
  viernes: "Vie",
  sabado: "Sáb",
  domingo: "Dom",
  lunes: "Lun",
  martes: "Mar",
}

export function etiquetaDia(dia: DiaSemana): string {
  return ETIQUETAS_DIA[dia]
}

export function getMiercolesSemana(fecha: Date): Date {
  const d = new Date(fecha)
  const day = d.getDay()
  const diff = d.getDate() - day + (day < 3 ? -4 : 3)
  return new Date(d.setDate(diff))
}

export function formatSemanaISO(fecha: Date): string {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, "0")
  const dia = String(fecha.getDate()).padStart(2, "0")
  return `${anio}-${mes}-${dia}`
}

export function getSemanaActualISO(): string {
  return formatSemanaISO(getMiercolesSemana(new Date()))
}

export function offsetSemana(semanaInicio: string, deltaSemanas: number): string {
  const d = new Date(`${semanaInicio}T12:00:00`)
  d.setDate(d.getDate() + deltaSemanas * 7)
  return formatSemanaISO(d)
}

export function esSemanaActual(semanaInicio: string): boolean {
  return semanaInicio === getSemanaActualISO()
}

export function getDiaSemanaActual(fecha: Date = new Date()): DiaSemana {
  return DIA_POR_JS[fecha.getDay()]
}

export function parseHorasConEstado(str: string | null): ParsedHoras {
  if (!str || !str.trim()) return { valor: 0, advertencia: false }
  const normalized = str.toLowerCase().trim()
  if (
    normalized === "vacaciones" ||
    normalized === "vac" ||
    normalized === "permiso" ||
    normalized === "-"
  ) {
    return { valor: 0, advertencia: false }
  }

  if (normalized.includes(" ")) {
    const parts = normalized.split(" ")
    const h = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10)
    if (isNaN(h) && isNaN(m)) return { valor: 0, advertencia: true }
    return { valor: (h || 0) + (m || 0) / 60, advertencia: false }
  }

  if (/[a-záéíóú]/i.test(normalized)) {
    return { valor: 0, advertencia: true }
  }

  const num = parseFloat(normalized)
  return isNaN(num) ? { valor: 0, advertencia: true } : { valor: num, advertencia: false }
}

export function parseHoras(str: string | null): number {
  return parseHorasConEstado(str).valor
}

export type CamposDia = Pick<
  import("@/lib/schemas").HorasExtra,
  DiaSemana
>

export function calcularTotalHoras(
  dias: Partial<Record<DiaSemana, string | null>>
): number {
  return DIAS_SEMANA.reduce((sum, dia) => sum + parseHoras(dias[dia] ?? null), 0)
}

/** Valor persistible: sin horas capturadas se representa como null, no como un total anterior. */
export function calcularTotalHorasPersistible(
  dias: Partial<Record<DiaSemana, string | null>>
): number | null {
  const total = calcularTotalHoras(dias)
  return total > 0 ? total : null
}

export function registroTieneHoras(
  dias: Partial<Record<DiaSemana, string | null>>
): boolean {
  return DIAS_SEMANA.some((dia) => {
    const v = dias[dia]
    return v != null && v.trim() !== ""
  })
}

export function estadoCelda(valor: string | null): "pendiente" | "capturado" | "vacaciones" {
  if (!valor || !valor.trim()) return "pendiente"
  const n = valor.toLowerCase().trim()
  if (n === "vacaciones" || n === "vac" || n === "permiso") return "vacaciones"
  return "capturado"
}

export function intensidadHeatmap(horas: number): string {
  if (horas <= 0) return ""
  if (horas <= 2) return "bg-sky-50"
  if (horas <= 4) return "bg-sky-100"
  if (horas <= 6) return "bg-sky-200"
  return "bg-sky-300"
}

export const CHIPS_RAPIDOS = [
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "4", value: "4" },
  { label: "½", value: "0.5" },
  { label: "Vac", value: "vacaciones" },
  { label: "Permiso", value: "permiso" },
] as const
