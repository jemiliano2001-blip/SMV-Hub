/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · tone: utilitario · scope: orden-detalles-modal */
import { formatPrecio } from '@/lib/format'
import {
  ordenTieneSatPendiente,
  itemSatPendiente,
  generarMensajeWhatsApp,
  obtenerUrlWhatsApp,
  LINK_GRUPO_WHATSAPP,
} from '@/lib/ordenes-display'
import WhatsAppIcon from '@/components/WhatsAppIcon'
import { normalizarClaveProdServ } from '@/lib/sat/normalizar'
import type { OrdenCompra } from '@/lib/schemas'
import { Calendar, CheckCircle2, Edit2, ExternalLink, Tags, Trash2, X, XCircle, Users } from 'lucide-react'
import OrdenBadgeEstado from './OrdenBadgeEstado'
import { useState } from 'react'

interface OrdenDetallesModalProps {
  orden: OrdenCompra;
  onClose: () => void;
  onEdit: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onApprove: () => void;
  onReject: () => void;
  onSugerirSat: () => void;
}

export default function OrdenDetallesModal({
  orden,
  onClose,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  onSugerirSat,
}: OrdenDetallesModalProps) {
  const [copiado, setCopiado] = useState(false)

  const handleNotificarWhatsApp = async () => {
    const msg = generarMensajeWhatsApp(orden)
    try {
      await navigator.clipboard.writeText(msg)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 3000)
    } catch {
      // Ignorar fallo de portapapeles si no hay contexto seguro
    }
    window.open(obtenerUrlWhatsApp(msg), '_blank')
  }

  const handleAbrirGrupoWhatsApp = async () => {
    const msg = generarMensajeWhatsApp(orden)
    try {
      await navigator.clipboard.writeText(msg)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 3000)
    } catch {
      // Ignorar
    }
    window.open(LINK_GRUPO_WHATSAPP, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto font-sans">
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col my-8 border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 shrink-0 bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Detalles de Orden de Compra</h2>
              <span className="text-[10px] font-mono font-bold bg-sky-50 text-sky-800 border border-sky-200 px-1.5 py-0.5 rounded">
                EUA
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {orden.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="px-3 py-1.5 text-xs font-bold text-[#0369A1] hover:bg-sky-50 rounded-lg transition-colors flex items-center gap-1 border border-sky-200"
            >
              <Edit2 className="h-3.5 w-3.5" />
              Editar
            </button>
            <div className="w-px h-4 bg-slate-200 mx-1"></div>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Top Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Proveedor y Estado</span>
              <div className="mt-1 font-bold text-slate-900 text-base truncate" title={orden.proveedor}>{orden.proveedor}</div>
              <div className="mt-2"><OrdenBadgeEstado estado={orden.estado} /></div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Requisitor e Info</span>
              <div className="mt-1 text-xs font-semibold text-slate-900">Requisitor: <span className="font-normal text-slate-700">{orden.requisitor}</span></div>
              <div className="mt-1 text-xs font-semibold text-slate-900">Empresa: <span className="font-normal text-slate-700">{orden.empresa}</span></div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200">
              <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Orden y Total</span>
              <div className="mt-1 text-xs font-semibold text-slate-900">Orden de Trabajo: <span className="font-mono text-slate-700">{orden.ordenTrabajo}</span></div>
              <div className="mt-1 text-xs font-semibold text-slate-900">Total: <span className="text-[#0369A1] font-mono font-bold">{formatPrecio(orden.total, orden.moneda)}</span></div>
            </div>
          </div>

          {/* Extra Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
            <div className="space-y-2.5">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1">Facturación</h3>
              <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                <span className="text-slate-500 font-mono">N° Factura:</span>
                <span className="text-slate-900 font-mono font-bold">{orden.numeroFactura || '-'}</span>
                
                <span className="text-slate-500 font-mono">Fecha Factura:</span>
                <span className="text-slate-900 font-mono">{orden.fechaFactura || '-'}</span>

                <span className="text-slate-500 font-mono">Subtotal:</span>
                <span className="text-slate-900 font-mono">{formatPrecio(orden.subtotal, orden.moneda)}</span>

                {orden.envio != null && orden.envio !== 0 && (
                  <>
                    <span className="text-slate-500 font-mono">Envío:</span>
                    <span className="text-slate-900 font-mono">{formatPrecio(orden.envio, orden.moneda)}</span>
                  </>
                )}

                <span className="text-slate-500 font-mono">Impuestos (Tax):</span>
                <span className="text-slate-900 font-mono">{formatPrecio(orden.impuestos, orden.moneda)}</span>

                <span className="text-slate-500 font-mono">Total:</span>
                <span className="text-slate-900 font-mono font-bold">{formatPrecio(orden.total, orden.moneda)}</span>
              </div>
            </div>

            <div className="space-y-2.5">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1">Entregas y Enlaces</h3>
              <div className="space-y-2 text-xs">
                {orden.fechaEntrega && (
                  <div className="flex items-center gap-2 text-slate-800 bg-sky-50/60 p-2 rounded-lg border border-sky-200">
                    <Calendar className="h-3.5 w-3.5 text-[#0369A1] shrink-0" />
                    <span className="font-mono"><strong>Fecha de Entrega:</strong> {orden.fechaEntrega}</span>
                  </div>
                )}
                {orden.linkProveedor && /^https?:\/\//i.test(orden.linkProveedor) && (
                  <div className="flex items-center gap-2 text-slate-800 bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <ExternalLink className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <span className="truncate flex-1">
                      <strong>Link Proveedor:</strong>{' '}
                      <a
                        href={orden.linkProveedor}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#0369A1] hover:underline"
                      >
                        Ir al sitio del proveedor
                      </a>
                    </span>
                  </div>
                )}
                {!orden.fechaEntrega && !orden.linkProveedor && (
                  <p className="text-slate-400 italic text-xs font-mono">No hay información adicional de entrega o proveedor.</p>
                )}
              </div>
            </div>
          </div>

          {/* Items List */}
          {orden.items && orden.items.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1">Ítems de la Factura</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs text-left text-slate-600 whitespace-nowrap">
                  <thead className="text-[11px] font-mono text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 font-bold">Descripción</th>
                      <th className="px-3 py-2 font-bold">Clave SAT</th>
                      <th className="px-3 py-2 font-bold">Empresa</th>
                      <th className="px-3 py-2 font-bold">Cuenta cargo</th>
                      <th className="px-3 py-2 font-bold">Requisitor</th>
                      <th className="px-3 py-2 font-bold text-center">Cant.</th>
                      <th className="px-3 py-2 font-bold text-right">P. Unitario</th>
                      <th className="px-3 py-2 font-bold text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {orden.items.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-900 font-sans font-medium">{item.descripcion}</td>
                        <td className="px-3 py-2">
                          {normalizarClaveProdServ(item.claveProdServ) ? (
                            <span className="text-slate-800">{item.claveProdServ}</span>
                          ) : itemSatPendiente(item) ? (
                            <span className="text-[10px] text-amber-800 font-bold bg-amber-100 px-1.5 py-0.2 rounded border border-amber-200">
                              Sin clave SAT
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600 font-sans">{item.empresa || orden.empresa || '—'}</td>
                        <td className="px-3 py-2 text-slate-600 font-sans">{item.cuentaCargo || orden.cuentaCargo || '—'}</td>
                        <td className="px-3 py-2 text-slate-600 font-sans">{item.requisitor || orden.requisitor || '—'}</td>
                        <td className="px-3 py-2 text-center">{item.cantidad ?? '-'}</td>
                        <td className="px-3 py-2 text-right">{formatPrecio(item.precioUnitario, orden.moneda)}</td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">{formatPrecio(item.total, orden.moneda)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Invoice Image */}
          {orden.imagenUrl && (
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-slate-200 pb-1">
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">Comprobante / Screenshot de Compra</h3>
                <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Listo para vista previa en WhatsApp
                </span>
              </div>
              <a
                href={orden.imagenUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block relative group overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={orden.imagenUrl}
                  alt="Comprobante Factura"
                  className="max-h-80 w-full object-contain mx-auto transition-transform duration-200 group-hover:scale-[1.01]"
                />
                <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-mono font-bold transition-opacity duration-200">
                  Abrir comprobante completo ↗
                </div>
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-3.5 bg-slate-50 rounded-b-xl shrink-0">
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" /> Eliminar
          </button>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleNotificarWhatsApp}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-xs transition-colors active:scale-[0.98]"
              title="Copia el mensaje con link al comprobante y abre WhatsApp"
            >
              <WhatsAppIcon className="h-3.5 w-3.5 text-white shrink-0" />
              {copiado ? '¡Mensaje Copiado!' : 'Notificar por WhatsApp'}
            </button>

            <button
              onClick={handleAbrirGrupoWhatsApp}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 px-3 py-1.5 text-xs font-bold transition-colors active:scale-[0.98]"
              title="Abre el enlace directo del Grupo de WhatsApp SMV"
            >
              <Users className="h-3.5 w-3.5 text-emerald-700" />
              Ir al Grupo de WhatsApp
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
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition-colors"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar
              </button>
            )}
            {orden.estado !== 'rechazada' && (
              <button
                onClick={onReject}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 transition-colors"
              >
                <XCircle className="h-3.5 w-3.5" /> Rechazar
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
