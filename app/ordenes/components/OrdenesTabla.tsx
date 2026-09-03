import { useState, type Dispatch, type SetStateAction } from 'react'
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
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
import { notificarOrdenPorWhatsApp } from '@/lib/notificar-orden-whatsapp'
import OrdenBadgeEstado from './OrdenBadgeEstado'
import WhatsAppIcon from '@/components/WhatsAppIcon'
import ModuleSurface from '@/components/layout/ModuleSurface'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useFilePreview } from '@/components/FilePreviewProvider'
import { useQuickLook } from '@/lib/hooks/useQuickLook'

type ColFiltros = { proveedor: string; requisitor: string; empresa: string; cuentaCargo: string }

interface OrdenesTablaProps {
  ordenesFiltradas: OrdenCompra[];
  selectedIds: Set<string>;
  toggleAllSelection: (e: React.ChangeEvent<HTMLInputElement>) => void;
  toggleSelection: (id: string, e: React.MouseEvent) => void;
  colFiltros: ColFiltros;
  setColFiltros: Dispatch<SetStateAction<ColFiltros>>;
  proveedoresUnicos: string[];
  requisitoresUnicos: string[];
  empresasUnicas: string[];
  cuentasUnicas: string[];
  onSelectOrden: (o: OrdenCompra) => void;
  onApproveClick: (id: string, e: React.MouseEvent) => void;
  onRejectClick: (id: string, e: React.MouseEvent) => void;
  onDeleteClick: (id: string, e: React.MouseEvent) => void;
  onPrepararFiltros: () => void;
}

const thFiltro = 'h-auto px-3 py-2.5 align-top font-bold whitespace-normal'

export default function OrdenesTabla({
  ordenesFiltradas,
  selectedIds,
  toggleAllSelection,
  toggleSelection,
  colFiltros,
  setColFiltros,
  proveedoresUnicos,
  requisitoresUnicos,
  empresasUnicas,
  cuentasUnicas,
  onSelectOrden,
  onApproveClick,
  onRejectClick,
  onDeleteClick,
  onPrepararFiltros,
}: OrdenesTablaProps) {
  const { previewFile } = useFilePreview()
  const [filaActivaIdx, setFilaActivaIdx] = useState<number | null>(0)

  useQuickLook({
    items: ordenesFiltradas,
    selectedIndex: filaActivaIdx,
    getArchivoMetadata: (orden) =>
      orden.imagenUrl
        ? {
            url: orden.imagenUrl,
            tipo: 'image',
            titulo: `Comprobante · ${orden.proveedor}`,
            subtitulo: `Factura #${orden.numeroFactura || 'S/N'} · ${formatPrecio(orden.total, orden.moneda)}`,
          }
        : null,
  })

  const [avisoWhatsApp, setAvisoWhatsApp] = useState<{
    mensaje: string
    whatsappUrl: string
    comprobanteUrl?: string
    abrirWhatsApp: boolean
  } | null>(null)

  async function notificar(orden: OrdenCompra) {
    const resultado = await notificarOrdenPorWhatsApp(orden)
    if (resultado.ventanaAbierta && resultado.captura.estado === 'copiada') return
    const mensajeCaptura = resultado.captura.estado === 'fallback'
      ? resultado.captura.mensaje
      : 'No se pudo copiar el comprobante como imagen.'

    setAvisoWhatsApp({
      mensaje: resultado.ventanaAbierta
        ? `${mensajeCaptura} WhatsApp ya lleva el texto listo.`
        : 'El navegador bloqueó la pestaña de WhatsApp. Ábrela con el enlace de abajo.',
      whatsappUrl: resultado.whatsappUrl,
      comprobanteUrl: resultado.captura.estado === 'fallback' ? orden.imagenUrl : undefined,
      abrirWhatsApp: !resultado.ventanaAbierta,
    })
  }

  return (
    <ModuleSurface className="font-sans">
      {avisoWhatsApp && (
        <div className="m-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950" role="status">
          <p>{avisoWhatsApp.mensaje}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {avisoWhatsApp.abrirWhatsApp && (
              <a
                href={avisoWhatsApp.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-emerald-600 px-2.5 py-1 font-semibold text-white hover:bg-emerald-700"
              >
                Abrir WhatsApp con texto
              </a>
            )}
            {avisoWhatsApp.comprobanteUrl && (
              <button
                type="button"
                onClick={() =>
                  previewFile({
                    url: avisoWhatsApp.comprobanteUrl!,
                    tipo: 'image',
                    titulo: 'Comprobante de Compra',
                  })
                }
                className="rounded-md border border-amber-400 bg-card px-2.5 py-1 font-semibold hover:bg-amber-100 cursor-pointer"
              >
                Ver comprobante
              </button>
            )}
          </div>
        </div>
      )}
      <Table className="text-xs text-left text-muted-foreground">
        <TableHeader className="bg-muted/50 text-[11px] font-mono text-foreground uppercase">
          <TableRow className="hover:bg-transparent">
            <TableHead className={`${thFiltro} w-8 text-center`}>
              <input
                type="checkbox"
                checked={ordenesFiltradas.length > 0 && selectedIds.size === ordenesFiltradas.length}
                onChange={toggleAllSelection}
                className="rounded border-input text-primary focus:ring-ring cursor-pointer"
              />
            </TableHead>
            <TableHead className={thFiltro}>
              <div>Proveedor</div>
              <select
                value={colFiltros.proveedor}
                onChange={e => setColFiltros({...colFiltros, proveedor: e.target.value})}
                onFocus={onPrepararFiltros}
                className="mt-1.5 block w-full max-w-[130px] text-[11px] font-normal border border-input rounded p-1 bg-card text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">Todos</option>
                {proveedoresUnicos.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </TableHead>
            <TableHead className={thFiltro}>
              <div>Requisitor</div>
              <select
                value={colFiltros.requisitor}
                onChange={e => setColFiltros({...colFiltros, requisitor: e.target.value})}
                onFocus={onPrepararFiltros}
                className="mt-1.5 block w-full max-w-[100px] text-[11px] font-normal border border-input rounded p-1 bg-card text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">Todos</option>
                {requisitoresUnicos.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </TableHead>
            <TableHead className={thFiltro}>No. Factura</TableHead>
            <TableHead className={thFiltro}>
              <div>Empresa</div>
              <select
                value={colFiltros.empresa}
                onChange={e => setColFiltros({...colFiltros, empresa: e.target.value})}
                onFocus={onPrepararFiltros}
                className="mt-1.5 block w-full max-w-[100px] text-[11px] font-normal border border-input rounded p-1 bg-card text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">Todos</option>
                {empresasUnicas.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </TableHead>
            <TableHead className={thFiltro}>
              <div>Cuenta cargo</div>
              <select
                value={colFiltros.cuentaCargo}
                onChange={e => setColFiltros({...colFiltros, cuentaCargo: e.target.value})}
                onFocus={onPrepararFiltros}
                className="mt-1.5 block w-full max-w-[130px] text-[11px] font-normal border border-input rounded p-1 bg-card text-foreground focus:outline-none focus:border-primary"
              >
                <option value="">Todos</option>
                {cuentasUnicas.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </TableHead>
            <TableHead className={`${thFiltro} text-right`}>Total</TableHead>
            <TableHead className={thFiltro}>Fecha</TableHead>
            <TableHead className={thFiltro}>Estado</TableHead>
            <TableHead className={`${thFiltro} text-center`}>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ordenesFiltradas.map((orden, index) => {
            const fechas = formatFechaOrden(orden)
            const linkNorm = orden.linkProveedor ? sanitizarUrl(orden.linkProveedor) : null
            return (
              <ContextMenu key={orden.id}>
                <ContextMenuTrigger asChild>
                  <TableRow
                    onClick={() => onSelectOrden(orden)}
                    onMouseEnter={() => setFilaActivaIdx(index)}
                    className="cursor-pointer"
                  >
                    <TableCell className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(orden.id)}
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
                              className="p-1 text-muted-foreground hover:text-emerald-600 rounded hover:bg-emerald-50 transition-colors"
                              title="Aprobar"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => onRejectClick(orden.id, e)}
                              className="p-1 text-muted-foreground hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                              title="Rechazar"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            void notificar(orden)
                          }}
                          className="p-1 text-primary hover:text-emerald-600 rounded hover:bg-emerald-50 transition-colors"
                          title="Notificar por WhatsApp (abre el mensaje y deja la captura lista para pegar)"
                        >
                          <WhatsAppIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelectOrden(orden)
                          }}
                          className="p-1 text-muted-foreground hover:text-primary hover:bg-sky-50 rounded transition-colors"
                          title="Ver detalles"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => onDeleteClick(orden.id, e)}
                          className="p-1 text-muted-foreground hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
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

                  <ContextMenuItem onClick={() => void notificar(orden)}>
                    <MessageCircle className="h-4 w-4 mr-2 text-emerald-600" />
                    <span>Notificar por WhatsApp</span>
                  </ContextMenuItem>

                  {linkNorm && (
                    <ContextMenuItem
                      onClick={() => window.open(linkNorm, '_blank', 'noopener,noreferrer')}
                    >
                      <ExternalLink className="h-4 w-4 mr-2 text-sky-600" />
                      <span>Abrir enlace de compra</span>
                    </ContextMenuItem>
                  )}

                  {orden.imagenUrl && (
                    <ContextMenuItem
                      onClick={() =>
                        previewFile(
                          {
                            url: orden.imagenUrl!,
                            nombre: `Factura-${orden.numeroFactura || orden.id}`,
                            tipo: 'image',
                            titulo: `Comprobante · ${orden.proveedor}`,
                            subtitulo: `Factura #${orden.numeroFactura || 'S/N'} · ${formatPrecio(orden.total, orden.moneda)}`,
                          },
                          ordenesFiltradas
                            .filter((o) => Boolean(o.imagenUrl))
                            .map((o) => ({
                              url: o.imagenUrl!,
                              nombre: `Factura-${o.numeroFactura || o.id}`,
                              tipo: 'image',
                              titulo: `Comprobante · ${o.proveedor}`,
                              subtitulo: `Factura #${o.numeroFactura || 'S/N'} · ${formatPrecio(o.total, o.moneda)}`,
                            }))
                        )
                      }
                    >
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
          })}
        </TableBody>
      </Table>
    </ModuleSurface>
  )
}
