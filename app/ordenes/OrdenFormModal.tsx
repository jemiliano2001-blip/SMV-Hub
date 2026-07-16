'use client'

import { useState } from 'react'
import { Loader2, X, Plus, Trash2, Wand2 } from 'lucide-react'
import type { OrdenCompra, EstadoOrden, ItemFactura } from '@/lib/schemas'
import { sincronizarCamposLegacyOrden } from '@/lib/schemas'
import type { NuevaOrdenPayload } from '@/lib/ordenes'
import { crearOrden, actualizarOrden } from '@/lib/ordenes'
import { getClienteAuth } from '@/lib/firebase'

import { normalizarClaveProdServ } from '@/lib/sat/normalizar'

type ItemForm = {
  descripcion: string
  cantidad: string
  precioUnitario: string
  total: string
  empresa: string
  cuentaCargo: string
  requisitor: string
  ordenTrabajo: string
  claveProdServ: string
  url: string
}

function itemVacio(): ItemForm {
  return {
    descripcion: '',
    cantidad: '',
    precioUnitario: '',
    total: '',
    empresa: '',
    cuentaCargo: '',
    requisitor: '',
    ordenTrabajo: '',
    claveProdServ: '',
    url: '',
  }
}

interface Props {
  ordenBase?: OrdenCompra
  onClose: () => void
  onSaved: (orden: OrdenCompra) => void
}

function itemsDesdeOrden(orden?: OrdenCompra): ItemForm[] {
  if (orden?.items && orden.items.length > 0) {
    return orden.items.map((i) => ({
      descripcion: i.descripcion,
      cantidad: i.cantidad?.toString() || '',
      precioUnitario: i.precioUnitario?.toString() || '',
      total: i.total?.toString() || '',
      empresa: i.empresa?.trim() || orden.empresa?.trim() || orden.destino?.trim() || '',
      cuentaCargo: i.cuentaCargo?.trim() || orden.cuentaCargo?.trim() || '',
      requisitor: i.requisitor?.trim() || orden.requisitor?.trim() || '',
      ordenTrabajo: i.ordenTrabajo?.trim() || orden.ordenTrabajo?.trim() || '',
      claveProdServ: i.claveProdServ ?? '',
      url: '',
    }))
  }
  return [itemVacio()]
}

export default function OrdenFormModal({ ordenBase, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    proveedor: ordenBase?.proveedor || '',
    numeroFactura: ordenBase?.numeroFactura || '',
    fechaFactura: ordenBase?.fechaFactura || '',
    moneda: ordenBase?.moneda || 'USD',
    subtotal: ordenBase?.subtotal?.toString() || '',
    envio: ordenBase?.envio?.toString() || '',
    impuestos: ordenBase?.impuestos?.toString() || '',
    total: ordenBase?.total?.toString() || '',
    linkProveedor: ordenBase?.linkProveedor || '',
    fechaEntrega: ordenBase?.fechaEntrega || '',
    estado: (ordenBase?.estado || 'pendiente') as EstadoOrden,
    items: itemsDesdeOrden(ordenBase),
  })

  const [scrapingIndex, setScrapingIndex] = useState<number | null>(null)

  const handleScrape = async (index: number) => {
    const url = formData.items[index].url
    if (!url) {
      alert('Ingresa una URL válida primero.')
      return
    }
    
    setScrapingIndex(index)
    try {
      const auth = getClienteAuth()
      const token = await auth.currentUser?.getIdToken()
      
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ url })
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al extraer la información')
      
      const newItems = [...formData.items]
      if (data.title) newItems[index].descripcion = data.title
      if (data.price) newItems[index].precioUnitario = data.price.toString()
      
      let newProveedor = formData.proveedor
      if (data.provider && !newProveedor) newProveedor = data.provider
      
      setFormData({ ...formData, items: newItems, proveedor: newProveedor })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No se pudo extraer la información')
    } finally {
      setScrapingIndex(null)
    }
  }

  const handleItemChange = (index: number, field: string, value: string) => {
    const newItems = [...formData.items]
    newItems[index] = { ...newItems[index], [field]: value }
    setFormData({ ...formData, items: newItems })
  }

  const handleAddItem = () => {
    setFormData({ ...formData, items: [...formData.items, itemVacio()] })
  }

  const handleRemoveItem = (index: number) => {
    const newItems = formData.items.filter((_, i) => i !== index)
    setFormData({ ...formData, items: newItems })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Parse numbers
      const parsedItems: ItemFactura[] = formData.items.map(i => {
        const claveProdServ = normalizarClaveProdServ(i.claveProdServ)
        return {
          descripcion: i.descripcion,
          descripcionSimplificada: '',
          cantidad: i.cantidad ? Number(i.cantidad) : null,
          precioUnitario: i.precioUnitario ? Number(i.precioUnitario) : null,
          total: i.total ? Number(i.total) : null,
          claveProdServ,
          satPendiente: claveProdServ === null,
          empresa: i.empresa,
          cuentaCargo: i.cuentaCargo,
          requisitor: i.requisitor,
          ordenTrabajo: i.ordenTrabajo,
        }
      })

      const subtotal = formData.subtotal ? Number(formData.subtotal) : null
      const envio = formData.envio ? Number(formData.envio) : null
      const impuestos = formData.impuestos ? Number(formData.impuestos) : null
      const total = formData.total ? Number(formData.total) : null

      const payload: NuevaOrdenPayload = sincronizarCamposLegacyOrden({
        proveedor: formData.proveedor,
        numeroFactura: formData.numeroFactura || null,
        fechaFactura: formData.fechaFactura || null,
        moneda: formData.moneda,
        subtotal,
        envio,
        impuestos,
        total,
        requisitor: '',
        ordenTrabajo: '',
        empresa: '',
        cuentaCargo: '',
        destino: '',
        linkProveedor: formData.linkProveedor || null,
        fechaEntrega: formData.fechaEntrega || null,
        estado: formData.estado,
        items: parsedItems,
      })

      if (ordenBase) {
        await actualizarOrden(ordenBase.id, payload)
        onSaved({ ...ordenBase, ...payload, id: ordenBase.id, actualizadoEn: new Date() } as OrdenCompra)
      } else {
        const id = await crearOrden(payload)
        onSaved({ ...payload, id, creadoEn: new Date(), actualizadoEn: new Date() } as OrdenCompra)
      }
      onClose()
    } catch (err: unknown) {
      console.error(err)
      setError('Ocurrió un error al guardar la orden. Revisa los datos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col my-8">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 shrink-0">
          <h2 className="text-lg font-bold text-gray-900">
            {ordenBase ? 'Editar Orden' : 'Añadir Nueva Orden'}
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

          <form id="orden-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Proveedor *</label>
                <input required value={formData.proveedor} onChange={e => setFormData({ ...formData, proveedor: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Estado</label>
                <select value={formData.estado} onChange={e => setFormData({ ...formData, estado: e.target.value as EstadoOrden })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none">
                  <option value="pendiente">Pendiente</option>
                  <option value="aprobada">Aprobada</option>
                  <option value="rechazada">Rechazada</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Moneda</label>
                <select value={formData.moneda} onChange={e => setFormData({ ...formData, moneda: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none">
                  <option value="USD">USD</option>
                  <option value="MXN">MXN</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Subtotal</label>
                <input type="number" step="any" value={formData.subtotal} onChange={e => setFormData({ ...formData, subtotal: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Envío</label>
                <input type="number" step="any" value={formData.envio} onChange={e => setFormData({ ...formData, envio: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Impuestos</label>
                <input type="number" step="any" value={formData.impuestos} onChange={e => setFormData({ ...formData, impuestos: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Total</label>
                <input type="number" step="any" value={formData.total} onChange={e => setFormData({ ...formData, total: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">N° Factura</label>
                <input value={formData.numeroFactura} onChange={e => setFormData({ ...formData, numeroFactura: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Fecha Factura</label>
                <input type="date" value={formData.fechaFactura} onChange={e => setFormData({ ...formData, fechaFactura: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Fecha Entrega</label>
                <input type="date" value={formData.fechaEntrega} onChange={e => setFormData({ ...formData, fechaEntrega: e.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Link Proveedor</label>
                <input type="url" value={formData.linkProveedor} onChange={e => setFormData({ ...formData, linkProveedor: e.target.value })} placeholder="https://" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-1">Ítems</h3>
                <button type="button" onClick={handleAddItem} className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Añadir Ítem
                </button>
              </div>
              {formData.items.map((item, index) => (
                <div key={index} className="flex gap-2 items-start bg-gray-50/50 p-3 rounded-xl border border-gray-100 mb-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <input type="url" placeholder="URL del producto para auto-completar (opcional)" value={item.url} onChange={e => handleItemChange(index, 'url', e.target.value)} className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none bg-white" />
                      <button type="button" onClick={() => handleScrape(index)} disabled={scrapingIndex === index || !item.url} className="px-3 py-1.5 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors">
                        {scrapingIndex === index ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                        Auto-llenar
                      </button>
                    </div>
                    <input placeholder="Descripción" value={item.descripcion} onChange={e => handleItemChange(index, 'descripcion', e.target.value)} className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none bg-white" />
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <input required placeholder="Empresa *" value={item.empresa} onChange={e => handleItemChange(index, 'empresa', e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none bg-white" />
                      <input placeholder="Cuenta cargo" value={item.cuentaCargo} onChange={e => handleItemChange(index, 'cuentaCargo', e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none bg-white" />
                      <input required placeholder="Requisitor *" value={item.requisitor} onChange={e => handleItemChange(index, 'requisitor', e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none bg-white" />
                      <input placeholder="OT" value={item.ordenTrabajo} onChange={e => handleItemChange(index, 'ordenTrabajo', e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none bg-white" />
                    </div>
                    <div className="flex gap-2">
                      <input type="number" step="any" placeholder="Cant." value={item.cantidad} onChange={e => handleItemChange(index, 'cantidad', e.target.value)} className="w-1/4 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none bg-white" />
                      <input type="number" step="any" placeholder="P.Unit." value={item.precioUnitario} onChange={e => handleItemChange(index, 'precioUnitario', e.target.value)} className="w-1/4 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none bg-white" />
                      <input type="number" step="any" placeholder="Total" value={item.total} onChange={e => handleItemChange(index, 'total', e.target.value)} className="w-1/4 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none bg-white" />
                      <input placeholder="Clave SAT (8 díg.)" value={item.claveProdServ} onChange={e => handleItemChange(index, 'claveProdServ', e.target.value)} className="w-1/4 rounded-lg border border-gray-300 px-2 py-1.5 text-sm font-mono focus:border-blue-400 focus:outline-none bg-white" />
                    </div>
                  </div>
                  {formData.items.length > 1 && (
                    <button type="button" onClick={() => handleRemoveItem(index)} className="p-1.5 text-red-400 hover:text-red-600 rounded mt-1 bg-white border border-gray-200">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-xl shrink-0">
          <button onClick={onClose} type="button" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button type="submit" form="orden-form" disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {ordenBase ? 'Guardar Cambios' : 'Crear Orden'}
          </button>
        </div>
      </div>
    </div>
  )
}
