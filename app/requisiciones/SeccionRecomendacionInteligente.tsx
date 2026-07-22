/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · tone: utilitario-premium · scope: motor-recomendador */
'use client'

import { useState, useMemo } from 'react'
import {
  Sparkles,
  Award,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import type { Proveedor, EvaluacionProveedor, CompraProveedor } from '@/lib/schemas'
import {
  evaluarYRecomendarProveedores,
  CONFIGURACION_PESOS_DEFAULT,
  type OfertaParaEvaluacion,
  type ConfiguracionPesosRecomendador,
} from '@/lib/motor-recomendador-proveedores'
import { TIPO_CAMBIO_DEFAULT_USD_MXN } from '@/lib/tipo-cambio'

interface Props {
  ofertas: OfertaParaEvaluacion[]
  proveedoresCatalogo?: Proveedor[]
  evaluacionesHistoricas?: EvaluacionProveedor[]
  comprasHistoricas?: CompraProveedor[]
  onSeleccionarProveedor?: (provId: string, provNombre: string, razon: string) => void
  /** MXN por 1 USD (configurable). */
  tipoCambioUsdMxn?: number
  /** Score de confiabilidad lead-time por proveedorId (1–5). */
  confiabilidadPorProveedor?: Record<string, number>
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

  // Ejecutar el motor de recomendación inteligente
  const resultado = useMemo(() => {
    return evaluarYRecomendarProveedores(
      ofertas,
      proveedoresCatalogo,
      evaluacionesHistoricas,
      comprasHistoricas,
      pesos,
      tipoCambioUsdMxn,
      confiabilidadPorProveedor
    )
  }, [
    ofertas,
    proveedoresCatalogo,
    evaluacionesHistoricas,
    comprasHistoricas,
    pesos,
    tipoCambioUsdMxn,
    confiabilidadPorProveedor,
  ])

  const {
    proveedorRecomendado,
    modoEvaluacion,
    explicacionModo,
  } = resultado

  return (
    <div className="space-y-5 font-sans bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-md">
      {/* HEADER DE RECOMENDACIÓN AUTOMÁTICA CON ESTRUCTURA HALLMARK */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold tracking-tight flex items-center gap-2">
              Motor de Recomendación Inteligente
              <Badge
                variant="outline"
                className={[
                  'font-mono font-bold text-[10px] uppercase px-2.5 py-0.5 border',
                  modoEvaluacion === 'primera_compra'
                    ? 'bg-sky-400/20 text-sky-300 border-sky-400/40'
                    : modoEvaluacion === 'recompra'
                    ? 'bg-emerald-400/20 text-emerald-300 border-emerald-400/40'
                    : 'bg-amber-400/20 text-amber-300 border-amber-400/40',
                ].join(' ')}
              >
                {modoEvaluacion === 'primera_compra'
                  ? '🆕 MODO PRIMERA COMPRA'
                  : modoEvaluacion === 'recompra'
                  ? '🔄 MODO RECOMPRA HISTÓRICA'
                  : '⚙️ MODO PERSONALIZADO'}
              </Badge>
            </h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">{explicacionModo}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMostrarConfigPesos(!mostrarConfigPesos)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 active:scale-98 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition-all cursor-pointer"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 text-amber-400" />
          {mostrarConfigPesos ? 'Ocultar Pesos' : 'Ajustar Pesos Algoritmo'}
        </button>
      </div>

      {/* PANEL CONFIGURACIÓN EDITABLE DE PESOS CON COMPONENTE SHADCN SLIDER (FASE 6) */}
      {mostrarConfigPesos && (
        <div className="p-5 bg-slate-950/90 rounded-2xl border border-slate-800 space-y-4 text-xs">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <span className="font-extrabold text-amber-400 flex items-center gap-2 text-xs">
              <SlidersHorizontal className="h-4 w-4" /> Configuración de Ponderación (Suma 100%)
            </span>
            <button
              type="button"
              onClick={() => {
                setPesos(CONFIGURACION_PESOS_DEFAULT)
                toast.info('Pesos del algoritmo restablecidos a valores por defecto.')
              }}
              className="text-[11px] font-mono text-slate-400 hover:text-white underline cursor-pointer"
            >
              Restablecer Valores Default
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between text-slate-300 font-semibold">
                <span>Precio Cotizado</span>
                <span className="font-mono text-amber-400">{(pesos.pesoPrecio * 100).toFixed(0)}%</span>
              </div>
              <Slider
                value={[pesos.pesoPrecio * 100]}
                min={10}
                max={50}
                step={5}
                onValueChange={(val) => setPesos((p) => ({ ...p, pesoPrecio: val[0] / 100 }))}
                className="cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-slate-300 font-semibold">
                <span>Lead Time de Entrega</span>
                <span className="font-mono text-amber-400">{(pesos.pesoLeadTime * 100).toFixed(0)}%</span>
              </div>
              <Slider
                value={[pesos.pesoLeadTime * 100]}
                min={10}
                max={40}
                step={5}
                onValueChange={(val) => setPesos((p) => ({ ...p, pesoLeadTime: val[0] / 100 }))}
                className="cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-slate-300 font-semibold">
                <span>Calidad de Herramienta</span>
                <span className="font-mono text-amber-400">{(pesos.pesoCalidad * 100).toFixed(0)}%</span>
              </div>
              <Slider
                value={[pesos.pesoCalidad * 100]}
                min={10}
                max={40}
                step={5}
                onValueChange={(val) => setPesos((p) => ({ ...p, pesoCalidad: val[0] / 100 }))}
                className="cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-slate-300 font-semibold">
                <span>Cumplimiento de Entregas</span>
                <span className="font-mono text-amber-400">{(pesos.pesoCumplimiento * 100).toFixed(0)}%</span>
              </div>
              <Slider
                value={[pesos.pesoCumplimiento * 100]}
                min={5}
                max={30}
                step={5}
                onValueChange={(val) => setPesos((p) => ({ ...p, pesoCumplimiento: val[0] / 100 }))}
                className="cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-slate-300 font-semibold">
                <span>Comunicación &amp; Respuesta</span>
                <span className="font-mono text-amber-400">{(pesos.pesoComunicacion * 100).toFixed(0)}%</span>
              </div>
              <Slider
                value={[pesos.pesoComunicacion * 100]}
                min={5}
                max={25}
                step={5}
                onValueChange={(val) => setPesos((p) => ({ ...p, pesoComunicacion: val[0] / 100 }))}
                className="cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-slate-300 font-semibold">
                <span>Historial Comprobado</span>
                <span className="font-mono text-amber-400">{(pesos.pesoHistorial * 100).toFixed(0)}%</span>
              </div>
              <Slider
                value={[pesos.pesoHistorial * 100]}
                min={0}
                max={20}
                step={5}
                onValueChange={(val) => setPesos((p) => ({ ...p, pesoHistorial: val[0] / 100 }))}
                className="cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* RECOMENDACIÓN CLARA */}
      {proveedorRecomendado && !proveedorRecomendado.esInformacionInsuficiente && (
        <div className="bg-slate-950 p-5 rounded-2xl border border-emerald-500/40 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Badge className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs font-mono px-3 py-1 rounded-full flex items-center gap-1.5 shadow-md">
                <Award className="h-4 w-4" /> #1 RECOMENDADO SMV
              </Badge>
              <h4 className="text-base font-extrabold text-white">{proveedorRecomendado.proveedorNombre}</h4>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono font-bold">Score Total:</span>
              <span className="text-lg font-black text-emerald-400 font-mono bg-emerald-950/80 border border-emerald-800 px-3.5 py-1 rounded-xl">
                {proveedorRecomendado.scoreTotal} / 100 Pts
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed font-sans bg-slate-900/90 p-3.5 rounded-xl border border-slate-800">
            💡 <strong>Razón Principal:</strong> {proveedorRecomendado.razonRecomendacion}
          </p>

          {/* DESGROSE CON BARRAS SHADCN PROGRESS */}
          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Desglose Transparente de Puntuación por Criterio
              </span>
              <button
                type="button"
                onClick={() => setMostrarDesgloseDetallado(!mostrarDesgloseDetallado)}
                className="text-[11px] font-bold text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {mostrarDesgloseDetallado ? 'Ocultar Barras' : 'Ver Barras por Criterio'}
                {mostrarDesgloseDetallado ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            </div>

            {mostrarDesgloseDetallado && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1 text-xs">
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Precio ({(pesos.pesoPrecio * 100).toFixed(0)}%)</span>
                    <span className="font-mono font-bold text-white">{proveedorRecomendado.desglose.scorePrecio}/100</span>
                  </div>
                  <Progress value={proveedorRecomendado.desglose.scorePrecio} className="h-1.5 bg-slate-800" />
                </div>

                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Lead Time ({(pesos.pesoLeadTime * 100).toFixed(0)}%)</span>
                    <span className="font-mono font-bold text-white">{proveedorRecomendado.desglose.scoreLeadTime}/100</span>
                  </div>
                  <Progress value={proveedorRecomendado.desglose.scoreLeadTime} className="h-1.5 bg-slate-800" />
                </div>

                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1.5">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Calidad ({(pesos.pesoCalidad * 100).toFixed(0)}%)</span>
                    <span className="font-mono font-bold text-white">{proveedorRecomendado.desglose.scoreCalidad}/100</span>
                  </div>
                  <Progress value={proveedorRecomendado.desglose.scoreCalidad} className="h-1.5 bg-slate-800" />
                </div>
              </div>
            )}
          </div>

          {/* CTA SELECCIÓN CON FEEDBACK SONNER */}
          {onSeleccionarProveedor && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  onSeleccionarProveedor(
                    proveedorRecomendado.proveedorId,
                    proveedorRecomendado.proveedorNombre,
                    proveedorRecomendado.razonRecomendacion
                  )
                  toast.success(`Proveedor Ganador Confirmado`, {
                    description: `Se seleccionó a ${proveedorRecomendado.proveedorNombre} como ganador de la cotización.`,
                  })
                }}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 active:scale-98 text-slate-950 text-xs font-black rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Award className="h-4 w-4" /> Aceptar Recomendación ({proveedorRecomendado.proveedorNombre})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
