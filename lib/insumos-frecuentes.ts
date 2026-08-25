/**
 * Catálogo estructurado de insumos frecuentes y herramientas de corte para taller.
 * Permite autocompletar y seleccionar con 1-toque en la captura móvil de pedidos de almacén.
 */

export interface InsumoFrecuente {
  id: string
  nombre: string
  categoria: 'corte' | 'consumibles' | 'ferreteria'
  icono?: string
  sugerenciaCantidad?: string
}

export interface CategoriaInsumos {
  id: 'corte' | 'consumibles' | 'ferreteria'
  label: string
  icono: string
  items: InsumoFrecuente[]
}

export const INSUMOS_FRECUENTES: InsumoFrecuente[] = [
  // ── Herramientas de Corte ──────────────────────────────────────────
  { id: 'apmt-1135', nombre: 'Insertos APMT 1135', categoria: 'corte', sugerenciaCantidad: '10 pzas' },
  { id: 'apmt-1604', nombre: 'Insertos APMT 1604', categoria: 'corte', sugerenciaCantidad: '10 pzas' },
  { id: 'cortador-1-2-4f', nombre: 'Cortador 1/2" 4F', categoria: 'corte', sugerenciaCantidad: '2 pzas' },
  { id: 'cortador-3-8-4f', nombre: 'Cortador 3/8" 4F', categoria: 'corte', sugerenciaCantidad: '2 pzas' },
  { id: 'cortador-1-4-4f', nombre: 'Cortador 1/4" 4F', categoria: 'corte', sugerenciaCantidad: '2 pzas' },
  { id: 'disco-corte-4-1-2', nombre: 'Discos de corte 4 1/2"', categoria: 'corte', sugerenciaCantidad: '5 pzas' },
  { id: 'machuelo-1-4-20', nombre: 'Machuelo 1/4-20', categoria: 'corte', sugerenciaCantidad: '2 pzas' },
  { id: 'machuelo-5-16-18', nombre: 'Machuelo 5/16-18', categoria: 'corte', sugerenciaCantidad: '2 pzas' },
  { id: 'machuelo-3-8-16', nombre: 'Machuelo 3/8-16', categoria: 'corte', sugerenciaCantidad: '2 pzas' },
  { id: 'broca-centro-3', nombre: 'Broca de centro #3', categoria: 'corte', sugerenciaCantidad: '2 pzas' },
  { id: 'broca-1-4', nombre: 'Broca 1/4" HSS', categoria: 'corte', sugerenciaCantidad: '2 pzas' },

  // ── Consumibles de Taller ──────────────────────────────────────────
  { id: 'guantes-nitrilo-m', nombre: 'Guantes nitrilo M', categoria: 'consumibles', sugerenciaCantidad: '1 caja' },
  { id: 'guantes-nitrilo-l', nombre: 'Guantes nitrilo L', categoria: 'consumibles', sugerenciaCantidad: '1 caja' },
  { id: 'refrigerante-soluble', nombre: 'Soluble / Refrigerante', categoria: 'consumibles', sugerenciaCantidad: '1 tambo' },
  { id: 'trapos-industriales', nombre: 'Trapos industriales', categoria: 'consumibles', sugerenciaCantidad: '10 kg' },
  { id: 'lija-agua-240', nombre: 'Lija de agua #240', categoria: 'consumibles', sugerenciaCantidad: '5 pliegos' },
  { id: 'lija-agua-400', nombre: 'Lija de agua #400', categoria: 'consumibles', sugerenciaCantidad: '5 pliegos' },
  { id: 'cinta-teflon', nombre: 'Cinta teflón', categoria: 'consumibles', sugerenciaCantidad: '3 rollos' },
  { id: 'wd40', nombre: 'Aflojatodo WD-40', categoria: 'consumibles', sugerenciaCantidad: '1 lata' },
  { id: 'limpiador-frenos', nombre: 'Brake Cleaner / Desengrasante', categoria: 'consumibles', sugerenciaCantidad: '2 botes' },

  // ── Ferretería / Tornillería ───────────────────────────────────────
  { id: 'tornillo-shcs-1-4-20-1', nombre: 'Tornillo SHCS 1/4-20 x 1"', categoria: 'ferreteria', sugerenciaCantidad: '10 pzas' },
  { id: 'tornillo-shcs-5-16-18-1', nombre: 'Tornillo SHCS 5/16-18 x 1"', categoria: 'ferreteria', sugerenciaCantidad: '10 pzas' },
  { id: 'tornillo-shcs-3-8-16-1-1-2', nombre: 'Tornillo SHCS 3/8-16 x 1 1/2"', categoria: 'ferreteria', sugerenciaCantidad: '10 pzas' },
  { id: 'llave-allen-5-32', nombre: 'Llave Allen 5/32"', categoria: 'ferreteria', sugerenciaCantidad: '1 pza' },
  { id: 'llave-allen-3-16', nombre: 'Llave Allen 3/16"', categoria: 'ferreteria', sugerenciaCantidad: '1 pza' },
  { id: 'aceite-guias-68', nombre: 'Aceite de guías ISO 68', categoria: 'ferreteria', sugerenciaCantidad: '1 garrafa' },
]

export const CATEGORIAS_INSUMOS: CategoriaInsumos[] = [
  {
    id: 'corte',
    label: 'Herramientas de Corte',
    icono: 'Scissors',
    items: INSUMOS_FRECUENTES.filter((i) => i.categoria === 'corte'),
  },
  {
    id: 'consumibles',
    label: 'Consumibles Taller',
    icono: 'PackageCheck',
    items: INSUMOS_FRECUENTES.filter((i) => i.categoria === 'consumibles'),
  },
  {
    id: 'ferreteria',
    label: 'Tornillería & Herramienta',
    icono: 'Wrench',
    items: INSUMOS_FRECUENTES.filter((i) => i.categoria === 'ferreteria'),
  },
]

/**
 * Agrega o combina un insumo frecuente en la descripción actual del pedido.
 */
export function agregarInsumoADescripcion(descripcionActual: string, insumo: InsumoFrecuente): string {
  const textoLimpio = descripcionActual.trim()
  if (!textoLimpio) {
    return insumo.sugerenciaCantidad ? `${insumo.nombre} (${insumo.sugerenciaCantidad})` : insumo.nombre
  }
  // Si ya contiene el nombre exacto, no duplicar
  if (textoLimpio.toLowerCase().includes(insumo.nombre.toLowerCase())) {
    return textoLimpio
  }
  const agregado = insumo.sugerenciaCantidad ? `${insumo.nombre} (${insumo.sugerenciaCantidad})` : insumo.nombre
  return `${textoLimpio}, ${agregado}`
}
