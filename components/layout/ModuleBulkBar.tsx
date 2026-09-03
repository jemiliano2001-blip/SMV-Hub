'use client'

import type { ReactNode } from 'react'
import { X, Layers } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ModuleBulkBarProps {
  /** Número de elementos seleccionados actualmente */
  selectedCount: number
  /** Número total de elementos disponibles (opcional) */
  totalCount?: number
  /** Función para deseleccionar todos los elementos */
  onClearSelection: () => void
  /** Botones de acción específicos del módulo (ej. Aprobar, Exportar, etc.) */
  actions: ReactNode
  className?: string
}

/**
 * Barra flotante inferior de acciones en lote (Bulk Actions Bar).
 * Aparece suavemente cuando el usuario selecciona 1 o más elementos mediante casillas.
 */
export default function ModuleBulkBar({
  selectedCount,
  totalCount,
  onClearSelection,
  actions,
  className,
}: ModuleBulkBarProps) {
  if (selectedCount <= 0) return null

  return (
    <aside
      aria-label="Acciones en lote para elementos seleccionados"
      className={cn(
        'fixed bottom-6 inset-x-0 mx-auto z-40 flex w-fit max-w-[95vw] items-center gap-3',
        'rounded-2xl border border-border/80 bg-card/95 p-2 px-3.5 shadow-2xl backdrop-blur-md',
        'animate-in fade-in slide-in-from-bottom-4 duration-200',
        'print:hidden',
        className
      )}
    >
      {/* Indicador de selección */}
      <div className="flex items-center gap-2 pr-2 border-r border-border/70">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Layers className="size-4" />
        </div>
        <div className="flex items-center gap-1.5">
          <Badge
            variant="default"
            className="bg-primary text-primary-foreground font-mono text-xs px-2 py-0.5 rounded-full"
          >
            {selectedCount}
          </Badge>
          <span className="text-xs font-semibold text-foreground hidden sm:inline">
            {selectedCount === 1 ? 'seleccionado' : 'seleccionados'}
          </span>
          {totalCount !== undefined && totalCount > 0 && (
            <span className="text-[11px] text-muted-foreground hidden md:inline">
              de {totalCount}
            </span>
          )}
        </div>
      </div>

      {/* Botones de acción específicos */}
      <div className="flex flex-wrap items-center gap-1.5">{actions}</div>

      {/* Botón de limpiar selección */}
      <div className="pl-1 border-l border-border/70">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/80 gap-1 rounded-lg cursor-pointer"
          title="Deseleccionar todos (Esc)"
        >
          <X className="size-3.5" />
          <span className="hidden sm:inline">Deseleccionar</span>
        </Button>
      </div>
    </aside>
  )
}
