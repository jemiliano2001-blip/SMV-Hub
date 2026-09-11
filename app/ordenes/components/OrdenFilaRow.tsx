'use client'

import { memo } from 'react'
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  MessageCircle,
  Tags,
  Trash2,
  XCircle,
} from 'lucide-react'
import type { OrdenCompra } from '@/lib/schemas'
import { formatPrecio } from '@/lib/format'
import { sanitizarUrl } from '@/lib/importar'
import {
  formatFechaOrden,
  cuentaCargoEfectiva,
  ordenTieneSatPendiente,
  displayOGuion,
} from '@/lib/ordenes-display'
import OrdenBadgeEstado from './OrdenBadgeEstado'
import WhatsAppIcon from '@/components/WhatsAppIcon'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { copiarAlPortapapeles } from '@/lib/portapapeles'
import { TableCell, TableRow } from '@/components/ui/table'

export interface OrdenFilaRowProps {
  orden: OrdenCompra
  index: number
  isSelected: boolean
  toggleSelection: (id: string, e: React.MouseEvent) => void
  onSelectOrden: (o: OrdenCompra) => void
  onMouseEnter: (index: number) => void
  onApproveClick: (id: string, e: React.MouseEvent) => void
  onRejectClick: (id: string, e: React.MouseEvent) => void
  onDeleteClick: (id: string, e: React.MouseEvent) => void
  onPreviewExcel: (orden: OrdenCompra) => void
  onNotificar: (orden: OrdenCompra) => void
  onPreviewComprobante?: (orden: OrdenCompra) => void
}

const OrdenFilaRow = memo(function OrdenFilaRow({
  orden,
  index,
  isSelected,
  toggleSelection,
  onSelectOrden,
  onMouseEnter,
  onApproveClick,
  onRejectClick,
  onDeleteClick,
  onPreviewExcel,
  onNotificar,
  onPreviewComprobante,
}: OrdenFilaRowProps) {
  const fechas = formatFechaOrden(orden)
  const linkNorm = orden.linkProveedor ? sanitizarUrl(orden.linkProveedor) : null

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TableRow
          onClick={() => onSelectOrden(orden)}
          onMouseEnter={() => onMouseEnter(index)}
          className={`cursor-pointer ${isSelected ? 'bg-primary/5' : ''}`}
        >
          <TableCell className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => toggleSelection(orden.id, e as unknown as React.MouseEvent)}
              className="rounded border-input text-primary focus:ring-ring cursor-pointer"
            />
          </TableCell>
          <TableCell className="px-3 py-2.5 font-semibold text-foreground truncate max-w-[140px]" title={orden.proveedor}>
            <span className="inline-flex items-center gap-1.5 w-full">
              <span className="truncate">{orden.proveedor}</span>
              {linkNorm && (
                <a
                  href={linkNorm}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-primary hover:text-sky-700 p-0.5 rounded transition-colors shrink-0"
                  title="Abrir enlace de compra / proveedor"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              {ordenTieneSatPendiente(orden) && (
                <span title="Falta clave SAT en algún ítem" aria-label="SAT pendiente">
                  <Tags className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                </span>
              )}
            </span>
          </TableCell>
          <TableCell className="px-3 py-2.5 truncate max-w-[100px]" title={orden.requisitor || ''}>
            {displayOGuion(orden.requisitor)}
          </TableCell>
          <TableCell className="px-3 py-2.5 font-mono text-foreground truncate max-w-[120px]" title={orden.numeroFactura || ''}>
            {displayOGuion(orden.numeroFactura)}
          </TableCell>
          <TableCell className="px-3 py-2.5 truncate max-w-[100px]" title={orden.empresa || ''}>
            {displayOGuion(orden.empresa)}
          </TableCell>
          <TableCell className="px-3 py-2.5 truncate max-w-[140px]" title={cuentaCargoEfectiva(orden) || ''}>
            {displayOGuion(cuentaCargoEfectiva(orden))}
          </TableCell>
          <TableCell className="px-3 py-2.5 font-mono font-bold text-foreground text-right tabular-nums">
            {formatPrecio(orden.total, orden.moneda)}
          </TableCell>
          <TableCell className="px-3 py-2.5 font-mono">
            <div className="text-foreground">{fechas.principal}</div>
            {fechas.secundaria && (
              <div className="text-[10px] text-muted-foreground">{fechas.secundaria}</div>
            )}
          </TableCell>
          <TableCell className="px-3 py-2.5">
            <OrdenBadgeEstado estado={orden.estado} estadoRecepcion={orden.estadoRecepcion} />
          </TableCell>
          <TableCell className="px-3 py-2.5 text-center">
            <div className="flex items-center justify-center gap-1">
              {orden.estado === 'pendiente' && (
                <>
                  <button
                    onClick={(e) => onApproveClick(orden.id, e)}
                    className="p-1 text-muted-foreground hover:text-emerald-600 rounded hover:bg-emerald-500/10 transition-colors"
                    title="Aprobar"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => onRejectClick(orden.id, e)}
                    className="p-1 text-muted-foreground hover:text-rose-600 rounded hover:bg-rose-500/10 transition-colors"
                    title="Rechazar"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onNotificar(orden)
                }}
                className="p-1 text-primary hover:text-emerald-600 rounded hover:bg-emerald-500/10 transition-colors"
                title="Notificar por WhatsApp (abre el mensaje y deja la captura lista para pegar)"
              >
                <WhatsAppIcon className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onPreviewExcel(orden)
                }}
                className="p-1 text-muted-foreground hover:text-emerald-700 hover:bg-emerald-500/10 rounded transition-colors cursor-pointer"
                title="Vista previa Excel de la orden"
                aria-label={`Vista previa Excel de orden ${orden.numeroFactura || orden.id}`}
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onSelectOrden(orden)
                }}
                className="p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded transition-colors"
                title="Ver detalles"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => onDeleteClick(orden.id, e)}
                className="p-1 text-muted-foreground hover:text-rose-600 rounded hover:bg-rose-500/10 transition-colors"
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </TableCell>
        </TableRow>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={() => onSelectOrden(orden)}>
          <Eye className="h-4 w-4 mr-2 text-primary" />
          <span>Ver detalle / Editar</span>
          <ContextMenuShortcut>↵</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <Copy className="h-4 w-4 mr-2 text-muted-foreground" />
            <span>Copiar datos</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            {orden.numeroFactura && (
              <ContextMenuItem
                onClick={() => {
                  void copiarAlPortapapeles(orden.numeroFactura || '', 'Factura copiada', orden.numeroFactura)
                }}
              >
                <span>No. Factura ({orden.numeroFactura})</span>
              </ContextMenuItem>
            )}
            <ContextMenuItem
              onClick={() => {
                void copiarAlPortapapeles(orden.proveedor || '', 'Proveedor copiado', orden.proveedor)
              }}
            >
              <span>Proveedor ({orden.proveedor})</span>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                const totalTxt = formatPrecio(orden.total, orden.moneda)
                void copiarAlPortapapeles(totalTxt, 'Total copiado', totalTxt)
              }}
            >
              <span>Total ({formatPrecio(orden.total, orden.moneda)})</span>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => {
                void copiarAlPortapapeles(orden.id, 'ID de orden copiado', orden.id)
              }}
            >
              <span>ID interno</span>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>

        {orden.estado === 'pendiente' && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={(e) => onApproveClick(orden.id, e as unknown as React.MouseEvent)}
            >
              <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" />
              <span>Aprobar orden</span>
            </ContextMenuItem>
            <ContextMenuItem
              onClick={(e) => onRejectClick(orden.id, e as unknown as React.MouseEvent)}
              className="text-rose-600"
            >
              <XCircle className="h-4 w-4 mr-2 text-rose-600" />
              <span>Rechazar orden</span>
            </ContextMenuItem>
          </>
        )}

        <ContextMenuSeparator />

        <ContextMenuItem onClick={() => onNotificar(orden)}>
          <MessageCircle className="h-4 w-4 mr-2 text-emerald-600" />
          <span>Notificar por WhatsApp</span>
        </ContextMenuItem>

        <ContextMenuItem onClick={() => onPreviewExcel(orden)}>
          <FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" />
          <span>Vista previa Excel (.xlsx)</span>
        </ContextMenuItem>

        {linkNorm && (
          <ContextMenuItem
            onClick={() => window.open(linkNorm, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink className="h-4 w-4 mr-2 text-sky-600" />
            <span>Abrir enlace de compra</span>
          </ContextMenuItem>
        )}

        {orden.imagenUrl && onPreviewComprobante && (
          <ContextMenuItem onClick={() => onPreviewComprobante(orden)}>
            <FileText className="h-4 w-4 mr-2 text-amber-600" />
            <span>Ver comprobante / factura</span>
            <ContextMenuShortcut>Espacio</ContextMenuShortcut>
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        <ContextMenuItem
          className="text-rose-600"
          onClick={(e) => onDeleteClick(orden.id, e as unknown as React.MouseEvent)}
        >
          <Trash2 className="h-4 w-4 mr-2 text-rose-600" />
          <span>Eliminar orden</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
})

export default OrdenFilaRow
