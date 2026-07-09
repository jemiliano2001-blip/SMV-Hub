'use client'

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import type { Cotizacion, EstatusCotizacion, Ubicacion } from '@/lib/schemas'
import type { NuevaCotizacionPayload } from '@/lib/cotizaciones'
import { crearCotizacion, actualizarCotizacion } from '@/lib/cotizaciones'

interface Props {
  cotizacionBase?: Cotizacion
  onClose: () => void
  onSaved: (cotizacion: Cotizacion) => void
}

function monedaDeUbicacion(ubicacion: Ubicacion): 'USD' | 'MXN' {
  return ubicacion === 'USA' ? 'USD' : 'MXN'
}

export default function CotizacionFormModal({ cotizacionBase, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    solicitante: cotizacionBase?.solicitante || '',
    fecha: cotizacionBase?.fecha || '',
    estatus: (cotizacionBase?.estatus || 'cotizado') as EstatusCotizacion,
    ubicacion: (cotizacionBase?.ubicacion || 'USA') as Ubicacion,
    proveedor: cotizacionBase?.proveedor || '',
    descripcion: cotizacionBase?.descripcion || '',
    numeroParte: cotizacionBase?.numeroParte || '',
    cantidad: cotizacionBase?.cantidad?.toString() || '',
    precioUnitario: cotizacionBase?.precioUnitario?.toString() || '',
    total: cotizacionBase?.total?.toString() || '',
    diasHabiles: cotizacionBase?.diasHabiles || '',
    link: cotizacionBase?.link || '',
    notas: cotizacionBase?.notas || '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const payload: NuevaCotizacionPayload = {
        solicitante: formData.solicitante,
        fecha: formData.fecha || null,
        estatus: formData.estatus,
        ubicacion: formData.ubicacion,
        proveedor: formData.proveedor,
        descripcion: formData.descripcion,
        numeroParte: formData.numeroParte || null,
        cantidad: formData.cantidad ? Number(formData.cantidad) : null,
        precioUnitario: formData.precioUnitario ? Number(formData.precioUnitario) : null,
        moneda: monedaDeUbicacion(formData.ubicacion),
        total: formData.total ? Number(formData.total) : null,
        diasHabiles: formData.diasHabiles || null,
        link: formData.link || null,
        notas: formData.notas || null,
      }

      if (cotizacionBase) {
        await actualizarCotizacion(cotizacionBase.id, payload)
        onSaved({ ...cotizacionBase, ...payload, id: cotizacionBase.id, actualizadoEn: new Date() } as Cotizacion)
      } else {
        const id = await crearCotizacion(payload)
        onSaved({ ...payload, id, creadoEn: new Date(), actualizadoEn: new Date() } as Cotizacion)
      }
    } catch (err) {
      console.error(err)
      setError('Ocurrió un error al guardar la cotización. Revisa los datos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col my-8">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 shrink-0">
          <h2 className="text-lg font-bold text-gray-900">
            {cotizacionBase ? 'Editar Cotización' : 'Añadir Cotización'}
          </h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form id="cotizacion-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Solicitante</label>
                <input value={formData.solicitante} onChange={e => setFormData({ ...formData, solicitante: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Fecha</label>
                <input type="date" value={formData.fecha} onChange={e => setFormData({ ...formData, fecha: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Estatus</label>
                <select value={formData.estatus} onChange={e => setFormData({ ...formData, estatus: e.target.value as EstatusCotizacion })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none">
                  <option value="cotizado">Cotizado</option>
                  <option value="revisar">Revisar</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Ubicación</label>
                <select value={formData.ubicacion} onChange={e => setFormData({ ...formData, ubicacion: e.target.value as Ubicacion })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none">
                  <option value="USA">EUA (USD)</option>
                  <option value="MX">México (MXN)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Proveedor *</label>
                <input required value={formData.proveedor} onChange={e => setFormData({ ...formData, proveedor: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">No. de parte</label>
                <input value={formData.numeroParte} onChange={e => setFormData({ ...formData, numeroParte: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Descripción *</label>
              <input required value={formData.descripcion} onChange={e => setFormData({ ...formData, descripcion: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Cantidad</label>
                <input type="number" step="any" value={formData.cantidad} onChange={e => setFormData({ ...formData, cantidad: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">P. Unitario</label>
                <input type="number" step="any" value={formData.precioUnitario} onChange={e => setFormData({ ...formData, precioUnitario: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Total</label>
                <input type="number" step="any" value={formData.total} onChange={e => setFormData({ ...formData, total: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Días hábiles</label>
                <input placeholder="Ej. 3 dias" value={formData.diasHabiles} onChange={e => setFormData({ ...formData, diasHabiles: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Link</label>
              <input type="url" placeholder="https://" value={formData.link} onChange={e => setFormData({ ...formData, link: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Notas</label>
              <textarea rows={3} value={formData.notas} onChange={e => setFormData({ ...formData, notas: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none resize-none" />
            </div>
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-xl shrink-0">
          <button onClick={onClose} type="button" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button type="submit" form="cotizacion-form" disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {cotizacionBase ? 'Guardar Cambios' : 'Crear Cotización'}
          </button>
        </div>
      </div>
    </div>
  )
}
