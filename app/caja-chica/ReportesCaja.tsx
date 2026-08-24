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

export default function ReportesCaja() {
  const [modoFiltro, setModoFiltro] = useState<ModoFiltroCaja>('CICLO_ACTIVO')
  const [periodo, setPeriodo] = useState(() => {
    const hoy = new Date()
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  })
  const [corteIdSel, setCorteIdSel] = useState<string>('')
  const [cortesHistorial, setCortesHistorial] = useState<CorteCaja[]>([])
  const [conFactura, setConFactura] = useState(true)

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
    const XLSX = await import('xlsx')

    const datos = filtrados.map((m) => {
      const fila: Record<string, string | number> = {
        Fecha: m.fecha,
        Descripción: m.descripcion,
        'Proveedor / Lugar': m.proveedor,
        Categoría: m.categoria,
        Comprobante: m.comprobante,
        'Monto ($)': m.monto,
      }
      return fila
    })

    datos.push({
      Fecha: '',
      Descripción: '',
      'Proveedor / Lugar': '',
      Categoría: '',
      Comprobante: '',
      'Monto ($)': '',
    })

    const filaTotal: Record<string, string | number> = {
      Fecha: 'TOTALES',
      'Monto ($)': total,
    }
    datos.push(filaTotal)

    const worksheet = XLSX.utils.json_to_sheet(datos)
    const wscols = [
      { wch: 12 },
      { wch: 40 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
    ]
    worksheet['!cols'] = wscols

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte Caja Chica')

    const sufijoModo = modoFiltro.toLowerCase()
    XLSX.writeFile(workbook, `Reporte_CajaChica_${sufijoModo}${conFactura ? '_ConFactura' : '_SinFactura'}.xlsx`)
  }

  const columnas = 6

  return (
    <div className="space-y-4 print:space-y-6">
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
            disabled={filtrados.length === 0}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Table2 className="h-3.5 w-3.5" /> Exportar Excel
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg bg-card border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <Printer className="h-3.5 w-3.5" /> Guardar PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm print:hidden">
          {error}
        </div>
      )}

      {/* Cabecera de Impresión (PDF) */}
      <div className="hidden print:block mb-6 pb-4 border-b-2 border-gray-900">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-black text-foreground tracking-tight">SMV MAQUINADOS</h1>
            <h2 className="text-xl font-bold text-foreground mt-1 uppercase tracking-wider">Reporte de Caja Chica</h2>
          </div>
          <div className="text-right text-sm text-foreground">
            <p><span className="font-semibold">Selección:</span> {etiquetaModo}</p>
            <p><span className="font-semibold">Filtro:</span> Gastos {conFactura ? 'Con Factura' : 'Sin Factura'}</p>
            <p><span className="font-semibold">Fecha de Emisión:</span> {new Date().toLocaleDateString('es-MX')}</p>
          </div>
        </div>
      </div>

      <ModuleSurface className="overflow-x-auto print:border-0 print:overflow-visible print:shadow-none">
        <Table className="w-full text-sm text-left print:text-xs">
          <TableHeader className="bg-muted text-muted-foreground font-medium border-b border-border print:bg-white print:border-b-2 print:border-gray-900 print:text-gray-900">
            <TableRow>
              <TableHead className="px-4 py-3 print:px-2 print:py-2">Fecha</TableHead>
              <TableHead className="px-4 py-3 print:px-2 print:py-2">Descripción</TableHead>
              <TableHead className="px-4 py-3 print:px-2 print:py-2">Proveedor</TableHead>
              <TableHead className="px-4 py-3 print:px-2 print:py-2">Categoría</TableHead>
              <TableHead className="px-4 py-3 print:px-2 print:py-2">Comprobante</TableHead>
              <TableHead className="px-4 py-3 text-right print:px-2 print:py-2">Monto</TableHead>
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
                        <a
                          href={m.archivoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary hover:underline flex items-center gap-0.5 print:hidden font-normal"
                          title="Ver comprobante digital"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </a>
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
