'use client'

import { useState, useMemo } from 'react'
import { useHorasExtraMensual } from '@/lib/hooks/useHorasExtra'
import {
  totalesPorEmpleado,
  calcularKpisResumen,
  exportarCsvResumen,
  detalleSemanasCsv,
} from '@/lib/horas-extra-resumen'
import type { Departamento } from '@/lib/schemas'
import { Clock, Search, Download, Printer } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const DEPARTAMENTO_LABEL: Record<Departamento, string> = {
  diseno: 'Diseño',
  automatizacion: 'Automatización',
  taller: 'Taller / Tool Room',
  cnc: 'CNC / Producción',
}

interface Props {
  departamento: Departamento
}

export default function ResumenMensual({ departamento }: Props) {
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7))
  const [busqueda, setBusqueda] = useState('')

  const { registros, loading, error } = useHorasExtraMensual(mes, departamento)

  const resumen = useMemo(() => totalesPorEmpleado(registros), [registros])
  const kpis = useMemo(() => calcularKpisResumen(registros), [registros])

  const resumenFiltrado = resumen.filter((item) =>
    item.empleado.toLowerCase().includes(busqueda.toLowerCase())
  )

  const deptLabel = DEPARTAMENTO_LABEL[departamento]

  function descargarCsv(contenido: string, nombre: string) {
    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = nombre
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function exportarResumen() {
    const csv = exportarCsvResumen(resumenFiltrado, mes, deptLabel)
    descargarCsv(csv, `horas_extra_${departamento}_${mes}.csv`)
  }

  function exportarDetalle() {
    const csv = '\uFEFF' + detalleSemanasCsv(registros)
    descargarCsv(csv, `horas_extra_detalle_${departamento}_${mes}.csv`)
  }

  if (error) {
    return <div className="text-red-600 bg-red-50 p-4 rounded-lg text-sm">{error}</div>
  }

  return (
    <div className="space-y-6 print:space-y-4" id="resumen-horas-extra">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gray-50 border border-gray-200 rounded-lg p-4 print:hidden">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Mes:</label>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar empleado..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-primary"
            />
          </div>
          <button
            type="button"
            onClick={exportarResumen}
            disabled={resumenFiltrado.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Resumen CSV
          </button>
          <button
            type="button"
            onClick={exportarDetalle}
            disabled={registros.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Detalle CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-white rounded-md hover:bg-primary/90"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </button>
        </div>
      </div>

      <div className="print:block hidden mb-4">
        <h2 className="text-lg font-bold">Horas Extra — {deptLabel}</h2>
        <p className="text-sm text-gray-600">Mes: {mes}</p>
      </div>

      {!loading && registros.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard label="Total horas" value={kpis.totalHoras.toFixed(1)} />
          <KpiCard label="Empleados" value={String(kpis.empleadosConHoras)} />
          <KpiCard
            label="Promedio / empleado"
            value={kpis.promedioPorEmpleado.toFixed(1)}
          />
          <KpiCard
            label="Semanas incompletas"
            value={String(kpis.semanasIncompletas)}
            warn={kpis.semanasIncompletas > 0}
          />
        </div>
      )}

      {loading ? (
        <div className="animate-pulse h-64 bg-gray-100 rounded-lg" />
      ) : resumen.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-gray-50 border border-dashed border-gray-200 rounded-lg">
          No hay horas extra registradas en {mes} para {deptLabel}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <Table className="w-full text-sm text-left">
            <TableHeader className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
              <TableRow>
                <TableHead className="px-6 py-3">Empleado</TableHead>
                <TableHead className="px-6 py-3 text-right">Total horas</TableHead>
                <TableHead className="px-6 py-3 text-right">Semanas</TableHead>
                <TableHead className="px-6 py-3 w-40 print:hidden" />
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100">
              {resumenFiltrado.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Sin resultados para la búsqueda
                  </TableCell>
                </TableRow>
              ) : (
                resumenFiltrado.map((item, index) => (
                  <TableRow key={item.empleado} className="hover:bg-gray-50">
                    <TableCell className="px-6 py-3 font-medium text-gray-900">
                      <span className="text-gray-400 text-xs mr-2">{index + 1}.</span>
                      {item.empleado}
                    </TableCell>
                    <TableCell className="px-6 py-3 text-right font-medium text-primary">
                      <Clock className="inline h-3.5 w-3.5 mr-1 opacity-60" />
                      {item.totalHoras.toFixed(1)}
                    </TableCell>
                    <TableCell className="px-6 py-3 text-right text-gray-600">
                      {item.semanas.length}
                    </TableCell>
                    <TableCell className="px-6 py-3 print:hidden">
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-primary h-full rounded-full opacity-70"
                          style={{
                            width: `${Math.max(
                              4,
                              resumenFiltrado[0]
                                ? (item.totalHoras / resumenFiltrado[0].totalHoras) * 100
                                : 0
                            )}%`,
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function KpiCard({
  label,
  value,
  warn = false,
}: {
  label: string
  value: string
  warn?: boolean
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${
        warn ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'
      }`}
    >
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${warn ? 'text-amber-800' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  )
}
