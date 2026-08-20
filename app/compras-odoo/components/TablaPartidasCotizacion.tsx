'use client'

import {
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  Trash2,
} from 'lucide-react'

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
  onActualizar: (id: string, campo: keyof PartidaCotizacionOdoo, valor: unknown) => void
  onSeleccionarOtFila: (partidaId: string, valor: string) => void
  onEliminar: (id: string) => void
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
  onActualizar,
  onSeleccionarOtFila,
  onEliminar,
  onLimpiar,
  onSolicitarCrear,
}: TablaPartidasCotizacionProps) {
  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-sm">
      <CardHeader className="bg-muted/50 flex flex-row items-center justify-between border-b px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-xs font-bold">
          <FileSpreadsheet className="text-muted-foreground" aria-hidden />
          Partidas a Cotizar ({partidas.length})
        </CardTitle>
        {partidas.length > 0 && (
          <Button type="button" variant="ghost" size="sm" onClick={onLimpiar} className="text-destructive">
            <Trash2 data-icon="inline-start" />
            Limpiar Partidas
          </Button>
        )}
      </CardHeader>

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
          <div className="max-h-[500px] overflow-x-auto">
            <Table className="w-full text-left text-xs">
              <TableHeader className="bg-muted/80 sticky top-0 z-10 text-[11px] font-bold tracking-wider uppercase">
                <TableRow>
                  <TableHead className="w-10 px-3 py-2.5 text-center">#</TableHead>
                  <TableHead className="w-28 px-3 py-2.5">Clave</TableHead>
                  <TableHead className="min-w-[220px] px-3 py-2.5">Descripción *</TableHead>
                  <TableHead className="w-24 px-3 py-2.5">Requisitor</TableHead>
                  <TableHead className="w-20 px-3 py-2.5">Empresa</TableHead>
                  <TableHead className="w-32 px-3 py-2.5">OT / Uso</TableHead>
                  <TableHead className="w-20 px-3 py-2.5 text-right">Cant.</TableHead>
                  <TableHead className="w-16 px-3 py-2.5">UdM</TableHead>
                  <TableHead className="w-24 px-3 py-2.5 text-right">P. Unitario</TableHead>
                  <TableHead className="w-20 px-2 py-2.5 text-center">IVA</TableHead>
                  <TableHead className="w-28 px-3 py-2.5 text-right">Subtotal</TableHead>
                  <TableHead className="w-10 px-2 py-2.5 text-center" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {partidas.map((item, idx) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-muted-foreground px-3 py-1.5 text-center font-mono text-[11px]">
                      {item.partida || idx + 1}
                    </TableCell>
                    <TableCell className="px-3 py-1.5">
                      <input
                        type="text"
                        value={item.clave || ''}
                        onChange={(e) => onActualizar(item.id, 'clave', e.target.value)}
                        className="hover:border-input focus:border-ring w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 font-mono text-xs focus:bg-background focus:ring-1 focus:outline-none"
                        placeholder="Clave"
                      />
                    </TableCell>
                    <TableCell className="px-3 py-1.5">
                      <input
                        type="text"
                        value={item.descripcion}
                        onChange={(e) => onActualizar(item.id, 'descripcion', e.target.value)}
                        className="hover:border-input focus:border-ring w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 text-xs font-medium focus:bg-background focus:ring-1 focus:outline-none"
                        placeholder="Descripción de la pieza *"
                      />
                    </TableCell>
                    <TableCell className="px-3 py-1.5">
                      <input
                        type="text"
                        value={item.requisitor || ''}
                        onChange={(e) => onActualizar(item.id, 'requisitor', e.target.value)}
                        className="hover:border-input focus:border-ring w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 text-xs focus:bg-background focus:ring-1 focus:outline-none"
                        placeholder="Pablo..."
                      />
                    </TableCell>
                    <TableCell className="px-3 py-1.5">
                      <input
                        type="text"
                        value={item.empresa || ''}
                        onChange={(e) => onActualizar(item.id, 'empresa', e.target.value)}
                        className="hover:border-input focus:border-ring w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 text-xs focus:bg-background focus:ring-1 focus:outline-none"
                        placeholder="Taller"
                      />
                    </TableCell>
                    <TableCell className="min-w-[130px] px-3 py-1.5">
                      <input
                        type="text"
                        list="lista-ots-odoo"
                        value={item.ordenTrabajo || item.uso || ''}
                        onChange={(e) => onSeleccionarOtFila(item.id, e.target.value)}
                        className="hover:border-input focus:border-ring w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 font-mono text-xs focus:bg-background focus:ring-1 focus:outline-none"
                        placeholder="ej. 2026/S01641"
                      />
                    </TableCell>
                    <TableCell className="px-3 py-1.5 text-right">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={item.cantidad}
                        onChange={(e) =>
                          onActualizar(item.id, 'cantidad', parseFloat(e.target.value) || 0)
                        }
                        className="hover:border-input focus:border-ring w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 text-right font-mono text-xs font-semibold tabular-nums focus:bg-background focus:outline-none"
                      />
                    </TableCell>
                    <TableCell className="px-3 py-1.5">
                      <input
                        type="text"
                        value={item.udm || 'Pieza'}
                        onChange={(e) => onActualizar(item.id, 'udm', e.target.value)}
                        className="hover:border-input focus:border-ring w-full rounded border border-transparent bg-transparent px-1.5 py-0.5 text-xs focus:bg-background focus:outline-none"
                      />
                    </TableCell>
                    <TableCell className="px-3 py-1.5 text-right">
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
                    <TableCell className="px-3 py-1.5 text-right font-mono font-bold tabular-nums">
                      ${formatMoney(item.subtotal)}
                    </TableCell>
                    <TableCell className="px-2 py-1.5 text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onEliminar(item.id)}
                        aria-label="Eliminar partida"
                        className="text-muted-foreground hover:text-destructive size-8 p-0"
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <CardFooter className="bg-muted/40 flex flex-col items-center justify-between gap-4 border-t px-4 py-4 sm:flex-row">
        <div className="flex items-center gap-6">
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
            <span className="text-primary font-mono text-base font-bold tabular-nums">
              ${formatMoney(totales.total)} {moneda}
            </span>
          </div>
        </div>

        <Button type="button" disabled={!puedeCrear || enviando} onClick={onSolicitarCrear}>
          {enviando ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
          {enviando ? 'Enviando a Odoo ERP...' : 'Crear Cotización en Odoo ERP'}
        </Button>
      </CardFooter>
    </Card>
  )
}
