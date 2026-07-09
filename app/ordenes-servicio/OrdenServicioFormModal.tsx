'use client'

import { useState, useId } from 'react'
import { Loader2, X } from 'lucide-react'
import type { EstatusOrdenServicio, OrdenServicio } from '@/lib/schemas'
import { actualizarOrdenServicio } from '@/lib/ordenes-servicio'
import {
  ESTATUS_ORDEN_SERVICIO,
  ESTATUS_LABEL,
  calcularCantidadPendiente,
} from '@/lib/ordenes-servicio-helpers'

interface Props {
  ordenBase: OrdenServicio
  nombresOperadores: string[]
  onClose: () => void
  onSaved: (orden: OrdenServicio) => void
}

const INPUT_CLS =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

function parseNumeroOpcional(value: string): number | null {
  const t = value.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function numeroAString(n: number | null | undefined): string {
  if (n === null || n === undefined) return ''
  return String(n)
}

export default function OrdenServicioFormModal({
  ordenBase,
  nombresOperadores,
  onClose,
  onSaved,
}: Props) {
  const datalistId = useId()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    estatus: ordenBase.estatus as EstatusOrdenServicio,
    descripcion: ordenBase.descripcion,
    requisitor: ordenBase.requisitor,
    ingAcargo: ordenBase.ingAcargo || '',
    cantidad: ordenBase.cantidad || '',
    cantidadEntregada: numeroAString(ordenBase.cantidadEntregada),
    cantidadPendiente: numeroAString(ordenBase.cantidadPendiente),
    numOC: ordenBase.numOC || '',
    fechaOC: ordenBase.fechaOC || '',
    ordenTrabajo: ordenBase.ordenTrabajo || '',
    tiempoEntrega: ordenBase.tiempoEntrega || '',
    fechaEntrega: ordenBase.fechaEntrega || '',
    fechaEntregaActualizada: ordenBase.fechaEntregaActualizada || '',
    nota: ordenBase.nota || '',
  })

  function actualizarCampo<K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) {
    setFormData((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'cantidad' || key === 'cantidadEntregada') {
        const ent = next.cantidadEntregada.trim() ? Number(next.cantidadEntregada) : null
        if (ent !== null && !Number.isNaN(ent)) {
          const pend = calcularCantidadPendiente(next.cantidad, ent)
          if (pend !== null) {
            next.cantidadPendiente = String(pend)
          }
        }
      }
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.descripcion.trim()) return
    setLoading(true)
    setError(null)

    try {
      const cambios = {
        estatus: formData.estatus,
        descripcion: formData.descripcion.trim(),
        requisitor: formData.requisitor.trim(),
        ingAcargo: formData.ingAcargo.trim() || null,
        cantidad: formData.cantidad.trim() || null,
        cantidadEntregada: parseNumeroOpcional(formData.cantidadEntregada),
        cantidadPendiente: parseNumeroOpcional(formData.cantidadPendiente),
        numOC: formData.numOC.trim() || null,
        fechaOC: formData.fechaOC || null,
        ordenTrabajo: formData.ordenTrabajo.trim() || null,
        tiempoEntrega: formData.tiempoEntrega.trim() || null,
        fechaEntrega: formData.fechaEntrega.trim() || null,
        fechaEntregaActualizada: formData.fechaEntregaActualizada.trim() || null,
        nota: formData.nota.trim() || null,
      }

      await actualizarOrdenServicio(ordenBase.id, cambios)
      onSaved({ ...ordenBase, ...cambios, actualizadoEn: new Date() })
    } catch (err) {
      console.error(err)
      setError('Ocurrió un error al guardar la orden de servicio. Revisa los datos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col my-8">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 shrink-0">
          <h2 className="text-lg font-bold text-gray-900">Editar orden de servicio</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <datalist id={datalistId}>
            {nombresOperadores.map((nombre) => (
              <option key={nombre} value={nombre} />
            ))}
          </datalist>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form id="orden-servicio-form" onSubmit={handleSubmit} className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <select
                value={formData.estatus}
                onChange={(e) => actualizarCampo('estatus', e.target.value as EstatusOrdenServicio)}
                className={`w-36 ${INPUT_CLS}`}
              >
                {ESTATUS_ORDEN_SERVICIO.map((e) => (
                  <option key={e} value={e}>
                    {ESTATUS_LABEL[e]}
                  </option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Descripción del servicio o material *"
                value={formData.descripcion}
                onChange={(e) => actualizarCampo('descripcion', e.target.value)}
                required
                className={`min-w-[200px] flex-1 ${INPUT_CLS}`}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <input
                type="text"
                placeholder="Requisitor"
                value={formData.requisitor}
                onChange={(e) => actualizarCampo('requisitor', e.target.value)}
                list={datalistId}
                className={`flex-1 min-w-[140px] ${INPUT_CLS}`}
              />
              <input
                type="text"
                placeholder="Ing. a cargo"
                value={formData.ingAcargo}
                onChange={(e) => actualizarCampo('ingAcargo', e.target.value)}
                list={datalistId}
                className={`flex-1 min-w-[140px] ${INPUT_CLS}`}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="No. OC"
                value={formData.numOC}
                onChange={(e) => actualizarCampo('numOC', e.target.value)}
                className={INPUT_CLS}
              />
              <input
                type="date"
                title="Fecha OC"
                value={formData.fechaOC}
                onChange={(e) => actualizarCampo('fechaOC', e.target.value)}
                className={INPUT_CLS}
              />
              <input
                type="text"
                placeholder="Orden de trabajo"
                value={formData.ordenTrabajo}
                onChange={(e) => actualizarCampo('ordenTrabajo', e.target.value)}
                className={INPUT_CLS}
              />
              <input
                type="text"
                placeholder="Cantidad total"
                value={formData.cantidad}
                onChange={(e) => actualizarCampo('cantidad', e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <input
                type="number"
                min={0}
                placeholder="Entregadas"
                value={formData.cantidadEntregada}
                onChange={(e) => actualizarCampo('cantidadEntregada', e.target.value)}
                className={INPUT_CLS}
              />
              <input
                type="number"
                min={0}
                placeholder="Pendientes"
                value={formData.cantidadPendiente}
                onChange={(e) => actualizarCampo('cantidadPendiente', e.target.value)}
                className={INPUT_CLS}
              />
              <input
                type="text"
                placeholder="Tiempo de entrega"
                value={formData.tiempoEntrega}
                onChange={(e) => actualizarCampo('tiempoEntrega', e.target.value)}
                className={INPUT_CLS}
              />
              <input
                type="text"
                placeholder="Fecha de entrega"
                value={formData.fechaEntrega}
                onChange={(e) => actualizarCampo('fechaEntrega', e.target.value)}
                className={INPUT_CLS}
              />
            </div>
            <input
              type="text"
              placeholder="Fecha entrega actualizada"
              value={formData.fechaEntregaActualizada}
              onChange={(e) => actualizarCampo('fechaEntregaActualizada', e.target.value)}
              className={`w-full ${INPUT_CLS}`}
            />
            <textarea
              placeholder="Nota"
              value={formData.nota}
              onChange={(e) => actualizarCampo('nota', e.target.value)}
              rows={3}
              className={`w-full resize-y ${INPUT_CLS}`}
            />
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-xl shrink-0">
          <button
            onClick={onClose}
            type="button"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="orden-servicio-form"
            disabled={loading || !formData.descripcion.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  )
}
