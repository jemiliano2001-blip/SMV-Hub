'use client'

import { useState, useMemo } from 'react'
import { useBanos } from '@/lib/hooks/useBanos'
import {
  calcularEstadisticasDiarias,
  generarTextoResumenDiario,
  generarExcelReporteDiario,
  formatearHorasMinutos,
} from '@/lib/banos-export'
import { descargarExcelEnNavegador } from '@/lib/excel-export-base'
import { copiarAlPortapapeles } from '@/lib/portapapeles'
import { fechaHoyLocal } from '@/lib/format'
import ModuleSurface from '@/components/layout/ModuleSurface'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Printer,
  FileSpreadsheet,
  Copy,
  Clock,
  Users,
  Timer,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

function getInitials(name: string) {
  return name
    .trim()
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()
}

function formatearFechaLegible(fechaStr: string): string {
  if (!fechaStr) return ''
  const [yyyy, mm, dd] = fechaStr.split('-').map(Number)
  if (!yyyy || !mm || !dd) return fechaStr
  const fecha = new Date(yyyy, mm - 1, dd)
  return fecha.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function sumarDias(fechaStr: string, dias: number): string {
  const [yyyy, mm, dd] = fechaStr.split('-').map(Number)
  const fecha = new Date(yyyy, mm - 1, dd)
  fecha.setDate(fecha.getDate() + dias)
  const nY = fecha.getFullYear()
  const nM = String(fecha.getMonth() + 1).padStart(2, '0')
  const nD = String(fecha.getDate()).padStart(2, '0')
  return `${nY}-${nM}-${nD}`
}

export default function ReporteDiarioBanos() {
  const [fecha, setFecha] = useState(() => fechaHoyLocal())
  const mesFiltro = fecha.slice(0, 7)
  const hoy = fechaHoyLocal()

  const { registros, loading, error, fetchRegistros } = useBanos(mesFiltro)
  const [exportandoExcel, setExportandoExcel] = useState(false)

  // Estadísticas del día
  const stats = useMemo(() => {
    return calcularEstadisticasDiarias(registros, fecha)
  }, [registros, fecha])

  function irHoy() {
    setFecha(hoy)
  }

  function irAyer() {
    setFecha(sumarDias(hoy, -1))
  }

  function irDiaAnterior() {
    setFecha(sumarDias(fecha, -1))
  }

  function irDiaSiguiente() {
    setFecha(sumarDias(fecha, 1))
  }

  const handleImprimir = () => {
    const tituloOriginal = document.title
    document.title = `Reporte_Diario_Banos_${fecha}`
    window.print()
    document.title = tituloOriginal
  }

  const handleCopiarWhatsApp = async () => {
    const texto = generarTextoResumenDiario(stats)
    await copiarAlPortapapeles(
      texto,
      'Resumen de reporte diario copiado para WhatsApp',
      'Listo para pegar en WhatsApp o correo'
    )
  }

  const handleExportarExcel = async () => {
    try {
      setExportandoExcel(true)
      const buffer = await generarExcelReporteDiario(stats)
      descargarExcelEnNavegador(buffer, `Reporte_Diario_Banos_${fecha}.xlsx`)
      toast.success('Reporte diario exportado a Excel')
    } catch (err) {
      console.error('Error exportando reporte diario a Excel:', err)
      toast.error('No se pudo exportar el reporte a Excel')
    } finally {
      setExportandoExcel(false)
    }
  }

  if (error) {
    return (
      <div className="text-destructive bg-destructive/10 border border-destructive/20 p-4 rounded-xl text-sm space-y-2">
        <p>{error}</p>
        <button
          onClick={fetchRegistros}
          className="font-semibold underline hover:no-underline cursor-pointer"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="reporte-formal-print space-y-6 print:space-y-2 print:p-0">
      {/* ── Encabezado Formal para Impresión (PDF a 1 Sola Página) ── */}
      <div className="hidden print:block print:border-b-2 print:border-black print:pb-2 print:mb-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12px] font-black uppercase tracking-widest print:text-black">
              SMV MAQUINADOS S.A. DE C.V.
            </p>
            <p className="text-[8px] tracking-wide print:text-gray-700">
              Control de Tiempos e Incidencias en Baño · Turno y Taller
            </p>
          </div>
          <div className="text-center">
            <p className="text-[13px] font-black uppercase tracking-wide print:text-black">
              REPORTE DIARIO DE CONTROL DE BAÑOS
            </p>
            <p className="text-[9px] font-bold capitalize print:text-gray-800">
              {formatearFechaLegible(fecha)}
            </p>
          </div>
          <div className="text-right text-[7.5px] leading-tight print:text-gray-600">
            <p className="font-semibold print:text-black">Responsable: Personal de Almacén</p>
            <p>
              Emitido: {new Date().toLocaleDateString('es-MX')}{' '}
              {new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {/* Resumen Ejecutivo en 1 solo renglón en el PDF */}
        <div className="mt-2 hidden print:grid print:grid-cols-4 print:gap-1 print:border print:border-black print:bg-muted/50 print:p-1.5 print:text-[8px] print:font-semibold print:text-center">
          <div>
            <span className="print:text-gray-600 print:font-normal">Total Visitas: </span>
            <span className="print:font-bold print:text-black">{stats.totalVisitas}</span>
          </div>
          <div>
            <span className="print:text-gray-600 print:font-normal">Operadores Distintos: </span>
            <span className="print:font-bold print:text-black">{stats.operadoresDistintos}</span>
          </div>
          <div>
            <span className="print:text-gray-600 print:font-normal">Tiempo Acumulado: </span>
            <span className="print:font-bold print:text-black">{formatearHorasMinutos(stats.tiempoTotalMinutos)}</span>
          </div>
          <div>
            <span className="print:text-gray-600 print:font-normal">Promedio / Visita: </span>
            <span className="print:font-bold print:text-black">{stats.promedioMinutosPorVisita} min</span>
            {stats.visitasProlongadas > 0 && (
              <span className="ml-1 print:text-black print:font-bold">({stats.visitasProlongadas} ≥ 15m)</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Barra de Controles y Selector de Fecha (Pantalla) ── */}
      <ModuleSurface className="p-4 sm:p-5 space-y-4 print:hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* Navegador de Fecha */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-xl border border-border bg-card p-1 shadow-2xs">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={irDiaAnterior}
                className="h-8 w-8 p-0 cursor-pointer text-muted-foreground hover:text-foreground"
                title="Día anterior"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <div className="relative flex items-center px-2">
                <Calendar className="size-4 mr-2 text-primary" />
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="text-xs sm:text-sm font-bold bg-transparent text-foreground border-0 focus:outline-none cursor-pointer"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={irDiaSiguiente}
                className="h-8 w-8 p-0 cursor-pointer text-muted-foreground hover:text-foreground"
                title="Día siguiente"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={irHoy}
                className={`h-8 px-3 text-xs font-semibold rounded-xl cursor-pointer ${
                  fecha === hoy ? 'border-primary text-primary bg-primary/10' : ''
                }`}
              >
                Hoy
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={irAyer}
                className={`h-8 px-3 text-xs font-semibold rounded-xl cursor-pointer ${
                  fecha === sumarDias(hoy, -1) ? 'border-primary text-primary bg-primary/10' : ''
                }`}
              >
                Ayer
              </Button>
            </div>

            <span className="text-xs text-muted-foreground capitalize hidden lg:inline ml-2 font-medium">
              {formatearFechaLegible(fecha)}
            </span>
          </div>

          {/* Acciones de Exportación */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopiarWhatsApp}
              disabled={stats.totalVisitas === 0}
              className="h-8 px-3 text-xs font-semibold gap-1.5 rounded-xl cursor-pointer flex-1 sm:flex-none"
              title="Copiar texto formateado para WhatsApp / Chat"
            >
              <Copy className="size-3.5" />
              <span>Copiar WhatsApp</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportarExcel}
              disabled={exportandoExcel || stats.totalVisitas === 0}
              className="h-8 px-3 text-xs font-semibold gap-1.5 rounded-xl cursor-pointer flex-1 sm:flex-none"
            >
              <FileSpreadsheet className="size-3.5" />
              <span>Excel</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleImprimir}
              disabled={stats.totalVisitas === 0}
              className="h-8 px-3.5 text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl cursor-pointer shadow-xs flex-1 sm:flex-none"
            >
              <Printer className="size-3.5" />
              <span>Guardar PDF</span>
            </Button>
          </div>
        </div>
      </ModuleSurface>

      {/* ── KPIs Ejecutivos del Día (Solo en Pantalla, Ocultos en PDF) ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:hidden">
        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <p className="text-[11px] font-medium uppercase tracking-wider">
              Total de Visitas
            </p>
            <Users className="size-4 opacity-70" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <p className="text-2xl font-extrabold text-foreground">
              {stats.totalVisitas}
            </p>
            <span className="text-xs text-muted-foreground font-medium">
              {stats.operadoresDistintos} operadores
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <p className="text-[11px] font-medium uppercase tracking-wider">
              Tiempo Total
            </p>
            <Clock className="size-4 text-primary opacity-80" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-primary font-mono">
            {formatearHorasMinutos(stats.tiempoTotalMinutos)}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <p className="text-[11px] font-medium uppercase tracking-wider">
              Promedio / Visita
            </p>
            <Timer className="size-4 opacity-70" />
          </div>
          <p className="mt-2 text-2xl font-extrabold text-foreground font-mono">
            {stats.promedioMinutosPorVisita}{' '}
            <span className="text-xs font-normal text-muted-foreground">
              min
            </span>
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <p className="text-[11px] font-medium uppercase tracking-wider">
              Visitas Prolongadas
            </p>
            <AlertTriangle className="size-4 text-amber-500 opacity-80" />
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-2xl font-extrabold text-foreground font-mono">
              {stats.visitasProlongadas}
            </p>
            {stats.visitasProlongadas > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                ≥ 15 min
              </span>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse h-64 bg-muted rounded-xl" />
      ) : stats.totalVisitas === 0 ? (
        <div className="text-center py-12 px-4 rounded-xl border border-dashed border-border bg-muted/30 text-muted-foreground space-y-3 print:hidden">
          <Clock className="size-10 mx-auto opacity-40 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">
            No se encontraron registros de baño para el {formatearFechaLegible(fecha)}
          </p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Puedes cambiar la fecha con el selector arriba o volver al día de hoy para registrar nuevas entradas.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={irHoy}
            className="text-xs font-bold rounded-xl cursor-pointer"
          >
            Ir a fecha de hoy
          </Button>
        </div>
      ) : (
        <div className="space-y-6 print:space-y-2">
          {/* ── Distribución por Ubicación de Baño (Solo en Pantalla, Oculto en PDF) ── */}
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">
              Uso por Baño:
            </span>
            {stats.porBano.map((b) => (
              <div
                key={b.bano}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-xl border border-border bg-card text-xs font-medium shadow-2xs"
              >
                <span className="font-semibold text-foreground">{b.bano}</span>
                <span className="text-muted-foreground">
                  {b.visitas} {b.visitas === 1 ? 'visita' : 'visitas'}
                </span>
                {b.tiempoTotalMinutos > 0 && (
                  <span className="font-mono text-[11px] text-primary font-medium">
                    ({b.tiempoTotalMinutos}m)
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* ── Tabla 1: Resumen Acumulado por Operador (Solo en Pantalla, Oculto en PDF) ── */}
          <div className="space-y-2.5 print:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Resumen acumulado por operador
                </h3>
              </div>
              <span className="text-xs text-muted-foreground">
                Ordenado por mayor tiempo ({stats.porOperador.length} operadores)
              </span>
            </div>

            <ModuleSurface className="overflow-hidden">
              <Table className="w-full text-xs">
                <TableHeader className="bg-muted text-muted-foreground font-semibold border-b border-border">
                  <TableRow>
                    <TableHead className="px-4 py-2.5 w-12 text-muted-foreground font-mono">#</TableHead>
                    <TableHead className="px-4 py-2.5">Operador</TableHead>
                    <TableHead className="px-4 py-2.5 text-center w-20">Visitas</TableHead>
                    <TableHead className="px-4 py-2.5 text-right w-24">Total Min</TableHead>
                    <TableHead className="px-4 py-2.5 text-right w-24">Promedio</TableHead>
                    <TableHead className="px-4 py-2.5">Horarios de Visitas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border">
                  {stats.porOperador.map((op, idx) => (
                    <TableRow key={op.operador} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="px-4 py-2 text-muted-foreground font-mono text-xs">
                        {idx + 1}.
                      </TableCell>
                      <TableCell className="px-4 py-2 font-semibold text-foreground">
                        <div className="flex items-center gap-2.5">
                          <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                            {getInitials(op.operador)}
                          </div>
                          <span>{op.operador}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-2 text-center font-bold text-foreground">
                        {op.visitas}
                      </TableCell>
                      <TableCell className="px-4 py-2 text-right font-extrabold text-primary font-mono">
                        {op.tiempoTotalMinutos} min
                      </TableCell>
                      <TableCell className="px-4 py-2 text-right text-muted-foreground font-mono">
                        {op.tiempoPromedioMinutos} min
                      </TableCell>
                      <TableCell className="px-4 py-2">
                        <div className="flex flex-wrap gap-1.5">
                          {op.visitasDetalle.map((v, vIdx) => {
                            const esProlongado = typeof v.minutos === 'number' && v.minutos >= 15
                            const esEnCurso = !v.horaLlegada

                            return (
                              <span
                                key={vIdx}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-mono transition-colors ${
                                  esEnCurso
                                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold'
                                    : esProlongado
                                    ? 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300 font-semibold'
                                    : 'border-border/60 bg-muted/60 text-foreground'
                                }`}
                              >
                                <span>{v.horaEntrada} - {v.horaLlegada || 'En curso'}</span>
                                <span className={esProlongado ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-muted-foreground'}>
                                  ({v.minutos !== null ? `${v.minutos}m` : '—'})
                                </span>
                                <span className="text-muted-foreground/70">· {v.bano}</span>
                              </span>
                            )
                          })}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ModuleSurface>
          </div>

          {/* ── Tabla 2: Registro Cronológico de Entradas y Salidas (Principal en Pantalla y Única en PDF) ── */}
          <div className="space-y-2.5 print:space-y-1">
            <div className="flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Registro cronológico de entradas y salidas
                </h3>
              </div>
              <span className="text-xs text-muted-foreground">
                {stats.registros.length} movimientos registrados
              </span>
            </div>

            <ModuleSurface className="overflow-hidden print:border-none print:rounded-none print:shadow-none print:bg-white">
              <Table className="w-full text-xs print:text-[8.5px] print:border print:border-black print:border-collapse">
                <TableHeader className="bg-muted text-muted-foreground font-semibold border-b border-border print:bg-[#111111] print:text-white print:border-b-2 print:border-black">
                  <TableRow>
                    <TableHead className="px-4 py-2.5 w-10 text-muted-foreground font-mono print:px-1.5 print:py-1.5 print:text-white print:font-bold print:w-7 print:text-center print:border-r print:border-gray-700">#</TableHead>
                    <TableHead className="px-4 py-2.5 print:px-2 print:py-1.5 print:text-white print:font-bold print:border-r print:border-gray-700">Operador</TableHead>
                    <TableHead className="px-4 py-2.5 print:px-2 print:py-1.5 print:text-white print:font-bold print:w-24 print:border-r print:border-gray-700">Baño</TableHead>
                    <TableHead className="px-4 py-2.5 text-center w-24 print:px-2 print:py-1.5 print:text-white print:font-bold print:w-20 print:border-r print:border-gray-700">Entrada</TableHead>
                    <TableHead className="px-4 py-2.5 text-center w-24 print:px-2 print:py-1.5 print:text-white print:font-bold print:w-20 print:border-r print:border-gray-700">Salida / Llegó</TableHead>
                    <TableHead className="px-4 py-2.5 text-right w-24 print:px-2 print:py-1.5 print:text-white print:font-bold print:w-20 print:border-r print:border-gray-700">Duración</TableHead>
                    <TableHead className="px-4 py-2.5 text-center w-28 print:px-2 print:py-1.5 print:text-white print:font-bold print:w-20">Estatus</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border print:divide-gray-300">
                  {stats.registros.map((r, idx) => {
                    const esProlongado = typeof r.tiempoMinutos === 'number' && r.tiempoMinutos >= 15
                    const esEnCurso = !r.horaLlegada

                    return (
                      <TableRow
                        key={r.id}
                        className="hover:bg-muted/50 transition-colors print:hover:bg-transparent print:border-b print:border-gray-300 print:break-inside-avoid"
                      >
                        <TableCell className="px-4 py-2 text-muted-foreground font-mono text-xs print:px-1.5 print:py-1 print:text-[8px] print:text-black print:text-center print:border-r print:border-gray-200">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="px-4 py-2 font-medium text-foreground print:px-2 print:py-1 print:text-[8.5px] print:text-black print:font-semibold print:border-r print:border-gray-200">
                          {r.operador}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-muted-foreground print:px-2 print:py-1 print:text-[8px] print:text-black print:border-r print:border-gray-200">
                          {r.bano}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-center font-mono font-medium text-foreground print:px-2 print:py-1 print:text-[8px] print:text-black print:border-r print:border-gray-200">
                          {r.horaEntrada}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-center font-mono text-muted-foreground print:px-2 print:py-1 print:text-[8px] print:text-black print:border-r print:border-gray-200">
                          {r.horaLlegada || '—'}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-right font-mono font-bold print:px-2 print:py-1 print:text-[8px] print:text-black print:border-r print:border-gray-200">
                          {r.tiempoMinutos !== null ? (
                            <span className={esProlongado ? 'text-rose-600 dark:text-rose-400 font-extrabold print:text-black' : 'text-foreground print:text-black'}>
                              {r.tiempoMinutos} min
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-medium print:text-black">En curso</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-center print:px-2 print:py-1">
                          {esEnCurso ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 print:text-[7.5px] print:text-black print:border-black print:border print:bg-transparent print:px-1 print:py-0">
                              En baño
                            </span>
                          ) : esProlongado ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 print:text-[7.5px] print:text-black print:border-black print:border print:bg-transparent print:px-1 print:py-0">
                              ≥ 15 min
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 print:text-[7.5px] print:text-black print:border-0 print:bg-transparent print:px-0">
                              Normal
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ModuleSurface>
          </div>

          {/* ── Pie de Firmas Formales en Impresión PDF (Compacto a 1 sola página) ── */}
          <div className="mt-6 hidden items-end justify-around pt-4 print:flex print:break-inside-avoid">
            <div className="text-center">
              <div className="mx-auto mb-1 w-44 border-b border-black"></div>
              <p className="text-[8.5px] font-bold text-black uppercase tracking-wider">
                Entregó / Personal de Almacén
              </p>
              <p className="text-[7.5px] print:text-gray-700">Control y Registro de Incidencias</p>
            </div>
            <div className="text-center">
              <div className="mx-auto mb-1 w-44 border-b border-black"></div>
              <p className="text-[8.5px] font-bold text-black uppercase tracking-wider">
                Recibió / Supervisión RH
              </p>
              <p className="text-[7.5px] print:text-gray-700">Revisión y Autorización de Turno</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

