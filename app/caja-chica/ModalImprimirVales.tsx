'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
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
  ChevronLeft,
  ChevronRight,
  Info,
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

/**
 * Contenido canónico de un vale impreso / previsualizado.
 * Utiliza colores hexadecimales de alto contraste aptos tanto para el lienzo digital
 * como para la salida monocromática en papel físico.
 */
function TarjetaValeContenido({ movimiento: m }: { movimiento: MovimientoCajaChica }) {
  return (
    <div className="flex flex-col justify-between h-full p-3.5 sm:p-4 box-border bg-[#ffffff] text-[#111111]">
      {/* Sección Superior: Encabezado y Datos Principales */}
      <div className="space-y-2">
        {/* Cabecera del vale */}
        <div className="flex items-center justify-between border-b-2 border-[#111111] pb-1.5">
          <div>
            <h4 className="text-xs sm:text-[13.5px] font-black uppercase tracking-wider text-[#111111] leading-tight font-mono">
              SMV MAQUINADOS
            </h4>
            <p className="text-[8.5px] sm:text-[9.5px] font-bold tracking-widest text-[#4b5563] uppercase">
              Vale de Caja Chica · Gasto Menor
            </p>
          </div>
          <div className="text-right font-mono leading-tight">
            <span className="text-xs sm:text-[13px] font-black text-[#111111] block">
              {obtenerFolioCortoVale(m.id)}
            </span>
            <span className="text-[9.5px] sm:text-[10.5px] font-bold text-[#4b5563] block">
              {m.fecha}
            </span>
          </div>
        </div>

        {/* Bloque destacado de Monto (Hero Block con tipografía grande y clara) */}
        <div className="bg-[#f4f4f5] border border-[#d4d4d8] rounded-xs px-3 py-2 flex items-center justify-between">
          <div>
            <span className="text-[8px] sm:text-[9px] uppercase font-bold tracking-wider text-[#52525b] block">
              Importe Pagado (Efectivo)
            </span>
            <span className="text-lg sm:text-[22px] font-black font-mono text-[#111111] leading-none">
              {formatPrecio(m.monto, 'MXN')}
            </span>
          </div>
          <span className="text-[8.5px] sm:text-[9.5px] font-mono font-black bg-[#ffffff] border border-[#71717a] px-2 py-1 rounded-xs text-[#18181b]">
            SIN FACTURA
          </span>
        </div>

        {/* Detalle descriptivo amplio y muy legible */}
        <div className="space-y-1.5 text-[#111111]">
          <div>
            <span className="font-bold text-[#52525b] uppercase text-[8px] sm:text-[9px] block">
              Concepto / Motivo:
            </span>
            <p className="font-bold text-xs sm:text-[13px] text-[#111111] leading-snug line-clamp-2" title={m.descripcion}>
              {m.descripcion}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <div>
              <span className="font-bold text-[#52525b] uppercase text-[8px] sm:text-[9px] block">
                Establecimiento / Prov:
              </span>
              <span className="text-xs sm:text-[12px] text-[#18181b] font-semibold truncate block">
                {m.proveedor || 'No especificado'}
              </span>
            </div>
            <div>
              <span className="font-bold text-[#52525b] uppercase text-[8px] sm:text-[9px] block">
                Categoría:
              </span>
              <span className="text-xs sm:text-[12px] text-[#18181b] font-semibold truncate block">
                {m.categoria || 'General'}
              </span>
            </div>
          </div>

          <div className="pt-0.5 flex items-baseline justify-between gap-2">
            <div>
              <span className="font-bold text-[#52525b] uppercase text-[8px] sm:text-[9px] block">
                Quien realizó el gasto:
              </span>
              <span className="text-xs sm:text-[12.5px] text-[#18181b] font-black">
                {m.solicitante || 'Personal autorizado'}
              </span>
            </div>
            <span className="text-[8px] sm:text-[9px] font-mono text-[#52525b] bg-[#f4f4f5] px-1.5 py-0.5 rounded-xs border border-[#e4e4e7]">
              Caja Chica SMV
            </span>
          </div>
        </div>
      </div>

      {/* Sección Inferior: Nota institucional y guía de corte (sin firmas) */}
      <div className="pt-2 border-t border-dashed border-[#d4d4d8] mt-2">
        <p className="text-[7.5px] sm:text-[8.5px] text-[#71717a] italic text-center pb-1">
          * Comprobante interno válido para arqueo de caja chica por falta de comprobante fiscal.
        </p>

        {/* Guía de tijera centrada */}
        <div className="flex items-center justify-center gap-1.5 text-[8px] sm:text-[9px] text-[#9ca3af] select-none font-mono">
          <Scissors className="h-3 w-3 text-[#71717a]" />
          <span>--- línea de corte ---</span>
        </div>
      </div>
    </div>
  )
}

export default function ModalImprimirVales({
  movimientos,
  open,
  onClose,
}: ModalImprimirValesProps) {
  const [filtroTipo, setFiltroTipo] = useState<FiltroModal>('NINGUNO')
  const [vista, setVista] = useState<VistaModal>('seleccion')
  const [hojaSeleccionada, setHojaSeleccionada] = useState<number>(0)

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

  // Derivación matemática pura para evitar cascading renders (cero setState en useEffect)
  const hojaActual = Math.min(Math.max(0, hojaSeleccionada), Math.max(0, hojasTotal - 1))

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

  const handleImprimir = useCallback(() => {
    if (movimientosSeleccionados.length === 0) return
    const fecha = fechaHoyLocal()
    const tituloDoc = `Vales_CajaChica_SinComprobante_${fecha}_${movimientosSeleccionados.length}vales`
    imprimirComoDocumento(tituloDoc)
  }, [movimientosSeleccionados.length])

  // Atajos de teclado para Power Users (Linear/SaaS Style)
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+P / Cmd+P manda a imprimir los vales seleccionados
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        handleImprimir()
      }
      // Flechas izquierda y derecha para pasar de hoja en la vista previa
      if (vista === 'vista_previa' && hojasTotal > 1) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          setHojaSeleccionada((p) => Math.max(0, p - 1))
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          setHojaSeleccionada((p) => Math.min(hojasTotal - 1, p + 1))
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, vista, hojasTotal, handleImprimir])

  const hojaMostrada = hojasParaImpresion[hojaActual] ?? hojasParaImpresion[0] ?? []

  return (
    <>
      {/* ── DIÁLOGO EN PANTALLA Y ENVOLTORIO DE IMPRESIÓN ── */}
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="max-w-5xl max-h-[94vh] flex flex-col gap-4 p-5 print:!static print:!top-auto print:!left-auto print:!translate-none print:!w-full print:!max-w-none print:!p-0 print:!m-0 print:!border-0 print:!shadow-none print:!bg-white print:!block print:!overflow-visible">
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
                    Cuadrícula exacta de {VALES_POR_HOJA} vales por hoja (formato Carta) con tipografía ampliada y guías de corte.
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Resumen numérico de control y conmutador de pestañas */}
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
                {hojasTotal} {hojasTotal === 1 ? 'hoja' : 'hojas'} ({VALES_POR_HOJA} por hoja)
              </span>
            </div>

            <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setVista('seleccion')}
                className={`px-3 py-1.5 rounded-md transition-colors font-medium flex items-center gap-1.5 cursor-pointer ${
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
                className={`px-3 py-1.5 rounded-md transition-colors font-medium flex items-center gap-1.5 cursor-pointer ${
                  vista === 'vista_previa'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                Vista Previa Carta ({hojasTotal})
              </button>
            </div>
          </div>

          {/* Filtros rápidos de gastos (solo visibles en pestaña de selección) */}
          {vista === 'seleccion' && (
            <div className="print:hidden flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground font-medium">Filtrar por comprobante:</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setFiltroTipo('NINGUNO')}
                    className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors cursor-pointer ${
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
                    className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors cursor-pointer ${
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
                    className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors cursor-pointer ${
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
                className="text-primary hover:underline font-medium flex items-center gap-1 cursor-pointer"
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
          )}

          {/* Contenido principal interactivo */}
          <div className="print:hidden flex-1 overflow-y-auto min-h-[360px] max-h-[58vh] border border-border rounded-lg bg-card">
            {vista === 'seleccion' ? (
              candidatos.length === 0 ? (
                <div className="p-12 text-center text-xs font-mono text-muted-foreground flex flex-col items-center gap-2">
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
                          <TableCell className="px-3 py-2 font-medium text-foreground max-w-[240px] truncate" title={m.descripcion}>
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
              /* ── VISTA PREVIA WYSIWYG: LIENZO DE HOJA CARTA ── */
              <div className="p-4 sm:p-6 bg-muted/30 flex flex-col items-center gap-4">
                {movimientosSeleccionados.length === 0 ? (
                  <div className="p-12 text-center text-xs font-mono text-muted-foreground flex flex-col items-center gap-3">
                    <FileText className="h-8 w-8 text-muted-foreground/50" />
                    <p className="font-semibold text-foreground text-sm">No hay vales seleccionados para previsualizar</p>
                    <p>Regresa a la pestaña de Selección para elegir los gastos que deseas imprimir.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVista('seleccion')}
                      className="mt-2 text-xs"
                    >
                      <ListFilter className="h-3.5 w-3.5 mr-1" />
                      Ir a Selección
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Barra de control y paginación de la hoja */}
                    <div className="w-full max-w-[700px] flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-card border border-border text-xs">
                      <div className="flex items-center gap-2">
                        {hojasTotal > 1 ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={hojaActual === 0}
                              onClick={() => setHojaSeleccionada((p) => Math.max(0, p - 1))}
                              className="h-7 px-2.5 text-xs font-medium cursor-pointer"
                            >
                              <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                              Anterior
                            </Button>
                            <span className="font-mono font-bold text-foreground px-1.5">
                              Hoja {hojaActual + 1} de {hojasTotal}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={hojaActual >= hojasTotal - 1}
                              onClick={() => setHojaSeleccionada((p) => Math.min(hojasTotal - 1, p + 1))}
                              className="h-7 px-2.5 text-xs font-medium cursor-pointer"
                            >
                              Siguiente
                              <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                            </Button>
                          </>
                        ) : (
                          <span className="font-mono font-bold text-foreground">
                            Hoja 1 de 1 · {hojaMostrada.length} vales
                          </span>
                        )}
                        <span className="text-muted-foreground hidden sm:inline">
                          ({hojaMostrada.length} de {VALES_POR_HOJA} vales en esta hoja)
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                          Formato Carta · 2 col × 3 ren
                        </span>
                        <Button
                          size="sm"
                          onClick={handleImprimir}
                          className="h-7 px-3 text-xs bg-primary text-primary-foreground hover:bg-primary/90 gap-1 cursor-pointer"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          Imprimir
                        </Button>
                      </div>
                    </div>

                    {/* Lienzo digital que simula exactamente la hoja de papel Carta */}
                    <div className="w-full max-w-[700px] bg-[#ffffff] text-[#111111] shadow-2xl border border-border/80 rounded-sm p-4 sm:p-5 flex flex-col gap-3 select-none">
                      {/* Cabecera del lienzo */}
                      <div className="flex items-center justify-between border-b border-[#e5e7eb] pb-2 text-[10px] font-mono text-[#6b7280]">
                        <span>SMV HUB · CAJA CHICA — VALES DE GASTO MENOR</span>
                        <span>HOJA {hojaActual + 1} DE {hojasTotal} · {fechaHoyLocal()}</span>
                      </div>

                      {/* Cuadrícula 2x3 con exactamente 6 espacios (activos + vacíos de corte) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 min-h-[500px]">
                        {/* Vales activos en esta hoja */}
                        {hojaMostrada.map((m) => (
                          <div
                            key={m.id}
                            className="border border-dashed border-[#374151] rounded-xs bg-[#ffffff] overflow-hidden shadow-xs"
                          >
                            <TarjetaValeContenido movimiento={m} />
                          </div>
                        ))}

                        {/* Espacios vacíos restantes en la hoja (guía visual de corte) */}
                        {Array.from({ length: VALES_POR_HOJA - hojaMostrada.length }).map((_, vacioIdx) => {
                          const slotNum = hojaMostrada.length + vacioIdx + 1
                          return (
                            <div
                              key={`vacio-${vacioIdx}`}
                              className="border border-dashed border-[#d4d4d8] bg-[#fafafa] rounded-xs p-4 flex flex-col items-center justify-center text-center gap-1 min-h-[160px]"
                            >
                              <Scissors className="h-4 w-4 text-[#a1a1aa]" />
                              <span className="text-[10px] font-mono text-[#71717a] font-medium">
                                Espacio disponible para corte
                              </span>
                              <span className="text-[8.5px] font-mono text-[#a1a1aa]">
                                Slot {slotNum} de {VALES_POR_HOJA} (libre en papel)
                              </span>
                            </div>
                          )
                        })}
                      </div>

                      {/* Pie del lienzo simulado */}
                      <div className="pt-2 border-t border-[#e5e7eb] flex items-center justify-between text-[9px] font-mono text-[#9ca3af]">
                        <span>Tolerancia de recorte: 3.8&quot; × 3.2&quot; por vale</span>
                        <span>Página lista para impresión en bandeja estándar</span>
                      </div>
                    </div>

                    {/* Alerta de instrucción amigable */}
                    <div className="w-full max-w-[700px] flex items-center gap-2 p-2.5 rounded-md bg-muted/60 border border-border text-[11px] text-muted-foreground">
                      <Info className="h-4 w-4 text-primary shrink-0" />
                      <span>
                        En el diálogo de impresión de tu navegador, asegúrate de mantener la escala en <strong>100%</strong> y los márgenes en <strong>Predeterminado</strong>.
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="print:hidden gap-2 sm:gap-0 flex items-center justify-between sm:justify-between w-full">
            <div className="text-xs text-muted-foreground font-mono">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px]">Ctrl+P</kbd> Imprimir directo
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose}>
                Cerrar
              </Button>
              {vista === 'seleccion' && movimientosSeleccionados.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setVista('vista_previa')}
                  className="gap-1 text-xs"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Ver Vista Previa ({hojasTotal})
                </Button>
              )}
              <Button
                onClick={handleImprimir}
                disabled={movimientosSeleccionados.length === 0}
                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
              >
                <Printer className="h-4 w-4" />
                Imprimir {movimientosSeleccionados.length} {movimientosSeleccionados.length === 1 ? 'Vale' : 'Vales'} ({hojasTotal} {hojasTotal === 1 ? 'pág' : 'págs'})
              </Button>
            </div>
          </DialogFooter>

          {/* ── PLANTILLA FÍSICA PARA IMPRESIÓN (Visible exclusivamente en @media print) ── */}
          <div className="vales-print-root hidden print:block">
            {hojasParaImpresion.map((hoja, hojaIndex) => (
              <div key={hojaIndex} className="vales-print-hoja">
                {hoja.map((m) => (
                  <div key={m.id} className="vale-tarjeta-fisica">
                    <TarjetaValeContenido movimiento={m} />
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
