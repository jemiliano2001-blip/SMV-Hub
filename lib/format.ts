/** Formatea un monto en la moneda indicada usando el locale es-MX (regla de negocio). */
export function formatPrecio(
  monto: number | null | undefined,
  moneda: string = "USD"
): string {
  if (monto === null || monto === undefined) return "-"
  try {
    const abs = Math.abs(monto)
    const decimales = abs > 0 && abs < 1 ? 4 : 2
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: moneda,
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    }).format(monto)
  } catch {
    return `${moneda} ${monto.toFixed(2)}`
  }
}

export { formatPrecio as formatearMoneda }

/** Convierte una fecha YYYY-MM-DD a DD/MM/YYYY para mostrar al usuario. */
export function formatFecha(fecha: string | null | undefined): string {
  if (!fecha) return "-"
  const m = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : fecha
}

// Rango Unicode "Combining Diacritical Marks" (U+0300–U+036F), construido con
// fromCharCode para evitar ambigüedad de escape \u dentro del literal regex.
const DIACRITICOS = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  "g"
)

/** Minúsculas + sin diacríticos, para búsqueda de texto libre case/accent-insensitive. */
export function normalizar(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(DIACRITICOS, "")
}

/** YYYY-MM-DD en zona local del cliente (no UTC). */
export function fechaHoyLocal(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * Inverso de `fechaHoyLocal`: convierte YYYY-MM-DD a un Date a medianoche **local**.
 *
 * `new Date("2026-08-01")` interpreta el string como medianoche UTC, que en México
 * (UTC-6) cae el 31 de julio a las 18:00 — un día antes. Eso saca la orden del
 * reporte de su propio mes. Devuelve null si el string no tiene el formato esperado.
 */
export function parseFechaLocal(fecha: string | null | undefined): Date | null {
  if (!fecha) return null
  const m = fecha.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** HH:mm en zona local del cliente. */
export function horaAhoraLocal(date: Date = new Date()): string {
  const h = String(date.getHours()).padStart(2, "0")
  const m = String(date.getMinutes()).padStart(2, "0")
  return `${h}:${m}`
}

/** Texto informativo para la barra de captura de baños. */
export function formatIndicadorCapturaBano(date: Date = new Date()): string {
  const fecha = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)
  return `Hoy, ${fecha} — ${horaAhoraLocal(date)}`
}

/** Fecha y hora cortas en es-MX, para mostrar "quién y cuándo" en listas. */
export function formatFechaHoraCorta(date: Date): string {
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}
