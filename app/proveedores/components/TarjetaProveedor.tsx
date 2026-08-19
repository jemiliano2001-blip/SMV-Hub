'use client'

import {
  ChevronRight,
  Clock,
  Edit2,
  Package,
  Star,
  Zap,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Proveedor } from '@/lib/schemas'
import { cn } from '@/lib/utils'

interface TarjetaProveedorProps {
  proveedor: Proveedor
  onSelect: (proveedor: Proveedor) => void
  onEdit: (proveedor: Proveedor) => void
  esPrimario?: boolean
  esBackup?: boolean
}

function etiquetaTipo(tipo: Proveedor['tipoProveedor']) {
  if (tipo === 'premium') {
    return { label: 'Premium', icon: Star, className: 'border-purple-300 text-purple-800 bg-purple-50' }
  }
  if (tipo === 'barato') {
    return { label: 'Económico', icon: Zap, className: 'border-amber-300 text-amber-800 bg-amber-50' }
  }
  return { label: 'Estándar', icon: Package, className: 'border-sky-300 text-primary bg-sky-50' }
}

export default function TarjetaProveedor({
  proveedor,
  onSelect,
  onEdit,
  esPrimario = false,
  esBackup = false,
}: TarjetaProveedorProps) {
  const esPremium = proveedor.tipoProveedor === 'premium'
  const esBarato = proveedor.tipoProveedor === 'barato'
  const tipo = etiquetaTipo(proveedor.tipoProveedor)
  const TipoIcon = tipo.icon

  return (
    <div
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-card transition-all duration-200 hover:shadow-md',
        esPremium
          ? 'border-purple-200 hover:border-purple-400'
          : esBarato
            ? 'border-amber-200 hover:border-amber-400'
            : 'border-border hover:border-primary'
      )}
    >
      <div className="flex flex-col gap-3 p-5 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant="outline" className={cn('rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider', tipo.className)}>
            <TipoIcon className="mr-1 inline size-3" aria-hidden />
            {tipo.label}
          </Badge>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">
              {proveedor.pais === 'Estados Unidos' ? 'USA' : 'MX'}
            </Badge>
            {typeof proveedor.ordenesOdoo === 'number' && proveedor.ordenesOdoo >= 1 && (
              <Badge variant="outline" className="border-sky-200 bg-sky-50 text-[9px] text-sky-800">
                {proveedor.ordenesOdoo} compras Odoo
              </Badge>
            )}
            {esPrimario ? (
              <Badge className="bg-emerald-600 text-[9px] uppercase text-white">Primario</Badge>
            ) : null}
            {esBackup ? (
              <Badge className="bg-indigo-600 text-[9px] uppercase text-white">Backup</Badge>
            ) : null}
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={() => onSelect(proveedor)}
            className="flex w-full cursor-pointer items-center justify-between text-left text-base font-bold text-foreground transition-colors group-hover:text-primary"
          >
            <span className="line-clamp-1">{proveedor.nombre}</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
          {proveedor.contacto ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              Atención: <span className="font-medium text-foreground">{proveedor.contacto}</span>
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1 pt-1">
          {proveedor.marcas && proveedor.marcas.length > 0 ? (
            proveedor.marcas.slice(0, 3).map((marca) => (
              <span
                key={marca}
                className="rounded border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground"
              >
                {marca}
              </span>
            ))
          ) : (
            <span className="text-[10px] italic text-muted-foreground">Distribuidores multimarca</span>
          )}
          {proveedor.marcas && proveedor.marcas.length > 3 ? (
            <span className="text-[10px] font-bold text-muted-foreground">+{proveedor.marcas.length - 3}</span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border bg-muted/50 px-5 py-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 font-bold text-amber-500">
            <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
            <span>{proveedor.calificacion || 5}.0</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="size-3.5" aria-hidden />
            <span>{proveedor.leadTimeDias || '3-5'}d</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onEdit(proveedor)}
            title="Editar proveedor"
          >
            <Edit2 aria-hidden />
          </Button>
          <Button variant="outline" size="sm" onClick={() => onSelect(proveedor)}>
            Ficha detalle
          </Button>
        </div>
      </div>
    </div>
  )
}
