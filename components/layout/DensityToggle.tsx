'use client'

import { Rows3, Rows2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { DensidadTabla } from '@/lib/hooks/useTablaDensidad'
import { cn } from '@/lib/utils'

export interface DensityToggleProps {
  densidad: DensidadTabla
  onToggle: () => void
  className?: string
}

/**
 * Botón conmutador de densidad de tabla (Compacta / Cómoda).
 * Permite al usuario alternar entre alta densidad de información o mayor espaciado táctil.
 */
export default function DensityToggle({
  densidad,
  onToggle,
  className,
}: DensityToggleProps) {
  const esCompacta = densidad === 'compacta'

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onToggle}
      className={cn(
        'h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5 rounded-lg cursor-pointer border-border',
        className
      )}
      title={
        esCompacta
          ? 'Densidad actual: Compacta. Clic para cambiar a Cómoda.'
          : 'Densidad actual: Cómoda. Clic para cambiar a Compacta.'
      }
      aria-label="Alternar densidad visual de la tabla"
    >
      {esCompacta ? (
        <Rows3 className="size-3.5 text-primary" />
      ) : (
        <Rows2 className="size-3.5 text-sky-600" />
      )}
      <span className="hidden md:inline capitalize">{densidad}</span>
    </Button>
  )
}
