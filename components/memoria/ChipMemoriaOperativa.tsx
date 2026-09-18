'use client'

import { useState } from 'react'
import {
  History,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Sparkles,
  Loader2,
  Building2,
  Calendar,
  Check,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { formatPrecio } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ContextoOperativo } from '@/lib/services/memoria-operativa'

export interface ChipMemoriaOperativaProps {
  contexto?: ContextoOperativo | null
  cargando?: boolean
  verPrecios?: boolean
  onAplicarSugerencia?: (contexto: ContextoOperativo) => void
  className?: string
}

export default function ChipMemoriaOperativa({
  contexto,
  cargando = false,
  verPrecios = false,
  onAplicarSugerencia,
  className,
}: ChipMemoriaOperativaProps) {
  const [abierto, setAbierto] = useState(false)

  if (cargando) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-[11px] text-muted-foreground animate-pulse py-0.5',
          className
        )}
      >
        <Loader2 className="size-3 animate-spin text-primary" />
        <span>Consultando historial…</span>
      </span>
    )
  }

  if (!contexto) return null

  const tieneExactos = contexto.totalExactos > 0
  const tieneParecidos = contexto.totalParecidos > 0
  const tieneFamilia = Boolean(contexto.familiaComprada)

  if (!tieneExactos && !tieneParecidos && !tieneFamilia) {
    return null
  }

  const compras = contexto.comprasPrevias || []
  const cotizaciones = contexto.cotizacionesPrevias || []
  const ultimaReferencia = compras[0] || cotizaciones[0]

  const totalVeces = tieneExactos
    ? contexto.totalExactos
    : contexto.familiaComprada?.veces || contexto.totalParecidos

  const alerta = contexto.alertaPrecio

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors cursor-pointer text-left',
            alerta?.tipo === 'caro'
              ? 'bg-destructive/10 text-destructive border-destructive/25 hover:bg-destructive/15'
              : tieneExactos
                ? 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/15'
                : 'bg-muted/70 text-muted-foreground border-border hover:bg-muted',
            className
          )}
          title="Ver historial de compras y cotizaciones previas"
        >
          {alerta?.tipo === 'caro' ? (
            <AlertTriangle className="size-3 shrink-0 text-destructive" />
          ) : tieneExactos ? (
            <History className="size-3 shrink-0 text-primary" />
          ) : (
            <Sparkles className="size-3 shrink-0 text-amber-500" />
          )}

          <span className="truncate font-semibold">
            {tieneExactos
              ? `Comprado antes (${totalVeces}x)`
              : tieneFamilia
                ? `Familia: ${contexto.familiaComprada?.proveedorNombre} (${totalVeces}x)`
                : `Parecido (${totalVeces}x)`}
          </span>

          {verPrecios && ultimaReferencia?.precioUnitario != null && (
            <span className="font-mono text-[10px] opacity-90 hidden sm:inline">
              · {formatPrecio(ultimaReferencia.precioUnitario, ultimaReferencia.moneda || 'USD')}
            </span>
          )}

          {ultimaReferencia?.proveedorNombre && (
            <span className="opacity-80 truncate max-w-[100px] hidden md:inline">
              · {ultimaReferencia.proveedorNombre}
            </span>
          )}

          {alerta && alerta.tipo === 'caro' && (
            <span className="flex items-center text-[10px] font-bold text-destructive ml-0.5">
              <TrendingUp className="size-3 mr-0.5" />
              Más caro
            </span>
          )}

          {alerta && alerta.tipo === 'mejor_que_historico' && (
            <span className="flex items-center text-[10px] font-bold text-emerald-600 ml-0.5">
              <TrendingDown className="size-3 mr-0.5" />
              Mejor precio
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-80 sm:w-96 p-3 space-y-3 bg-card border-border text-card-foreground shadow-xl rounded-xl z-50">
        <div className="flex items-start justify-between gap-2 pb-2 border-b border-border">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-foreground">
              <History className="size-3.5 text-primary" />
              <span>Memoria Operativa</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {tieneExactos
                ? `Coincidencia exacta con ${contexto.totalExactos} registro(s) previo(s)`
                : `Sugerencia basada en productos de la misma familia`}
            </p>
          </div>

          {contexto.claveSatValidada && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-muted-foreground font-mono">
              SAT {contexto.claveSatValidada.claveProdServ}
            </Badge>
          )}
        </div>

        {/* Alerta de precio si existe */}
        {alerta && (
          <div
            className={cn(
              'p-2 rounded-lg text-xs flex items-start gap-2 border',
              alerta.tipo === 'caro'
                ? 'bg-destructive/10 border-destructive/20 text-destructive'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
            )}
          >
            {alerta.tipo === 'caro' ? (
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            ) : (
              <TrendingDown className="size-4 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5 text-[11px]">
              <p className="font-semibold">
                {alerta.tipo === 'caro' ? 'Precio superior al histórico' : 'Precio menor al histórico'}
              </p>
              <p className="opacity-90">{alerta.mensaje}</p>
            </div>
          </div>
        )}

        {/* Lista de compras previas */}
        {compras.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Compras anteriores ({compras.length})
            </span>
            <div className="max-h-36 overflow-y-auto space-y-1 rounded-lg border border-border bg-muted/30 p-1.5 text-xs divide-y divide-border/60">
              {compras.slice(0, 5).map((c, i) => (
                <div key={c.refId || i} className="pt-1.5 first:pt-0 pb-1.5 last:pb-0 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 font-medium text-foreground truncate">
                      <Building2 className="size-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{c.proveedorNombre || 'Proveedor'}</span>
                    </div>
                    {c.fecha && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="size-2.5" />
                        {c.fecha}
                      </span>
                    )}
                  </div>

                  {verPrecios && c.precioUnitario != null && (
                    <span className="font-mono font-bold text-foreground text-[11px] shrink-0">
                      {formatPrecio(c.precioUnitario, c.moneda || 'USD')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista de cotizaciones previas */}
        {cotizaciones.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Cotizaciones en archivo ({cotizaciones.length})
            </span>
            <div className="max-h-28 overflow-y-auto space-y-1 rounded-lg border border-border bg-muted/30 p-1.5 text-xs divide-y divide-border/60">
              {cotizaciones.slice(0, 3).map((cot, i) => (
                <div key={cot.refId || i} className="pt-1 first:pt-0 pb-1 last:pb-0 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-foreground truncate">
                    {cot.proveedorNombre || 'Cotización'}
                  </span>
                  {verPrecios && cot.precioUnitario != null && (
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                      {formatPrecio(cot.precioUnitario, cot.moneda || 'USD')}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Botón de acción para aplicar sugerencia si fue provisto */}
        {onAplicarSugerencia && (
          <div className="pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                onAplicarSugerencia(contexto)
                setAbierto(false)
              }}
              className="w-full h-8 text-xs font-semibold gap-1.5 border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
            >
              <Check className="size-3.5" />
              <span>Aplicar datos sugeridos</span>
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
