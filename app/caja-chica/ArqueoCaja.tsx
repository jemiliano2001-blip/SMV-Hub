'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useCajaChica } from '@/lib/hooks/useCajaChica'
import { Calculator, CheckCircle2, AlertTriangle, XCircle, Save } from 'lucide-react'
import { crearArqueoCaja, listarArqueosCaja, type ArqueoCaja as ArqueoCajaRegistro } from '@/lib/caja-chica'
import { toast } from 'sonner'
import ModuleSurface from '@/components/layout/ModuleSurface'

export default function ArqueoCaja() {
  const { movimientos, loading, error, recargar } = useCajaChica() // Sin periodo para traer todo el histórico
  const [efectivoReal, setEfectivoReal] = useState<string>('')
  const [guardando, setGuardando] = useState(false)
  const [historial, setHistorial] = useState<ArqueoCajaRegistro[]>([])

  const cargarHistorial = useCallback(() => {
    listarArqueosCaja()
      .then((data) => setHistorial(data.slice(0, 5)))
      .catch((err) => console.error('Error cargando historial de arqueos:', err))
  }, [])

  useEffect(() => {
    cargarHistorial()
  }, [cargarHistorial])

  const saldoTeorico = useMemo(() => {
    let entradas = 0
    let salidas = 0
    movimientos.forEach(m => {
      if (m.tipo === 'ENTRADA') entradas += m.monto
      else salidas += m.monto
    })
    return entradas - salidas
  }, [movimientos])

  const formatearDinero = (monto: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto)
  }

  const efectivoNum = parseFloat(efectivoReal) || 0
  const diferencia = efectivoNum - saldoTeorico

  async function guardarArqueo() {
    setGuardando(true)
    try {
      const hoy = new Date()
      const periodo = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
      await crearArqueoCaja({
        periodo,
        efectivoFisico: efectivoNum,
        saldoTeorico,
        diferencia,
      })
      toast.success('Arqueo guardado en el historial.')
      setEfectivoReal('')
      cargarHistorial()
    } catch (err) {
      console.error('Error guardando arqueo:', err)
      toast.error('No se pudo guardar el arqueo. Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto py-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
          <Calculator className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-medium text-foreground">Arqueo de Caja Chica</h2>
        <p className="text-muted-foreground text-sm">
          Verifica que el saldo en el sistema coincida con el dinero físico actual.
        </p>
      </div>

      <ModuleSurface className="p-6 space-y-6 mt-8">
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-muted rounded"></div>
            <div className="h-12 bg-muted rounded"></div>
          </div>
        ) : error ? (
          // Si los movimientos no cargaron, el saldo teórico sería $0.00 y el
          // arqueo compararía el efectivo real contra un total falso. Mejor no
          // dejar arquear que dejar arquear con un número inventado.
          <div className="space-y-3 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-rose-500" />
            <p className="font-medium text-foreground">No se pudieron cargar los movimientos</p>
            <p className="text-sm text-muted-foreground">
              No se puede arquear sin el saldo teórico: quedaría comparado contra $0.00.
            </p>
            <p className="text-xs text-muted-foreground">{error}</p>
            <button
              type="button"
              onClick={() => void recargar()}
              className="cursor-pointer rounded-md border border-input bg-card px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center py-4 border-b border-border">
              <div className="text-muted-foreground font-medium">Saldo Teórico (Sistema)</div>
              <div className="text-2xl font-bold text-foreground">{formatearDinero(saldoTeorico)}</div>
            </div>

            <div className="flex justify-between items-center py-4 border-b border-border">
              <label className="text-muted-foreground font-medium whitespace-nowrap mr-4">Efectivo Físico (Real)</label>
              <div className="relative w-48">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-muted-foreground sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={efectivoReal}
                  onChange={e => setEfectivoReal(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 text-right text-xl font-bold border border-input bg-card rounded-md shadow-xs focus:ring-ring focus:border-primary text-foreground"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="pt-4">
              <div className={`p-4 rounded-lg border flex items-start gap-4 ${
                efectivoReal === '' ? 'bg-muted border-border' :
                diferencia === 0 ? 'bg-emerald-50 border-emerald-200' :
                'bg-rose-50 border-rose-200'
              }`}>
                {efectivoReal === '' ? (
                  <AlertTriangle className="h-6 w-6 text-muted-foreground shrink-0" />
                ) : diferencia === 0 ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="h-6 w-6 text-rose-600 shrink-0" />
                )}

                <div className="flex-1">
                  <h4 className={`text-sm font-bold ${
                    efectivoReal === '' ? 'text-foreground' :
                    diferencia === 0 ? 'text-emerald-800' :
                    'text-rose-800'
                  }`}>
                    {efectivoReal === '' ? 'Ingresa el monto físico' :
                     diferencia === 0 ? '¡Cuadre Perfecto!' :
                     diferencia > 0 ? 'Sobrante de efectivo' : 'Faltante de efectivo'}
                  </h4>

                  {efectivoReal !== '' && (
                    <p className={`mt-1 text-xl font-black ${diferencia === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {diferencia > 0 ? '+' : ''}{formatearDinero(diferencia)}
                    </p>
                  )}

                  {efectivoReal !== '' && diferencia !== 0 && (
                    <p className="mt-2 text-xs text-rose-600">
                      Hay una diferencia entre los movimientos registrados y el dinero físico.
                      Verifica si falta capturar algún gasto o recarga.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={guardarArqueo}
              disabled={efectivoReal === '' || guardando}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-bold py-2.5 rounded-lg transition-colors"
            >
              <Save className="h-4 w-4" />
              {guardando ? 'Guardando...' : 'Guardar Arqueo'}
            </button>
          </>
        )}
      </ModuleSurface>

      {historial.length > 0 && (
        <ModuleSurface className="p-6">
          <h3 className="text-sm font-bold text-foreground mb-3">Últimos Arqueos</h3>
          <div className="divide-y divide-border">
            {historial.map((a) => (
              <div key={a.id} className="flex justify-between items-center py-2 text-sm">
                <span className="text-muted-foreground font-mono text-xs">
                  {a.creadoEn.toLocaleDateString('es-MX')} · {a.creadoPor}
                </span>
                <span className={`font-bold font-mono ${a.diferencia === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {a.diferencia > 0 ? '+' : ''}{formatearDinero(a.diferencia)}
                </span>
              </div>
            ))}
          </div>
        </ModuleSurface>
      )}
    </div>
  )
}
