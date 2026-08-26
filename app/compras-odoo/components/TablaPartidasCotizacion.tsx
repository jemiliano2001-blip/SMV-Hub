'use client'

import { useState } from 'react'
import {
  AlertCircle,
  Check,
  CheckSquare,
  Copy,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  Square,
  Trash2,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { PartidaCotizacionOdoo } from '@/lib/schemas'

import type { TotalesCotizacion } from './tipos-captura'

export interface TablaPartidasCotizacionProps {
  partidas: PartidaCotizacionOdoo[]
  moneda: 'MXN' | 'USD'
  totales: TotalesCotizacion
  enviando: boolean
  puedeCrear: boolean
  validarFilas?: boolean
  onActualizar: (id: string, campo: keyof PartidaCotizacionOdoo, valor: unknown) => void
  onSeleccionarOtFila: (partidaId: string, valor: string) => void
  onEliminar: (id: string) => void
  onEliminarLote?: (ids: string[]) => void
  onClonarPartida?: (id: string) => void
  onClonarLote?: (ids: string[]) => void
  onActualizarLote?: (ids: string[], campo: keyof PartidaCotizacionOdoo, valor: unknown) => void
  onLimpiar: () => void
  onSolicitarCrear: () => void
}

function formatMoney(n: number) {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function TablaPartidasCotizacion({
  partidas,
  moneda,
  totales,
  enviando,
  puedeCrear,
  validarFilas = false,
  onActualizar,
  onSeleccionarOtFila,
  onEliminar,
  onEliminarLote,
  onClonarPartida,
  onClonarLote,
  onActualizarLote,
  onLimpiar,
  onSolicitarCrear,
}: TablaPartidasCotizacionProps) {
  const [seleccionados, setSeleccionados] = useState<string[]>([])
  const [modalBatchAbierto, setModalBatchAbierto] = useState(false)
  const [batchCampo, setBatchCampo] = useState<'requisitor' | 'empresa' | 'ordenTrabajo' | 'udm' | 'tasaIva'>('requisitor')
  const [batchValor, setBatchValor] = useState('')

  const todosSeleccionados = partidas.length > 0 && seleccionados.length === partidas.length

  const toggleSeleccionarTodo = () => {
    if (todosSeleccionados) {
      setSeleccionados([])
    } else {
      setSeleccionados(partidas.map((p) => p.id))
    }
  }

  const toggleSeleccionarFila = (id: string) => {
    setSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleEliminarSeleccionados = () => {
    if (seleccionados.length === 0) return
    if (onEliminarLote) {
      onEliminarLote(seleccionados)
    } else {
      seleccionados.forEach((id) => onEliminar(id))
    }
    setSeleccionados([])
  }

  const handleClonarSeleccionados = () => {
    if (seleccionados.length === 0) return
    if (onClonarLote) {
      onClonarLote(seleccionados)
    } else if (onClonarPartida) {
      seleccionados.forEach((id) => onClonarPartida(id))
    }
    setSeleccionados([])
  }

  const handleAplicarLote = () => {
    if (seleccionados.length === 0 || !onActualizarLote) return
    if (batchCampo === 'tasaIva') {
      const tasa = parseFloat(batchValor) || 0
      onActualizarLote(seleccionados, 'tasaIva', tasa)
      const impuestoStr = tasa === 0.16 ? 'IVA 16%' : tasa === 0.08 ? 'IVA 8%' : 'Tasa 0% / Exento'
      onActualizarLote(seleccionados, 'impuesto', impuestoStr)
    } else {
      onActualizarLote(seleccionados, batchCampo, batchValor)
    }
    setModalBatchAbierto(false)
    setBatchValor('')
  }

  return (
    <Card className="bg-card/70 backdrop-blur-md border-border/80 gap-0 overflow-hidden py-0 shadow-sm">
      <CardHeader className="bg-muted/40 flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <CardTitle className="flex items-center gap-2 text-xs font-bold">
            <FileSpreadsheet className="text-primary size-4" aria-hidden />
            Partidas a Cotizar ({partidas.length})
          </CardTitle>
          {seleccionados.length > 0 && (
            <Badge variant="secondary" className="font-mono text-[10px]">
              {seleccionados.length} seleccionadas
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {seleccionados.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border bg-background/80 px-2 py-1 shadow-sm">
              <span className="text-muted-foreground text-[10px] font-semibold">Lote:</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[10px]"
                onClick={() => setModalBatchAbierto(true)}
              >
                <MoreHorizontal className="size-3" data-icon="inline-start" />
                Asignar campo...
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[10px]"
                onClick={handleClonarSeleccionados}
              >
                <Copy className="size-3" data-icon="inline-start" />
                Clonar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive h-6 px-1.5 text-[10px]"
                onClick={handleEliminarSeleccionados}
              >
                <Trash2 className="size-3" data-icon="inline-start" />
                Eliminar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground h-6 px-1 text-[10px]"
                onClick={() => setSeleccionados([])}
                aria-label="Deseleccionar todo"
              >
                <X className="size-3" />
              </Button>
            </div>
          )}

          {partidas.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onLimpiar}
              className="text-destructive h-7 text-xs"
            >
              <Trash2 data-icon="inline-start" />
              Limpiar Todo
            </Button>
          )}
        </div>
      </CardHeader>

      {/* Modal / Popover para Asignación Masiva */}
      {modalBatchAbierto && (
        <div className="bg-muted/80 flex flex-wrap items-center gap-3 border-b px-4 py-2.5">
          <span className="text-xs font-bold">Modificar en lote ({seleccionados.length} partidas):</span>
          <select
            value={batchCampo}
            onChange={(e) => setBatchCampo(e.target.value as typeof batchCampo)}
            className="border-input bg-background rounded border px-2 py-1 text-xs font-medium focus:outline-none"
          >
            <option value="requisitor">Requisitor</option>
            <option value="empresa">Empresa / Destino</option>
            <option value="ordenTrabajo">OT / Uso</option>
            <option value="udm">UdM</option>
            <option value="tasaIva">Impuesto / IVA</option>
          </select>

          {batchCampo === 'tasaIva' ? (
            <select
              value={batchValor}
              onChange={(e) => setBatchValor(e.target.value)}
              className="border-input bg-background rounded border px-2 py-1 text-xs focus:outline-none"
            >
              <option value="">Selecciona tasa...</option>
              <option value="0.16">IVA 16%</option>
              <option value="0.08">IVA 8%</option>
              <option value="0">Tasa 0% / Exento</option>
            </select>
          ) : (
            <input
              type="text"
              placeholder={`Nuevo valor para ${batchCampo}...`}
              value={batchValor}
              onChange={(e) => setBatchValor(e.target.value)}
              className="border-input bg-background rounded border px-2 py-1 text-xs focus:outline-none"
            />
          )}

          <Button type="button" size="sm" onClick={handleAplicarLote} disabled={!batchValor} className="h-7 text-xs">
            <Check className="size-3" data-icon="inline-start" />
            Aplicar a {seleccionados.length}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setModalBatchAbierto(false)}
            className="h-7 text-xs"
          >
            Cancelar
          </Button>
        </div>
      )}

      <CardContent className="p-0">
        {partidas.length === 0 ? (
          <Empty className="border-0 py-12">
            <EmptyHeader>
              <EmptyMedia variant="default">
                <div className="text-muted-foreground flex justify-center gap-2">
                  <FileSpreadsheet className="size-8" aria-hidden />
                  <FileText className="size-8" aria-hidden />
                  <ImageIcon className="size-8" aria-hidden />
                </div>
              </EmptyMedia>
              <EmptyTitle className="text-sm">Aún no has agregado partidas</EmptyTitle>
              <EmptyDescription>
                Pega desde Excel (Ctrl+V), escanea PDF/imagen con IA, o agrega una fila manual.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="max-h-[520px] overflow-x-auto">
            <Table className="w-full text-left text-xs">
              <TableHeader className="bg-muted/80 sticky top-0 z-10 text-[11px] font-bold tracking-wider uppercase backdrop-blur-xs">
                <TableRow>
                  <TableHead className="w-9 px-2 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={toggleSeleccionarTodo}
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                      title={todosSeleccionados ? 'Deseleccionar todo' : 'Seleccionar todo'}
                    >
                      {todosSeleccionados ? (
                        <CheckSquare className="text-primary size-4" />
                      ) : (
                        <Square className="size-4" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="w-8 px-2 py-2.5 text-center">#</TableHead>
                  <TableHead className="w-28 px-2.5 py-2.5">Clave</TableHead>
                  <TableHead className="min-w-[230px] px-2.5 py-2.5">Descripción *</TableHead>
                  <TableHead className="w-24 px-2.5 py-2.5">Requisitor</TableHead>
                  <TableHead className="w-20 px-2.5 py-2.5">Empresa</TableHead>
                  <TableHead className="w-32 px-2.5 py-2.5">OT / Uso</TableHead>
                  <TableHead className="w-20 px-2.5 py-2.5 text-right">Cant.</TableHead>
                  <TableHead className="w-16 px-2.5 py-2.5">UdM</TableHead>
                  <TableHead className="w-24 px-2.5 py-2.5 text-right">P. Unitario</TableHead>
                  <TableHead className="w-20 px-2 py-2.5 text-center">IVA</TableHead>
                  <TableHead className="w-28 px-2.5 py-2.5 text-right">Subtotal</TableHead>
                  <TableHead className="w-16 px-2 py-2.5 text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partidas.map((item, idx) => {
                  const estaSeleccionado = seleccionados.includes(item.id)
                  const esInvalido =
                    validarFilas && (!item.descripcion?.trim() || item.cantidad <= 0)

                  return (
                    <TableRow
                      key={item.id}
                      className={`hover:bg-muted/40 transition-colors ${
                        estaSeleccionado ? 'bg-primary/5' : ''
                      } ${esInvalido ? 'bg-destructive/10 border-destructive/40' : ''}`}
                    >
                      <TableCell className="px-2 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSeleccionarFila(item.id)}
                          className="text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          {estaSeleccionado ? (
                            <CheckSquare className="text-primary size-4" />
                          ) : (
                            <Square className="size-4" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className="text-muted-foreground px-2 py-1.5 text-center font-mono text-[11px]">
                        {item.partida || idx + 1}
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        <input
                          type="text"
                          value={item.clave || ''}
                          onChange={(e) => onActualizar(item.id, 'clave', e.target.value)}
                          className="hover:border-input focus:border-ring w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 font-mono text-xs focus:bg-background focus:ring-1 focus:outline-none"
                          placeholder="Clave"
                        />
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={item.descripcion}
                            onChange={(e) => onActualizar(item.id, 'descripcion', e.target.value)}
                            className={`hover:border-input focus:border-ring w-full rounded border bg-transparent px-1.5 py-0.5 text-xs font-medium focus:bg-background focus:ring-1 focus:outline-none ${
                              !item.descripcion?.trim() && validarFilas
                                ? 'border-destructive text-destructive'
                                : 'border-transparent'
                            }`}
                            placeholder="Descripción de la pieza *"
                          />
                          {!item.descripcion?.trim() && validarFilas && (
                            <span title="Descripción requerida" className="inline-flex shrink-0">
                              <AlertCircle className="text-destructive size-3.5" />
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        <input
                          type="text"
                          value={item.requisitor || ''}
                          onChange={(e) => onActualizar(item.id, 'requisitor', e.target.value)}
                          className="hover:border-input focus:border-ring w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 text-xs focus:bg-background focus:ring-1 focus:outline-none"
                          placeholder="Pablo..."
                        />
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        <input
                          type="text"
                          value={item.empresa || ''}
                          onChange={(e) => onActualizar(item.id, 'empresa', e.target.value)}
                          className="hover:border-input focus:border-ring w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 text-xs focus:bg-background focus:ring-1 focus:outline-none"
                          placeholder="Taller"
                        />
                      </TableCell>
                      <TableCell className="min-w-[130px] px-2.5 py-1.5">
                        <input
                          type="text"
                          list="lista-ots-odoo"
                          value={item.ordenTrabajo || item.uso || ''}
                          onChange={(e) => onSeleccionarOtFila(item.id, e.target.value)}
                          className="hover:border-input focus:border-ring w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 font-mono text-xs focus:bg-background focus:ring-1 focus:outline-none"
                          placeholder="ej. 2026/S01641"
                        />
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={item.cantidad}
                          onChange={(e) =>
                            onActualizar(item.id, 'cantidad', parseFloat(e.target.value) || 0)
                          }
                          className={`hover:border-input focus:border-ring w-full rounded border bg-transparent px-1.5 py-0.5 text-right font-mono text-xs font-semibold tabular-nums focus:bg-background focus:outline-none ${
                            item.cantidad <= 0 && validarFilas
                              ? 'border-destructive text-destructive'
                              : 'border-transparent'
                          }`}
                        />
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5">
                        <input
                          type="text"
                          value={item.udm || 'Pieza'}
                          onChange={(e) => onActualizar(item.id, 'udm', e.target.value)}
                          className="hover:border-input focus:border-ring w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 text-xs focus:bg-background focus:outline-none"
                        />
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right">
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={item.precioUnitario}
                          onChange={(e) =>
                            onActualizar(item.id, 'precioUnitario', parseFloat(e.target.value) || 0)
                          }
                          className="hover:border-input focus:border-ring w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 text-right font-mono text-xs font-semibold tabular-nums focus:bg-background focus:outline-none"
                        />
                      </TableCell>
                      <TableCell className="px-2 py-1.5 text-center">
                        <select
                          value={item.tasaIva !== undefined ? item.tasaIva : 0.16}
                          onChange={(e) => {
                            const tasa = parseFloat(e.target.value) || 0
                            onActualizar(item.id, 'tasaIva', tasa)
                            onActualizar(
                              item.id,
                              'impuesto',
                              tasa === 0.16 ? 'IVA 16%' : tasa === 0.08 ? 'IVA 8%' : 'Tasa 0% / Exento'
                            )
                          }}
                          className="border-input bg-background rounded border px-1 py-0.5 font-mono text-[11px] font-medium focus:outline-none"
                        >
                          <option value={0.16}>16%</option>
                          <option value={0.08}>8%</option>
                          <option value={0}>0%</option>
                        </select>
                      </TableCell>
                      <TableCell className="px-2.5 py-1.5 text-right font-mono font-bold tabular-nums">
                        ${formatMoney(item.subtotal)}
                      </TableCell>
                      <TableCell className="px-2 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {onClonarPartida && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => onClonarPartida(item.id)}
                              aria-label="Clonar partida"
                              className="text-muted-foreground hover:text-foreground size-7 p-0 cursor-pointer"
                              title="Duplicar partida"
                            >
                              <Copy className="size-3.5" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onEliminar(item.id)}
                            aria-label="Eliminar partida"
                            className="text-muted-foreground hover:text-destructive size-7 p-0 cursor-pointer"
                            title="Eliminar partida"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <CardFooter className="bg-muted/30 flex flex-col items-center justify-between gap-4 border-t px-4 py-4 sm:flex-row">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <span className="text-muted-foreground block text-[11px] font-medium">Subtotal</span>
            <span className="font-mono text-sm font-bold tabular-nums">
              ${formatMoney(totales.subtotal)} {moneda}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px] font-medium">IVA Estimado</span>
            <span className="font-mono text-sm font-bold tabular-nums">
              ${formatMoney(totales.iva)} {moneda}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px] font-medium">Total Cotización</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono text-base font-bold tabular-nums">
              ${formatMoney(totales.total)} {moneda}
            </span>
          </div>
        </div>

        <Button
          type="button"
          disabled={!puedeCrear || enviando}
          onClick={onSolicitarCrear}
          className="cursor-pointer font-semibold shadow-sm"
        >
          {enviando ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          {enviando ? 'Enviando a Odoo ERP...' : 'Crear Cotización en Odoo ERP'}
        </Button>
      </CardFooter>
    </Card>
  )
}
