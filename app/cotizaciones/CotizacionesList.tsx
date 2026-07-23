'use client'

import { useMemo, useState } from 'react'
import {
  Loader2,
  AlertCircle,
  Search,
  ExternalLink,
  FileSearch,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import type { Cotizacion, EstatusCotizacion } from '@/lib/schemas'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'
import { toast } from 'sonner'
import { formatPrecio, formatFecha } from '@/lib/format'
import {
  filtrarCotizaciones,
  ordenarCotizaciones,
  paginarCotizaciones,
  direccionDefaultColumna,
  hayTokens,
  TAMANO_PAGINA_COTIZACIONES,
  type ColumnaOrdenCotizacion,
  type DireccionOrden,
  type FiltroUbicacion,
  type FiltroEstatus,
} from '@/lib/cotizaciones-tabla'
import { useCotizaciones } from '@/lib/hooks/useCotizaciones'
import CotizacionFormModal from './CotizacionFormModal'

const ESTATUS_BADGE: Record<EstatusCotizacion, string> = {
  cotizado: 'bg-green-50 text-green-700 ring-green-600/20',
  cancelado: 'bg-red-50 text-red-700 ring-red-600/20',
  revisar: 'bg-yellow-50 text-yellow-800 ring-yellow-600/20',
}

type CotizacionCardProps = {
  c: Cotizacion
  selected: boolean
  onToggleSelect: (id: string, e: React.MouseEvent) => void
  onEditar: (c: Cotizacion) => void
}

// Tarjeta para < md: mismo dato que la fila de tabla, sin scroll horizontal.
function CotizacionCard({ c, selected, onToggleSelect, onEditar }: CotizacionCardProps) {
  return (
    <div onClick={() => onEditar(c)} className="p-4 space-y-2.5 active:bg-gray-50 cursor-pointer">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0 flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onToggleSelect(c.id, e as unknown as React.MouseEvent)}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 shrink-0"
          />
          <div className="min-w-0">
            <p className="text-xs text-gray-500">{formatFecha(c.fecha)} · {c.solicitante || '—'}</p>
            <p className="text-sm font-semibold text-gray-900 break-words">{c.descripcion}</p>
          </div>
        </div>
        <span className={`shrink-0 inline-flex rounded-full px-2 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${ESTATUS_BADGE[c.estatus]}`}>
          {c.estatus}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs pl-[26px]">
        <div className="min-w-0">
          <span className="text-gray-400 block">Proveedor</span>
          <span className="text-gray-900 truncate block">{c.proveedor}</span>
        </div>
        <div className="min-w-0">
          <span className="text-gray-400 block">No. parte</span>
          <span className="text-gray-900 truncate block font-mono">{c.numeroParte || '-'}</span>
        </div>
        <div className="min-w-0">
          <span className="text-gray-400 block">Ubicación</span>
          <span className={`inline-block rounded px-1.5 py-0.5 font-semibold ${c.ubicacion === 'USA' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
            {c.ubicacion === 'USA' ? 'EUA' : 'MX'}
          </span>
        </div>
        <div className="min-w-0">
          <span className="text-gray-400 block">Cantidad</span>
          <span className="text-gray-900">{c.cantidad ?? '-'}</span>
        </div>
      </div>

      <div className="flex items-center justify-between pl-[26px] pt-2 border-t border-gray-50">
        <span className="text-xs text-gray-500">{formatPrecio(c.precioUnitario, c.moneda)} c/u</span>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-gray-900">{formatPrecio(c.total, c.moneda)}</span>
          {c.link && /^https?:\/\//i.test(c.link) && (
            <a
              href={c.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-gray-400 hover:text-blue-600"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CotizacionesList() {
  const confirmar = useConfirmDialog()
  const {
    cotizaciones,
    loading,
    error,
    fetchCotizaciones,
    addOrUpdateCotizacion,
    handleEliminarLote,
  } = useCotizaciones()

  const [busqueda, setBusqueda] = useState('')
  const [filtroUbicacion, setFiltroUbicacion] = useState<FiltroUbicacion>('todas')
  const [filtroEstatus, setFiltroEstatus] = useState<FiltroEstatus>('todos')

  const [columnaOrden, setColumnaOrden] = useState<ColumnaOrdenCotizacion>('fecha')
  const [direccionOrden, setDireccionOrden] = useState<DireccionOrden>('desc')
  const [pagina, setPagina] = useState(1)
  const [ordenPersonalizado, setOrdenPersonalizado] = useState(false)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeletingBulk, setIsDeletingBulk] = useState(false)
  const [isAddingMode, setIsAddingMode] = useState(false)
  const [cotizacionToEdit, setCotizacionToEdit] = useState<Cotizacion | null>(null)

  const filtros = useMemo(
    () => ({
      busqueda,
      ubicacion: filtroUbicacion,
      estatus: filtroEstatus,
    }),
    [busqueda, filtroUbicacion, filtroEstatus]
  )

  const filtradas = useMemo(
    () => filtrarCotizaciones(cotizaciones, filtros),
    [cotizaciones, filtros]
  )

  const ordenadas = useMemo(
    () =>
      ordenarCotizaciones(filtradas, columnaOrden, direccionOrden, {
        busqueda: filtros.busqueda,
        usarRelevancia: !ordenPersonalizado && hayTokens(filtros.busqueda),
      }),
    [filtradas, columnaOrden, direccionOrden, filtros.busqueda, ordenPersonalizado]
  )

  const paginaEfectiva = useMemo(() => {
    const totalPaginas = Math.ceil(ordenadas.length / TAMANO_PAGINA_COTIZACIONES)
    if (totalPaginas === 0) return 1
    return Math.min(pagina, totalPaginas)
  }, [ordenadas.length, pagina])

  const paginacion = useMemo(
    () => paginarCotizaciones(ordenadas, paginaEfectiva, TAMANO_PAGINA_COTIZACIONES),
    [ordenadas, paginaEfectiva]
  )

  const filasPagina = paginacion.filas

  const resetPaginaYSeleccion = () => {
    setPagina(1)
    setSelectedIds(new Set())
  }

  const cambiarPagina = (nuevaPagina: number) => {
    setPagina(nuevaPagina)
    setSelectedIds(new Set())
  }

  const handleOrdenColumna = (columna: ColumnaOrdenCotizacion) => {
    setOrdenPersonalizado(true)
    if (columnaOrden === columna) {
      setDireccionOrden((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setColumnaOrden(columna)
      setDireccionOrden(direccionDefaultColumna(columna))
    }
  }

  const iconoOrden = (columna: ColumnaOrdenCotizacion) => {
    if (columnaOrden !== columna) return null
    return direccionOrden === 'asc' ? (
      <ChevronUp className="inline h-3.5 w-3.5 ml-1" />
    ) : (
      <ChevronDown className="inline h-3.5 w-3.5 ml-1" />
    )
  }

  const thOrdenable = (
    columna: ColumnaOrdenCotizacion,
    label: string,
    className = ''
  ) => (
    <th
      className={`px-4 py-3 font-semibold whitespace-nowrap cursor-pointer select-none hover:bg-gray-100 ${className}`}
      onClick={() => handleOrdenColumna(columna)}
    >
      {label}
      {iconoOrden(columna)}
    </th>
  )

  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) newSelected.delete(id)
    else newSelected.add(id)
    setSelectedIds(newSelected)
  }

  const toggleAllSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filasPagina.map((c) => c.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleDeleteMultiple = async () => {
    if (selectedIds.size === 0) return
    const aceptado = await confirmar({
      title: 'Eliminar cotizaciones seleccionadas',
      description: `Se eliminarán ${selectedIds.size} cotizaciones y esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar cotizaciones',
      variant: 'destructive',
    })
    if (!aceptado) return
    setIsDeletingBulk(true)
    const success = await handleEliminarLote(Array.from(selectedIds))
    if (success) {
      setSelectedIds(new Set())
    } else {
      toast.error('No se pudieron eliminar las cotizaciones. Intenta de nuevo.')
    }
    setIsDeletingBulk(false)
  }

  const handleFormSaved = (cotizacionGuardada: Cotizacion) => {
    addOrUpdateCotizacion(cotizacionGuardada)
    setIsAddingMode(false)
    setCotizacionToEdit(null)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200 shadow-xs">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-4" />
        <p className="text-gray-500 text-sm">Cargando cotizaciones…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-red-800">Error de carga</h3>
          <p className="text-sm text-red-700 mt-1">{error}</p>
          <button onClick={fetchCotizaciones} className="mt-3 text-xs font-semibold text-red-800 underline hover:text-red-900">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (cotizaciones.length === 0) {
    return (
      <>
        <div className="text-center py-20 bg-white rounded-xl border border-gray-200 shadow-xs">
          <div className="mx-auto w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-4 text-gray-400">
            <FileSearch className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">No hay cotizaciones</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
            Aún no hay cotizaciones registradas. Usa la pestaña <strong>Importar desde Sheet</strong> para cargar el histórico,
            o agrega una manualmente.
          </p>
          <button
            onClick={() => setIsAddingMode(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Añadir Cotización
          </button>
        </div>
        {isAddingMode && (
          <CotizacionFormModal
            onClose={() => setIsAddingMode(false)}
            onSaved={handleFormSaved}
          />
        )}
      </>
    )
  }

  const chip = (activo: boolean, onClick: () => void, label: string) => (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
        activo ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  )

  return (
    <>
      {/* Buscador + filtros */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-4 space-y-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value)
              resetPaginaYSeleccion()
            }}
            placeholder="Buscar por descripción, no. de parte o proveedor…"
            className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 mr-1">Ubicación:</span>
          {chip(filtroUbicacion === 'todas', () => { setFiltroUbicacion('todas'); resetPaginaYSeleccion() }, 'Todas')}
          {chip(filtroUbicacion === 'MX', () => { setFiltroUbicacion('MX'); resetPaginaYSeleccion() }, 'México')}
          {chip(filtroUbicacion === 'USA', () => { setFiltroUbicacion('USA'); resetPaginaYSeleccion() }, 'EUA')}
          <span className="text-xs font-semibold text-gray-400 mx-1 ml-3">Estatus:</span>
          {chip(filtroEstatus === 'todos', () => { setFiltroEstatus('todos'); resetPaginaYSeleccion() }, 'Todos')}
          {chip(filtroEstatus === 'cotizado', () => { setFiltroEstatus('cotizado'); resetPaginaYSeleccion() }, 'Cotizado')}
          {chip(filtroEstatus === 'revisar', () => { setFiltroEstatus('revisar'); resetPaginaYSeleccion() }, 'Revisar')}
          {chip(filtroEstatus === 'cancelado', () => { setFiltroEstatus('cancelado'); resetPaginaYSeleccion() }, 'Cancelado')}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-3">
              <p className="text-xs text-gray-500">
                {filtradas.length} de {cotizaciones.length} cotizaciones
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
            {paginacion.totalFilas > 0 && (
              <p className="text-xs text-gray-500">
                Mostrando {paginacion.indiceInicio}–{paginacion.indiceFin} de {paginacion.totalFilas} resultados
              </p>
            )}
          </div>
          <button
            onClick={() => setIsAddingMode(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Añadir Cotización
          </button>
        </div>
      </div>

      {/* Tabla (desktop) / Tarjetas (celular) */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 w-12 text-center">
                  <input
                    type="checkbox"
                    checked={filasPagina.length > 0 && filasPagina.every((c) => selectedIds.has(c.id))}
                    onChange={toggleAllSelection}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                {thOrdenable('fecha', 'Fecha')}
                {thOrdenable('solicitante', 'Solicitante')}
                {thOrdenable('proveedor', 'Proveedor')}
                {thOrdenable('descripcion', 'Descripción', 'min-w-[220px]')}
                {thOrdenable('numeroParte', 'No. parte')}
                <th className="px-4 py-3 font-semibold text-center">Ubic.</th>
                {thOrdenable('cantidad', 'Cant.', 'text-center')}
                {thOrdenable('precioUnitario', 'P. Unit.', 'text-right')}
                {thOrdenable('total', 'Total', 'text-right')}
                {thOrdenable('estatus', 'Estatus')}
                <th className="px-4 py-3 font-semibold text-center">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filasPagina.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setCotizacionToEdit(c)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={(e) => toggleSelection(c.id, e as unknown as React.MouseEvent)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatFecha(c.fecha)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{c.solicitante || '-'}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{c.proveedor}</td>
                  <td className="px-4 py-3 text-gray-900 min-w-[220px]">{c.descripcion}</td>
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{c.numeroParte || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${c.ubicacion === 'USA' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                      {c.ubicacion === 'USA' ? 'EUA' : 'MX'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">{c.cantidad ?? '-'}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{formatPrecio(c.precioUnitario, c.moneda)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">{formatPrecio(c.total, c.moneda)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${ESTATUS_BADGE[c.estatus]}`}>
                      {c.estatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    {c.link && /^https?:\/\//i.test(c.link) ? (
                      <a href={c.link} target="_blank" rel="noopener noreferrer" className="inline-flex text-gray-500 hover:text-blue-600" title="Abrir enlace">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y divide-gray-100">
          {filasPagina.map((c) => (
            <CotizacionCard
              key={c.id}
              c={c}
              selected={selectedIds.has(c.id)}
              onToggleSelect={toggleSelection}
              onEditar={setCotizacionToEdit}
            />
          ))}
        </div>

        {filtradas.length === 0 && (
          <div className="text-center py-12 text-sm text-gray-500">
            Ninguna cotización coincide con la búsqueda.
          </div>
        )}
        {paginacion.totalPaginas > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 bg-gray-50">
            <button
              type="button"
              onClick={() => cambiarPagina(Math.max(1, paginaEfectiva - 1))}
              disabled={paginaEfectiva <= 1}
              className="text-sm font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-40"
            >
              « Anterior
            </button>
            <span className="text-sm text-gray-600">
              Página {paginacion.paginaActual} de {paginacion.totalPaginas}
            </span>
            <button
              type="button"
              onClick={() => cambiarPagina(Math.min(paginacion.totalPaginas, paginaEfectiva + 1))}
              disabled={paginaEfectiva >= paginacion.totalPaginas}
              className="text-sm font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-40"
            >
              Siguiente »
            </button>
          </div>
        )}
      </div>

      {(isAddingMode || cotizacionToEdit) && (
        <CotizacionFormModal
          cotizacionBase={cotizacionToEdit || undefined}
          onClose={() => {
            setIsAddingMode(false)
            setCotizacionToEdit(null)
          }}
          onSaved={handleFormSaved}
        />
      )}
    </>
  )
}
