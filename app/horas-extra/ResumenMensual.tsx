'use client'

import { useState, useMemo } from 'react'
import { useHorasExtraMensual } from '@/lib/hooks/useHorasExtra'
import {
  totalesPorEmpleado,
  calcularKpisResumen,
} from '@/lib/horas-extra-resumen'
import {
  generarExcelResumenHorasExtra,
  generarExcelDetalleHorasExtra,
} from '@/lib/horas-extra-export'
import { descargarExcelEnNavegador } from '@/lib/excel-export-base'
import type { Departamento } from '@/lib/schemas'
import { fechaHoyLocal } from '@/lib/format'
import { Clock, Search, Printer, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
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
  const [mes, setMes] = useState(() => fechaHoyLocal().slice(0, 7))
  const [busqueda, setBusqueda] = useState('')
  const [exportando, setExportando] = useState(false)

  const { registros, loading, error } = useHorasExtraMensual(mes, departamento)

  const resumen = useMemo(() => totalesPorEmpleado(registros), [registros])
  const kpis = useMemo(() => calcularKpisResumen(registros), [registros])

  const resumenFiltrado = resumen.filter((item) =>
    item.empleado.toLowerCase().includes(busqueda.toLowerCase())
  )

  const deptLabel = DEPARTAMENTO_LABEL[departamento]

  async function exportarResumen() {
    if (resumenFiltrado.length === 0) return
    try {
      setExportando(true)
      const buffer = await generarExcelResumenHorasExtra({
        resumen: resumenFiltrado,
        mes,
        departamentoLabel: deptLabel,
      })
      descargarExcelEnNavegador(buffer, `Horas_Extra_Resumen_${departamento}_${mes}.xlsx`)
      toast.success('Resumen de horas extra exportado a Excel')
    } catch (err) {
      console.error('Error exportando resumen a Excel:', err)
      toast.error('No se pudo exportar el resumen a Excel.')
    } finally {
      setExportando(false)
    }
  }

  async function exportarDetalle() {
    if (registros.length === 0) return
    try {
      setExportando(true)
      const buffer = await generarExcelDetalleHorasExtra({
        registros,
        mes,
        departamentoLabel: deptLabel,
      })
      descargarExcelEnNavegador(buffer, `Horas_Extra_Detalle_${departamento}_${mes}.xlsx`)
      toast.success('Detalle de horas extra exportado a Excel')
    } catch (err) {
      console.error('Error exportando detalle a Excel:', err)
      toast.error('No se pudo exportar el detalle a Excel.')
    } finally {
      setExportando(false)
    }
  }

  const handleImprimir = () => {
    const tituloOriginal = document.title
    document.title = `Horas_Extra_${departamento}_${mes}`
    window.print()
    document.title = tituloOriginal
  }

  if (error) {
    return <div className="text-destructive bg-destructive/10 border border-destructive/20 p-4 rounded-lg text-sm">{error}</div>
  }

  return (
    <div className="reporte-formal-print space-y-6 print:space-y-4" id="resumen-horas-extra">
      {/* Cabecera formal de Impresión (PDF) */}
      <div className="mb-3 hidden print:flex print:items-center print:justify-between print:bg-[#111111] print:px-3 print:py-2.5 print:text-white">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest">SMV Maquinados</p>
          <p className="mt-0.5 text-[8px] tracking-wide print:text-gray-400">S.A. de C.V.</p>
        </div>
        <div className="text-center">
          <p className="text-[12.5px] font-semibold uppercase tracking-wide">Control de Horas Extra — {deptLabel}</p>
          <p className="mt-1 text-[8.5px] print:text-gray-400">Mes: {mes}</p>
        </div>
        <div className="text-right text-[8px] leading-relaxed print:text-gray-400">
          <p>{resumenFiltrado.length} empleados</p>
          <p>Generado el {new Date().toLocaleDateString('es-MX')}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-muted border border-border rounded-lg p-4 print:hidden">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-foreground">Mes:</label>
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="px-3 py-1.5 text-sm border border-input bg-card text-foreground rounded-md focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar empleado..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-input bg-card text-foreground rounded-md focus:outline-none focus:border-primary"
            />
          </div>
          <button
            type="button"
            onClick={exportarResumen}
            disabled={resumenFiltrado.length === 0 || exportando}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-card border border-border rounded-md hover:bg-muted text-foreground disabled:opacity-50 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Resumen Excel
          </button>
          <button
            type="button"
            onClick={exportarDetalle}
            disabled={registros.length === 0 || exportando}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-card border border-border rounded-md hover:bg-muted text-foreground disabled:opacity-50 transition-colors"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Detalle Excel
          </button>
          <button
            type="button"
            onClick={handleImprimir}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            Guardar PDF
          </button>
        </div>
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
        <div className="animate-pulse h-64 bg-muted rounded-lg" />
      ) : resumen.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground bg-muted border border-dashed border-border rounded-lg">
          No hay horas extra registradas en {mes} para {deptLabel}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden shadow-xs print:rounded-none print:border-0 print:shadow-none">
          <Table className="w-full text-sm text-left print:text-[9px]">
            <TableHeader className="bg-muted text-muted-foreground font-semibold border-b border-border print:bg-[#111111] print:border-b-0">
              <TableRow>
                <TableHead className="px-6 py-3 print:px-2 print:py-1.5 print:text-[7.5px] print:font-medium print:uppercase print:tracking-widest print:text-white">Empleado</TableHead>
                <TableHead className="px-6 py-3 text-right print:px-2 print:py-1.5 print:text-[7.5px] print:font-medium print:uppercase print:tracking-widest print:text-white">Total horas</TableHead>
                <TableHead className="px-6 py-3 text-right print:px-2 print:py-1.5 print:text-[7.5px] print:font-medium print:uppercase print:tracking-widest print:text-white">Semanas</TableHead>
                <TableHead className="px-6 py-3 w-40 print:hidden" />
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border print:divide-border/60">
              {resumenFiltrado.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                    Sin resultados para la búsqueda
                  </TableCell>
                </TableRow>
              ) : (
                resumenFiltrado.map((item, index) => (
                  <TableRow key={item.empleado} className={`hover:bg-muted print:hover:bg-transparent ${index % 2 === 1 ? "print:bg-[#fafafa]" : ""}`}>
                    <TableCell className="px-6 py-3 font-medium text-foreground print:px-2 print:py-1 print:text-[8.5px] print:text-black">
                      <span className="text-muted-foreground text-xs mr-2 print:text-[7.5px]">{index + 1}.</span>
                      {item.empleado}
                    </TableCell>
                    <TableCell className="px-6 py-3 text-right font-medium text-primary print:px-2 print:py-1 print:font-mono print:text-[8.5px] print:text-black">
                      <Clock className="inline h-3.5 w-3.5 mr-1 opacity-60 print:hidden" />
                      {item.totalHoras.toFixed(1)} hrs
                    </TableCell>
                    <TableCell className="px-6 py-3 text-right text-muted-foreground print:px-2 print:py-1 print:font-mono print:text-[8.5px] print:text-gray-700">
                      {item.semanas.length}
                    </TableCell>
                    <TableCell className="px-6 py-3 print:hidden">
                      <div className="w-full bg-muted rounded-full h-1.5">
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

      {/* Pie de Firmas para Impresión Formal */}
      <div className="mt-16 hidden items-end justify-around pt-6 print:flex">
        <div className="text-center">
          <div className="mx-auto mb-1.5 w-56 border-b border-foreground"></div>
          <p className="text-xs font-bold text-foreground">Supervisor / Responsable de Área</p>
          <p className="text-[10px] text-muted-foreground">{deptLabel}</p>
        </div>
        <div className="text-center">
          <div className="mx-auto mb-1.5 w-56 border-b border-foreground"></div>
          <p className="text-xs font-bold text-foreground">Revisó y Aprobó Nómina</p>
          <p className="text-[10px] text-muted-foreground">Administración / RH</p>
        </div>
      </div>
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
        warn ? 'border-amber-200 bg-amber-50' : 'border-border bg-card'
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${warn ? 'text-amber-800' : 'text-foreground'}`}>
        {value}
      </p>
    </div>
  )
}
