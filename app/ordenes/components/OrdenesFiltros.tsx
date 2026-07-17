import { CheckCircle2, Clock, Search, Tags, Trash2, X, XCircle } from 'lucide-react'
import type { EstadoOrden } from '@/lib/schemas'

interface OrdenesFiltrosProps {
  query: string;
  setQuery: (q: string) => void;
  estadoFiltro: EstadoOrden | 'todos';
  setEstadoFiltro: (e: EstadoOrden | 'todos') => void;
  hayFiltrosActivos: boolean;
  ordenesFiltradasLength: number;
  ordenesTotalLength: number;
  limpiarFiltros: () => void;
  selectedIdsSize: number;
  seleccionConSatPendienteLength: number;
  onSugerirSat: () => void;
  seleccionPendientesLength: number;
  isChangingEstadoBulk: boolean;
  onApproveMultiple: () => void;
  onRejectMultiple: () => void;
  isDeletingBulk: boolean;
  onDeleteMultiple: () => void;
}

export default function OrdenesFiltros({
  query,
  setQuery,
  estadoFiltro,
  setEstadoFiltro,
  hayFiltrosActivos,
  ordenesFiltradasLength,
  ordenesTotalLength,
  limpiarFiltros,
  selectedIdsSize,
  seleccionConSatPendienteLength,
  onSugerirSat,
  seleccionPendientesLength,
  isChangingEstadoBulk,
  onApproveMultiple,
  onRejectMultiple,
  isDeletingBulk,
  onDeleteMultiple,
}: OrdenesFiltrosProps) {
  return (
    <>
      {/* Barra de búsqueda y filtros */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Input de texto */}
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none group-focus-within:text-blue-500 transition-colors" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar por proveedor, factura, requisitor, empresa, ítem..."
              className="w-full pl-9 pr-9 py-2 text-sm rounded-xl border border-gray-300 bg-white text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 hover:border-gray-400 transition-all duration-200"
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
              className={`px-4 py-1.5 rounded-full text-xs font-semibold border shadow-sm hover:shadow-md active:scale-95 transition-all duration-200 ${
                estadoFiltro === 'todos'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setEstadoFiltro('pendiente')}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold border shadow-sm hover:shadow-md active:scale-95 transition-all duration-200 ${
                estadoFiltro === 'pendiente'
                  ? 'bg-yellow-50 text-yellow-800 border-yellow-300 ring-1 ring-yellow-400/50'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              <Clock className="h-3 w-3" />
              Pendiente
            </button>
            <button
              onClick={() => setEstadoFiltro('aprobada')}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold border shadow-sm hover:shadow-md active:scale-95 transition-all duration-200 ${
                estadoFiltro === 'aprobada'
                  ? 'bg-green-50 text-green-700 border-green-300 ring-1 ring-green-400/50'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              <CheckCircle2 className="h-3 w-3" />
              Aprobada
            </button>
            <button
              onClick={() => setEstadoFiltro('rechazada')}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold border shadow-sm hover:shadow-md active:scale-95 transition-all duration-200 ${
                estadoFiltro === 'rechazada'
                  ? 'bg-red-50 text-red-700 border-red-300 ring-1 ring-red-400/50'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
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
              Mostrando <span className="font-semibold text-gray-700">{ordenesFiltradasLength}</span> de{' '}
              <span className="font-semibold text-gray-700">{ordenesTotalLength}</span> órdenes
            </p>
          )}
          {selectedIdsSize > 0 && (
            <>
              <button
                onClick={onSugerirSat}
                disabled={seleccionConSatPendienteLength === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-50 text-amber-800 px-4 py-2 text-sm font-semibold shadow-sm hover:shadow-md hover:bg-amber-100 active:scale-95 transition-all duration-200 border border-amber-200 disabled:opacity-50 disabled:active:scale-100 disabled:hover:shadow-sm"
              >
                <Tags className="h-4 w-4" />
                Sugerir claves SAT ({seleccionConSatPendienteLength})
              </button>
              <button
                onClick={onApproveMultiple}
                disabled={isChangingEstadoBulk || seleccionPendientesLength === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-green-50 text-green-700 px-4 py-2 text-sm font-semibold shadow-sm hover:shadow-md hover:bg-green-100 active:scale-95 transition-all duration-200 border border-green-200 disabled:opacity-50 disabled:active:scale-100 disabled:hover:shadow-sm"
              >
                <CheckCircle2 className="h-4 w-4" />
                {isChangingEstadoBulk
                  ? 'Actualizando...'
                  : `Aprobar (${seleccionPendientesLength})`}
              </button>
              <button
                onClick={onRejectMultiple}
                disabled={isChangingEstadoBulk || seleccionPendientesLength === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-red-50 text-red-600 px-4 py-2 text-sm font-semibold shadow-sm hover:shadow-md hover:bg-red-100 active:scale-95 transition-all duration-200 border border-red-200 disabled:opacity-50 disabled:active:scale-100 disabled:hover:shadow-sm"
              >
                <XCircle className="h-4 w-4" />
                {isChangingEstadoBulk
                  ? 'Actualizando...'
                  : `Rechazar (${seleccionPendientesLength})`}
              </button>
              <button
                onClick={onDeleteMultiple}
                disabled={isDeletingBulk || isChangingEstadoBulk}
                className="inline-flex items-center gap-2 rounded-xl bg-red-50 text-red-600 px-4 py-2 text-sm font-semibold shadow-sm hover:shadow-md hover:bg-red-100 active:scale-95 transition-all duration-200 border border-red-200 disabled:opacity-50 disabled:active:scale-100 disabled:hover:shadow-sm"
              >
                <Trash2 className="h-4 w-4" />
                {isDeletingBulk ? 'Eliminando...' : `Eliminar ${selectedIdsSize} seleccionadas`}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Empty state por filtro activo */}
      {ordenesFiltradasLength === 0 && hayFiltrosActivos && (
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
    </>
  )
}
