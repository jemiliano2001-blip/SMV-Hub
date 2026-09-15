'use client'

/**
 * Backfill de lead time numérico en cotizaciones (super-admin). Previsualiza → aplica; auditado y
 * repetible. Vive en la tab Mantenimiento junto a los otros backfills para tener un solo lugar.
 */

import { useMemo, useState } from 'react'
import { AlertCircle, Check, Clock, RefreshCw } from 'lucide-react'
import ModuleSurface from '@/components/layout/ModuleSurface'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'
import {
  aplicarBackfillLeadTime,
  previsualizarBackfillLeadTime,
  type PlanBackfillLeadTime,
} from '@/lib/cotizaciones-backfill-lead-time'

const ETIQUETA_DETALLE: Record<string, string> = {
  numero: 'número',
  rango: 'rango',
  semanas: 'semanas ×5',
  meses: 'meses ×20',
  horas: 'horas',
  stock: 'en stock (0)',
  moneda_formato: 'días con formato $',
  moneda: 'precio, no días',
  fecha: 'fecha',
  sin_stock: 'sin existencia',
  sin_numero: 'sin número',
  fuera_de_rango: 'más de un año',
}

export default function PanelBackfillLeadTime() {
  const confirmar = useConfirmDialog()
  const [plan, setPlan] = useState<PlanBackfillLeadTime | null>(null)
  const [cargando, setCargando] = useState(false)
  const [aplicando, setAplicando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [soloNulos, setSoloNulos] = useState(false)

  async function previsualizar() {
    setCargando(true)
    setError(null)
    setMensaje(null)
    try {
      setPlan(await previsualizarBackfillLeadTime())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo previsualizar.')
    } finally {
      setCargando(false)
    }
  }

  async function aplicar() {
    if (!plan || plan.cambios.length === 0) return
    const parseadas = plan.cambios.filter((c) => c.leadTimeMinDias !== null).length
    const ok = await confirmar({
      title: 'Guardar lead time en cotizaciones',
      description: `Se escribirá leadTimeMin/Max en ${plan.cambios.length} cotización(es): ${parseadas} con días calculados y ${plan.cambios.length - parseadas} en null explícito (texto que no se entiende). El texto original de "días hábiles" no se toca. Queda auditado.`,
      confirmLabel: 'Aplicar',
    })
    if (!ok) return
    setAplicando(true)
    setError(null)
    try {
      const r = await aplicarBackfillLeadTime()
      setMensaje(`Listo: ${r.parseadas} con días, ${r.nulas} en null explícito; ${r.yaCorrectos} ya estaban.`)
      await previsualizar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo aplicar.')
    } finally {
      setAplicando(false)
    }
  }

  const visibles = useMemo(() => {
    if (!plan) return []
    return soloNulos ? plan.cambios.filter((c) => c.leadTimeMinDias === null) : plan.cambios
  }, [plan, soloNulos])

  return (
    <ModuleSurface id="panel-backfill-lead-time" className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Lead time numérico en cotizaciones
          </h3>
          <p className="text-xs text-muted-foreground">
            Convierte el texto de &quot;días hábiles&quot; (&quot;3 - 4&quot;, &quot;2 semanas&quot;, &quot;stock&quot;) en días mínimos y
            máximos para que el recomendador y el comparador usen tiempos reales. Semanas ×5, meses ×20; lo que no se
            entiende queda en null con su motivo.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={cargando || aplicando} onClick={() => void previsualizar()}>
            <RefreshCw className={cargando ? 'animate-spin' : ''} /> {plan ? 'Volver a revisar' : 'Previsualizar'}
          </Button>
          <Button type="button" size="sm" disabled={!plan || plan.cambios.length === 0 || aplicando} onClick={() => void aplicar()}>
            <Check /> Aplicar {plan ? `(${plan.cambios.length})` : ''}
          </Button>
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}
      {mensaje && !error && <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-foreground">{mensaje}</p>}

      {plan && (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{plan.total} cotizaciones · {plan.conTexto} con texto de días</span>
            <span>· parseadas <span className="font-semibold text-foreground">{plan.parseadas}</span> ({plan.conTexto ? Math.round((plan.parseadas / plan.conTexto) * 100) : 0} %)</span>
            <span>· null explícito {plan.nulas}</span>
            <span>· por escribir <span className="font-semibold text-foreground">{plan.cambios.length}</span> · ya correctos {plan.yaCorrectos}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(plan.porDetalle)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => (
                <Badge key={k} variant="secondary" className="text-[10px]">
                  {ETIQUETA_DETALLE[k] ?? k}: {v}
                </Badge>
              ))}
          </div>
          {plan.cambios.length > 0 && (
            <>
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input type="checkbox" className="h-3.5 w-3.5 rounded border-input" checked={soloNulos} onChange={(e) => setSoloNulos(e.target.checked)} />
                Ver solo los que quedan en null (para revisar el texto original)
              </label>
              <div className="overflow-x-auto rounded-lg border border-border max-h-80">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-3 py-2">Texto de días hábiles</TableHead>
                      <TableHead className="px-3 py-2">Interpretación</TableHead>
                      <TableHead className="px-3 py-2 text-right">Min</TableHead>
                      <TableHead className="px-3 py-2 text-right">Max</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibles.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="px-3 py-1.5 text-xs font-mono text-foreground max-w-[320px]">
                          <span className="block truncate" title={c.diasHabiles}>{c.diasHabiles}</span>
                        </TableCell>
                        <TableCell className="px-3 py-1.5 text-xs">
                          <Badge variant={c.leadTimeMinDias === null ? 'outline' : 'secondary'} className="text-[10px]">
                            {ETIQUETA_DETALLE[c.detalle] ?? c.detalle}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-3 py-1.5 text-right font-mono text-xs">{c.leadTimeMinDias ?? '—'}</TableCell>
                        <TableCell className="px-3 py-1.5 text-right font-mono text-xs">{c.leadTimeMaxDias ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </>
      )}

      {!plan && !cargando && (
        <p className="text-xs text-muted-foreground">
          Pulsa <span className="font-semibold">Previsualizar</span> para ver cada texto con su interpretación. No cambia nada hasta aplicar.
        </p>
      )}
    </ModuleSurface>
  )
}
