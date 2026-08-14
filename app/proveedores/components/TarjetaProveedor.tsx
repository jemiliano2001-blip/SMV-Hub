'use client'

import {
  Star,
  Clock,
  ChevronRight,
  Edit2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Proveedor } from '@/lib/schemas'

interface TarjetaProveedorProps {
  proveedor: Proveedor
  onSelect: (proveedor: Proveedor) => void
  onEdit: (proveedor: Proveedor) => void
  esPrimario?: boolean
  esBackup?: boolean
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

  return (
    <div
      className={`group relative rounded-2xl border transition-all duration-200 hover:shadow-md flex flex-col justify-between overflow-hidden bg-white ${
        esPremium
          ? 'border-purple-200 hover:border-purple-400'
          : esBarato
          ? 'border-amber-200 hover:border-amber-400'
          : 'border-slate-200 hover:border-[#0369A1]'
      }`}
    >
      {/* Indicador superior de Tier y badges */}
      <div className="p-5 pb-3 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Badge
            variant="outline"
            className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full ${
              esPremium
                ? 'border-purple-300 text-purple-800 bg-purple-50'
                : esBarato
                ? 'border-amber-300 text-amber-800 bg-amber-50'
                : 'border-sky-300 text-[#0369A1] bg-sky-50'
            }`}
          >
            {esPremium ? '⭐ Premium Performance' : esBarato ? '⚡ Económico ($ Barato)' : '📦 Estándar ($)'}
          </Badge>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <span>{proveedor.pais === 'Estados Unidos' ? '🇺🇸 USA' : '🇲🇽 MX'}</span>
            {typeof proveedor.ordenesOdoo === 'number' && proveedor.ordenesOdoo >= 1 && (
              <Badge
                variant="outline"
                className="border-sky-200 bg-sky-50 text-sky-800 text-[9px] font-extrabold px-2 py-0"
              >
                {proveedor.ordenesOdoo} compras Odoo
              </Badge>
            )}
            {esPrimario && (
              <Badge className="bg-emerald-600 text-white text-[9px] uppercase font-extrabold px-2 py-0">
                Primario
              </Badge>
            )}
            {esBackup && (
              <Badge className="bg-indigo-600 text-white text-[9px] uppercase font-extrabold px-2 py-0">
                Backup
              </Badge>
            )}
          </div>
        </div>

        {/* Nombre & Subtítulo */}
        <div>
          <h3
            onClick={() => onSelect(proveedor)}
            className="text-base font-extrabold text-slate-900 group-hover:text-[#0369A1] transition-colors cursor-pointer flex items-center justify-between"
          >
            <span className="line-clamp-1">{proveedor.nombre}</span>
            <ChevronRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          </h3>
          {proveedor.contacto && (
            <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
              Atención: <span className="font-medium text-slate-700">{proveedor.contacto}</span>
            </p>
          )}
        </div>

        {/* Marcas representadas */}
        <div className="flex flex-wrap gap-1 pt-1">
          {proveedor.marcas && proveedor.marcas.length > 0 ? (
            proveedor.marcas.slice(0, 3).map((m, idx) => (
              <span
                key={idx}
                className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200/80"
              >
                {m}
              </span>
            ))
          ) : (
            <span className="text-[10px] text-slate-400 italic">Distribuidores multimarca</span>
          )}
          {proveedor.marcas && proveedor.marcas.length > 3 && (
            <span className="text-[10px] text-slate-400 font-bold">+{proveedor.marcas.length - 3}</span>
          )}
        </div>
      </div>

      {/* Footer de la tarjeta con lead time, calificacion y acciones */}
      <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 font-bold text-amber-500">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>{proveedor.calificacion || 5}.0</span>
          </div>

          <div className="flex items-center gap-1 text-slate-500">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{proveedor.leadTimeDias || '3-5'}d</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(proveedor)}
            className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
            title="Editar proveedor"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onSelect(proveedor)}
            className="h-8 px-2.5 text-xs font-bold text-[#0369A1] border-sky-200 bg-sky-50/50 hover:bg-sky-100/80"
          >
            Ficha Detalle
          </Button>
        </div>
      </div>
    </div>
  )
}
