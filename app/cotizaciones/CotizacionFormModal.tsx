'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Cotizacion, EstatusCotizacion, Ubicacion, Proveedor } from '@/lib/schemas'
import type { NuevaCotizacionPayload } from '@/lib/cotizaciones'
import { crearCotizacion, actualizarCotizacion, claveDedupCotizacion, clavesExistentes } from '@/lib/cotizaciones'
import { obtenerProveedores } from '@/lib/proveedores'

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
    proveedorId: cotizacionBase?.proveedorId || null as string | null,
    descripcion: cotizacionBase?.descripcion || '',
    numeroParte: cotizacionBase?.numeroParte || '',
    cantidad: cotizacionBase?.cantidad?.toString() || '',
    precioUnitario: cotizacionBase?.precioUnitario?.toString() || '',
    total: cotizacionBase?.total?.toString() || '',
    diasHabiles: cotizacionBase?.diasHabiles || '',
    link: cotizacionBase?.link || '',
    notas: cotizacionBase?.notas || '',
  })

  const [catalogoProveedores, setCatalogoProveedores] = useState<Proveedor[]>([])
  useEffect(() => {
    obtenerProveedores()
      .then(setCatalogoProveedores)
      .catch((err) => console.error('Error cargando catálogo de proveedores:', err))
  }, [])

  function handleProveedorChange(nombre: string) {
    const match = catalogoProveedores.find((p) => p.nombre === nombre)
    setFormData({ ...formData, proveedor: nombre, proveedorId: match?.id ?? null })
  }

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
        proveedorId: formData.proveedorId,
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
        const claveNueva = claveDedupCotizacion(payload)
        const existentes = await clavesExistentes()
        if (existentes.has(claveNueva)) {
          setError('Ya existe una cotización con el mismo proveedor, descripción, no. de parte y fecha.')
          setLoading(false)
          return
        }
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>{cotizacionBase ? 'Editar cotización' : 'Añadir cotización'}</DialogTitle>
        </DialogHeader>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form id="cotizacion-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Solicitante</label>
                <input value={formData.solicitante} onChange={e => setFormData({ ...formData, solicitante: e.target.value })} className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Fecha</label>
                <input type="date" value={formData.fecha} onChange={e => setFormData({ ...formData, fecha: e.target.value })} className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Estatus</label>
                <select value={formData.estatus} onChange={e => setFormData({ ...formData, estatus: e.target.value as EstatusCotizacion })} className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none">
                  <option value="cotizado">Cotizado</option>
                  <option value="revisar">Revisar</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Ubicación</label>
                <select value={formData.ubicacion} onChange={e => setFormData({ ...formData, ubicacion: e.target.value as Ubicacion })} className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none">
                  <option value="USA">EUA (USD)</option>
                  <option value="MX">México (MXN)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Proveedor *</label>
                <input
                  required
                  list="catalogo-proveedores-cotizacion"
                  value={formData.proveedor}
                  onChange={e => handleProveedorChange(e.target.value)}
                  className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  placeholder="Escribe o elige del catálogo"
                />
                <datalist id="catalogo-proveedores-cotizacion">
                  {catalogoProveedores.map((p) => (
                    <option key={p.id} value={p.nombre} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">No. de parte</label>
                <input value={formData.numeroParte} onChange={e => setFormData({ ...formData, numeroParte: e.target.value })} className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none" />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">Descripción *</label>
              <input required value={formData.descripcion} onChange={e => setFormData({ ...formData, descripcion: e.target.value })} className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Cantidad</label>
                <input type="number" step="any" value={formData.cantidad} onChange={e => setFormData({ ...formData, cantidad: e.target.value })} className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">P. Unitario</label>
                <input type="number" step="any" value={formData.precioUnitario} onChange={e => setFormData({ ...formData, precioUnitario: e.target.value })} className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Total</label>
                <input type="number" step="any" value={formData.total} onChange={e => setFormData({ ...formData, total: e.target.value })} className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">Días hábiles</label>
                <input placeholder="Ej. 3 dias" value={formData.diasHabiles} onChange={e => setFormData({ ...formData, diasHabiles: e.target.value })} className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none" />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">Link</label>
              <input type="url" placeholder="https://" value={formData.link} onChange={e => setFormData({ ...formData, link: e.target.value })} className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none" />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-foreground">Notas</label>
              <textarea rows={3} value={formData.notas} onChange={e => setFormData({ ...formData, notas: e.target.value })} className="w-full rounded-lg border border-input px-3 py-2 text-sm focus:border-primary focus:outline-none resize-none" />
            </div>
          </form>
        </div>

        <DialogFooter className="border-t border-border bg-muted/30 px-6 py-4">
          <Button variant="outline" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button type="submit" form="cotizacion-form" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            {cotizacionBase ? 'Guardar cambios' : 'Crear cotización'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
