'use client'

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import type { Requisicion, PrioridadRequisicion } from '@/lib/schemas'
import { actualizarRequisicion } from '@/lib/requisiciones'
import { SOLICITANTES, EMPRESAS, PRIORIDADES } from './RequisicionesList'
import { ESTADOS_REQUISICION, ESTADO_LABEL, REVISION_FINANZAS_OPCIONES } from '@/lib/requisiciones-helpers'

interface Props {
  requisicionBase: Requisicion
  onClose: () => void
  onSaved: (requisicion: Requisicion) => void
}

const INPUT_CLS =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

export default function RequisicionFormModal({ requisicionBase, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAuto = requisicionBase.tipo === 'automatizacion'

  const [formData, setFormData] = useState({
    descripcion: requisicionBase.descripcion,
    link: requisicionBase.link || '',
    solicitante: requisicionBase.solicitante,
    cantidad: requisicionBase.cantidad || '',
    tienda: requisicionBase.tienda || '',
    prioridad: (requisicionBase.prioridad || '') as PrioridadRequisicion | '',
    empresa: requisicionBase.empresa || '',
    ordenServicio: requisicionBase.ordenServicio || '',
    fechaPedido: requisicionBase.fechaPedido,
    parteNumero: requisicionBase.parteNumero || '',
    fechaEntregaEst: requisicionBase.fechaEntregaEst || '',
    recibio: requisicionBase.recibio || '',
    revisionFinanzas: requisicionBase.revisionFinanzas || '',
    nota: requisicionBase.nota || '',
    estado: requisicionBase.estado,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.descripcion.trim()) return
    setLoading(true)
    setError(null)

    try {
      const cambios = {
        descripcion: formData.descripcion.trim(),
        link: formData.link.trim() || null,
        solicitante: formData.solicitante,
        cantidad: formData.cantidad.trim() || null,
        tienda: formData.tienda.trim() || null,
        prioridad: (formData.prioridad || null) as PrioridadRequisicion | null,
        empresa: formData.empresa || null,
        ordenServicio: formData.ordenServicio.trim() || null,
        fechaPedido: formData.fechaPedido,
        parteNumero: isAuto ? (formData.parteNumero.trim() || null) : null,
        fechaEntregaEst: isAuto ? (formData.fechaEntregaEst || null) : null,
        recibio: formData.recibio.trim() || null,
        revisionFinanzas: formData.revisionFinanzas.trim() || null,
        nota: formData.nota.trim() || null,
        estado: formData.estado,
      }

      await actualizarRequisicion(requisicionBase.id, cambios)
      onSaved({ ...requisicionBase, ...cambios, actualizadoEn: new Date() } as Requisicion)
    } catch (err) {
      console.error(err)
      setError('Ocurrió un error al guardar la requisición. Revisa los datos.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col my-8">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Editar Requisición</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {isAuto ? 'Automatización' : 'Compra general'}
            </p>
          </div>
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

          <form id="requisicion-form" onSubmit={handleSubmit} className="space-y-3">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Descripción del artículo *"
                value={formData.descripcion}
                onChange={(e) => setFormData((f) => ({ ...f, descripcion: e.target.value }))}
                required
                className={`flex-1 ${INPUT_CLS}`}
              />
              <select
                value={formData.solicitante}
                onChange={(e) => setFormData((f) => ({ ...f, solicitante: e.target.value }))}
                className={INPUT_CLS}
              >
                <option value="">Solicitante</option>
                {SOLICITANTES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <input
              type="url"
              placeholder="Link del producto (opcional)"
              value={formData.link}
              onChange={(e) => setFormData((f) => ({ ...f, link: e.target.value }))}
              className={`w-full ${INPUT_CLS}`}
            />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Cantidad"
                value={formData.cantidad}
                onChange={(e) => setFormData((f) => ({ ...f, cantidad: e.target.value }))}
                className={INPUT_CLS}
              />
              <input
                type="text"
                placeholder={isAuto ? 'Proveedor' : 'Tienda / Proveedor'}
                value={formData.tienda}
                onChange={(e) => setFormData((f) => ({ ...f, tienda: e.target.value }))}
                className={INPUT_CLS}
              />
              {!isAuto && (
                <select
                  value={formData.prioridad}
                  onChange={(e) => setFormData((f) => ({ ...f, prioridad: e.target.value as PrioridadRequisicion | '' }))}
                  className={INPUT_CLS}
                >
                  <option value="">Prioridad</option>
                  {PRIORIDADES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              )}
              {isAuto && (
                <input
                  type="text"
                  placeholder="No. de parte"
                  value={formData.parteNumero}
                  onChange={(e) => setFormData((f) => ({ ...f, parteNumero: e.target.value }))}
                  className={INPUT_CLS}
                />
              )}
              <select
                value={formData.empresa}
                onChange={(e) => setFormData((f) => ({ ...f, empresa: e.target.value }))}
                className={INPUT_CLS}
              >
                <option value="">Empresa</option>
                {EMPRESAS.map((emp) => (
                  <option key={emp} value={emp}>{emp}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="text"
                placeholder="S.O. / Orden de trabajo"
                value={formData.ordenServicio}
                onChange={(e) => setFormData((f) => ({ ...f, ordenServicio: e.target.value }))}
                className={`w-48 ${INPUT_CLS}`}
              />
              <input
                type="date"
                title={isAuto ? 'Fecha de compra' : 'Fecha de pedido'}
                value={formData.fechaPedido}
                onChange={(e) => setFormData((f) => ({ ...f, fechaPedido: e.target.value }))}
                className={INPUT_CLS}
              />
              {isAuto && (
                <input
                  type="date"
                  title="Fecha de entrega estimada"
                  value={formData.fechaEntregaEst}
                  onChange={(e) => setFormData((f) => ({ ...f, fechaEntregaEst: e.target.value }))}
                  className={INPUT_CLS}
                />
              )}
              <select
                value={formData.estado}
                onChange={(e) => setFormData((f) => ({ ...f, estado: e.target.value as Requisicion['estado'] }))}
                className={INPUT_CLS}
              >
                {ESTADOS_REQUISICION.map((e) => (
                  <option key={e} value={e}>{ESTADO_LABEL[e]}</option>
                ))}
              </select>
            </div>
            {isAuto && (
              <div className="flex flex-wrap gap-3">
                <select
                  value={formData.recibio}
                  onChange={(e) => setFormData((f) => ({ ...f, recibio: e.target.value }))}
                  className={INPUT_CLS}
                >
                  <option value="">Recibió</option>
                  {SOLICITANTES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <select
                  value={formData.revisionFinanzas}
                  onChange={(e) => setFormData((f) => ({ ...f, revisionFinanzas: e.target.value }))}
                  className={INPUT_CLS}
                >
                  {REVISION_FINANZAS_OPCIONES.map((op) => (
                    <option key={op || 'vacio'} value={op}>{op || 'Rev. finanzas'}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Nota (entregas parciales, seguimiento…)"
                  value={formData.nota}
                  onChange={(e) => setFormData((f) => ({ ...f, nota: e.target.value }))}
                  className={`min-w-[200px] flex-1 ${INPUT_CLS}`}
                />
              </div>
            )}
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-xl shrink-0">
          <button onClick={onClose} type="button" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            Cancelar
          </button>
          <button type="submit" form="requisicion-form" disabled={loading || !formData.descripcion.trim()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  )
}
