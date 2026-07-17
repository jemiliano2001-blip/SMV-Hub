import { useState, useMemo } from 'react'
import { useCajaChica } from '@/lib/hooks/useCajaChica'
import { Wallet, TrendingDown, CreditCard } from 'lucide-react'

export default function ResumenCaja() {
  const [periodo, setPeriodo] = useState(() => {
    const hoy = new Date()
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  })
  
  const { movimientos, loading } = useCajaChica(periodo)

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <h2 className="text-lg font-medium text-gray-900">Resumen del Periodo</h2>
        <input
          type="month"
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-[#0369A1]"
        />
      </div>

      {loading ? (
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-100 rounded-xl"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-100 rounded-xl"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-gray-100 p-6 rounded-xl shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Recargas</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{formatearDinero(totalEntradas)}</p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-lg">
                  <Wallet className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-100 p-6 rounded-xl shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500">Total Gastos</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{formatearDinero(totalSalidas)}</p>
                </div>
                <div className="p-3 bg-rose-50 rounded-lg">
                  <TrendingDown className="h-6 w-6 text-rose-600" />
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-100 p-6 rounded-xl shadow-sm">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-500">Saldo del Periodo</p>
                  <p className={`text-2xl font-bold mt-2 ${saldo >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                    {formatearDinero(saldo)}
                  </p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <CreditCard className="h-6 w-6 text-[#0369A1]" />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-medium text-gray-900">Gastos por Categoría</h3>
            </div>
            {gastosPorCategoria.length === 0 ? (
              <div className="p-6 text-center text-gray-500">No hay gastos en este periodo.</div>
            ) : (
              <div className="p-6">
                <div className="space-y-4">
                  {gastosPorCategoria.map((cat, i) => {
                    const porcentaje = totalSalidas > 0 ? (cat.monto / totalSalidas) * 100 : 0
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-gray-700">{cat.nombre}</span>
                          <span className="text-gray-900">{formatearDinero(cat.monto)}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-[#0369A1] h-2 rounded-full"
                            style={{ width: `${Math.min(porcentaje, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
