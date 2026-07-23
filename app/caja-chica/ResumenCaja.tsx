/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · tone: utilitario · scope: resumen-caja */
'use client'

import { useState, useMemo, useEffect } from 'react'
import { useCajaChica } from '@/lib/hooks/useCajaChica'
import { Wallet, TrendingDown, CreditCard, AlertTriangle, Settings, PiggyBank, Save, RefreshCw } from 'lucide-react'
import { fechaHoyLocal } from '@/lib/format'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'
import { toast } from 'sonner'

export default function ResumenCaja() {
  const confirmar = useConfirmDialog()
  const [periodo, setPeriodo] = useState(() => {
    const hoy = new Date()
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  })

  const [fondoFijo, setFondoFijo] = useState<number>(0)
  const [isEditingFondo, setIsEditingFondo] = useState(false)
  const [fondoInput, setFondoInput] = useState('')
  const [isCorteLoading, setIsCorteLoading] = useState(false)

  // Sincroniza con localStorage (sistema externo) en el montaje. No se puede
  // leer en el render inicial: `window` no existe en el render de servidor y
  // leerlo ahí rompería la hidratación (el texto cambiaría entre servidor y
  // cliente). `fondoFijo` también se edita localmente (guardarFondoFijo), así
  // que no es un candidato para useSyncExternalStore.
  useEffect(() => {
    const saved = localStorage.getItem('smv_caja_chica_fondo_fijo')
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFondoFijo(Number(saved))
      setFondoInput(saved)
    }
  }, [])

  const guardarFondoFijo = () => {
    const val = Number(fondoInput)
    if (!isNaN(val) && val >= 0) {
      setFondoFijo(val)
      localStorage.setItem('smv_caja_chica_fondo_fijo', val.toString())
      setIsEditingFondo(false)
    }
  }

  const { movimientos, loading, agregarMovimiento } = useCajaChica(periodo)

  const { totalEntradas, totalSalidas, saldo, gastosPorCategoria } = useMemo(() => {
    let totalEntradas = 0
    let totalSalidas = 0
    const categorias: Record<string, number> = {}

    movimientos.forEach(m => {
      if (m.tipo === 'ENTRADA') {
        totalEntradas += m.monto
      } else {
        totalSalidas += m.monto
        categorias[m.categoria] = (categorias[m.categoria] || 0) + m.monto
      }
    })

    const categoriasArray = Object.entries(categorias)
      .map(([nombre, monto]) => ({ nombre, monto }))
      .sort((a, b) => b.monto - a.monto)

    return {
      totalEntradas,
      totalSalidas,
      saldo: totalEntradas - totalSalidas,
      gastosPorCategoria: categoriasArray
    }
  }, [movimientos])

  const formatearDinero = (monto: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto)
  }

  const porcentajeConsumido = fondoFijo > 0 ? (totalSalidas / fondoFijo) * 100 : 0
  const requiereReabastecimiento = porcentajeConsumido >= 80

  const handleCorteReabastecimiento = async () => {
    if (totalSalidas <= 0) {
      toast.info("No hay gastos registrados para reembolsar en este periodo.")
      return
    }

    const aceptado = await confirmar({
      title: 'Registrar reabastecimiento automático',
      description: `Se registrará un reabastecimiento por ${formatearDinero(totalSalidas)}.\n\nConfirma que entregarás el reporte a Finanzas para solicitar el reembolso.`,
      confirmLabel: 'Registrar reabastecimiento',
    })
    if (!aceptado) return
    
    setIsCorteLoading(true)
    try {
      await agregarMovimiento({
        fecha: fechaHoyLocal(),
        periodo: periodo,
        descripcion: 'Reabastecimiento por Corte de Caja',
        proveedor: 'Finanzas',
        categoria: 'Recarga de Caja',
        solicitante: 'Administración',
        comprobante: 'NINGUNO',
        deducible: false,
        tipo: 'ENTRADA',
        monto: totalSalidas,
        costoReal: totalSalidas,
        ivaEstimado: 0,
        verificado: true
      })
      toast.success('Corte y reabastecimiento registrado. Descarga el reporte para Finanzas.')
    } catch (error) {
      console.error(error)
      toast.error('Ocurrió un error al registrar el reabastecimiento.')
    } finally {
      setIsCorteLoading(false)
    }
  }

  return (
    <div className="space-y-4 font-sans">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-sm font-bold text-slate-900 tracking-tight">Resumen Ejecutivo del Periodo</h2>
          <p className="text-xs text-slate-500">Métricas consolidadas de caja chica y consumo de fondo.</p>
        </div>
        <input
          type="month"
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#0369A1] font-mono text-slate-900"
        />
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-28 bg-slate-200/60 rounded-xl"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-slate-200/60 rounded-xl"></div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Panel de Fondo Fijo Utilitario */}
          <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-xs">
            <div className="flex flex-col md:flex-row justify-between gap-5">
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs uppercase tracking-wider font-mono">
                    <PiggyBank className="h-4 w-4 text-[#0369A1]" />
                    <h3>Control de Fondo Fijo (Sistema Imprest)</h3>
                  </div>
                  {!isEditingFondo && (
                    <button onClick={() => setIsEditingFondo(true)} className="text-slate-400 hover:text-[#0369A1] transition-colors p-1" title="Configurar Límite">
                      <Settings className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                
                {isEditingFondo ? (
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">$</span>
                      <input 
                        type="number" 
                        value={fondoInput}
                        onChange={(e) => setFondoInput(e.target.value)}
                        className="pl-6 pr-3 py-1 text-xs border border-slate-300 rounded-md focus:border-[#0369A1] focus:outline-none font-mono"
                        placeholder="Ej: 5000"
                      />
                    </div>
                    <button onClick={guardarFondoFijo} className="bg-[#0369A1] text-white p-1 rounded hover:bg-[#0284C7] transition-colors">
                      <Save className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div>
                    {fondoFijo === 0 ? (
                      <p className="text-xs text-slate-500">Haz clic en el engrane para definir el límite del fondo fijo.</p>
                    ) : (
                      <div className="space-y-2.5">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-slate-600">Límite Establecido: <strong className="text-slate-900">{formatearDinero(fondoFijo)}</strong></span>
                          <span className="text-slate-600">Gastado: <strong className="text-slate-900">{formatearDinero(totalSalidas)}</strong></span>
                        </div>
                        
                        <div className="w-full bg-slate-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${requiereReabastecimiento ? 'bg-rose-500' : 'bg-[#0369A1]'}`}
                            style={{ width: `${Math.min(porcentajeConsumido, 100)}%` }}
                          ></div>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-1">
                          <div>
                            <p className={`text-xs font-mono font-medium ${requiereReabastecimiento ? 'text-rose-600' : 'text-slate-500'}`}>
                              {porcentajeConsumido.toFixed(1)}% Consumido del Límite
                            </p>
                            <p className="text-xs font-bold font-mono text-[#0369A1] mt-0.5">
                              Monto a Reembolsar: {formatearDinero(totalSalidas)}
                            </p>
                          </div>
                          
                          <button 
                            onClick={handleCorteReabastecimiento}
                            disabled={isCorteLoading || totalSalidas === 0}
                            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-50 active:scale-[0.98]"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${isCorteLoading ? 'animate-spin' : ''}`} />
                            Hacer Corte Automático
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {requiereReabastecimiento && fondoFijo > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex-1 flex gap-2.5 items-start">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-rose-800">Fondo al Límite</h4>
                    <p className="text-[11px] text-rose-700 mt-0.5 leading-relaxed">
                      El consumo superó el 80%. Exporta tu reporte y presiona <strong>Hacer Corte Automático</strong> para reabastecer {formatearDinero(totalSalidas)}.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold">Total Recargas</p>
                  <p className="text-xl font-bold font-mono text-slate-900 mt-1">{formatearDinero(totalEntradas)}</p>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-700">
                  <Wallet className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold">Total Gastos</p>
                  <p className="text-xl font-bold font-mono text-slate-900 mt-1">{formatearDinero(totalSalidas)}</p>
                </div>
                <div className="p-2.5 bg-rose-50 rounded-lg text-rose-700">
                  <TrendingDown className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold">Saldo del Periodo</p>
                  <p className={`text-xl font-bold font-mono mt-1 ${saldo >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                    {formatearDinero(saldo)}
                  </p>
                </div>
                <div className="p-2.5 bg-sky-50 rounded-lg text-[#0369A1]">
                  <CreditCard className="h-5 w-5" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-700">Gastos por Categoría</h3>
            </div>
            {gastosPorCategoria.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-xs font-mono">No hay gastos en este periodo.</div>
            ) : (
              <div className="p-4 space-y-3">
                {gastosPorCategoria.map((cat, i) => {
                  const porcentaje = totalSalidas > 0 ? (cat.monto / totalSalidas) * 100 : 0
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-700">{cat.nombre}</span>
                        <span className="font-mono text-slate-900">{formatearDinero(cat.monto)} ({porcentaje.toFixed(1)}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5">
                        <div
                          className="bg-[#0369A1] h-1.5 rounded-full"
                          style={{ width: `${Math.min(porcentaje, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
