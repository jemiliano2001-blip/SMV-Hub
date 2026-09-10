'use client'

import { useState, useMemo } from 'react'
import {
  Printer,
  Scissors,
  CheckSquare,
  Square,
  FileText,
  DollarSign,
  Layers,
  ListFilter,
  Eye,
  AlertCircle,
} from 'lucide-react'
import type { MovimientoCajaChica } from '@/lib/schemas'
import {
  VALES_POR_HOJA,
  filtrarGastosSinComprobante,
  agruparEnHojasDeSeis,
  calcularHojasRequeridas,
  obtenerFolioCortoVale,
  calcularTotalMontoVales,
} from '@/lib/caja-chica-vales'
import { formatPrecio, fechaHoyLocal } from '@/lib/format'
import { imprimirComoDocumento } from '@/lib/imprimir-documento'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface ModalImprimirValesProps {
  movimientos: MovimientoCajaChica[]
  open: boolean
  onClose: () => void
}

type FiltroModal = 'NINGUNO' | 'NINGUNO_Y_VALES' | 'TODOS_GASTOS'
type VistaModal = 'seleccion' | 'vista_previa'

export default function ModalImprimirVales({
  movimientos,
  open,
  onClose,
}: ModalImprimirValesProps) {
  const [filtroTipo, setFiltroTipo] = useState<FiltroModal>('NINGUNO')
  const [vista, setVista] = useState<VistaModal>('seleccion')

  // Candidatos disponibles según filtro
  const candidatos = useMemo(() => {
    return movimientos.filter((m) => {
      if (m.anulado) return false
      if (m.tipo !== 'SALIDA') return false
      if (filtroTipo === 'NINGUNO') return m.comprobante === 'NINGUNO'
      if (filtroTipo === 'NINGUNO_Y_VALES') {
        return m.comprobante === 'NINGUNO' || m.comprobante === 'VALE'
      }
      return true
    })
  }, [movimientos, filtroTipo])

  // IDs seleccionados. Inicialmente preselecciona todos los que tienen comprobante === 'NINGUNO'
  const [seleccionados, setSeleccionados] = useState<Set<string>>(() => {
    const sinComprobante = filtrarGastosSinComprobante(movimientos)
    return new Set(sinComprobante.map((m) => m.id))
  })

  // Lista de movimientos seleccionados ordenados por fecha desc
  const movimientosSeleccionados = useMemo(() => {
    return candidatos.filter((m) => seleccionados.has(m.id))
  }, [candidatos, seleccionados])

  // Hojas de impresión agrupadas de 6 en 6
  const hojasParaImpresion = useMemo(() => {
    return agruparEnHojasDeSeis(movimientosSeleccionados)
  }, [movimientosSeleccionados])

  const totalMonto = useMemo(() => {
    return calcularTotalMontoVales(movimientosSeleccionados)
  }, [movimientosSeleccionados])

  const hojasTotal = useMemo(() => {
    return calcularHojasRequeridas(movimientosSeleccionados.length)
  }, [movimientosSeleccionados])

  const todosSeleccionados = candidatos.length > 0 && candidatos.every((m) => seleccionados.has(m.id))

  const handleToggleSeleccionarTodos = () => {
    if (todosSeleccionados) {
      setSeleccionados(new Set())
    } else {
      setSeleccionados(new Set(candidatos.map((m) => m.id)))
    }
  }

  const handleToggleItem = (id: string) => {
    setSeleccionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleImprimir = () => {
    if (movimientosSeleccionados.length === 0) return
    const fecha = fechaHoyLocal()
    const tituloDoc = `Vales_CajaChica_SinComprobante_${fecha}_${movimientosSeleccionados.length}vales`
    imprimirComoDocumento(tituloDoc)
  }

  return (
    <>
      {/* ── DIÁLOGO EN PANTALLA Y ENVOLTORIO DE IMPRESIÓN ── */}
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col gap-4 p-5 print:p-0 print:border-0 print:max-h-none print:shadow-none print:bg-white print:block">
          <DialogHeader className="print:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <Printer className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Imprimir Vales de Gastos sin Comprobante
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Modo de selección: exactamente {VALES_POR_HOJA} vales por hoja (formato Carta) con guías de corte y firmas.
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Resumen numérico y selector de vista */}
          <div className="print:hidden flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              <span className="px-2.5 py-1 rounded-md bg-card border border-border font-bold text-foreground flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 text-primary" />
                {movimientosSeleccionados.length} seleccionados
              </span>
              <span className="px-2.5 py-1 rounded-md bg-card border border-border font-bold text-rose-700 flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5" />
                {formatPrecio(totalMonto, 'MXN')}
              </span>
              <span className="px-2.5 py-1 rounded-md bg-card border border-border font-bold text-foreground flex items-center gap-1">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                {hojasTotal} {hojasTotal === 1 ? 'hoja' : 'hojas'} ({VALES_POR_HOJA} vales/hoja)
              </span>
            </div>

            <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setVista('seleccion')}
                className={`px-3 py-1 rounded-md transition-colors font-medium flex items-center gap-1.5 ${
                  vista === 'seleccion'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <ListFilter className="h-3.5 w-3.5" />
                Selección ({candidatos.length})
              </button>
              <button
                type="button"
                onClick={() => setVista('vista_previa')}
                className={`px-3 py-1 rounded-md transition-colors font-medium flex items-center gap-1.5 ${
                  vista === 'vista_previa'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                Vista Previa ({hojasTotal})
              </button>
            </div>
          </div>

          {/* Filtros rápidos de gastos a considerar */}
          <div className="print:hidden flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground font-medium">Filtrar por comprobante:</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setFiltroTipo('NINGUNO')}
                  className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                    filtroTipo === 'NINGUNO'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  Solo NINGUNO
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroTipo('NINGUNO_Y_VALES')}
                  className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                    filtroTipo === 'NINGUNO_Y_VALES'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  NINGUNO + VALES
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroTipo('TODOS_GASTOS')}
                  className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                    filtroTipo === 'TODOS_GASTOS'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground border-border hover:text-foreground'
                  }`}
                >
                  Todos los gastos
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleToggleSeleccionarTodos}
              className="text-primary hover:underline font-medium flex items-center gap-1"
            >
              {todosSeleccionados ? (
                <>
                  <Square className="h-3.5 w-3.5" /> Desmarcar todos
                </>
              ) : (
                <>
                  <CheckSquare className="h-3.5 w-3.5" /> Marcar todos los mostrados ({candidatos.length})
                </>
              )}
            </button>
          </div>

          {/* Contenido principal scrolleable */}
          <div className="print:hidden flex-1 overflow-y-auto min-h-[300px] max-h-[50vh] border border-border rounded-lg bg-card">
            {vista === 'seleccion' ? (
              candidatos.length === 0 ? (
                <div className="p-8 text-center text-xs font-mono text-muted-foreground flex flex-col items-center gap-2">
                  <AlertCircle className="h-6 w-6 text-muted-foreground/60" />
                  <span>No hay gastos que coincidan con el filtro seleccionado.</span>
                </div>
              ) : (
                <Table className="text-xs">
                  <TableHeader className="bg-muted/80 sticky top-0 z-10 text-[11px] font-mono uppercase tracking-wider">
                    <TableRow>
                      <TableHead className="w-10 px-3 py-2 text-center">
                        <span className="sr-only">Seleccionar</span>
                      </TableHead>
                      <TableHead className="px-3 py-2">Fecha</TableHead>
                      <TableHead className="px-3 py-2">Descripción</TableHead>
                      <TableHead className="px-3 py-2">Proveedor</TableHead>
                      <TableHead className="px-3 py-2">Categoría</TableHead>
                      <TableHead className="px-3 py-2">Solicitante</TableHead>
                      <TableHead className="px-3 py-2">Comprobante</TableHead>
                      <TableHead className="px-3 py-2 text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border">
                    {candidatos.map((m) => {
                      const checked = seleccionados.has(m.id)
                      return (
                        <TableRow
                          key={m.id}
                          onClick={() => handleToggleItem(m.id)}
                          className={`cursor-pointer hover:bg-muted/60 transition-colors ${
                            checked ? 'bg-primary/5' : ''
                          }`}
                        >
                          <TableCell className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleItem(m.id)}
                              className="rounded border-input text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                            />
                          </TableCell>
                          <TableCell className="px-3 py-2 font-mono text-foreground">{m.fecha}</TableCell>
                          <TableCell className="px-3 py-2 font-medium text-foreground max-w-[220px] truncate" title={m.descripcion}>
                            {m.descripcion}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-muted-foreground">{m.proveedor}</TableCell>
                          <TableCell className="px-3 py-2 text-muted-foreground">
                            <span className="bg-muted text-foreground px-1.5 py-0.5 rounded border border-border text-[10px]">
                              {m.categoria}
                            </span>
                          </TableCell>
                          <TableCell className="px-3 py-2 text-muted-foreground">{m.solicitante}</TableCell>
                          <TableCell className="px-3 py-2 font-mono text-[10px]">
                            <span
                              className={`px-1.5 py-0.5 rounded border ${
                                m.comprobante === 'NINGUNO'
                                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                                  : m.comprobante === 'VALE'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-muted text-muted-foreground border-border'
                              }`}
                            >
                              {m.comprobante}
                            </span>
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right font-mono font-bold text-rose-700">
                            {formatPrecio(m.monto, 'MXN')}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )
            ) : (
              /* Vista previa en miniatura */
              <div className="p-4 space-y-6">
                {hojasParaImpresion.length === 0 ? (
                  <div className="p-8 text-center text-xs font-mono text-muted-foreground">
                    Selecciona al menos un gasto para previsualizar las hojas de impresión.
                  </div>
                ) : (
                  hojasParaImpresion.map((hoja, hojaIdx) => (
                    <div key={hojaIdx} className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                        <span className="font-bold text-foreground">
                          Hoja {hojaIdx + 1} de {hojasTotal}
                        </span>
                        <span>{hoja.length} de {VALES_POR_HOJA} vales en esta hoja</span>
                      </div>

                      {/* Simulación miniatura de la cuadrícula 2x3 */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-muted/30 border border-border rounded-lg">
                        {hoja.map((m) => (
                          <div
                            key={m.id}
                            className="border border-dashed border-border bg-card p-3 rounded-md space-y-2 text-xs"
                          >
                            <div className="flex justify-between items-start border-b border-border pb-1.5 text-[10px] font-mono">
                              <div>
                                <span className="font-bold text-foreground block">SMV MAQUINADOS</span>
                                <span className="text-muted-foreground">VALE DE CAJA CHICA</span>
                              </div>
                              <div className="text-right">
                                <span className="text-muted-foreground block">{obtenerFolioCortoVale(m.id)}</span>
                                <span className="font-bold text-foreground">{m.fecha}</span>
                              </div>
                            </div>

                            <div className="flex justify-between items-center py-1">
                              <span className="text-[10px] uppercase font-mono text-muted-foreground">Importe:</span>
                              <span className="text-sm font-bold font-mono text-rose-700">
                                {formatPrecio(m.monto, 'MXN')}
                              </span>
                            </div>

                            <div className="text-[11px] space-y-0.5">
                              <p className="font-medium text-foreground truncate" title={m.descripcion}>
                                <strong className="text-muted-foreground font-normal">Concepto: </strong>
                                {m.descripcion}
                              </p>
                              <div className="grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
                                <span className="truncate">Prov: {m.proveedor}</span>
                                <span className="truncate">Cat: {m.categoria}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground truncate">
                                Solicitó: <strong className="text-foreground">{m.solicitante}</strong>
                              </p>
                            </div>

                            <div className="pt-2 border-t border-dashed border-border flex justify-between gap-2 text-[9px] text-muted-foreground font-mono text-center">
                              <div className="flex-1 border-t border-muted-foreground/40 pt-0.5">
                                Recibió: {m.solicitante}
                              </div>
                              <div className="flex-1 border-t border-muted-foreground/40 pt-0.5">
                                Autorizó Caja
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <DialogFooter className="print:hidden gap-2 sm:gap-0">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            <Button
              onClick={handleImprimir}
              disabled={movimientosSeleccionados.length === 0}
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
            >
              <Printer className="h-4 w-4" />
              Imprimir {movimientosSeleccionados.length} {movimientosSeleccionados.length === 1 ? 'Vale' : 'Vales'} ({hojasTotal} {hojasTotal === 1 ? 'página' : 'páginas'})
            </Button>
          </DialogFooter>

          {/* ── PLANTILLA FÍSICA PARA IMPRESIÓN (visible exclusivamente en @media print) ── */}
          <div className="vales-print-root hidden print:block">
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                @page {
                  size: letter portrait;
                  margin: 0.3in;
                }
                body {
                  background: #ffffff !important;
                  color: #111111 !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .vales-print-root {
                  display: block !important;
                  width: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                .vales-print-hoja {
                  width: 100% !important;
                  height: 10.0in !important;
                  max-height: 10.0in !important;
                  display: grid !important;
                  grid-template-columns: 1fr 1fr !important;
                  grid-template-rows: 1fr 1fr 1fr !important;
                  gap: 0.18in !important;
                  box-sizing: border-box !important;
                  break-after: page !important;
                  page-break-after: always !important;
                  overflow: hidden !important;
                }
                .vales-print-hoja:last-child {
                  break-after: auto !important;
                  page-break-after: auto !important;
                }
                .vale-tarjeta-fisica {
                  border: 1.5px dashed #4b5563 !important;
                  border-radius: 4px !important;
                  padding: 0.12in 0.14in !important;
                  display: flex !important;
                  flex-direction: column !important;
                  justify-content: space-between !important;
                  box-sizing: border-box !important;
                  background-color: #ffffff !important;
                  color: #111111 !important;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
              }
            `}} />

            {hojasParaImpresion.map((hoja, hojaIndex) => (
              <div key={hojaIndex} className="vales-print-hoja">
                {hoja.map((m) => (
                  <div key={m.id} className="vale-tarjeta-fisica">
                    {/* Cabecera del vale */}
                    <div>
                      <div className="flex items-center justify-between border-b-2 border-[#111111] pb-1">
                        <div>
                          <h4 className="text-[11.5px] font-black uppercase tracking-wider text-[#111111] leading-tight">
                            SMV MAQUINADOS
                          </h4>
                          <p className="text-[7.5px] font-bold tracking-widest text-[#4b5563] uppercase">
                            Vale de Caja Chica · Gasto Menor
                          </p>
                        </div>
                        <div className="text-right font-mono leading-tight">
                          <span className="text-[8.5px] font-bold text-[#111111] block">
                            {obtenerFolioCortoVale(m.id)}
                          </span>
                          <span className="text-[8px] text-[#4b5563] block">
                            {m.fecha}
                          </span>
                        </div>
                      </div>

                      {/* Bloque destacado de Monto */}
                      <div className="my-2 bg-[#f4f4f5] border border-[#d4d4d8] rounded px-2.5 py-1.5 flex items-center justify-between">
                        <div>
                          <span className="text-[7px] uppercase font-bold tracking-wider text-[#71717a] block">
                            Importe Pagado (Efectivo)
                          </span>
                          <span className="text-[14px] font-black font-mono text-[#111111] leading-none">
                            {formatPrecio(m.monto, 'MXN')}
                          </span>
                        </div>
                        <span className="text-[7.5px] font-mono font-bold bg-[#ffffff] border border-[#a1a1aa] px-1.5 py-0.5 rounded text-[#18181b]">
                          SIN FACTURA
                        </span>
                      </div>

                      {/* Detalle descriptivo */}
                      <div className="space-y-1 text-[8.5px] leading-tight">
                        <div>
                          <span className="font-bold text-[#52525b] uppercase text-[7px] block">Concepto / Motivo:</span>
                          <p className="font-semibold text-[#111111] line-clamp-2">
                            {m.descripcion}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                          <div>
                            <span className="font-bold text-[#52525b] uppercase text-[7px] block">Establecimiento / Prov:</span>
                            <span className="text-[#18181b] truncate block font-medium">
                              {m.proveedor || 'No especificado'}
                            </span>
                          </div>
                          <div>
                            <span className="font-bold text-[#52525b] uppercase text-[7px] block">Categoría:</span>
                            <span className="text-[#18181b] truncate block font-medium">
                              {m.categoria || 'General'}
                            </span>
                          </div>
                        </div>

                        <div className="pt-0.5">
                          <span className="font-bold text-[#52525b] uppercase text-[7px] block">Quien realizó el gasto:</span>
                          <span className="text-[#18181b] font-bold">
                            {m.solicitante || 'Personal autorizado'}
                          </span>
                        </div>

                        <p className="text-[6.5px] text-[#71717a] italic pt-0.5">
                          * Comprobante interno emitido por falta de ticket o recibo en comercio.
                        </p>
                      </div>
                    </div>

                    {/* Firmas de conformidad */}
                    <div className="pt-2">
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <div className="border-b border-[#111111] mb-1 mx-2"></div>
                          <p className="text-[7px] font-bold text-[#111111] uppercase leading-none">
                            Recibió / Compró
                          </p>
                          <p className="text-[6.5px] text-[#52525b] truncate">
                            {m.solicitante || 'Firma'}
                          </p>
                        </div>

                        <div>
                          <div className="border-b border-[#111111] mb-1 mx-2"></div>
                          <p className="text-[7px] font-bold text-[#111111] uppercase leading-none">
                            Autorizó
                          </p>
                          <p className="text-[6.5px] text-[#52525b]">
                            Caja Chica / Gerencia
                          </p>
                        </div>
                      </div>

                      {/* Guía de tijera */}
                      <div className="flex items-center justify-center gap-1 text-[6.5px] text-[#9ca3af] pt-1.5 select-none font-mono">
                        <Scissors className="h-2.5 w-2.5" />
                        <span>corte</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
