'use client'

import { useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import { useCajaChica } from '@/lib/hooks/useCajaChica'
import { filtrarMovimientosCajaChicaReporte, calcularTotalesReporteCaja } from '@/lib/reportes-caja-chica'
import { formatPrecio } from '@/lib/format'

export default function ReportesCaja() {
  const [periodo, setPeriodo] = useState(() => {
    const hoy = new Date()
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  })
  const [conFactura, setConFactura] = useState(true)

  const { movimientos, loading, error } = useCajaChica(periodo)

  const filtrados = useMemo(
    () => filtrarMovimientosCajaChicaReporte(movimientos, conFactura),
    [movimientos, conFactura]
  )
  const { total, ivaTotal } = useMemo(() => calcularTotalesReporteCaja(filtrados), [filtrados])

  const columnas = conFactura ? 7 : 6

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="month"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-[#0369A1]"
          />
          <div className="flex bg-gray-200/50 p-1 rounded-lg">
            {([true, false] as const).map((valor) => (
              <button
                key={String(valor)}
                onClick={() => setConFactura(valor)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  conFactura === valor
                    ? 'bg-white text-[#0369A1] shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {valor ? 'Con factura' : 'Sin factura'}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg bg-white border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <Printer className="h-3.5 w-3.5" /> Guardar PDF
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm print:hidden">
          {error}
        </div>
      )}

      <div className="hidden print:block">
        <h2 className="text-base font-semibold text-gray-900">
          Caja chica — Gastos {conFactura ? 'con factura' : 'sin factura'} ({periodo})
        </h2>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto print:border-0">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Descripción</th>
              <th className="px-4 py-3">Proveedor</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3">Comprobante</th>
              <th className="px-4 py-3 text-right">Monto</th>
              {conFactura && <th className="px-4 py-3 text-right">IVA est.</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={columnas} className="px-4 py-8 text-center text-gray-500">
                  Cargando movimientos...
                </td>
              </tr>
            ) : filtrados.length === 0 ? (
              <tr>
                <td colSpan={columnas} className="px-4 py-8 text-center text-gray-500">
                  Sin movimientos {conFactura ? 'con factura' : 'sin factura'} en este periodo.
                </td>
              </tr>
            ) : (
              filtrados.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{m.fecha}</td>
                  <td className="px-4 py-3 text-gray-900 max-w-[220px] truncate" title={m.descripcion}>
                    {m.descripcion}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{m.proveedor}</td>
                  <td className="px-4 py-3 text-gray-600">{m.categoria}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{m.comprobante}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900 tabular-nums">
                    {formatPrecio(m.monto, 'MXN')}
                  </td>
                  {conFactura && (
                    <td className="px-4 py-3 text-right text-gray-600 tabular-nums">
                      {formatPrecio(m.ivaEstimado, 'MXN')}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
          {filtrados.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-300 font-semibold text-gray-900">
                <td className="px-4 py-3" colSpan={5}>
                  TOTAL
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{formatPrecio(total, 'MXN')}</td>
                {conFactura && (
                  <td className="px-4 py-3 text-right tabular-nums">{formatPrecio(ivaTotal, 'MXN')}</td>
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
