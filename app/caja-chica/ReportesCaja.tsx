'use client'

import { useMemo, useState, useEffect } from 'react'
import { Printer, FileText, Table2, Filter } from 'lucide-react'
import { useCajaChica } from '@/lib/hooks/useCajaChica'
import { filtrarMovimientosCajaChicaReporte, calcularTotalesReporteCaja } from '@/lib/reportes-caja-chica'
import { formatPrecio } from '@/lib/format'
import { listarCortesCaja, type CorteCaja, type ModoFiltroCaja } from '@/lib/caja-chica'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import ModuleSurface from '@/components/layout/ModuleSurface'

import { toast } from 'sonner'
import { generarExcelReporteCaja } from '@/lib/caja-chica-export'
import { descargarExcelEnNavegador } from '@/lib/excel-export-base'
import { useFilePreview } from '@/components/FilePreviewProvider'

export default function ReportesCaja() {
  const { previewFile } = useFilePreview()
  const [modoFiltro, setModoFiltro] = useState<ModoFiltroCaja>('CICLO_ACTIVO')
  const [periodo, setPeriodo] = useState(() => {
    const hoy = new Date()
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  })
  const [corteIdSel, setCorteIdSel] = useState<string>('')
  const [cortesHistorial, setCortesHistorial] = useState<CorteCaja[]>([])
  const [conFactura, setConFactura] = useState(true)
  const [exportando, setExportando] = useState(false)

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

  const filtroActual = useMemo(() => {
    return {
      modo: modoFiltro,
      periodo,
      corteId: corteIdSel,
    }
  }, [modoFiltro, periodo, corteIdSel])

  const { movimientos, loading, error } = useCajaChica(filtroActual)

  const filtrados = useMemo(
    () => filtrarMovimientosCajaChicaReporte(movimientos, conFactura),
    [movimientos, conFactura]
  )
  const { total } = useMemo(() => calcularTotalesReporteCaja(filtrados), [filtrados])

  const etiquetaModo = useMemo(() => {
    if (modoFiltro === 'CICLO_ACTIVO') return 'Ciclo Activo (Sin corte)'
    if (modoFiltro === 'TODOS') return 'Todos los Movimientos Históricos'
    if (modoFiltro === 'PERIODO') return `Mes ${periodo}`
    const c = cortesHistorial.find((item) => item.id === corteIdSel)
    return c ? `${c.folio} (${c.fechaCierre})` : 'Corte de Caja'
  }, [modoFiltro, periodo, corteIdSel, cortesHistorial])

  const exportarExcel = async () => {
    if (filtrados.length === 0) return
    try {
      setExportando(true)
      const buffer = await generarExcelReporteCaja({
        movimientos: filtrados,
        etiquetaModo,
        conFactura,
      })
      const sufijoModo = modoFiltro.toLowerCase()
      const nombre = `Reporte_CajaChica_${sufijoModo}${conFactura ? '_ConFactura' : '_SinFactura'}_${new Date().toISOString().slice(0, 10)}.xlsx`
      descargarExcelEnNavegador(buffer, nombre)
      toast.success('Reporte de caja chica exportado a Excel')
    } catch (err) {
      console.error('Error exportando caja chica a Excel:', err)
      toast.error('No se pudo exportar el archivo Excel.')
    } finally {
      setExportando(false)
    }
  }

  const handleImprimir = () => {
    const tituloOriginal = document.title
    document.title = `Reporte_CajaChica_${modoFiltro}_${conFactura ? 'ConFactura' : 'SinFactura'}`
    window.print()
    document.title = tituloOriginal
  }

  const columnas = 6

  return (
    <div className="reporte-formal-print space-y-4">
      {/* Cabecera formal de Impresión (PDF) */}
      <div className="mb-3 hidden print:flex print:items-center print:justify-between print:bg-[#111111] print:px-3 print:py-2.5 print:text-white">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest">SMV Maquinados</p>
          <p className="mt-0.5 text-[8px] tracking-wide print:text-gray-400">S.A. de C.V.</p>
        </div>
        <div className="text-center">
          <p className="text-[12.5px] font-semibold uppercase tracking-wide">Reporte de Caja Chica</p>
          <p className="mt-1 text-[8.5px] print:text-gray-400">{etiquetaModo} · Gastos {conFactura ? 'Con Factura' : 'Sin Factura'}</p>
        </div>
        <div className="text-right text-[8px] leading-relaxed print:text-gray-400">
          <p>MXN · {filtrados.length} movimientos</p>
          <p>Generado el {new Date().toLocaleDateString('es-MX')}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de Modo */}
          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <select
              value={modoFiltro}
              onChange={(e) => setModoFiltro(e.target.value as ModoFiltroCaja)}
              className="px-3 py-2 text-xs font-bold border border-input bg-card rounded-md focus:outline-none focus:border-primary text-foreground"
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
              className="px-3 py-2 text-xs font-mono border border-input bg-card rounded-md focus:outline-none focus:border-primary text-foreground"
            />
          )}

          {modoFiltro === 'CORTE' && (
            <select
              value={corteIdSel}
              onChange={(e) => setCorteIdSel(e.target.value)}
              className="px-3 py-2 text-xs font-mono border border-input bg-card rounded-md focus:outline-none focus:border-primary text-foreground"
            >
              {cortesHistorial.length === 0 ? (
                <option value="">Sin cortes realizados</option>
              ) : (
                cortesHistorial.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.folio} ({c.fechaCierre}) — ${c.saldoReembolsado.toFixed(2)}
                  </option>
                ))
              )}
            </select>
          )}

          <div className="flex bg-muted p-1 rounded-lg">
            {([true, false] as const).map((valor) => (
              <button
                key={String(valor)}
                onClick={() => setConFactura(valor)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  conFactura === valor
                    ? 'bg-card text-primary shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
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
            disabled={filtrados.length === 0 || exportando}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            <Table2 className="h-3.5 w-3.5" /> Exportar Excel
          </button>
          <button
            onClick={handleImprimir}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Printer className="h-3.5 w-3.5" /> Guardar PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm print:hidden">
          {error}
        </div>
      )}

      <ModuleSurface className="overflow-x-auto print:border-0 print:p-0 print:overflow-visible print:shadow-none">
        <Table className="w-full text-sm text-left print:text-[9px]">
          <TableHeader className="bg-muted text-muted-foreground font-semibold border-b border-border print:bg-[#111111] print:border-b-0">
            <TableRow>
              <TableHead className="px-4 py-3 print:px-2 print:py-1.5 print:text-[7.5px] print:font-medium print:uppercase print:tracking-widest print:text-white">Fecha</TableHead>
              <TableHead className="px-4 py-3 print:px-2 print:py-1.5 print:text-[7.5px] print:font-medium print:uppercase print:tracking-widest print:text-white">Descripción</TableHead>
              <TableHead className="px-4 py-3 print:px-2 print:py-1.5 print:text-[7.5px] print:font-medium print:uppercase print:tracking-widest print:text-white">Proveedor</TableHead>
              <TableHead className="px-4 py-3 print:px-2 print:py-1.5 print:text-[7.5px] print:font-medium print:uppercase print:tracking-widest print:text-white">Categoría</TableHead>
              <TableHead className="px-4 py-3 print:px-2 print:py-1.5 print:text-[7.5px] print:font-medium print:uppercase print:tracking-widest print:text-white">Comprobante</TableHead>
              <TableHead className="px-4 py-3 text-right print:px-2 print:py-1.5 print:text-[7.5px] print:font-medium print:uppercase print:tracking-widest print:text-white">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border print:divide-gray-300">
            {loading ? (
              <TableRow>
                <TableCell colSpan={columnas} className="px-4 py-8 text-center text-muted-foreground">
                  Cargando movimientos...
                </TableCell>
              </TableRow>
            ) : filtrados.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnas} className="px-4 py-8 text-center text-muted-foreground">
                  Sin movimientos {conFactura ? 'con factura' : 'sin factura'} para esta selección.
                </TableCell>
              </TableRow>
            ) : (
              filtrados.map((m) => (
                <TableRow key={m.id} className="hover:bg-muted print:hover:bg-white">
                  <TableCell className="px-4 py-3 text-foreground print:px-2 print:py-2">{m.fecha}</TableCell>
                  <TableCell
                    className="px-4 py-3 text-foreground max-w-[220px] truncate print:max-w-none print:whitespace-normal print:px-2 print:py-2"
                    title={m.descripcion}
                  >
                    {m.descripcion}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground print:px-2 print:py-2">{m.proveedor}</TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground text-xs print:px-2 print:py-2">{m.categoria}</TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground text-xs print:px-2 print:py-2">
                    <div className="flex items-center gap-1.5">
                      <span>{m.comprobante}</span>
                      {m.archivoUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            previewFile({
                              url: m.archivoUrl!,
                              nombre: `Comprobante-${m.comprobante || m.id}`,
                              titulo: `Comprobante · ${m.proveedor || m.descripcion}`,
                              subtitulo: `${m.categoria} · ${m.fecha} · ${formatPrecio(m.monto, 'MXN')}`,
                            })
                          }
                          className="text-primary hover:text-sky-800 p-0.5 rounded hover:bg-primary/10 transition-colors print:hidden cursor-pointer"
                          title="Ver comprobante digital"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right font-medium text-foreground tabular-nums print:px-2 print:py-2">
                    {formatPrecio(m.monto, 'MXN')}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {filtrados.length > 0 && (
            <TableFooter>
              <TableRow className="border-t-2 border-border font-semibold text-foreground print:border-gray-900 print:text-sm">
                <TableCell className="px-4 py-3 print:px-2 print:py-3" colSpan={5}>
                  TOTAL
                </TableCell>
                <TableCell className="px-4 py-3 text-right tabular-nums print:px-2 print:py-3">
                  {formatPrecio(total, 'MXN')}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </ModuleSurface>

      {/* Pie de Firmas (Solo PDF) */}
      <div className="mt-32 hidden items-end justify-around pt-8 print:flex">
        <div className="text-center">
          <div className="mx-auto mb-2 w-64 border-b border-foreground"></div>
          <p className="text-sm font-bold text-foreground">Elaboró</p>
          <p className="text-xs text-muted-foreground">Nombre y Firma del Responsable</p>
        </div>
        <div className="text-center">
          <div className="mx-auto mb-2 w-64 border-b border-foreground"></div>
          <p className="text-sm font-bold text-foreground">Revisó / Autorizó</p>
          <p className="text-xs text-muted-foreground">Nombre y Firma de Gerencia</p>
        </div>
      </div>
    </div>
  )
}
