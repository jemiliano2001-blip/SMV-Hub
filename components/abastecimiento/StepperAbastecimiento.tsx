'use client'

import Link from 'next/link'
import { CheckCircle2, Clock, CircleDot, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PasoAbastecimiento } from '@/lib/abastecimiento'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface StepperAbastecimientoProps {
  pasos: PasoAbastecimiento[]
  className?: string
  compacto?: boolean
}

export default function StepperAbastecimiento({
  pasos,
  className,
  compacto = false,
}: StepperAbastecimientoProps) {
  if (!pasos || pasos.length === 0) return null

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn('flex items-center gap-1.5', className)}>
        {pasos.map((paso, index) => {
          const esUltimo = index === pasos.length - 1

          const icono =
            paso.estado === 'completo' ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            ) : paso.estado === 'actual' ? (
              <CircleDot className="h-3.5 w-3.5 text-amber-500 animate-pulse shrink-0" />
            ) : (
              <Clock className="h-3.5 w-3.5 text-zinc-500 shrink-0 opacity-50" />
            )

          const estiloBadge =
            paso.estado === 'completo'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
              : paso.estado === 'actual'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20 font-medium'
                : 'bg-zinc-800/40 text-zinc-500 border-zinc-700/30 opacity-60'

          const contenidoPill = (
            <div
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border transition-colors select-none',
                estiloBadge,
                paso.href && 'cursor-pointer'
              )}
            >
              {icono}
              {!compacto && <span className="truncate max-w-[110px]">{paso.titulo}</span>}
            </div>
          )

          return (
            <div key={paso.id} className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  {paso.href ? (
                    <Link href={paso.href}>{contenidoPill}</Link>
                  ) : (
                    <div>{contenidoPill}</div>
                  )}
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs bg-zinc-900 border-zinc-700 text-zinc-100 p-2 max-w-xs shadow-xl">
                  <p className="font-semibold">{paso.titulo}</p>
                  <p className="text-zinc-400 mt-0.5">{paso.detalle}</p>
                  {paso.href && (
                    <p className="text-[10px] text-amber-400/80 mt-1 font-mono">
                      Clic para ir a {paso.href}
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>

              {!esUltimo && (
                <ChevronRight className="h-3 w-3 text-zinc-600 shrink-0 opacity-40" />
              )}
            </div>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
