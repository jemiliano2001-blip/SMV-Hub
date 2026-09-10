/**
 * Utilidades, catálogos frecuentes y cálculos en tiempo real para
 * la captura ultra-rápida de compras en SMV Hub (/nueva-compra y /ordenes).
 */

export interface EmpresaFrecuente {
  codigo: string
  nombre: string
  label: string
  esPropia?: boolean
  cuentaCargoDefault?: string
}

/**
 * Empresas frecuentes basadas en el análisis de órdenes reales de SMV Hub.
 * "SMV" representa compras para consumo propio / taller / stock interno.
 */
export const EMPRESAS_FRECUENTES: EmpresaFrecuente[] = [
  { codigo: 'SMV', nombre: 'SMV', label: 'SMV (Nosotros)', esPropia: true, cuentaCargoDefault: 'Stock' },
  { codigo: 'OHD', nombre: 'OHD', label: 'OHD' },
  { codigo: 'SUPRAJIT', nombre: 'SUPRAJIT', label: 'SUPRAJIT' },
  { codigo: 'SENSATA', nombre: 'SENSATA', label: 'SENSATA' },
  { codigo: 'AFX', nombre: 'AFX', label: 'AFX' },
  { codigo: 'SILTECH', nombre: 'SILTECH', label: 'SILTECH' },
  { codigo: 'FISHER', nombre: 'FISHER', label: 'FISHER' },
  { codigo: 'KOHLER', nombre: 'KOHLER', label: 'KOHLER' },
  { codigo: 'RGV', nombre: 'RGV', label: 'RGV' },
]

/**
 * Requisitores con mayor frecuencia histórica analizados en Firestore.
 * Normalizados en formato legible para inserción directa en 1 clic.
 */
export const REQUISITORES_FRECUENTES: string[] = [
  'Francisco',
  'Chava',
  'Oscar',
  'Pantoja',
  'Pablo',
  'Baez',
  'Antonio',
  'Emiliano',
  'Lorena',
  'Rogelio',
]

/** Cuentas de cargo rápidas recurrentes en el taller. */
export const CUENTAS_CARGO_RAPIDAS: string[] = [
  'Stock',
  'HERRAMIENTA',
  'PENDIENTE',
]

/**
 * Mapea el nombre del partner/cliente que viene de Odoo hacia el código de empresa
 * usado habitualmente en SMV (ej. 'SUPRAJIT MEXICO' -> 'SUPRAJIT').
 */
export function mapearPartnerAEmpresa(partnerName?: string | null): string {
  if (!partnerName) return ''
  const upper = partnerName.toUpperCase().trim()
  if (upper.includes('SUPRAJIT')) return 'SUPRAJIT'
  if (upper.includes('OHD') || upper.includes('OVERHEAD')) return 'OHD'
  if (upper.includes('SENSATA')) return 'SENSATA'
  if (upper.includes('AFX')) return 'AFX'
  if (upper.includes('SILTECH') || upper.includes('SILICONE')) return 'SILTECH'
  if (upper.includes('FISHER')) return 'FISHER'
  if (upper.includes('KOHLER')) return 'KOHLER'
  if (upper.includes('RGV')) return 'RGV'
  if (upper.includes('SMV') || upper.includes('VAZQUEZ') || upper.includes('VÁZQUEZ')) return 'SMV'
  return partnerName.trim()
}

/**
 * Extrae la orden de compra / PO del cliente desde un registro de orden de venta de Odoo.
 * En Odoo se almacena prioritariamente en `ordenCompra` (origin) o en `clientOrderRef`.
 */
export function extraerPoClienteDeSo(so?: {
  ordenCompra?: string | null
  clientOrderRef?: string | null
} | null): string {
  if (!so) return ''
  return (so.ordenCompra || so.clientOrderRef || '').trim()
}

/**
 * Convierte un valor de input (string, number o null) a un número válido o null si está vacío/inválido.
 */
export function aNumeroValido(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * Calcula el total de una partida: cantidad * precioUnitario, redondeado a 2 decimales.
 * Devuelve null si alguno de los valores no es un número finito positivo o cero.
 */
export function calcularTotalPartida(
  cantidad: unknown,
  precioUnitario: unknown
): number | null {
  const cant = aNumeroValido(cantidad)
  const pUnit = aNumeroValido(precioUnitario)
  if (cant === null || pUnit === null) return null
  return Number((cant * pUnit).toFixed(2))
}

/**
 * Calcula el subtotal de la factura sumando los totales de cada partida.
 * Si ninguna partida tiene total, devuelve null.
 */
export function calcularSubtotalFactura(
  partidas?: Array<{ total?: unknown }> | null
): number | null {
  if (!partidas || partidas.length === 0) return null
  let suma = 0
  let tieneAlMenosUno = false
  for (const p of partidas) {
    const t = aNumeroValido(p.total)
    if (t !== null) {
      suma += t
      tieneAlMenosUno = true
    }
  }
  return tieneAlMenosUno ? Number(suma.toFixed(2)) : null
}

/**
 * Calcula el total de la factura: subtotal + envío + impuestos.
 * Devuelve null si no hay subtotal ni cargos adicionales.
 */
export function calcularTotalFactura(
  subtotal: unknown,
  envio: unknown,
  impuestos: unknown
): number | null {
  const sub = aNumeroValido(subtotal)
  const env = aNumeroValido(envio) || 0
  const imp = aNumeroValido(impuestos) || 0

  if (sub === null && env === 0 && imp === 0) return null
  const base = sub ?? 0
  return Number((base + env + imp).toFixed(2))
}
