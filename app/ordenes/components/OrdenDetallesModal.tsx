import { formatPrecio } from '@/lib/format'
import {
  ordenTieneSatPendiente,
  itemSatPendiente,
} from '@/lib/ordenes-display'
import { notificarOrdenPorWhatsApp } from '@/lib/notificar-orden-whatsapp'
import WhatsAppIcon from '@/components/WhatsAppIcon'
import { normalizarClaveProdServ } from '@/lib/sat/normalizar'
import { sanitizarUrl } from '@/lib/importar'
import type { OrdenCompra } from '@/lib/schemas'
import { Calendar, CheckCircle2, Edit2, ExternalLink, Eye, PackageCheck, Tags, Trash2, XCircle } from 'lucide-react'
import { useFilePreview } from '@/components/FilePreviewProvider'
import OrdenBadgeEstado from './OrdenBadgeEstado'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import StepperAbastecimiento from '@/components/abastecimiento/StepperAbastecimiento'
import ModalRecibirOrdenAlmacen from '@/components/abastecimiento/ModalRecibirOrdenAlmacen'
import { derivarPasosAbastecimiento } from '@/lib/abastecimiento'
import ModuleSurface from '@/components/layout/ModuleSurface'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface OrdenDetallesModalProps {
  orden: OrdenCompra;
  onClose: () => void;
  onEdit: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onApprove: () => void;
  onReject: () => void;
  onSugerirSat: () => void;
  onRecepcionExitosa?: () => void;
}

export default function OrdenDetallesModal({
  orden,
  onClose,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  onSugerirSat,
  onRecepcionExitosa,
}: OrdenDetallesModalProps) {
  const { previewFile } = useFilePreview()
  const [modalRecibirAbierto, setModalRecibirAbierto] = useState(false)
  const [estadoWhatsApp, setEstadoWhatsApp] = useState<{
    exito: boolean
    mensaje: string
    whatsappUrl?: string
    comprobanteUrl?: string
  } | null>(null)
  const linkNorm = orden.linkProveedor ? sanitizarUrl(orden.linkProveedor) : null
  const pasosAbastecimiento = derivarPasosAbastecimiento({
    orden,
    origen: orden.requisicionId
      ? { tipo: 'requisicion', id: orden.requisicionId }
      : null,
    entradaAlmacenId: orden.entradaAlmacenId,
  })

  const handleNotificarWhatsApp = async () => {
    const resultado = await notificarOrdenPorWhatsApp(orden)
    if (resultado.ventanaAbierta && resultado.captura.estado === 'copiada') {
      setEstadoWhatsApp({
        exito: true,
        mensaje: 'WhatsApp está abierto con el texto listo. Presiona Ctrl+V para adjuntar la captura.',
      })
      return
    }
    const mensajeCaptura = resultado.captura.estado === 'fallback'
      ? resultado.captura.mensaje
      : 'No se pudo copiar el comprobante como imagen.'

    setEstadoWhatsApp({
      exito: false,
      mensaje: resultado.ventanaAbierta
        ? `${mensajeCaptura} WhatsApp ya lleva el texto listo.`
        : 'El navegador bloqueó la pestaña de WhatsApp. Ábrela con el enlace de abajo.',
      whatsappUrl: resultado.ventanaAbierta ? undefined : resultado.whatsappUrl,
      comprobanteUrl: resultado.captura.estado === 'fallback' ? orden.imagenUrl : undefined,
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="border-b border-border bg-muted/30 px-6 py-4 pr-12">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle>Detalles de orden de compra</DialogTitle>
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-muted-foreground">EUA</span>
              </div>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">ID: {orden.id}</p>
            </div>
            <Button variant="outline" size="sm" onClick={onEdit} type="button">
              <Edit2 /> Editar
            </Button>
          </div>
        </DialogHeader>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Trazabilidad Stepper */}
          <ModuleSurface className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-muted p-4">
            <div>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider font-semibold">Trazabilidad de Abastecimiento</p>
              <div className="mt-2">
                <StepperAbastecimiento pasos={pasosAbastecimiento} />
              </div>
            </div>
            {orden.estadoRecepcion !== 'recibida' ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setModalRecibirAbierto(true)}
                className="border-emerald-500/30 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 gap-1.5 text-xs font-semibold shrink-0"
              >
                <PackageCheck className="h-4 w-4 text-emerald-600" />
                Recibir en Almacén
              </Button>
            ) : (
              <div className="text-right text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 font-medium shrink-0 inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Recibido en Almacén ({orden.recibidoPor || 'Almacén'})
              </div>
            )}
          </ModuleSurface>

          {/* Status & Provider Header Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ModuleSurface className="bg-muted/70 p-4">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider font-semibold">Proveedor y Estado</p>
              <h3 className="text-sm font-bold text-foreground mt-1 truncate" title={orden.proveedor}>{orden.proveedor}</h3>
              <div className="mt-2 flex items-center gap-2">
                <OrdenBadgeEstado estado={orden.estado} />
              </div>
            </ModuleSurface>

            <ModuleSurface className="bg-muted/70 p-4">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider font-semibold">Requisitor e Info</p>
              <p className="text-xs text-foreground mt-1"><strong>Requisitor:</strong> {orden.requisitor || '—'}</p>
              <p className="text-xs text-foreground mt-0.5"><strong>Empresa:</strong> {orden.empresa || '—'}</p>
            </ModuleSurface>

            <ModuleSurface className="bg-muted/70 p-4">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider font-semibold">Orden y Total</p>
              <p className="text-xs text-foreground mt-1"><strong>Orden de Trabajo:</strong> {orden.ordenTrabajo || '—'}</p>
              <p className="text-xs font-bold text-foreground mt-0.5">Total: <span className="font-mono text-primary">{formatPrecio(orden.total, orden.moneda)}</span></p>
            </ModuleSurface>
          </div>

          {/* Billing & Deliveries Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">Facturación</h3>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>N° Factura:</span>
                  <span className="font-mono text-foreground font-bold">{orden.numeroFactura || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fecha Factura:</span>
                  <span className="font-mono text-foreground">{orden.fechaFactura || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-mono">{formatPrecio(orden.subtotal, orden.moneda)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Envío:</span>
                  <span className="font-mono">{formatPrecio(orden.envio, orden.moneda)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Impuestos (Tax):</span>
                  <span className="font-mono">{formatPrecio(orden.impuestos, orden.moneda)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-border font-bold text-foreground">
                  <span>Total:</span>
                  <span className="font-mono text-primary">{formatPrecio(orden.total, orden.moneda)}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">Entregas y Enlaces</h3>
              <div className="space-y-2 text-xs">
                {orden.fechaEntrega && (
                  <div className="flex items-center gap-2 text-foreground bg-sky-50/60 p-2 rounded-lg border border-sky-200">
                    <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="font-mono"><strong>Fecha de Entrega:</strong> {orden.fechaEntrega}</span>
                  </div>
                )}
                {linkNorm && (
                  <div className="flex items-center gap-2 text-foreground bg-muted p-2 rounded-lg border border-border">
                    <ExternalLink className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="truncate flex-1">
                      <strong>Link Proveedor:</strong>{' '}
                      <a
                        href={linkNorm}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary font-semibold hover:underline"
                      >
                        Ir al sitio / enlace de compra
                      </a>
                    </span>
                  </div>
                )}
                {!orden.fechaEntrega && !linkNorm && (
                  <p className="text-muted-foreground italic text-xs font-mono">No hay información adicional de entrega o proveedor.</p>
                )}
              </div>
            </div>
          </div>

          {/* Items List */}
          {orden.items && orden.items.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-1">Ítems de la Factura</h3>
              <ModuleSurface>
                <Table className="text-xs text-left text-muted-foreground">
                  <TableHeader className="text-[11px] font-mono text-muted-foreground uppercase bg-muted border-b border-border">
                    <TableRow>
                      <TableHead className="px-3 py-2 font-bold">Descripción</TableHead>
                      <TableHead className="px-3 py-2 font-bold">Clave SAT</TableHead>
                      <TableHead className="px-3 py-2 font-bold">Empresa</TableHead>
                      <TableHead className="px-3 py-2 font-bold">Cuenta cargo</TableHead>
                      <TableHead className="px-3 py-2 font-bold">Requisitor</TableHead>
                      <TableHead className="px-3 py-2 font-bold text-center">Cant.</TableHead>
                      <TableHead className="px-3 py-2 font-bold text-right">P. Unitario</TableHead>
                      <TableHead className="px-3 py-2 font-bold text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-border font-mono">
                    {orden.items.map((item, index) => (
                      <TableRow key={index} className="hover:bg-muted">
                        <TableCell className="px-3 py-2 text-foreground font-sans font-medium">{item.descripcion}</TableCell>
                        <TableCell className="px-3 py-2">
                          {normalizarClaveProdServ(item.claveProdServ) ? (
                            <span className="text-foreground">{item.claveProdServ}</span>
                          ) : itemSatPendiente(item) ? (
                            <span className="text-[10px] text-amber-800 font-bold bg-amber-100 px-1.5 py-0.2 rounded border border-amber-200">
                              Sin clave SAT
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-muted-foreground font-sans">{item.empresa || orden.empresa || '—'}</TableCell>
                        <TableCell className="px-3 py-2 text-muted-foreground font-sans">{item.cuentaCargo || orden.cuentaCargo || '—'}</TableCell>
                        <TableCell className="px-3 py-2 text-muted-foreground font-sans">{item.requisitor || orden.requisitor || '—'}</TableCell>
                        <TableCell className="px-3 py-2 text-center">{item.cantidad ?? '-'}</TableCell>
                        <TableCell className="px-3 py-2 text-right">{formatPrecio(item.precioUnitario, orden.moneda)}</TableCell>
                        <TableCell className="px-3 py-2 text-right font-bold text-foreground">{formatPrecio(item.total, orden.moneda)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ModuleSurface>
            </div>
          )}

          {/* Invoice Image */}
          {orden.imagenUrl && (
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-border pb-1">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground">Comprobante / Screenshot de Compra</h3>
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Se copiará al notificar
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  previewFile({
                    url: orden.imagenUrl!,
                    nombre: `Factura-${orden.numeroFactura || orden.id}`,
                    tipo: 'image',
                    titulo: `Comprobante · ${orden.proveedor}`,
                    subtitulo: `Factura #${orden.numeroFactura || 'S/N'} · ${formatPrecio(orden.total, orden.moneda)}`,
                  })
                }
                className="w-full text-left block relative group overflow-hidden rounded-xl border border-border bg-muted p-2 cursor-pointer transition-all hover:border-primary/50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={orden.imagenUrl}
                  alt="Comprobante Factura"
                  className="max-h-80 w-full object-contain mx-auto transition-transform duration-200 group-hover:scale-[1.01]"
                />
                <div className="absolute inset-0 bg-foreground/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 text-background text-xs font-mono font-bold transition-opacity duration-200">
                  <Eye className="h-4 w-4 mr-1" /> Ver comprobante con zoom y rotación
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3.5 bg-muted rounded-b-xl shrink-0">
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-card px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" /> Eliminar
          </button>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleNotificarWhatsApp}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-xs transition-colors active:scale-[0.98]"
              title="Abre WhatsApp con el texto listo y deja la captura preparada para pegar"
            >
              <WhatsAppIcon className="h-3.5 w-3.5 text-white shrink-0" />
              {estadoWhatsApp?.exito ? 'WhatsApp listo para pegar' : 'Notificar por WhatsApp'}
            </button>

            {ordenTieneSatPendiente(orden) && (
              <button
                onClick={onSugerirSat}
                className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 px-3 py-1.5 text-xs font-bold transition-colors"
              >
                <Tags className="h-3.5 w-3.5 text-amber-700" /> Clave SAT
              </button>
            )}
            {orden.estado !== 'aprobada' && (
              <button
                onClick={onApprove}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-card px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar
              </button>
            )}
            {orden.estado !== 'rechazada' && (
              <button
                onClick={onReject}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-card px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 transition-colors"
              >
                <XCircle className="h-3.5 w-3.5" /> Rechazar
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg bg-foreground px-3.5 py-1.5 text-xs font-bold text-background hover:bg-foreground/90 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
        {estadoWhatsApp && (
          <div
            className={`border-t px-5 py-3 text-xs ${estadoWhatsApp.exito ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : 'border-amber-300 bg-amber-50 text-amber-950'}`}
            role="status"
          >
            <p>{estadoWhatsApp.mensaje}</p>
            {!estadoWhatsApp.exito && (
              <div className="mt-2 flex flex-wrap gap-2">
                {estadoWhatsApp.whatsappUrl && (
                  <a
                    href={estadoWhatsApp.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md bg-emerald-600 px-2.5 py-1 font-semibold text-white hover:bg-emerald-700"
                  >
                    Abrir WhatsApp con texto
                  </a>
                )}
                {estadoWhatsApp.comprobanteUrl && (
                  <button
                    type="button"
                    onClick={() =>
                      previewFile({
                        url: estadoWhatsApp.comprobanteUrl!,
                        nombre: `Comprobante-${orden.numeroFactura || orden.id}`,
                        tipo: 'image',
                        titulo: `Comprobante · ${orden.proveedor}`,
                      })
                    }
                    className="rounded-md border border-amber-400 bg-card px-2.5 py-1 font-semibold hover:bg-amber-100 cursor-pointer"
                  >
                    Ver comprobante
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>

      <ModalRecibirOrdenAlmacen
        orden={orden}
        abierto={modalRecibirAbierto}
        onCerrar={() => setModalRecibirAbierto(false)}
        onExito={() => {
          onRecepcionExitosa?.()
          onClose()
        }}
      />
    </Dialog>
  )
}
