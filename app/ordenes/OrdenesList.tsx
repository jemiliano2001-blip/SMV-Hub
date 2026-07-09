'use client'

import { useState, useMemo } from 'react'

import type { OrdenCompra, EstadoOrden } from '@/lib/schemas'
import { formatPrecio, normalizar } from '@/lib/format'
import {
  formatFechaOrden,
  cuentaCargoEfectiva,
  ordenTieneSatPendiente,
  itemSatPendiente,
  displayOGuion,
} from '@/lib/ordenes-display'
import {
  Loader2,
  Trash2,
  Eye,
  AlertCircle,
  ExternalLink,
  Calendar,
  X,
  Clock,
  XCircle,
  CheckCircle2,
  Edit2,
  Search,
  Tags
} from 'lucide-react'
import OrdenFormModal from './OrdenFormModal'
import ModalSugerirClavesSat from './ModalSugerirClavesSat'
import { useOrdenes } from '@/lib/hooks/useOrdenes'
import { normalizarClaveProdServ } from '@/lib/sat/normalizar'

export default function OrdenesList() {
  const {
    ordenes,
    loading,
    error,
    fetchOrdenes,
    handleEliminar,
    handleCambiarEstado,
    handleCambiarEstadoLote,
    handleEliminarLote,
    addOrUpdateOrden
  } = useOrdenes()

  const [selectedOrden, setSelectedOrden] = useState<OrdenCompra | null>(null)
  
  // States para búsqueda y filtrado
  const [query, setQuery] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoOrden | 'todos'>('todos')

  // States para bulk actions y forms
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeletingBulk, setIsDeletingBulk] = useState(false)
  const [isChangingEstadoBulk, setIsChangingEstadoBulk] = useState(false)
  const [ordenToEdit, setOrdenToEdit] = useState<OrdenCompra | null>(null)
  const [satModalOrdenes, setSatModalOrdenes] = useState<OrdenCompra[] | null>(null)

  const ordenesFiltradas = useMemo(() => {
    let resultado = ordenes

    if (estadoFiltro !== 'todos') {
      resultado = resultado.filter(o => o.estado === estadoFiltro)
    }

    const q = normalizar(query.trim())
    if (q) {
      resultado = resultado.filter(o =>
        [
          o.proveedor,
          o.requisitor,
          o.empresa,
          o.ordenTrabajo,
          o.numeroFactura,
          o.fechaFactura,
          cuentaCargoEfectiva(o),
        ]
          .some(campo => normalizar(campo ?? '').includes(q))
      )
    }

    return resultado
  }, [ordenes, query, estadoFiltro])

  const hayFiltrosActivos = query.trim() !== '' || estadoFiltro !== 'todos'

  const limpiarFiltros = () => {
    setQuery('')
    setEstadoFiltro('todos')
  }

  const onDeleteClick = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (window.confirm('¿Estás seguro de que deseas eliminar esta orden de compra?')) {
      const success = await handleEliminar(id)
      if (success) {
        if (selectedOrden?.id === id) {
          setSelectedOrden(null)
        }
      } else {
        alert('No se pudo eliminar la orden. Por favor, intenta de nuevo.')
      }
    }
  }

  const onChangeEstadoClick = async (id: string, estado: EstadoOrden) => {
    const success = await handleCambiarEstado(id, estado)
    if (success) {
      setSelectedOrden((prev) => (prev && prev.id === id ? { ...prev, estado } : prev))
    } else {
      alert('No se pudo actualizar el estado. Por favor, intenta de nuevo.')
    }
  }

  const onApproveClick = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await onChangeEstadoClick(id, 'aprobada')
  }

  const onRejectClick = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm('¿Rechazar esta orden de compra?')) return
    await onChangeEstadoClick(id, 'rechazada')
  }

  // Bulk Actions
  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) newSelected.delete(id)
    else newSelected.add(id)
    setSelectedIds(newSelected)
  }

  const toggleAllSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(ordenesFiltradas.map(o => o.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleDeleteMultiple = async () => {
    if (selectedIds.size === 0) return
    if (window.confirm(`¿Estás seguro de que deseas eliminar ${selectedIds.size} órdenes seleccionadas?`)) {
      setIsDeletingBulk(true)
      const success = await handleEliminarLote(Array.from(selectedIds))
      if (success) {
        if (selectedOrden && selectedIds.has(selectedOrden.id)) {
          setSelectedOrden(null)
        }
        setSelectedIds(new Set())
      } else {
        alert('No se pudieron eliminar las órdenes. Por favor, intenta de nuevo.')
      }
      setIsDeletingBulk(false)
    }
  }

  const handleFormSaved = (ordenGuardada: OrdenCompra) => {
    addOrUpdateOrden(ordenGuardada)
    setOrdenToEdit(null)
    if (selectedOrden && selectedOrden.id === ordenGuardada.id) {
      setSelectedOrden(ordenGuardada)
    }
  }

  const ordenesSeleccionadas = useMemo(
    () => ordenes.filter((o) => selectedIds.has(o.id)),
    [ordenes, selectedIds]
  )

  const seleccionConSatPendiente = useMemo(
    () => ordenesSeleccionadas.filter(ordenTieneSatPendiente),
    [ordenesSeleccionadas]
  )

  const seleccionPendientes = useMemo(
    () => ordenesSeleccionadas.filter((o) => o.estado === 'pendiente'),
    [ordenesSeleccionadas]
  )

  const handleApproveMultiple = async () => {
    if (seleccionPendientes.length === 0) return
    if (!window.confirm(`¿Aprobar ${seleccionPendientes.length} órdenes seleccionadas?`)) return
    setIsChangingEstadoBulk(true)
    const ids = seleccionPendientes.map((o) => o.id)
    const success = await handleCambiarEstadoLote(ids, 'aprobada')
    if (success) {
      if (selectedOrden && ids.includes(selectedOrden.id)) {
        setSelectedOrden((prev) => (prev ? { ...prev, estado: 'aprobada' } : prev))
      }
    } else {
      alert('No se pudieron aprobar las órdenes. Por favor, intenta de nuevo.')
    }
    setIsChangingEstadoBulk(false)
  }

  const handleRejectMultiple = async () => {
    if (seleccionPendientes.length === 0) return
    if (
      !window.confirm(
        `¿Rechazar ${seleccionPendientes.length} órdenes seleccionadas? Las órdenes quedarán marcadas como rechazadas.`
      )
    ) {
      return
    }
    setIsChangingEstadoBulk(true)
    const ids = seleccionPendientes.map((o) => o.id)
    const success = await handleCambiarEstadoLote(ids, 'rechazada')
    if (success) {
      if (selectedOrden && ids.includes(selectedOrden.id)) {
        setSelectedOrden((prev) => (prev ? { ...prev, estado: 'rechazada' } : prev))
      }
    } else {
      alert('No se pudieron rechazar las órdenes. Por favor, intenta de nuevo.')
    }
    setIsChangingEstadoBulk(false)
  }

  const abrirSugerirSat = (ordenesTarget: OrdenCompra[]) => {
    const conPendientes = ordenesTarget.filter(ordenTieneSatPendiente)
    if (conPendientes.length === 0) {
      alert('Las órdenes seleccionadas ya tienen clave SAT en todos sus ítems.')
      return
    }
    setSatModalOrdenes(conPendientes)
  }

  const handleSatApplied = (ordenesActualizadas: OrdenCompra[]) => {
    for (const orden of ordenesActualizadas) {
      addOrUpdateOrden(orden)
    }
    if (selectedOrden) {
      const actualizada = ordenesActualizadas.find((o) => o.id === selectedOrden.id)
      if (actualizada) setSelectedOrden(actualizada)
    }
    setSatModalOrdenes(null)
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
      {/* Barra de búsqueda y filtros */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Input de texto */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por proveedor, factura, requisitor..."
              className="w-full pl-9 pr-9 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Pills de estado */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setEstadoFiltro('todos')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                estadoFiltro === 'todos'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setEstadoFiltro('pendiente')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                estadoFiltro === 'pendiente'
                  ? 'bg-yellow-100 text-yellow-800 border-yellow-400'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              <Clock className="h-3 w-3" />
              Pendiente
            </button>
            <button
              onClick={() => setEstadoFiltro('aprobada')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                estadoFiltro === 'aprobada'
                  ? 'bg-green-100 text-green-700 border-green-400'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              <CheckCircle2 className="h-3 w-3" />
              Aprobada
            </button>
            <button
              onClick={() => setEstadoFiltro('rechazada')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                estadoFiltro === 'rechazada'
                  ? 'bg-red-100 text-red-700 border-red-400'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              <XCircle className="h-3 w-3" />
              Rechazada
            </button>
          </div>
        </div>

        {/* Contador + bulk actions */}
        <div className="flex items-center gap-3 flex-wrap">
          {hayFiltrosActivos && (
            <p className="text-xs text-gray-500">
              Mostrando <span className="font-semibold text-gray-700">{ordenesFiltradas.length}</span> de{' '}
              <span className="font-semibold text-gray-700">{ordenes.length}</span> órdenes
            </p>
          )}
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={() => abrirSugerirSat(seleccionConSatPendiente)}
                disabled={seleccionConSatPendiente.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-50 text-amber-800 px-4 py-2 text-sm font-semibold hover:bg-amber-100 transition-colors border border-amber-200 disabled:opacity-50"
              >
                <Tags className="h-4 w-4" />
                Sugerir claves SAT ({seleccionConSatPendiente.length})
              </button>
              <button
                onClick={handleApproveMultiple}
                disabled={isChangingEstadoBulk || seleccionPendientes.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-green-50 text-green-700 px-4 py-2 text-sm font-semibold hover:bg-green-100 transition-colors border border-green-200 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {isChangingEstadoBulk
                  ? 'Actualizando...'
                  : `Aprobar (${seleccionPendientes.length})`}
              </button>
              <button
                onClick={handleRejectMultiple}
                disabled={isChangingEstadoBulk || seleccionPendientes.length === 0}
                className="inline-flex items-center gap-2 rounded-lg bg-red-50 text-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-100 transition-colors border border-red-200 disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                {isChangingEstadoBulk
                  ? 'Actualizando...'
                  : `Rechazar (${seleccionPendientes.length})`}
              </button>
              <button
                onClick={handleDeleteMultiple}
                disabled={isDeletingBulk || isChangingEstadoBulk}
                className="inline-flex items-center gap-2 rounded-lg bg-red-50 text-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-100 transition-colors border border-red-200 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {isDeletingBulk ? 'Eliminando...' : `Eliminar ${selectedIds.size} seleccionadas`}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Empty state por filtro activo */}
      {ordenesFiltradas.length === 0 && hayFiltrosActivos && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200 shadow-xs">
          <div className="mx-auto w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-4 text-gray-400">
            <Search className="h-5 w-5" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Sin resultados</h3>
          {query && (
            <p className="text-sm text-gray-500 mt-1">
              No se encontraron órdenes para <span className="font-medium">&quot;{query}&quot;</span>
            </p>
          )}
          <button
            onClick={limpiarFiltros}
            className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700 underline underline-offset-2"
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {ordenesFiltradas.length > 0 && (
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-4 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={ordenesFiltradas.length > 0 && selectedIds.size === ordenesFiltradas.length}
                    onChange={toggleAllSelection}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="px-6 py-4 font-semibold">Proveedor</th>
                <th className="px-6 py-4 font-semibold">Requisitor</th>
                <th className="px-6 py-4 font-semibold">No. factura</th>
                <th className="px-6 py-4 font-semibold">Empresa</th>
                <th className="px-6 py-4 font-semibold">Cuenta cargo</th>
                <th className="px-6 py-4 font-semibold text-right">Total</th>
                <th className="px-6 py-4 font-semibold">Fecha</th>
                <th className="px-6 py-4 font-semibold">Estado</th>
                <th className="px-6 py-4 font-semibold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {ordenesFiltradas.map((orden) => {
                const fechas = formatFechaOrden(orden)
                return (
                <tr 
                  key={orden.id} 
                  onClick={() => setSelectedOrden(orden)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(orden.id)}
                      onChange={(e) => toggleSelection(orden.id, e as unknown as React.MouseEvent)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      {orden.proveedor}
                      {ordenTieneSatPendiente(orden) && (
                        <span title="Falta clave SAT en algún ítem" aria-label="SAT pendiente">
                          <Tags className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {displayOGuion(orden.requisitor)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-900">
                    {displayOGuion(orden.numeroFactura)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {displayOGuion(orden.empresa)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {displayOGuion(cuentaCargoEfectiva(orden))}
                  </td>
                  <td className="px-6 py-4 font-semibold text-gray-900 text-right whitespace-nowrap">
                    {formatPrecio(orden.total, orden.moneda)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-gray-900">{fechas.principal}</div>
                    {fechas.secundaria && (
                      <div className="text-xs text-gray-400 mt-0.5">{fechas.secundaria}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {renderStatusBadge(orden.estado)}
                  </td>
                  <td className="px-6 py-4 text-center whitespace-nowrap">
                    <div className="flex items-center justify-center gap-1">
                      {orden.estado === 'pendiente' && (
                        <>
                          <button
                            onClick={(e) => onApproveClick(orden.id, e)}
                            className="p-1 text-gray-500 hover:text-green-600 rounded-md hover:bg-green-50 transition-colors"
                            title="Aprobar"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => onRejectClick(orden.id, e)}
                            className="p-1 text-gray-500 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                            title="Rechazar"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </>
                      )}
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
                        onClick={(e) => onDeleteClick(orden.id, e)}
                        className="p-1 text-gray-500 hover:text-red-600 rounded-md hover:bg-gray-100 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
      )}

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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOrdenToEdit(selectedOrden)}
                  className="p-1.5 text-blue-600 hover:text-blue-800 rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-1.5 text-sm font-semibold"
                >
                  <Edit2 className="h-4 w-4" />
                  Editar
                </button>
                <div className="w-px h-4 bg-gray-200 mx-1"></div>
                <button
                  onClick={() => setSelectedOrden(null)}
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
                  <div className="mt-1 text-sm font-semibold text-gray-900">Total: <span className="text-blue-600 font-semibold">{formatPrecio(selectedOrden.total, selectedOrden.moneda)}</span></div>
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
                    <span className="text-gray-900">{formatPrecio(selectedOrden.subtotal, selectedOrden.moneda)}</span>

                    {selectedOrden.envio != null && selectedOrden.envio !== 0 && (
                      <>
                        <span className="text-gray-400">Envío:</span>
                        <span className="text-gray-900">{formatPrecio(selectedOrden.envio, selectedOrden.moneda)}</span>
                      </>
                    )}

                    <span className="text-gray-400">Impuestos (Tax):</span>
                    <span className="text-gray-900">{formatPrecio(selectedOrden.impuestos, selectedOrden.moneda)}</span>

                    <span className="text-gray-400">Total:</span>
                    <span className="text-gray-900 font-semibold">{formatPrecio(selectedOrden.total, selectedOrden.moneda)}</span>
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
                        {selectedOrden.items.map((item, index) => (
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
                            <td className="px-4 py-3 text-gray-600">{item.empresa || selectedOrden.empresa || '—'}</td>
                            <td className="px-4 py-3 text-gray-600">{item.cuentaCargo || selectedOrden.cuentaCargo || '—'}</td>
                            <td className="px-4 py-3 text-gray-600">{item.requisitor || selectedOrden.requisitor || '—'}</td>
                            <td className="px-4 py-3 text-center">{item.cantidad ?? '-'}</td>
                            <td className="px-4 py-3 text-right">{formatPrecio(item.precioUnitario, selectedOrden.moneda)}</td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatPrecio(item.total, selectedOrden.moneda)}</td>
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
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-xl shrink-0">
              <button
                onClick={(e) => onDeleteClick(selectedOrden.id, e)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50 hover:text-red-800 transition-colors"
              >
                <Trash2 className="h-4 w-4" /> Eliminar orden
              </button>
              <div className="flex items-center gap-2">
                {ordenTieneSatPendiente(selectedOrden) && (
                  <button
                    onClick={() => abrirSugerirSat([selectedOrden])}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm hover:bg-amber-50 transition-colors"
                  >
                    <Tags className="h-4 w-4" /> Sugerir clave SAT
                  </button>
                )}
                {selectedOrden.estado !== 'aprobada' && (
                  <button
                    onClick={() => onChangeEstadoClick(selectedOrden.id, 'aprobada')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-white px-4 py-2 text-sm font-semibold text-green-700 shadow-sm hover:bg-green-50 hover:text-green-800 transition-colors"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Aprobar
                  </button>
                )}
                {selectedOrden.estado !== 'rechazada' && (
                  <button
                    onClick={() => onChangeEstadoClick(selectedOrden.id, 'rechazada')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50 hover:text-red-800 transition-colors"
                  >
                    <XCircle className="h-4 w-4" /> Rechazar
                  </button>
                )}
                <button
                  onClick={() => setSelectedOrden(null)}
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Formulario para editar */}
      {ordenToEdit && (
        <OrdenFormModal
          ordenBase={ordenToEdit}
          onClose={() => setOrdenToEdit(null)}
          onSaved={handleFormSaved}
        />
      )}

      {satModalOrdenes && (
        <ModalSugerirClavesSat
          ordenes={satModalOrdenes}
          historialOrdenes={ordenes}
          onClose={() => setSatModalOrdenes(null)}
          onApplied={handleSatApplied}
        />
      )}
    </>
  )
}
