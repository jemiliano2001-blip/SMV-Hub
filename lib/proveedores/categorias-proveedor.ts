import type { CategoriaProveedor } from '@/lib/schemas'

export type CategoriaProveedorOpcion = {
  id: CategoriaProveedor | 'todas'
  etiqueta: string
}

/** Etiquetas centralizadas para categorías de proveedor (directorio USA/MX). */
export const CATEGORIAS_PROVEEDOR: CategoriaProveedorOpcion[] = [
  { id: 'endmills', etiqueta: 'Endmills (Cortadores)' },
  { id: 'insertos', etiqueta: 'Insertos de Torneado/Fresado' },
  { id: 'tooling', etiqueta: 'Tooling & Conos' },
  { id: 'consumibles', etiqueta: 'Consumibles Taller' },
  { id: 'otros', etiqueta: 'Otros / Misceláneo' },
]

export const CATEGORIAS_PROVEEDOR_FILTRO: CategoriaProveedorOpcion[] = [
  { id: 'todas', etiqueta: 'Todas las categorías' },
  ...CATEGORIAS_PROVEEDOR,
]

export function etiquetaCategoriaProveedor(id: CategoriaProveedor): string {
  return CATEGORIAS_PROVEEDOR.find((c) => c.id === id)?.etiqueta ?? id
}

/** Opciones para formularios (sin "todas"). */
export const CATEGORIAS_PROVEEDOR_FORM = CATEGORIAS_PROVEEDOR.map((c) => ({
  valor: c.id as CategoriaProveedor,
  etiqueta: c.etiqueta,
}))
