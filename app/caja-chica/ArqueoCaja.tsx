import { useState, useMemo } from 'react'
import { useCajaChica } from '@/lib/hooks/useCajaChica'
import { Calculator, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'

export default function ArqueoCaja() {
  const { movimientos, loading } = useCajaChica() // Sin periodo para traer todo el histórico
  const [efectivoReal, setEfectivoReal] = useState<string>('')

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

  return (
    <div className="space-y-6 max-w-2xl mx-auto py-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-12 h-12 bg-[#0369A1]/10 text-[#0369A1] rounded-full flex items-center justify-center mb-4">
          <Calculator className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-medium text-gray-900">Arqueo de Caja Chica</h2>
        <p className="text-gray-500 text-sm">
          Verifica que el saldo en el sistema coincida con el dinero físico actual.
        </p>
      </div>

      <div className="bg-white border border-gray-100 p-6 rounded-xl shadow-sm space-y-6 mt-8">
        {loading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-gray-100 rounded"></div>
            <div className="h-12 bg-gray-100 rounded"></div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center py-4 border-b border-gray-100">
              <div className="text-gray-600 font-medium">Saldo Teórico (Sistema)</div>
              <div className="text-2xl font-bold text-gray-900">{formatearDinero(saldoTeorico)}</div>
            </div>

            <div className="flex justify-between items-center py-4 border-b border-gray-100">
              <label className="text-gray-600 font-medium whitespace-nowrap mr-4">Efectivo Físico (Real)</label>
              <div className="relative w-48">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={efectivoReal}
                  onChange={e => setEfectivoReal(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 text-right text-xl font-bold border border-gray-300 rounded-md shadow-sm focus:ring-[#0369A1] focus:border-[#0369A1]"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="pt-4">
              <div className={`p-4 rounded-lg border flex items-start gap-4 ${
                efectivoReal === '' ? 'bg-gray-50 border-gray-200' :
                diferencia === 0 ? 'bg-emerald-50 border-emerald-200' :
                'bg-rose-50 border-rose-200'
              }`}>
                {efectivoReal === '' ? (
                  <AlertTriangle className="h-6 w-6 text-gray-400 shrink-0" />
                ) : diferencia === 0 ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="h-6 w-6 text-rose-600 shrink-0" />
                )}
                
                <div className="flex-1">
                  <h4 className={`text-sm font-bold ${
                    efectivoReal === '' ? 'text-gray-700' :
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
          </>
        )}
      </div>
    </div>
  )
}
