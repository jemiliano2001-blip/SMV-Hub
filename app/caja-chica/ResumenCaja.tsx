'use client'

import { useState, useMemo, useEffect } from 'react'
import { useCajaChica } from '@/lib/hooks/useCajaChica'
import { Wallet, TrendingDown, CreditCard, AlertTriangle, Settings, PiggyBank, Save, Scissors, Filter } from 'lucide-react'
import { toast } from 'sonner'
import { obtenerFondoFijoCajaChica, guardarFondoFijoCajaChica, type ModoFiltroCaja, listarCortesCaja, type CorteCaja } from '@/lib/caja-chica'
import ModuleSurface from '@/components/layout/ModuleSurface'

export default function ResumenCaja() {
  const [modoFiltro, setModoFiltro] = useState<ModoFiltroCaja>('CICLO_ACTIVO')
  const [periodo, setPeriodo] = useState(() => {
    const hoy = new Date()
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  })
  const [corteIdSel, setCorteIdSel] = useState<string>('')
  const [cortesHistorial, setCortesHistorial] = useState<CorteCaja[]>([])

  const [fondoFijo, setFondoFijo] = useState<number>(0)
  const [isEditingFondo, setIsEditingFondo] = useState(false)
  const [fondoInput, setFondoInput] = useState('')
  const [isCorteLoading, setIsCorteLoading] = useState(false)
  const [guardandoFondo, setGuardandoFondo] = useState(false)

  useEffect(() => {
    listarCortesCaja()
      .then((res) => {
        setCortesHistorial(res)
        if (res.length > 0 && !corteIdSel) {
          setCorteIdSel(res[0].id)
        }
      })
      .catch((err) => console.error('Error cargando historial de cortes:', err))
  }, [corteIdSel])

  useEffect(() => {
    obtenerFondoFijoCajaChica()
      .then((valor) => {
        setFondoFijo(valor)
        setFondoInput(valor > 0 ? String(valor) : '')
      })
      .catch((err) => console.error('Error cargando fondo fijo:', err))
  }, [])

  const guardarFondoFijo = async () => {
    const val = Number(fondoInput)
    if (isNaN(val) || val < 0) return
    setGuardandoFondo(true)
    try {
      await guardarFondoFijoCajaChica(val)
      setFondoFijo(val)
      setIsEditingFondo(false)
      toast.success('Fondo fijo actualizado correctamente.')
    } catch (err) {
      console.error('Error guardando fondo fijo:', err)
      toast.error('No se pudo guardar el fondo fijo. Intenta de nuevo.')
    } finally {
      setGuardandoFondo(false)
    }
  }

  const filtroActual = useMemo(() => {
    return {
      modo: modoFiltro,
      periodo,
      corteId: corteIdSel,
    }
  }, [modoFiltro, periodo, corteIdSel])

  const { movimientos, loading, realizarCorteCaja } = useCajaChica(filtroActual)

  const { totalEntradas, totalSalidas, saldo, gastosPorCategoria } = useMemo(() => {
    let totalEntradas = 0
    let totalSalidas = 0
    const categorias: Record<string, number> = {}

    movimientos.forEach((m) => {
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
      gastosPorCategoria: categoriasArray,
    }
  }, [movimientos])

  const formatearDinero = (monto: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto)
  }

  const porcentajeConsumido = fondoFijo > 0 ? (totalSalidas / fondoFijo) * 100 : 0
  const requiereReabastecimiento = porcentajeConsumido >= 80

  const handleCorteReabastecimiento = async () => {
    if (totalSalidas <= 0) {
      toast.info('No hay gastos acumulados para reembolsar en este ciclo.')
      return
    }

    const montoRes = window.prompt(
      `Confirma o edita el monto que recibirás como reabastecimiento / depósito (Gastado en ciclo: $${totalSalidas}):`,
      totalSalidas.toString()
    )
    if (montoRes === null) return // usuario canceló

    const montoParsed = parseFloat(montoRes)
    const montoFinal = Number.isNaN(montoParsed) || montoParsed < 0 ? totalSalidas : montoParsed

    setIsCorteLoading(true)
    try {
      const res = await realizarCorteCaja(undefined, montoFinal)
      toast.success(
        `¡${res.corte.folio} realizado con éxito! Se reabastecieron ${formatearDinero(res.corte.saldoReembolsado)}.`
      )
    } catch (error) {
      console.error(error)
      toast.error('Ocurrió un error al registrar el corte de caja.')
    } finally {
      setIsCorteLoading(false)
    }
  }

  return (
    <div className="space-y-4 font-sans">
      <ModuleSurface className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center p-4">
        <div>
          <h2 className="text-sm font-bold text-foreground tracking-tight">Resumen Ejecutivo del Ciclo</h2>
          <p className="text-xs text-muted-foreground">Métricas consolidadas de caja chica y consumo de fondo.</p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <select
              value={modoFiltro}
              onChange={(e) => setModoFiltro(e.target.value as ModoFiltroCaja)}
              className="px-2.5 py-1.5 text-xs font-bold bg-card border border-input rounded-md text-foreground focus:outline-none focus:border-primary"
            >
              <option value="CICLO_ACTIVO">Ciclo activo (sin corte)</option>
              <option value="TODOS">Todos los movimientos</option>
              <option value="PERIODO">📅 Por Mes Calendario</option>
              <option value="CORTE">🔖 Por Corte Realizado</option>
            </select>
          </div>

          {modoFiltro === 'PERIODO' && (
            <input
              type="month"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-card border border-input rounded-md focus:outline-none focus:border-primary font-mono text-foreground"
            />
          )}

          {modoFiltro === 'CORTE' && (
            <select
              value={corteIdSel}
              onChange={(e) => setCorteIdSel(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-card border border-input rounded-md focus:outline-none focus:border-primary font-mono text-foreground"
            >
              {cortesHistorial.length === 0 ? (
                <option value="">Sin cortes</option>
              ) : (
                cortesHistorial.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.folio} ({c.fechaCierre}) — ${c.saldoReembolsado.toFixed(2)}
                  </option>
                ))
              )}
            </select>
          )}
        </div>
      </ModuleSurface>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-28 bg-muted rounded-xl"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-muted rounded-xl"></div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Panel de Fondo Fijo Utilitario */}
          <ModuleSurface className="p-5">
            <div className="flex flex-col md:flex-row justify-between gap-5">
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-foreground font-bold text-xs uppercase tracking-wider font-mono">
                    <PiggyBank className="h-4 w-4 text-primary" />
                    <h3>Control de Fondo Fijo (Sistema Imprest)</h3>
                  </div>
                  {!isEditingFondo && (
                    <button
                      onClick={() => setIsEditingFondo(true)}
                      className="text-muted-foreground hover:text-primary transition-colors p-1"
                      title="Configurar Límite"
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {isEditingFondo ? (
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-xs">
                        $
                      </span>
                      <input
                        type="number"
                        value={fondoInput}
                        onChange={(e) => setFondoInput(e.target.value)}
                        className="pl-6 pr-3 py-1 text-xs border border-input bg-card rounded-md focus:border-primary focus:outline-none font-mono text-foreground"
                        placeholder="Ej: 5000"
                      />
                    </div>
                    <button
                      onClick={guardarFondoFijo}
                      disabled={guardandoFondo}
                      className="bg-primary text-primary-foreground p-1 rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      <Save className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div>
                    {fondoFijo === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Haz clic en el engrane para definir el límite del fondo fijo.
                      </p>
                    ) : (
                      <div className="space-y-2.5">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-muted-foreground">
                            Límite Establecido:{' '}
                            <strong className="text-foreground">{formatearDinero(fondoFijo)}</strong>
                          </span>
                          <span className="text-muted-foreground">
                            Gastado:{' '}
                            <strong className="text-foreground">{formatearDinero(totalSalidas)}</strong>
                          </span>
                        </div>

                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${
                              requiereReabastecimiento ? 'bg-rose-500' : 'bg-primary'
                            }`}
                            style={{ width: `${Math.min(porcentajeConsumido, 100)}%` }}
                          ></div>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-1">
                          <div>
                            <p
                              className={`text-xs font-mono font-medium ${
                                requiereReabastecimiento ? 'text-rose-600' : 'text-muted-foreground'
                              }`}
                            >
                              {porcentajeConsumido.toFixed(1)}% Consumido del Límite
                            </p>
                            <p className="text-xs font-bold font-mono text-primary mt-0.5">
                              Monto a Reembolsar: {formatearDinero(totalSalidas)}
                            </p>
                          </div>

                          {modoFiltro === 'CICLO_ACTIVO' && (
                            <button
                              onClick={handleCorteReabastecimiento}
                              disabled={isCorteLoading || totalSalidas === 0}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50 active:scale-[0.98]"
                            >
                              <Scissors
                                className={`h-3.5 w-3.5 ${isCorteLoading ? 'animate-spin' : ''}`}
                              />
                              Hacer Corte de Caja
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {requiereReabastecimiento && fondoFijo > 0 && modoFiltro === 'CICLO_ACTIVO' && (
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 flex-1 flex gap-2.5 items-start">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-rose-800">Fondo al Límite</h4>
                    <p className="text-[11px] text-rose-700 mt-0.5 leading-relaxed">
                      El consumo superó el 80%. Presiona <strong>Hacer Corte de Caja</strong> para generar el reporte de gastos y reabastecer {formatearDinero(totalSalidas)}.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ModuleSurface>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ModuleSurface className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                    Total Recargas
                  </p>
                  <p className="text-xl font-bold font-mono text-foreground mt-1">
                    {formatearDinero(totalEntradas)}
                  </p>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-lg text-emerald-700">
                  <Wallet className="h-5 w-5" />
                </div>
              </div>
            </ModuleSurface>

            <ModuleSurface className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                    Total Gastos
                  </p>
                  <p className="text-xl font-bold font-mono text-foreground mt-1">
                    {formatearDinero(totalSalidas)}
                  </p>
                </div>
                <div className="p-2.5 bg-rose-50 rounded-lg text-rose-700">
                  <TrendingDown className="h-5 w-5" />
                </div>
              </div>
            </ModuleSurface>

            <ModuleSurface className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                    Saldo del Ciclo
                  </p>
                  <p
                    className={`text-xl font-bold font-mono mt-1 ${
                      saldo >= 0 ? 'text-foreground' : 'text-rose-600'
                    }`}
                  >
                    {formatearDinero(saldo)}
                  </p>
                </div>
                <div className="p-2.5 bg-sky-50 rounded-lg text-primary">
                  <CreditCard className="h-5 w-5" />
                </div>
              </div>
            </ModuleSurface>
          </div>

          <ModuleSurface>
            <div className="px-4 py-3 border-b border-border bg-muted">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-foreground">
                Gastos por Categoría
              </h3>
            </div>
            {gastosPorCategoria.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-xs font-mono">
                No hay gastos registrados para la vista seleccionada.
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {gastosPorCategoria.map((cat, i) => {
                  const porcentaje = totalSalidas > 0 ? (cat.monto / totalSalidas) * 100 : 0
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-foreground">{cat.nombre}</span>
                        <span className="font-mono text-foreground">
                          {formatearDinero(cat.monto)} ({porcentaje.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className="bg-primary h-1.5 rounded-full"
                          style={{ width: `${Math.min(porcentaje, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </ModuleSurface>
        </>
      )}
    </div>
  )
}
