import { CheckCircle2, Clock, Search, Tags, Trash2, X, XCircle } from 'lucide-react'
import type { EstadoOrden } from '@/lib/schemas'
import ModuleEmptyState from '@/components/layout/ModuleEmptyState'
import ModuleFilterChips from '@/components/layout/ModuleFilterChips'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
  onPrepararFiltros: () => void;
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
  onPrepararFiltros,
}: OrdenesFiltrosProps) {
  return (
    <>
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={onPrepararFiltros}
              placeholder="Buscar por proveedor, factura, requisitor, empresa, ítem..."
              className="pl-9 pr-9"
              aria-label="Buscar órdenes"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <ModuleFilterChips
            ariaLabel="Filtrar por estado"
            value={estadoFiltro}
            onValueChange={(value) => setEstadoFiltro(value as EstadoOrden | 'todos')}
            options={[
              { value: 'todos', label: 'Todos' },
              {
                value: 'pendiente',
                label: (
                  <>
                    <Clock />
                    Pendiente
                  </>
                ),
                className:
                  'data-[state=on]:border-yellow-300 data-[state=on]:bg-yellow-50 data-[state=on]:text-yellow-800',
              },
              {
                value: 'aprobada',
                label: (
                  <>
                    <CheckCircle2 />
                    Aprobada
                  </>
                ),
                className:
                  'data-[state=on]:border-green-300 data-[state=on]:bg-green-50 data-[state=on]:text-green-700',
              },
              {
                value: 'rechazada',
                label: (
                  <>
                    <XCircle />
                    Rechazada
                  </>
                ),
                className:
                  'data-[state=on]:border-red-300 data-[state=on]:bg-red-50 data-[state=on]:text-red-700',
              },
            ]}
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {hayFiltrosActivos && (
            <p className="text-xs text-muted-foreground">
              Mostrando <span className="font-semibold text-foreground">{ordenesFiltradasLength}</span> de{' '}
              <span className="font-semibold text-foreground">{ordenesTotalLength}</span> órdenes
            </p>
          )}
          {selectedIdsSize > 0 && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onSugerirSat}
                disabled={seleccionConSatPendienteLength === 0}
                className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
              >
                <Tags />
                Sugerir claves SAT ({seleccionConSatPendienteLength})
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onApproveMultiple}
                disabled={isChangingEstadoBulk || seleccionPendientesLength === 0}
                className="border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
              >
                <CheckCircle2 />
                {isChangingEstadoBulk
                  ? 'Actualizando...'
                  : `Aprobar (${seleccionPendientesLength})`}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRejectMultiple}
                disabled={isChangingEstadoBulk || seleccionPendientesLength === 0}
                className="border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
              >
                <XCircle />
                {isChangingEstadoBulk
                  ? 'Actualizando...'
                  : `Rechazar (${seleccionPendientesLength})`}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onDeleteMultiple}
                disabled={isDeletingBulk || isChangingEstadoBulk}
                className="border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
              >
                <Trash2 />
                {isDeletingBulk ? 'Eliminando...' : `Eliminar ${selectedIdsSize} seleccionadas`}
              </Button>
            </>
          )}
        </div>
      </div>

      {ordenesFiltradasLength === 0 && hayFiltrosActivos && (
        <ModuleEmptyState
          icon={Search}
          title="Sin resultados"
          description={query ? `No se encontraron órdenes para “${query}”.` : 'Ninguna orden coincide con los filtros.'}
          action={
            <Button type="button" variant="outline" size="sm" onClick={limpiarFiltros}>
              Limpiar filtros
            </Button>
          }
        />
      )}
    </>
  )
}
