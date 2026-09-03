'use client'

import { useState, useMemo } from 'react'

import type { OrdenCompra, EstadoOrden } from '@/lib/schemas'
import { normalizar } from '@/lib/format'
import {
  cuentaCargoEfectiva,
  ordenTieneSatPendiente,
} from '@/lib/ordenes-display'
import { Loader2, AlertCircle, Package, CheckCircle2, XCircle, Tags, Trash2 } from 'lucide-react'
import ModuleEmptyState from '@/components/layout/ModuleEmptyState'
import ModuleSurface from '@/components/layout/ModuleSurface'
import ModuleBulkBar from '@/components/layout/ModuleBulkBar'
import { Button } from '@/components/ui/button'

import OrdenFormModal from './OrdenFormModal'
import ModalSugerirClavesSat from './ModalSugerirClavesSat'
import { useOrdenes } from '@/lib/hooks/useOrdenes'

import OrdenesFiltros from './components/OrdenesFiltros'
import OrdenesTabla from './components/OrdenesTabla'
import OrdenDetallesModal from './components/OrdenDetallesModal'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'
import { toast } from 'sonner'

export default function OrdenesList({ busquedaInicial }: { busquedaInicial?: string } = {}) {
  const confirmar = useConfirmDialog()
  const {
    ordenes,
    loading,
    cargandoMas,
    cargandoCompleto,
    hayMas,
    totalOrdenes,
    error,
    fetchOrdenes,
    cargarMas,
    cargarTodas,
    handleEliminar,
    handleCambiarEstado,
    handleCambiarEstadoLote,
    handleEliminarLote,
    addOrUpdateOrden
  } = useOrdenes()

  const [selectedOrden, setSelectedOrden] = useState<OrdenCompra | null>(null)
  
  // States para búsqueda y filtrado
  const [query, setQuery] = useState(busquedaInicial ?? '')
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
    const aceptado = await confirmar({
      title: 'Eliminar orden de compra',
      description: 'La orden se eliminará de la lista y esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar orden',
      variant: 'destructive',
    })
    if (!aceptado) return
    const success = await handleEliminar(id)
    if (success) {
      if (selectedOrden?.id === id) {
        setSelectedOrden(null)
      }
    } else {
      toast.error('No se pudo eliminar la orden. Intenta de nuevo.')
    }
  }

  const onChangeEstadoClick = async (id: string, estado: EstadoOrden) => {
    const success = await handleCambiarEstado(id, estado)
    if (success) {
      setSelectedOrden((prev) => (prev && prev.id === id ? { ...prev, estado } : prev))
    } else {
      toast.error('No se pudo actualizar el estado. Intenta de nuevo.')
    }
  }

  const onApproveClick = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await onChangeEstadoClick(id, 'aprobada')
  }

  const onRejectClick = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const aceptado = await confirmar({
      title: 'Rechazar orden de compra',
      description: 'La orden quedará marcada como rechazada.',
      confirmLabel: 'Rechazar orden',
      variant: 'destructive',
    })
    if (!aceptado) return
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
    const aceptado = await confirmar({
      title: 'Eliminar órdenes seleccionadas',
      description: `Se eliminarán ${selectedIds.size} órdenes y esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar órdenes',
      variant: 'destructive',
    })
    if (!aceptado) return
    setIsDeletingBulk(true)
    const success = await handleEliminarLote(Array.from(selectedIds))
    if (success) {
      if (selectedOrden && selectedIds.has(selectedOrden.id)) {
        setSelectedOrden(null)
      }
      setSelectedIds(new Set())
    } else {
      toast.error('No se pudieron eliminar las órdenes. Intenta de nuevo.')
    }
    setIsDeletingBulk(false)
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
    const aceptado = await confirmar({
      title: 'Aprobar órdenes seleccionadas',
      description: `Se aprobarán ${seleccionPendientes.length} órdenes pendientes.`,
      confirmLabel: 'Aprobar órdenes',
    })
    if (!aceptado) return
    setIsChangingEstadoBulk(true)
    const ids = seleccionPendientes.map((o) => o.id)
    const success = await handleCambiarEstadoLote(ids, 'aprobada')
    if (success) {
      if (selectedOrden && ids.includes(selectedOrden.id)) {
        setSelectedOrden((prev) => (prev ? { ...prev, estado: 'aprobada' } : prev))
      }
    } else {
      toast.error('No se pudieron aprobar las órdenes. Intenta de nuevo.')
    }
    setIsChangingEstadoBulk(false)
  }

  const handleRejectMultiple = async () => {
    if (seleccionPendientes.length === 0) return
    const aceptado = await confirmar({
      title: 'Rechazar órdenes seleccionadas',
      description: `${seleccionPendientes.length} órdenes quedarán marcadas como rechazadas.`,
      confirmLabel: 'Rechazar órdenes',
      variant: 'destructive',
    })
    if (!aceptado) return
    setIsChangingEstadoBulk(true)
    const ids = seleccionPendientes.map((o) => o.id)
    const success = await handleCambiarEstadoLote(ids, 'rechazada')
    if (success) {
      if (selectedOrden && ids.includes(selectedOrden.id)) {
        setSelectedOrden((prev) => (prev ? { ...prev, estado: 'rechazada' } : prev))
      }
    } else {
      toast.error('No se pudieron rechazar las órdenes. Intenta de nuevo.')
    }
    setIsChangingEstadoBulk(false)
  }

  const abrirSugerirSat = async (ordenesTarget: OrdenCompra[]) => {
    const conPendientes = ordenesTarget.filter(ordenTieneSatPendiente)
    if (conPendientes.length === 0) {
      toast.info('Las órdenes seleccionadas ya tienen clave SAT en todos sus ítems.')
      return
    }
    const toastId = toast.loading('Preparando historial para sugerencias SAT…')
    try {
      await cargarTodas()
      toast.dismiss(toastId)
      setSatModalOrdenes(conPendientes)
    } catch {
      toast.error('No se pudo preparar el historial SAT', { id: toastId })
    }
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
      <ModuleSurface className="flex flex-col items-center justify-center py-20">
        <Loader2 className="mb-4 size-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Cargando órdenes de compra…</p>
      </ModuleSurface>
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
      <ModuleEmptyState
        icon={Package}
        title="No hay órdenes"
        description="No hay órdenes de compra registradas. Sube una nueva factura para comenzar."
      />
    )
  }

  return (
    <>
      <OrdenesFiltros 
        query={query}
        setQuery={setQuery}
        estadoFiltro={estadoFiltro}
        setEstadoFiltro={(estado) => {
          setEstadoFiltro(estado)
        }}
        hayFiltrosActivos={hayFiltrosActivos}
        ordenesFiltradasLength={ordenesFiltradas.length}
        ordenesTotalLength={totalOrdenes}
        limpiarFiltros={limpiarFiltros}
        selectedIdsSize={selectedIds.size}
        seleccionConSatPendienteLength={seleccionConSatPendiente.length}
        onSugerirSat={() => void abrirSugerirSat(seleccionConSatPendiente)}
        seleccionPendientesLength={seleccionPendientes.length}
        isChangingEstadoBulk={isChangingEstadoBulk}
        onApproveMultiple={handleApproveMultiple}
        onRejectMultiple={handleRejectMultiple}
        isDeletingBulk={isDeletingBulk}
        onDeleteMultiple={handleDeleteMultiple}
        onPrepararFiltros={() => void cargarTodas()}
      />

      {cargandoCompleto && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs font-medium text-sky-800" role="status">
          <Loader2 className="h-4 w-4 animate-spin" />
          Preparando todas las órdenes para aplicar filtros completos…
        </div>
      )}

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
          onPrepararFiltros={() => void cargarTodas()}
        />
      )}

      {!cargandoCompleto && ordenesFiltradas.length > 0 && (
        <div className="mt-3 flex flex-col items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row">
          <p className="text-xs font-medium text-muted-foreground" aria-live="polite">
            Mostrando <span className="font-bold text-foreground">{ordenesFiltradas.length}</span> de{' '}
            <span className="font-bold text-foreground">{totalOrdenes}</span> órdenes
          </p>
          {hayMas && (
            <button
              type="button"
              onClick={() => void cargarMas()}
              disabled={cargandoMas}
              className="min-h-10 min-w-32 rounded-lg border border-input bg-card px-4 py-2 text-xs font-bold text-primary hover:bg-muted disabled:opacity-50"
            >
              {cargandoMas ? 'Cargando…' : 'Cargar más'}
            </button>
          )}
        </div>
      )}

      {selectedOrden && (
        <OrdenDetallesModal 
          orden={selectedOrden}
          onClose={() => setSelectedOrden(null)}
          onEdit={() => setOrdenToEdit(selectedOrden)}
          onDelete={(e) => onDeleteClick(selectedOrden.id, e)}
          onApprove={() => onChangeEstadoClick(selectedOrden.id, 'aprobada')}
          onReject={() => onChangeEstadoClick(selectedOrden.id, 'rechazada')}
          onSugerirSat={() => void abrirSugerirSat([selectedOrden])}
          onRecepcionExitosa={fetchOrdenes}
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

      {/* Barra flotante de acciones en lote */}
      <ModuleBulkBar
        selectedCount={selectedIds.size}
        totalCount={ordenesFiltradas.length}
        onClearSelection={() =>
          toggleAllSelection({ target: { checked: false } } as React.ChangeEvent<HTMLInputElement>)
        }
        actions={
          <>
            {seleccionPendientes.length > 0 && (
              <>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleApproveMultiple}
                  disabled={isChangingEstadoBulk}
                  className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                >
                  <CheckCircle2 className="size-3.5" />
                  Aprobar ({seleccionPendientes.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleRejectMultiple}
                  disabled={isChangingEstadoBulk}
                  className="h-8 gap-1.5 border-rose-300 text-rose-600 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
                >
                  <XCircle className="size-3.5" />
                  Rechazar ({seleccionPendientes.length})
                </Button>
              </>
            )}

            {seleccionConSatPendiente.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void abrirSugerirSat(seleccionConSatPendiente)}
                className="h-8 gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 text-xs font-semibold cursor-pointer"
              >
                <Tags className="size-3.5" />
                Claves SAT ({seleccionConSatPendiente.length})
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleDeleteMultiple}
              disabled={isDeletingBulk}
              className="h-8 gap-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700 text-xs cursor-pointer"
            >
              <Trash2 className="size-3.5" />
              Eliminar ({selectedIds.size})
            </Button>
          </>
        }
      />
    </>
  )
}
