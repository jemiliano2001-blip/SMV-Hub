'use client'

import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatPrecio } from '@/lib/format'
import type { OrdenCompra } from '@/lib/schemas'
import {
  armarVistaPreviaLote,
  armarVistaPreviaOrden,
  descargarExcelLoteOrdenes,
  descargarExcelOrden,
  type VistaPreviaExcelCelda,
} from '@/lib/orden-excel-export'

export type ModoVistaPreviaExcel = 'orden' | 'lote'

interface Props {
  open: boolean
  onClose: () => void
  modo: ModoVistaPreviaExcel
  orden?: OrdenCompra | null
  ordenes?: OrdenCompra[]
}

function esColumnaMonetaria(header: string): boolean {
  const h = header.toLowerCase()
  return (
    h.includes('p. unitario') ||
    h.includes('total') ||
    h.includes('precio')
  )
}

function esColumnaNumerica(header: string): boolean {
  const h = header.toLowerCase()
  return h === '#' || h === 'cant.' || h.includes('cantidad')
}

function formatearCelda(
  valor: VistaPreviaExcelCelda,
  header: string,
  monedaFila?: string
): string {
  if (typeof valor === 'number') {
    if (esColumnaMonetaria(header)) {
      return formatPrecio(valor, monedaFila || 'USD')
    }
    if (esColumnaNumerica(header)) {
      return valor.toLocaleString('es-MX', { maximumFractionDigits: 3 })
    }
    return String(valor)
  }
  return valor
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="truncate text-xs font-semibold text-foreground">{value}</dd>
    </div>
  )
}

export default function ModalVistaPreviaExcelOrden({
  open,
  onClose,
  modo,
  orden = null,
  ordenes = [],
}: Props) {
  const [descargando, setDescargando] = useState(false)

  const vista = useMemo(() => {
    if (modo === 'orden' && orden) return armarVistaPreviaOrden(orden)
    if (modo === 'lote' && ordenes.length > 0) return armarVistaPreviaLote(ordenes)
    return null
  }, [modo, orden, ordenes])

  const tituloDialog =
    modo === 'lote'
      ? `Vista previa — Consolidado de ${ordenes.length} órdenes`
      : 'Vista previa — Orden de compra'

  const monedaDefault = vista?.meta.moneda || 'USD'
  const idxMonedaLote = vista?.columnas.findIndex((c) => c === 'Moneda') ?? -1

  const handleDescargar = async () => {
    if (!vista) {
      toast.error('No hay datos disponibles para exportar')
      return
    }
    try {
      setDescargando(true)
      if (modo === 'orden' && orden) {
        await descargarExcelOrden(orden)
        toast.success(`Excel generado para ${orden.proveedor}`)
      } else if (modo === 'lote' && ordenes.length > 0) {
        await descargarExcelLoteOrdenes(ordenes, vista.nombreArchivo)
        toast.success(`Consolidado Excel de ${ordenes.length} órdenes descargado`)
      } else {
        toast.error('No hay datos disponibles para exportar')
        return
      }
      onClose()
    } catch (err) {
      console.error('Error al generar Excel de órdenes:', err)
      toast.error('No se pudo generar el archivo Excel')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 print:hidden sm:max-w-4xl">
        <DialogHeader className="border-b border-border bg-muted/40 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg border border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              <FileSpreadsheet className="size-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold text-foreground">
                {tituloDialog}
              </DialogTitle>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {vista?.nombreArchivo ?? '—'}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-6 text-sm">
          {!vista ? (
            <p className="text-sm text-muted-foreground" role="status">
              No hay órdenes para previsualizar.
            </p>
          ) : (
            <>
              <div className="space-y-1">
                <h3 className="text-sm font-bold tracking-tight text-foreground">
                  {vista.meta.titulo}
                </h3>
                {vista.meta.subtitulo && (
                  <p className="text-xs text-muted-foreground">{vista.meta.subtitulo}</p>
                )}
              </div>

              {modo === 'orden' && (
                <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/60 p-3.5 sm:grid-cols-4">
                  <MetaItem label="Proveedor" value={vista.meta.proveedor || '—'} />
                  <MetaItem label="N° factura" value={vista.meta.numeroFactura || '—'} />
                  <MetaItem label="Requisitor" value={vista.meta.requisitor || '—'} />
                  <MetaItem label="Empresa" value={vista.meta.empresa || '—'} />
                  <MetaItem label="Moneda" value={vista.meta.moneda || '—'} />
                  <MetaItem label="Estado" value={vista.meta.estado || '—'} />
                  <MetaItem label="Fecha" value={vista.meta.fecha || '—'} />
                  <MetaItem label="Cuenta cargo" value={vista.meta.cuentaCargo || '—'} />
                  <MetaItem label="OT" value={vista.meta.ordenTrabajo || '—'} />
                  <MetaItem label="Recepción" value={vista.meta.recepcion || '—'} />
                </dl>
              )}

              {modo === 'lote' && (
                <div className="rounded-lg border border-border bg-muted/60 px-3.5 py-2.5 text-xs">
                  <span className="text-muted-foreground">Órdenes en consolidado: </span>
                  <span className="font-mono font-bold text-foreground">
                    {vista.meta.numOrdenes ?? ordenes.length}
                  </span>
                  <span className="text-muted-foreground"> · Partidas: </span>
                  <span className="font-mono font-bold text-foreground">{vista.filas.length}</span>
                </div>
              )}

              <div className="overflow-x-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      {vista.columnas.map((col) => (
                        <TableHead
                          key={col}
                          className="sticky top-0 h-8 whitespace-nowrap bg-muted px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
                        >
                          {col}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vista.filas.map((fila, rowIdx) => {
                      const monedaFila =
                        idxMonedaLote >= 0 && typeof fila[idxMonedaLote] === 'string'
                          ? String(fila[idxMonedaLote])
                          : monedaDefault
                      return (
                        <TableRow
                          key={rowIdx}
                          className={rowIdx % 2 === 1 ? 'bg-muted/40' : undefined}
                        >
                          {fila.map((celda, colIdx) => {
                            const header = vista.columnas[colIdx] ?? ''
                            const alignRight =
                              esColumnaMonetaria(header) || esColumnaNumerica(header)
                            return (
                              <TableCell
                                key={colIdx}
                                className={`px-2 py-1.5 text-[11px] text-foreground ${
                                  alignRight ? 'text-right font-mono tabular-nums' : 'max-w-[14rem] truncate'
                                }`}
                                title={String(celda)}
                              >
                                {formatearCelda(celda, header, monedaFila)}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {vista.totales.length > 0 && (
                <div className="ml-auto w-full max-w-sm space-y-1.5 rounded-lg border border-border bg-muted/40 px-3.5 py-3">
                  {vista.totales.map((t) => (
                    <div
                      key={t.label}
                      className={`flex items-center justify-between gap-3 text-xs ${
                        t.esTotalGeneral ? 'border-t border-border pt-1.5' : ''
                      }`}
                    >
                      <span
                        className={`text-right text-muted-foreground ${
                          t.esTotalGeneral ? 'font-bold text-foreground' : 'font-medium'
                        }`}
                      >
                        {t.label}
                      </span>
                      <span
                        className={`font-mono tabular-nums ${
                          t.esTotalGeneral
                            ? 'text-sm font-bold text-emerald-700 dark:text-emerald-400'
                            : 'font-semibold text-foreground'
                        }`}
                      >
                        {formatPrecio(t.valor, t.moneda || monedaDefault)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 border-t border-border bg-muted/30 px-6 py-3.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={descargando}
            type="button"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleDescargar()}
            disabled={descargando || !vista}
            className="gap-2 bg-emerald-600 font-semibold text-white shadow-xs transition-transform hover:bg-emerald-700 active:scale-[0.98] cursor-pointer"
          >
            {descargando ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="size-4" />
            )}
            {descargando ? 'Generando Excel…' : 'Descargar .xlsx'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
