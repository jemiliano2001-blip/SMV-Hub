'use client'

import { useState, useMemo, useId } from 'react'
import { Loader2, AlertCircle, Wrench, Trash2, Edit2 } from 'lucide-react'
import type { EstatusOrdenServicio, OrdenServicio } from '@/lib/schemas'
import type { NuevaOrdenServicioPayload } from '@/lib/ordenes-servicio'
import { useOrdenesServicio } from '@/lib/hooks/useOrdenesServicio'
import { useOperadores } from '@/lib/hooks/useOperadores'
import { formatFecha, normalizar } from '@/lib/format'
import {
  ESTATUS_ORDEN_SERVICIO,
  ESTATUS_BADGE,
  ESTATUS_LABEL,
  calcularCantidadPendiente,
  formatearCantidadEntrega,
  truncarNota,
} from '@/lib/ordenes-servicio-helpers'
import OrdenServicioFormModal from './OrdenServicioFormModal'

type FormState = {
  descripcion: string
  requisitor: string
  ingAcargo: string
  cantidad: string
  cantidadEntregada: string
  cantidadPendiente: string
  numOC: string
  fechaOC: string
  ordenTrabajo: string
  tiempoEntrega: string
  fechaEntrega: string
  fechaEntregaActualizada: string
  nota: string
}

function emptyForm(): FormState {
  return {
    descripcion: '',
    requisitor: '',
    ingAcargo: '',
    cantidad: '',
    cantidadEntregada: '',
    cantidadPendiente: '',
    numOC: '',
    fechaOC: '',
    ordenTrabajo: '',
    tiempoEntrega: '',
    fechaEntrega: '',
    fechaEntregaActualizada: '',
    nota: '',
  }
}

function aplicarPendienteAuto(form: FormState): FormState {
  const ent = form.cantidadEntregada.trim() ? Number(form.cantidadEntregada) : null
  if (ent === null || Number.isNaN(ent)) return form
  const pend = calcularCantidadPendiente(form.cantidad, ent)
  if (pend === null) return form
  return { ...form, cantidadPendiente: String(pend) }
}

function parseNumeroOpcional(value: string): number | null {
  const t = value.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

const INPUT_CLS =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500'

export default function OrdenesServicioList() {
  const {
    ordenes,
    loading,
    error,
    fetchOrdenes,
    agregarOrden,
    actualizarEstatus,
    borrarOrden,
    borrarOrdenesServicioLote,
  } = useOrdenesServicio()
  const { activos: operadoresActivos } = useOperadores()
  const datalistId = useId()

  const nombresOperadores = useMemo(
    () => operadoresActivos.map((op) => op.nombre).sort((a, b) => a.localeCompare(b, 'es')),
    [operadoresActivos]
  )

  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [filtroEstatus, setFiltroEstatus] = useState<EstatusOrdenServicio | 'todos'>('todos')
  const [busqueda, setBusqueda] = useState('')

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeletingBulk, setIsDeletingBulk] = useState(false)
  const [ordenToEdit, setOrdenToEdit] = useState<OrdenServicio | null>(null)

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda.trim())
    return ordenes.filter((o) => {
      if (filtroEstatus !== 'todos' && o.estatus !== filtroEstatus) return false
      if (q) {
        const haystack = normalizar(
          `${o.descripcion} ${o.requisitor} ${o.ingAcargo ?? ''} ${o.numOC ?? ''} ${o.ordenTrabajo ?? ''} ${o.nota ?? ''}`
        )
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [ordenes, filtroEstatus, busqueda])

  function actualizarForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === 'cantidad' || key === 'cantidadEntregada') {
        return aplicarPendienteAuto(next)
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.descripcion.trim()) return
    setSaving(true)
    try {
      const payload: NuevaOrdenServicioPayload = {
        estatus: 'pendiente',
        descripcion: form.descripcion.trim(),
        requisitor: form.requisitor.trim(),
        ingAcargo: form.ingAcargo.trim() || null,
        cantidad: form.cantidad.trim() || null,
        cantidadEntregada: parseNumeroOpcional(form.cantidadEntregada),
        cantidadPendiente: parseNumeroOpcional(form.cantidadPendiente),
        numOC: form.numOC.trim() || null,
        fechaOC: form.fechaOC || null,
        ordenTrabajo: form.ordenTrabajo.trim() || null,
        tiempoEntrega: form.tiempoEntrega.trim() || null,
        fechaEntrega: form.fechaEntrega.trim() || null,
        fechaEntregaActualizada: form.fechaEntregaActualizada.trim() || null,
        nota: form.nota.trim() || null,
      }
      await agregarOrden(payload)
      setForm(emptyForm())
    } catch (err) {
      console.error('Error al guardar orden de servicio:', err)
    } finally {
      setSaving(false)
    }
  }

  async function handleCambioEstatus(id: string, estatus: EstatusOrdenServicio) {
    await actualizarEstatus(id, estatus)
  }

  async function handleEliminar(id: string, desc: string) {
    if (!confirm(`¿Eliminar "${desc.slice(0, 60)}"?`)) return
    await borrarOrden(id)
  }

  function toggleSelection(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) newSelected.delete(id)
    else newSelected.add(id)
    setSelectedIds(newSelected)
  }

  function toggleAllSelection(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.checked) {
      setSelectedIds(new Set(filtradas.map((o) => o.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  async function handleDeleteMultiple() {
    if (selectedIds.size === 0) return
    if (window.confirm(`¿Estás seguro de que deseas eliminar ${selectedIds.size} órdenes de servicio seleccionadas?`)) {
      setIsDeletingBulk(true)
      const success = await borrarOrdenesServicioLote(Array.from(selectedIds))
      if (success) {
        setSelectedIds(new Set())
      } else {
        alert('No se pudieron eliminar las órdenes. Por favor, intenta de nuevo.')
      }
      setIsDeletingBulk(false)
    }
  }

  function handleFormSaved() {
    setOrdenToEdit(null)
    fetchOrdenes()
  }

  const chip = (activo: boolean, onClick: () => void, label: string) => (
    <button
      key={label}
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
        activo
          ? 'bg-blue-600 text-white'
          : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-6">
      <datalist id={datalistId}>
        {nombresOperadores.map((nombre) => (
          <option key={nombre} value={nombre} />
        ))}
      </datalist>

      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Nueva orden de servicio</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="Descripción del servicio o material *"
              value={form.descripcion}
              onChange={(e) => actualizarForm('descripcion', e.target.value)}
              required
              className={`min-w-[200px] flex-1 ${INPUT_CLS}`}
            />
            <input
              type="text"
              placeholder="Requisitor"
              value={form.requisitor}
              onChange={(e) => actualizarForm('requisitor', e.target.value)}
              list={datalistId}
              className={`w-44 sm:w-52 ${INPUT_CLS}`}
            />
            <input
              type="text"
              placeholder="Ing. a cargo"
              value={form.ingAcargo}
              onChange={(e) => actualizarForm('ingAcargo', e.target.value)}
              list={datalistId}
              className={`w-44 sm:w-52 ${INPUT_CLS}`}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <input
              type="text"
              placeholder="No. OC"
              value={form.numOC}
              onChange={(e) => actualizarForm('numOC', e.target.value)}
              className={INPUT_CLS}
            />
            <input
              type="date"
              title="Fecha OC"
              value={form.fechaOC}
              onChange={(e) => actualizarForm('fechaOC', e.target.value)}
              className={INPUT_CLS}
            />
            <input
              type="text"
              placeholder="Orden de trabajo"
              value={form.ordenTrabajo}
              onChange={(e) => actualizarForm('ordenTrabajo', e.target.value)}
              className={INPUT_CLS}
            />
            <input
              type="text"
              placeholder="Cantidad total"
              value={form.cantidad}
              onChange={(e) => actualizarForm('cantidad', e.target.value)}
              className={INPUT_CLS}
            />
            <input
              type="number"
              min={0}
              placeholder="Entregadas"
              value={form.cantidadEntregada}
              onChange={(e) => actualizarForm('cantidadEntregada', e.target.value)}
              className={INPUT_CLS}
            />
            <input
              type="number"
              min={0}
              placeholder="Pendientes"
              value={form.cantidadPendiente}
              onChange={(e) => actualizarForm('cantidadPendiente', e.target.value)}
              className={INPUT_CLS}
            />
            <input
              type="text"
              placeholder="Tiempo de entrega"
              value={form.tiempoEntrega}
              onChange={(e) => actualizarForm('tiempoEntrega', e.target.value)}
              className={INPUT_CLS}
            />
          </div>
          <div className="flex flex-wrap gap-3 items-start">
            <input
              type="text"
              placeholder="Fecha de entrega (??, 8 al 15 abril…)"
              value={form.fechaEntrega}
              onChange={(e) => actualizarForm('fechaEntrega', e.target.value)}
              className={`min-w-[180px] flex-1 ${INPUT_CLS}`}
            />
            <input
              type="text"
              placeholder="Fecha entrega actualizada"
              value={form.fechaEntregaActualizada}
              onChange={(e) => actualizarForm('fechaEntregaActualizada', e.target.value)}
              className={`min-w-[180px] flex-1 ${INPUT_CLS}`}
            />
          </div>
          <div className="flex flex-wrap gap-3 items-end">
            <textarea
              placeholder="Nota (entregas parciales, visitas, seguimiento…)"
              value={form.nota}
              onChange={(e) => actualizarForm('nota', e.target.value)}
              rows={2}
              className={`min-w-[240px] flex-1 resize-y ${INPUT_CLS}`}
            />
            <button
              type="submit"
              disabled={saving || !form.descripcion.trim()}
              className="ml-auto flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Agregar
            </button>
          </div>
        </form>
      </div>

      {/* Filters */}
      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-400 mr-1">Estatus:</span>
            {chip(filtroEstatus === 'todos', () => setFiltroEstatus('todos'), 'Todos')}
            {ESTATUS_ORDEN_SERVICIO.map((e) =>
              chip(filtroEstatus === e, () => setFiltroEstatus(e), ESTATUS_LABEL[e])
            )}
          </div>
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por descripción, requisitor, OT, No. OC, nota…"
            className={`w-full ${INPUT_CLS}`}
          />
          <div className="flex items-center gap-3">
            <p className="text-xs text-gray-500">
              {filtradas.length} de {ordenes.length} órdenes
            </p>
            {selectedIds.size > 0 && (
              <button
                onClick={handleDeleteMultiple}
                disabled={isDeletingBulk}
                className="inline-flex items-center gap-2 rounded-lg bg-red-50 text-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-100 transition-colors border border-red-200 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {isDeletingBulk ? 'Eliminando...' : `Eliminar ${selectedIds.size} seleccionadas`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200 shadow-xs">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-4" />
          <p className="text-gray-500 text-sm">Cargando órdenes de servicio…</p>
        </div>
      )}

      {/* Error */}
      {error && (
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
      )}

      {/* Table */}
      {!loading && !error && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          {filtradas.length === 0 ? (
            <div className="text-center py-20">
              <div className="mx-auto w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-4 text-gray-400">
                <Wrench className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900">
                {ordenes.length === 0 ? 'Sin órdenes de servicio' : 'Sin coincidencias'}
              </h3>
              <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
                {ordenes.length === 0
                  ? 'Agrega la primera con el formulario de arriba.'
                  : 'Ningún registro coincide con los filtros actuales.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={filtradas.length > 0 && selectedIds.size === filtradas.length}
                        onChange={toggleAllSelection}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="px-3 py-3 font-semibold whitespace-nowrap">Estatus</th>
                    <th className="px-3 py-3 font-semibold whitespace-nowrap">Fecha OC</th>
                    <th className="px-3 py-3 font-semibold whitespace-nowrap">No. OC</th>
                    <th className="px-3 py-3 font-semibold whitespace-nowrap">Requisitor</th>
                    <th className="px-3 py-3 font-semibold whitespace-nowrap">Ing.</th>
                    <th className="px-3 py-3 font-semibold whitespace-nowrap">O.T.</th>
                    <th className="px-3 py-3 font-semibold min-w-[180px]">Descripción</th>
                    <th className="px-3 py-3 font-semibold text-center whitespace-nowrap">Cant.</th>
                    <th className="px-3 py-3 font-semibold whitespace-nowrap">T. entrega</th>
                    <th className="px-3 py-3 font-semibold whitespace-nowrap">F. entrega</th>
                    <th className="px-3 py-3 font-semibold whitespace-nowrap">F. act.</th>
                    <th className="px-3 py-3 font-semibold min-w-[120px]">Nota</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filtradas.map((o) => (
                    <tr
                      key={o.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        o.estatus === 'detenida' ? 'bg-red-50/40' : ''
                      }`}
                    >
                      <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(o.id)}
                          onChange={(e) => toggleSelection(o.id, e as unknown as React.MouseEvent)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <select
                          value={o.estatus}
                          onChange={(e) =>
                            handleCambioEstatus(o.id, e.target.value as EstatusOrdenServicio)
                          }
                          className={`rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset cursor-pointer border-0 focus:ring-2 focus:ring-blue-500 ${ESTATUS_BADGE[o.estatus]}`}
                          title="Cambiar estatus"
                        >
                          {ESTATUS_ORDEN_SERVICIO.map((e) => (
                            <option key={e} value={e}>
                              {ESTATUS_LABEL[e]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500">
                        {formatFecha(o.fechaOC)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap font-mono text-xs">
                        {o.numOC || '-'}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap font-medium text-gray-900 max-w-[140px] truncate" title={o.requisitor}>
                        {o.requisitor || '-'}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap max-w-[120px] truncate" title={o.ingAcargo ?? ''}>
                        {o.ingAcargo || '-'}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap font-mono text-xs">
                        {o.ordenTrabajo || '-'}
                      </td>
                      <td className="px-3 py-3 text-gray-900">{o.descripcion}</td>
                      <td
                        className="px-3 py-3 text-center whitespace-nowrap text-xs"
                        title={
                          o.cantidadEntregada != null
                            ? `Entregadas: ${o.cantidadEntregada}, Pendientes: ${o.cantidadPendiente ?? calcularCantidadPendiente(o.cantidad, o.cantidadEntregada) ?? '?'}`
                            : undefined
                        }
                      >
                        {formatearCantidadEntrega(o)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs">{o.tiempoEntrega || '-'}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-600">
                        {o.fechaEntrega?.trim() || '-'}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-600">
                        {o.fechaEntregaActualizada?.trim() || '-'}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-600 max-w-[160px]" title={o.nota ?? ''}>
                        {truncarNota(o.nota) || '-'}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setOrdenToEdit(o)}
                            className="text-gray-400 hover:text-blue-600 transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEliminar(o.id, o.descripcion)}
                            className="text-gray-400 hover:text-red-600 transition-colors"
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
          )}
        </div>
      )}

      {ordenToEdit && (
        <OrdenServicioFormModal
          ordenBase={ordenToEdit}
          nombresOperadores={nombresOperadores}
          onClose={() => setOrdenToEdit(null)}
          onSaved={handleFormSaved}
        />
      )}
    </div>
  )
}
