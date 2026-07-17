'use client'

import { useState, useMemo } from 'react'

import type { OrdenCompra, EstadoOrden } from '@/lib/schemas'
import { normalizar } from '@/lib/format'
import {
  cuentaCargoEfectiva,
  ordenTieneSatPendiente,
} from '@/lib/ordenes-display'
import { Loader2, AlertCircle } from 'lucide-react'

import OrdenFormModal from './OrdenFormModal'
import ModalSugerirClavesSat from './ModalSugerirClavesSat'
import { useOrdenes } from '@/lib/hooks/useOrdenes'

import OrdenesFiltros from './components/OrdenesFiltros'
import OrdenesTabla from './components/OrdenesTabla'
import OrdenDetallesModal from './components/OrdenDetallesModal'

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

  const [colFiltros, setColFiltros] = useState({
    proveedor: '',
    requisitor: '',
    empresa: '',
    cuentaCargo: ''
  })

  const proveedoresUnicos = useMemo(() => Array.from(new Set(ordenes.map(o => o.proveedor).filter(Boolean))).sort(), [ordenes])
  const requisitoresUnicos = useMemo(() => Array.from(new Set(ordenes.map(o => o.requisitor).filter(Boolean))).sort(), [ordenes])
  const empresasUnicas = useMemo(() => Array.from(new Set(ordenes.map(o => o.empresa).filter(Boolean))).sort(), [ordenes])
  const cuentasUnicas = useMemo(() => Array.from(new Set(ordenes.map(o => cuentaCargoEfectiva(o)).filter(Boolean))).sort(), [ordenes])

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

    if (colFiltros.proveedor) {
      resultado = resultado.filter(o => o.proveedor === colFiltros.proveedor)
    }
    if (colFiltros.requisitor) {
      resultado = resultado.filter(o => o.requisitor === colFiltros.requisitor)
    }
    if (colFiltros.empresa) {
      resultado = resultado.filter(o => o.empresa === colFiltros.empresa)
    }
    if (colFiltros.cuentaCargo) {
      resultado = resultado.filter(o => cuentaCargoEfectiva(o) === colFiltros.cuentaCargo)
    }

    const q = normalizar(query.trim())
    if (q) {
      resultado = resultado.filter(o => {
        const matchBase = [
          o.proveedor,
          o.requisitor,
          o.empresa,
          o.ordenTrabajo,
          o.numeroFactura,
          o.fechaFactura,
          cuentaCargoEfectiva(o),
        ].some(campo => normalizar(campo ?? '').includes(q))

        if (matchBase) return true

        if (o.items && o.items.length > 0) {
          return o.items.some(item => 
            [
              item.descripcion, 
              item.claveProdServ, 
              item.empresa, 
              item.cuentaCargo, 
              item.requisitor
            ].some(campo => normalizar(campo ?? '').includes(q))
          )
        }

        return false
      })
    }

    return resultado
  }, [ordenes, query, estadoFiltro, colFiltros])

  const hayFiltrosActivos = query.trim() !== '' || estadoFiltro !== 'todos' || Object.values(colFiltros).some(v => v !== '')

  const limpiarFiltros = () => {
    setQuery('')
    setEstadoFiltro('todos')
    setColFiltros({ proveedor: '', requisitor: '', empresa: '', cuentaCargo: '' })
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
      <OrdenesFiltros 
        query={query}
        setQuery={setQuery}
        estadoFiltro={estadoFiltro}
        setEstadoFiltro={setEstadoFiltro}
        hayFiltrosActivos={hayFiltrosActivos}
        ordenesFiltradasLength={ordenesFiltradas.length}
        ordenesTotalLength={ordenes.length}
        limpiarFiltros={limpiarFiltros}
        selectedIdsSize={selectedIds.size}
        seleccionConSatPendienteLength={seleccionConSatPendiente.length}
        onSugerirSat={() => abrirSugerirSat(seleccionConSatPendiente)}
        seleccionPendientesLength={seleccionPendientes.length}
        isChangingEstadoBulk={isChangingEstadoBulk}
        onApproveMultiple={handleApproveMultiple}
        onRejectMultiple={handleRejectMultiple}
        isDeletingBulk={isDeletingBulk}
        onDeleteMultiple={handleDeleteMultiple}
      />

      {ordenesFiltradas.length > 0 && (
        <OrdenesTabla 
          ordenesFiltradas={ordenesFiltradas}
          selectedIds={selectedIds}
          toggleAllSelection={toggleAllSelection}
          toggleSelection={toggleSelection}
          colFiltros={colFiltros}
          setColFiltros={setColFiltros}
          proveedoresUnicos={proveedoresUnicos}
          requisitoresUnicos={requisitoresUnicos}
          empresasUnicas={empresasUnicas}
          cuentasUnicas={cuentasUnicas}
          onSelectOrden={setSelectedOrden}
          onApproveClick={onApproveClick}
          onRejectClick={onRejectClick}
          onDeleteClick={onDeleteClick}
        />
      )}

      {selectedOrden && (
        <OrdenDetallesModal 
          orden={selectedOrden}
          onClose={() => setSelectedOrden(null)}
          onEdit={() => setOrdenToEdit(selectedOrden)}
          onDelete={(e) => onDeleteClick(selectedOrden.id, e)}
          onApprove={() => onChangeEstadoClick(selectedOrden.id, 'aprobada')}
          onReject={() => onChangeEstadoClick(selectedOrden.id, 'rechazada')}
          onSugerirSat={() => abrirSugerirSat([selectedOrden])}
        />
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
