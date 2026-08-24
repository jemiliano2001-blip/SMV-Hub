'use client'

import { TrendingUp } from 'lucide-react'
import {
  detectarTipoInsumo,
  parseAtributosMetal,
  resolverCategoriaProducto,
} from '@/lib/compras-odoo'
import { calcularRangoPreciosDesdeItems } from '@/lib/compras-odoo-store'
import type { CompraOdooItem } from '@/lib/schemas'
import { formatPrecio } from '@/lib/format'

type Props = {
  concepto: string
  items: CompraOdooItem[]
}

/**
 * Si el concepto de una cotización parece metal (u otro insumo con histórico),
 * muestra min / promedio / máx desde Odoo.
 */
export default function BandaRangoMetalConcepto({ concepto, items }: Props) {
  if (!concepto.trim() || items.length === 0) return null

  const cat = resolverCategoriaProducto({ descripcion: concepto })
  if (cat === 'otros') return null

  const metal = parseAtributosMetal(concepto)
  const tipo = metal.tipoMetal ?? detectarTipoInsumo(concepto, cat)
  if (!tipo) return null

  const rango = calcularRangoPreciosDesdeItems(items, {
    categoriaId: cat,
    tipo,
    medida: metal.medida,
  })
  if (rango.n === 0) return null

  const moneda = rango.moneda === 'USD' ? 'USD' : 'MXN'

  return (
    <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
      <span className="inline-flex items-center gap-1 font-bold text-emerald-800">
        <TrendingUp className="h-3.5 w-3.5" />
        Rango Odoo · {cat} · {tipo}
        {metal.medida ? ` · ${metal.medida}` : ''}
      </span>
      <span className="font-mono text-emerald-900">
        min {formatPrecio(rango.min, moneda)}
      </span>
      <span className="font-mono text-sky-900">
        avg {formatPrecio(rango.promedio, moneda)}
      </span>
      <span className="font-mono text-amber-900">
        max {formatPrecio(rango.max, moneda)}
      </span>
      <span className="text-muted-foreground font-mono">n={rango.n}</span>
    </div>
  )
}
