'use client'

import { useEffect, useState } from 'react'
import { listarOrdenes, eliminarOrden } from '@/lib/ordenes'
import type { OrdenCompra } from '@/lib/schemas'
import { 
  Loader2, 
  Trash2, 
  Eye, 
  AlertCircle, 
  ExternalLink, 
  Calendar, 
  X, 
  Clock, 
  CheckCircle2, 
  XCircle 
} from 'lucide-react'

export default function OrdenesList() {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedOrden, setSelectedOrden] = useState<OrdenCompra | null>(null)

  useEffect(() => {
    fetchOrdenes()
  }, [])

  async function fetchOrdenes() {
    setLoading(true)
    setError(null)
    try {
      const data = await listarOrdenes()
      setOrdenes(data)
    } catch (err) {
      console.error('Error fetching ordenes:', err)
      setError('No se pudieron cargar las órdenes de compra. Por favor, intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm('¿Estás seguro de que deseas eliminar esta orden de compra?')) {
      try {
        await eliminarOrden(id)
        setOrdenes((prev) => prev.filter((o) => o.id !== id))
        if (selectedOrden?.id === id) {
          setSelectedOrden(null)
        }
      } catch (err) {
        console.error('Error deleting orden:', err)
        alert('No se pudo eliminar la orden. Por favor, intenta de nuevo.')
      }
    }
  }

  // Format Helpers
  const formatDate = (date: unknown) => {
    if (!date) return '-'
    let d: Date
    if (date instanceof Date) {
      d = date
    } else if (
      date &&
      typeof date === 'object' &&
      'toDate' in date &&
      typeof (date as { toDate: unknown }).toDate === 'function'
    ) {
      d = (date as { toDate: () => Date }).toDate()
    } else if (typeof date === 'string' || typeof date === 'number') {
      d = new Date(date)
    } else {
      return '-'
    }
    
    // Check if valid date
    if (isNaN(d.getTime())) return '-'
    
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const formatPrice = (amount: number | null | undefined, currency: string = 'USD') => {
    if (amount === null || amount === undefined) return '-'
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).format(amount)
    } catch {
      return `${currency} ${amount.toFixed(2)}`
    }
  }

  // Status Badge Helper
  const renderStatusBadge = (estado: string) => {
    switch (estado) {
      case 'aprobada':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-700 ring-1 ring-green-600/20 ring-inset">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Aprobada
          </span>
        )
      case 'rechazada':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-600/20 ring-inset">
            <XCircle className="h-3.5 w-3.5" />
            Rechazada
          </span>
        )
      case 'pendiente':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-50 px-2 py-1 text-xs font-semibold text-yellow-800 ring-1 ring-yellow-600/20 ring-inset">
            <Clock className="h-3.5 w-3.5" />
            Pendiente
          </span>
        )
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200 shadow-xs">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-4" />
        <p className="text-gray-500 text-sm">Cargando órdenes de compra…</p>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-red-800">Error de carga</h3>
          <p className="text-sm text-red-700 mt-1">{error}</p>
          <button 
            onClick={fetchOrdenes} 
            className="mt-3 text-xs font-semibold text-red-800 underline hover:text-red-900"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  // Empty state
  if (ordenes.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-xl border border-gray-200 shadow-xs">
        <div className="mx-auto w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-4 text-gray-400">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900">No hay órdenes</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
          No hay órdenes de compra registradas. Sube una nueva factura para comenzar.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-semibold">ID</th>
                <th className="px-6 py-4 font-semibold">Proveedor</th>
                <th className="px-6 py-4 font-semibold">Requisitor</th>
                <th className="px-6 py-4 font-semibold">Orden Trabajo</th>
                <th className="px-6 py-4 font-semibold">Empresa</th>
                <th className="px-6 py-4 font-semibold text-right">Total</th>
                <th className="px-6 py-4 font-semibold">Fecha</th>
                <th className="px-6 py-4 font-semibold">Estado</th>
                <th className="px-6 py-4 font-semibold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {ordenes.map((orden) => (
                <tr 
                  key={orden.id} 
                  onClick={() => setSelectedOrden(orden)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4 font-mono text-xs text-gray-900 max-w-[120px] truncate" title={orden.id}>
                    {orden.id}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                    {orden.proveedor}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {orden.requisitor}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {orden.ordenTrabajo}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {orden.empresa}
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900 text-right whitespace-nowrap">
                    {formatPrice(orden.total, orden.moneda)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {formatDate(orden.creadoEn)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {renderStatusBadge(orden.estado)}
                  </td>
                  <td className="px-6 py-4 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedOrden(orden)
                        }}
                        className="p-1 text-gray-500 hover:text-blue-600 rounded-md hover:bg-gray-100 transition-colors"
                        title="Ver detalles"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => handleDelete(orden.id, e)}
                        className="p-1 text-gray-500 hover:text-red-600 rounded-md hover:bg-gray-100 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {selectedOrden && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col my-8">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Detalles de la Orden</h2>
                <p className="text-xs text-gray-400 font-mono mt-0.5">ID: {selectedOrden.id}</p>
              </div>
              <button
                onClick={() => setSelectedOrden(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Top Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Proveedor y Estado</span>
                  <div className="mt-1 font-bold text-gray-900 text-lg truncate" title={selectedOrden.proveedor}>{selectedOrden.proveedor}</div>
                  <div className="mt-2">{renderStatusBadge(selectedOrden.estado)}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Requisitor e Info</span>
                  <div className="mt-1 text-sm font-semibold text-gray-900">Requisitor: <span className="font-normal text-gray-600">{selectedOrden.requisitor}</span></div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">Empresa: <span className="font-normal text-gray-600">{selectedOrden.empresa}</span></div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Orden y Pago</span>
                  <div className="mt-1 text-sm font-semibold text-gray-900">Orden de Trabajo: <span className="font-normal text-gray-600">{selectedOrden.ordenTrabajo}</span></div>
                  <div className="mt-1 text-sm font-semibold text-gray-900">Total: <span className="text-blue-600 font-semibold">{formatPrice(selectedOrden.total, selectedOrden.moneda)}</span></div>
                </div>
              </div>

              {/* Extra Details (Factura, Fechas, Proveedor Link) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-1.5">Información de Facturación</h3>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-gray-400">N° Factura:</span>
                    <span className="text-gray-900 font-medium">{selectedOrden.numeroFactura || '-'}</span>
                    
                    <span className="text-gray-400">Fecha Factura:</span>
                    <span className="text-gray-900">{selectedOrden.fechaFactura || '-'}</span>

                    <span className="text-gray-400">Subtotal:</span>
                    <span className="text-gray-900">{formatPrice(selectedOrden.subtotal, selectedOrden.moneda)}</span>

                    <span className="text-gray-400">Impuestos (Tax):</span>
                    <span className="text-gray-900">{formatPrice(selectedOrden.impuestos, selectedOrden.moneda)}</span>

                    <span className="text-gray-400">Total:</span>
                    <span className="text-gray-900 font-semibold">{formatPrice(selectedOrden.total, selectedOrden.moneda)}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-1.5">Entregas y Enlaces</h3>
                  <div className="space-y-2.5 text-sm">
                    {selectedOrden.fechaEntrega && (
                      <div className="flex items-center gap-2 text-gray-700 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/30">
                        <Calendar className="h-4 w-4 text-blue-600 shrink-0" />
                        <span><strong>Fecha de Entrega:</strong> {selectedOrden.fechaEntrega}</span>
                      </div>
                    )}
                    {selectedOrden.linkProveedor && /^https?:\/\//i.test(selectedOrden.linkProveedor) && (
                      <div className="flex items-center gap-2 text-gray-700 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                        <ExternalLink className="h-4 w-4 text-gray-500 shrink-0" />
                        <span className="truncate flex-1">
                          <strong>Link Proveedor:</strong>{' '}
                          <a
                            href={selectedOrden.linkProveedor}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline inline-flex items-center gap-1"
                          >
                            Ir al sitio del proveedor
                          </a>
                        </span>
                      </div>
                    )}
                    {!selectedOrden.fechaEntrega && !selectedOrden.linkProveedor && (
                      <p className="text-gray-400 italic text-xs">No hay información adicional de entrega o proveedor.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Items List */}
              {selectedOrden.items && selectedOrden.items.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-1.5">Ítems de la Factura</h3>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm text-left text-gray-500">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Descripción</th>
                          <th className="px-4 py-3 font-semibold text-center w-20">Cant.</th>
                          <th className="px-4 py-3 font-semibold text-right w-32">P. Unitario</th>
                          <th className="px-4 py-3 font-semibold text-right w-32">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedOrden.items.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-900 font-medium">{item.descripcion}</td>
                            <td className="px-4 py-3 text-center">{item.cantidad ?? '-'}</td>
                            <td className="px-4 py-3 text-right">{formatPrice(item.precioUnitario, selectedOrden.moneda)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatPrice(item.total, selectedOrden.moneda)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Invoice Image */}
              {selectedOrden.imagenUrl && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-1.5">Imagen de la Factura</h3>
                  <a
                    href={selectedOrden.imagenUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block relative group overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedOrden.imagenUrl}
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
            <div className="flex justify-between border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-xl shrink-0">
              <button
                onClick={(e) => handleDelete(selectedOrden.id, e)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50 hover:text-red-800 transition-colors"
              >
                <Trash2 className="h-4 w-4" /> Eliminar orden
              </button>
              <button
                onClick={() => setSelectedOrden(null)}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
