import { formatPrecio } from '@/lib/format'
import {
  ordenTieneSatPendiente,
  itemSatPendiente,
} from '@/lib/ordenes-display'
import { normalizarClaveProdServ } from '@/lib/sat/normalizar'
import type { OrdenCompra } from '@/lib/schemas'
import { Calendar, CheckCircle2, Edit2, ExternalLink, Tags, Trash2, X, XCircle } from 'lucide-react'
import OrdenBadgeEstado from './OrdenBadgeEstado'

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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Detalles de la Orden</h2>
            <p className="text-xs text-gray-400 font-mono mt-0.5">ID: {orden.id}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="p-1.5 text-blue-600 hover:text-blue-800 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-1.5 text-sm font-semibold"
            >
              <Edit2 className="h-4 w-4" />
              Editar
            </button>
            <div className="w-px h-4 bg-gray-200 mx-1"></div>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Top Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Proveedor y Estado</span>
              <div className="mt-1 font-bold text-gray-900 text-lg truncate" title={orden.proveedor}>{orden.proveedor}</div>
              <div className="mt-2"><OrdenBadgeEstado estado={orden.estado} /></div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Requisitor e Info</span>
              <div className="mt-1 text-sm font-semibold text-gray-900">Requisitor: <span className="font-normal text-gray-600">{orden.requisitor}</span></div>
              <div className="mt-1 text-sm font-semibold text-gray-900">Empresa: <span className="font-normal text-gray-600">{orden.empresa}</span></div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Orden y Pago</span>
              <div className="mt-1 text-sm font-semibold text-gray-900">Orden de Trabajo: <span className="font-normal text-gray-600">{orden.ordenTrabajo}</span></div>
              <div className="mt-1 text-sm font-semibold text-gray-900">Total: <span className="text-blue-600 font-semibold">{formatPrecio(orden.total, orden.moneda)}</span></div>
            </div>
          </div>

          {/* Extra Details (Factura, Fechas, Proveedor Link) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-1.5">Información de Facturación</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-gray-400">N° Factura:</span>
                <span className="text-gray-900 font-medium">{orden.numeroFactura || '-'}</span>
                
                <span className="text-gray-400">Fecha Factura:</span>
                <span className="text-gray-900">{orden.fechaFactura || '-'}</span>

                <span className="text-gray-400">Subtotal:</span>
                <span className="text-gray-900">{formatPrecio(orden.subtotal, orden.moneda)}</span>

                {orden.envio != null && orden.envio !== 0 && (
                  <>
                    <span className="text-gray-400">Envío:</span>
                    <span className="text-gray-900">{formatPrecio(orden.envio, orden.moneda)}</span>
                  </>
                )}

                <span className="text-gray-400">Impuestos (Tax):</span>
                <span className="text-gray-900">{formatPrecio(orden.impuestos, orden.moneda)}</span>

                <span className="text-gray-400">Total:</span>
                <span className="text-gray-900 font-semibold">{formatPrecio(orden.total, orden.moneda)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-1.5">Entregas y Enlaces</h3>
              <div className="space-y-2.5 text-sm">
                {orden.fechaEntrega && (
                  <div className="flex items-center gap-2 text-gray-700 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/30">
                    <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
                    <span><strong>Fecha de Entrega:</strong> {orden.fechaEntrega}</span>
                  </div>
                )}
                {orden.linkProveedor && /^https?:\/\//i.test(orden.linkProveedor) && (
                  <div className="flex items-center gap-2 text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    <ExternalLink className="h-4 w-4 text-gray-500 shrink-0" />
                    <span className="truncate flex-1">
                      <strong>Link Proveedor:</strong>{' '}
                      <a
                        href={orden.linkProveedor}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        Ir al sitio del proveedor
                      </a>
                    </span>
                  </div>
                )}
                {!orden.fechaEntrega && !orden.linkProveedor && (
                  <p className="text-gray-400 italic text-xs">No hay información adicional de entrega o proveedor.</p>
                )}
              </div>
            </div>
          </div>

          {/* Items List */}
          {orden.items && orden.items.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-1.5">Ítems de la Factura</h3>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm text-left text-gray-500">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Descripción</th>
                      <th className="px-4 py-3 font-semibold w-28">Clave SAT</th>
                      <th className="px-4 py-3 font-semibold">Empresa</th>
                      <th className="px-4 py-3 font-semibold">Cuenta cargo</th>
                      <th className="px-4 py-3 font-semibold">Requisitor</th>
                      <th className="px-4 py-3 font-semibold text-center w-20">Cant.</th>
                      <th className="px-4 py-3 font-semibold text-right w-32">P. Unitario</th>
                      <th className="px-4 py-3 font-semibold text-right w-32">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orden.items.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900 font-medium">{item.descripcion}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {normalizarClaveProdServ(item.claveProdServ) ? (
                            <span className="font-mono text-xs text-gray-800">{item.claveProdServ}</span>
                          ) : itemSatPendiente(item) ? (
                            <span className="inline-flex items-center gap-1 text-xs text-yellow-800 font-semibold bg-yellow-100/60 px-2 py-0.5 rounded-sm">
                              Sin clave SAT
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{item.empresa || orden.empresa || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{item.cuentaCargo || orden.cuentaCargo || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{item.requisitor || orden.requisitor || '—'}</td>
                        <td className="px-4 py-3 text-center">{item.cantidad ?? '-'}</td>
                        <td className="px-4 py-3 text-right">{formatPrecio(item.precioUnitario, orden.moneda)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatPrecio(item.total, orden.moneda)}</td>
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
              <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-1.5">Imagen de la Factura</h3>
              <a
                href={orden.imagenUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block relative group overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={orden.imagenUrl}
                  alt="Factura"
                  className="max-h-96 w-full object-contain mx-auto transition-transform duration-200 group-hover:scale-[1.01]"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-sm font-medium transition-opacity duration-200">
                  Ver imagen completa en nueva pestaña ↗
                </div>
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-xl shrink-0">
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50 hover:text-red-800 transition-colors"
          >
            <Trash2 className="h-4 w-4" /> Eliminar orden
          </button>
          <div className="flex items-center gap-2">
            {ordenTieneSatPendiente(orden) && (
              <button
                onClick={onSugerirSat}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm hover:bg-amber-50 transition-colors"
              >
                <Tags className="h-4 w-4" /> Sugerir clave SAT
              </button>
            )}
            {orden.estado !== 'aprobada' && (
              <button
                onClick={onApprove}
                className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-white px-4 py-2 text-sm font-semibold text-green-700 shadow-sm hover:bg-green-50 hover:text-green-800 transition-colors"
              >
                <CheckCircle2 className="h-4 w-4" /> Aprobar
              </button>
            )}
            {orden.estado !== 'rechazada' && (
              <button
                onClick={onReject}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50 hover:text-red-800 transition-colors"
              >
                <XCircle className="h-4 w-4" /> Rechazar
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
