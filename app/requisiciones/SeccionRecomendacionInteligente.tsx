'use client'

import { useMemo, useState } from 'react'
import {
  Award,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  RefreshCw,
  Settings2,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Slider } from '@/components/ui/slider'
import {
  CONFIGURACION_PESOS_DEFAULT,
  evaluarYRecomendarProveedores,
  type ConfiguracionPesosRecomendador,
  type OfertaParaEvaluacion,
} from '@/lib/motor-recomendador-proveedores'
import type { CompraProveedor, EvaluacionProveedor, Proveedor } from '@/lib/schemas'
import { TIPO_CAMBIO_DEFAULT_USD_MXN } from '@/lib/tipo-cambio'
import { cn } from '@/lib/utils'

interface Props {
  ofertas: OfertaParaEvaluacion[]
  proveedoresCatalogo?: Proveedor[]
  evaluacionesHistoricas?: EvaluacionProveedor[]
  comprasHistoricas?: CompraProveedor[]
  onSeleccionarProveedor?: (provId: string, provNombre: string, razon: string) => void
  tipoCambioUsdMxn?: number
  confiabilidadPorProveedor?: Record<string, number>
}

function etiquetaModo(modo: string) {
  if (modo === 'primera_compra') return 'Primera compra'
  if (modo === 'recompra') return 'Recompra histórica'
  return 'Personalizado'
}

export default function SeccionRecomendacionInteligente({
  ofertas,
  proveedoresCatalogo = [],
  evaluacionesHistoricas = [],
  comprasHistoricas = [],
  onSeleccionarProveedor,
  tipoCambioUsdMxn = TIPO_CAMBIO_DEFAULT_USD_MXN,
  confiabilidadPorProveedor = {},
}: Props) {
  const [pesos, setPesos] = useState<ConfiguracionPesosRecomendador>(CONFIGURACION_PESOS_DEFAULT)
  const [mostrarConfigPesos, setMostrarConfigPesos] = useState(false)
  const [mostrarDesgloseDetallado, setMostrarDesgloseDetallado] = useState(false)

  const resultado = useMemo(
    () =>
      evaluarYRecomendarProveedores(
        ofertas,
        proveedoresCatalogo,
        evaluacionesHistoricas,
        comprasHistoricas,
        pesos,
        tipoCambioUsdMxn,
        confiabilidadPorProveedor
      ),
    [
      ofertas,
      proveedoresCatalogo,
      evaluacionesHistoricas,
      comprasHistoricas,
      pesos,
      tipoCambioUsdMxn,
      confiabilidadPorProveedor,
    ]
  )

  const { proveedorRecomendado, modoEvaluacion, explicacionModo } = resultado

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-amber-600">
            <Sparkles className="size-5" aria-hidden />
          </div>
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold tracking-tight text-foreground">
              Motor de recomendación
              <Badge
                variant="outline"
                className={cn(
                  'px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase',
                  modoEvaluacion === 'primera_compra' && 'border-sky-200 bg-sky-50 text-sky-800',
                  modoEvaluacion === 'recompra' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
                  modoEvaluacion !== 'primera_compra' &&
                    modoEvaluacion !== 'recompra' &&
                    'border-amber-200 bg-amber-50 text-amber-800'
                )}
              >
                {modoEvaluacion === 'recompra' ? (
                  <RefreshCw className="mr-1 inline size-3" aria-hidden />
                ) : modoEvaluacion === 'primera_compra' ? null : (
                  <Settings2 className="mr-1 inline size-3" aria-hidden />
                )}
                {etiquetaModo(modoEvaluacion)}
              </Badge>
            </h3>
            <p className="mt-0.5 text-xs font-medium text-muted-foreground">{explicacionModo}</p>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={() => setMostrarConfigPesos(!mostrarConfigPesos)}>
          <SlidersHorizontal data-icon="inline-start" />
          {mostrarConfigPesos ? 'Ocultar pesos' : 'Ajustar pesos'}
        </Button>
      </div>

      {mostrarConfigPesos ? (
        <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/30 p-5 text-xs">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <span className="flex items-center gap-2 text-xs font-bold text-foreground">
              <SlidersHorizontal className="size-4 text-primary" aria-hidden />
              Configuración de ponderación
            </span>
            <button
              type="button"
              onClick={() => {
                setPesos(CONFIGURACION_PESOS_DEFAULT)
                toast.info('Pesos restablecidos a valores por defecto.')
              }}
              className="cursor-pointer text-[11px] font-mono text-muted-foreground underline hover:text-foreground"
            >
              Restablecer
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ['Precio cotizado', 'pesoPrecio', 10, 50] as const,
                ['Lead time de entrega', 'pesoLeadTime', 10, 40] as const,
                ['Calidad de herramienta', 'pesoCalidad', 10, 40] as const,
                ['Cumplimiento de entregas', 'pesoCumplimiento', 5, 30] as const,
                ['Comunicación y respuesta', 'pesoComunicacion', 5, 25] as const,
                ['Historial comprobado', 'pesoHistorial', 0, 20] as const,
              ] as const
            ).map(([label, key, min, max]) => (
              <div key={key} className="flex flex-col gap-2">
                <div className="flex justify-between font-semibold text-foreground">
                  <span>{label}</span>
                  <span className="font-mono text-primary">{(pesos[key] * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[pesos[key] * 100]}
                  min={min}
                  max={max}
                  step={5}
                  onValueChange={(val) => setPesos((prev) => ({ ...prev, [key]: val[0] / 100 }))}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {proveedorRecomendado && !proveedorRecomendado.esInformacionInsuficiente ? (
        <div className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Badge className="flex items-center gap-1.5 bg-emerald-600 text-white">
                <Award className="size-4" aria-hidden />
                Recomendado
              </Badge>
              <h4 className="text-base font-bold text-foreground">{proveedorRecomendado.proveedorNombre}</h4>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-mono font-bold text-muted-foreground">Score total:</span>
              <span className="rounded-xl border border-emerald-200 bg-white px-3.5 py-1 font-mono text-lg font-bold text-emerald-700">
                {proveedorRecomendado.scoreTotal} / 100
              </span>
            </div>
          </div>

          <p className="flex items-start gap-2 rounded-xl border border-border bg-card p-3.5 text-xs leading-relaxed text-muted-foreground">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <span>
              <strong className="text-foreground">Razón principal:</strong>{' '}
              {proveedorRecomendado.razonRecomendacion}
            </span>
          </p>

          <div className="flex flex-col gap-3 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Desglose por criterio
              </span>
              <button
                type="button"
                onClick={() => setMostrarDesgloseDetallado(!mostrarDesgloseDetallado)}
                className="flex cursor-pointer items-center gap-1 text-[11px] font-bold text-primary hover:underline"
              >
                {mostrarDesgloseDetallado ? 'Ocultar barras' : 'Ver barras'}
                {mostrarDesgloseDetallado ? (
                  <ChevronUp className="size-3" aria-hidden />
                ) : (
                  <ChevronDown className="size-3" aria-hidden />
                )}
              </button>
            </div>

            {mostrarDesgloseDetallado ? (
              <div className="grid grid-cols-1 gap-3.5 pt-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
                {(
                  [
                    ['Precio', proveedorRecomendado.desglose.scorePrecio, pesos.pesoPrecio] as const,
                    ['Lead time', proveedorRecomendado.desglose.scoreLeadTime, pesos.pesoLeadTime] as const,
                    ['Calidad', proveedorRecomendado.desglose.scoreCalidad, pesos.pesoCalidad] as const,
                  ] as const
                ).map(([label, score, peso]) => (
                  <div key={label} className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>
                        {label} ({(peso * 100).toFixed(0)}%)
                      </span>
                      <span className="font-mono font-bold text-foreground">{score}/100</span>
                    </div>
                    <Progress value={score} className="h-1.5" />
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {onSeleccionarProveedor ? (
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              onClick={() => {
                onSeleccionarProveedor(
                  proveedorRecomendado.proveedorId,
                  proveedorRecomendado.proveedorNombre,
                  proveedorRecomendado.razonRecomendacion
                )
                toast.success('Proveedor seleccionado', {
                  description: `Se eligió a ${proveedorRecomendado.proveedorNombre}.`,
                })
              }}
            >
              <Award data-icon="inline-start" />
              Aceptar recomendación ({proveedorRecomendado.proveedorNombre})
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
