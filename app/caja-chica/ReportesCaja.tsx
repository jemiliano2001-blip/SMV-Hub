'use client'

import { useMemo, useState } from 'react'
import { Printer, FileText, Table2 } from 'lucide-react'
import { useCajaChica } from '@/lib/hooks/useCajaChica'
import { filtrarMovimientosCajaChicaReporte, calcularTotalesReporteCaja } from '@/lib/reportes-caja-chica'
import { formatPrecio } from '@/lib/format'
import * as XLSX from 'xlsx'

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

  const exportarExcel = () => {
    if (filtrados.length === 0) return
    
    // Preparar filas para Excel
    const datos = filtrados.map(m => {
      const fila: Record<string, string | number> = {
        'Fecha': m.fecha,
        'Descripción': m.descripcion,
        'Proveedor / Lugar': m.proveedor,
        'Categoría': m.categoria,
        'Comprobante': m.comprobante,
        'Monto ($)': m.monto
      }
      if (conFactura) fila['IVA Estimado ($)'] = m.ivaEstimado || 0
      return fila
    })
    
    // Fila vacía de separación
    datos.push({ 'Fecha': '', 'Descripción': '', 'Proveedor / Lugar': '', 'Categoría': '', 'Comprobante': '', 'Monto ($)': '' })
    
    // Fila de totales
    const filaTotal: Record<string, string | number> = {
      'Fecha': 'TOTALES',
      'Monto ($)': total
    }
    if (conFactura) filaTotal['IVA Estimado ($)'] = ivaTotal
    datos.push(filaTotal)
    
    const worksheet = XLSX.utils.json_to_sheet(datos)
    
    // Ajustar anchos de columnas
    const wscols = [
      {wch: 12}, // Fecha
      {wch: 40}, // Descripción
      {wch: 25}, // Proveedor
      {wch: 15}, // Categoría
      {wch: 15}, // Comprobante
      {wch: 15}  // Monto
    ]
    if (conFactura) wscols.push({wch: 15})
    worksheet['!cols'] = wscols
    
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte Caja Chica')
    
    XLSX.writeFile(workbook, `Reporte_CajaChica_${periodo}${conFactura ? '_ConFactura' : '_SinFactura'}.xlsx`)
  }

  const columnas = conFactura ? 7 : 6

  return (
    <div className="space-y-4 print:space-y-6">
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
        <div className="flex gap-2">
          <button
            onClick={exportarExcel}
            disabled={filtrados.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Table2 className="h-3.5 w-3.5" /> Exportar Excel
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg bg-white border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            <Printer className="h-3.5 w-3.5" /> Guardar PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm print:hidden">
          {error}
        </div>
      )}

      {/* Cabecera de Impresión (PDF) */}
      <div className="hidden print:block mb-6 pb-4 border-b-2 border-gray-900">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">SMV MAQUINADOS</h1>
            <h2 className="text-xl font-bold text-gray-700 mt-1 uppercase tracking-wider">Reporte de Caja Chica</h2>
          </div>
          <div className="text-right text-sm text-gray-800">
            <p><span className="font-semibold">Periodo:</span> {periodo}</p>
            <p><span className="font-semibold">Filtro:</span> Gastos {conFactura ? 'Con Factura' : 'Sin Factura'}</p>
            <p><span className="font-semibold">Fecha de Emisión:</span> {new Date().toLocaleDateString('es-MX')}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto print:border-0 print:overflow-visible print:shadow-none">
        <table className="w-full text-sm text-left print:text-xs">
          <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200 print:bg-white print:border-b-2 print:border-gray-900 print:text-gray-900">
            <tr>
              <th className="px-4 py-3 print:px-2 print:py-2">Fecha</th>
              <th className="px-4 py-3 print:px-2 print:py-2">Descripción</th>
              <th className="px-4 py-3 print:px-2 print:py-2">Proveedor</th>
              <th className="px-4 py-3 print:px-2 print:py-2">Categoría</th>
              <th className="px-4 py-3 print:px-2 print:py-2">Comprobante</th>
              <th className="px-4 py-3 text-right print:px-2 print:py-2">Monto</th>
              {conFactura && <th className="px-4 py-3 text-right print:px-2 print:py-2">IVA est.</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 print:divide-gray-300">
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
                <tr key={m.id} className="hover:bg-gray-50 print:hover:bg-white">
                  <td className="px-4 py-3 text-gray-900 print:px-2 print:py-2">{m.fecha}</td>
                  <td className="px-4 py-3 text-gray-900 max-w-[220px] truncate print:max-w-none print:whitespace-normal print:px-2 print:py-2" title={m.descripcion}>
                    {m.descripcion}
                  </td>
                  <td className="px-4 py-3 text-gray-600 print:px-2 print:py-2">{m.proveedor}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs print:px-2 print:py-2">{m.categoria}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs print:px-2 print:py-2">
                    <div className="flex items-center gap-1.5">
                      <span>{m.comprobante}</span>
                      {m.archivoUrl && (
                        <a
                          href={m.archivoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#0369A1] hover:text-[#0284C7] hover:underline flex items-center gap-0.5 print:hidden font-normal"
                          title="Ver comprobante digital"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900 tabular-nums print:px-2 print:py-2">
                    {formatPrecio(m.monto, 'MXN')}
                  </td>
                  {conFactura && (
                    <td className="px-4 py-3 text-right text-gray-600 tabular-nums print:px-2 print:py-2">
                      {formatPrecio(m.ivaEstimado, 'MXN')}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
          {filtrados.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-gray-300 font-semibold text-gray-900 print:border-gray-900 print:text-sm">
                <td className="px-4 py-3 print:px-2 print:py-3" colSpan={5}>
                  TOTAL
                </td>
                <td className="px-4 py-3 text-right tabular-nums print:px-2 print:py-3">{formatPrecio(total, 'MXN')}</td>
                {conFactura && (
                  <td className="px-4 py-3 text-right tabular-nums print:px-2 print:py-3">{formatPrecio(ivaTotal, 'MXN')}</td>
                )}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Pie de Firmas (Solo PDF) */}
      <div className="hidden print:flex justify-around items-end mt-32 pt-8">
        <div className="text-center">
          <div className="w-64 border-b border-gray-900 mb-2 mx-auto"></div>
          <p className="text-sm font-bold text-gray-900">Elaboró</p>
          <p className="text-xs text-gray-500">Nombre y Firma del Responsable</p>
        </div>
        <div className="text-center">
          <div className="w-64 border-b border-gray-900 mb-2 mx-auto"></div>
          <p className="text-sm font-bold text-gray-900">Revisó / Autorizó</p>
          <p className="text-xs text-gray-500">Nombre y Firma de Gerencia</p>
        </div>
      </div>
    </div>
  )
}
