import type { Dispatch, SetStateAction } from 'react'
import { CheckCircle2, Eye, Tags, Trash2, XCircle } from 'lucide-react'
import type { OrdenCompra } from '@/lib/schemas'
import { formatPrecio } from '@/lib/format'
import { formatFechaOrden, cuentaCargoEfectiva, ordenTieneSatPendiente, displayOGuion } from '@/lib/ordenes-display'
import OrdenBadgeEstado from './OrdenBadgeEstado'

type ColFiltros = { proveedor: string; requisitor: string; empresa: string; cuentaCargo: string }

interface OrdenesTablaProps {
  ordenesFiltradas: OrdenCompra[];
  selectedIds: Set<string>;
  toggleAllSelection: (e: React.ChangeEvent<HTMLInputElement>) => void;
  toggleSelection: (id: string, e: React.MouseEvent) => void;
  colFiltros: ColFiltros;
  setColFiltros: Dispatch<SetStateAction<ColFiltros>>;
  proveedoresUnicos: string[];
  requisitoresUnicos: string[];
  empresasUnicas: string[];
  cuentasUnicas: string[];
  onSelectOrden: (o: OrdenCompra) => void;
  onApproveClick: (id: string, e: React.MouseEvent) => void;
  onRejectClick: (id: string, e: React.MouseEvent) => void;
  onDeleteClick: (id: string, e: React.MouseEvent) => void;
}

export default function OrdenesTabla({
  ordenesFiltradas,
  selectedIds,
  toggleAllSelection,
  toggleSelection,
  colFiltros,
  setColFiltros,
  proveedoresUnicos,
  requisitoresUnicos,
  empresasUnicas,
  cuentasUnicas,
  onSelectOrden,
  onApproveClick,
  onRejectClick,
  onDeleteClick,
}: OrdenesTablaProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg shadow-gray-200/40 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-500">
          <thead className="text-xs text-gray-700 uppercase tracking-wider bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={ordenesFiltradas.length > 0 && selectedIds.size === ordenesFiltradas.length}
                  onChange={toggleAllSelection}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </th>
              <th className="px-3 py-3 font-semibold align-top">
                <div>Proveedor</div>
                <select 
                  value={colFiltros.proveedor} 
                  onChange={e => setColFiltros({...colFiltros, proveedor: e.target.value})}
                  className="mt-2 block w-full max-w-[140px] text-xs font-normal border border-gray-200 shadow-sm rounded-md p-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 hover:border-gray-300 transition-all duration-200"
                >
                  <option value="">Todos</option>
                  {proveedoresUnicos.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </th>
              <th className="px-3 py-3 font-semibold align-top">
                <div>Requisitor</div>
                <select 
                  value={colFiltros.requisitor} 
                  onChange={e => setColFiltros({...colFiltros, requisitor: e.target.value})}
                  className="mt-2 block w-full max-w-[100px] text-xs font-normal border border-gray-200 shadow-sm rounded-md p-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 hover:border-gray-300 transition-all duration-200"
                >
                  <option value="">Todos</option>
                  {requisitoresUnicos.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </th>
              <th className="px-3 py-3 font-semibold align-top">No. factura</th>
              <th className="px-3 py-3 font-semibold align-top">
                <div>Empresa</div>
                <select 
                  value={colFiltros.empresa} 
                  onChange={e => setColFiltros({...colFiltros, empresa: e.target.value})}
                  className="mt-2 block w-full max-w-[100px] text-xs font-normal border border-gray-200 shadow-sm rounded-md p-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 hover:border-gray-300 transition-all duration-200"
                >
                  <option value="">Todos</option>
                  {empresasUnicas.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </th>
              <th className="px-3 py-3 font-semibold align-top">
                <div>Cuenta cargo</div>
                <select 
                  value={colFiltros.cuentaCargo} 
                  onChange={e => setColFiltros({...colFiltros, cuentaCargo: e.target.value})}
                  className="mt-2 block w-full max-w-[140px] text-xs font-normal border border-gray-200 shadow-sm rounded-md p-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 hover:border-gray-300 transition-all duration-200"
                >
                  <option value="">Todos</option>
                  {cuentasUnicas.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </th>
              <th className="px-3 py-3 font-semibold text-right align-top">Total</th>
              <th className="px-3 py-3 font-semibold align-top">Fecha</th>
              <th className="px-3 py-3 font-semibold align-top">Estado</th>
              <th className="px-3 py-3 font-semibold text-center align-top">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {ordenesFiltradas.map((orden) => {
              const fechas = formatFechaOrden(orden)
              return (
              <tr 
                key={orden.id} 
                onClick={() => onSelectOrden(orden)}
                className="hover:bg-blue-50/50 cursor-pointer transition-all duration-200 hover:shadow-[0_0_0_1px_rgba(59,130,246,0.1)_inset]"
              >
                <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(orden.id)}
                    onChange={(e) => toggleSelection(orden.id, e as unknown as React.MouseEvent)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </td>
                <td className="px-3 py-3 font-medium text-gray-900 truncate max-w-[140px]" title={orden.proveedor}>
                  <span className="inline-flex items-center gap-1.5 w-full">
                    <span className="truncate">{orden.proveedor}</span>
                    {ordenTieneSatPendiente(orden) && (
                      <span title="Falta clave SAT en algún ítem" aria-label="SAT pendiente">
                        <Tags className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-3 whitespace-nowrap truncate max-w-[100px]" title={orden.requisitor || ''}>
                  {displayOGuion(orden.requisitor)}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-gray-900 truncate max-w-[120px]" title={orden.numeroFactura || ''}>
                  {displayOGuion(orden.numeroFactura)}
                </td>
                <td className="px-3 py-3 whitespace-nowrap truncate max-w-[100px]" title={orden.empresa || ''}>
                  {displayOGuion(orden.empresa)}
                </td>
                <td className="px-3 py-3 whitespace-nowrap truncate max-w-[140px]" title={cuentaCargoEfectiva(orden) || ''}>
                  {displayOGuion(cuentaCargoEfectiva(orden))}
                </td>
                <td className="px-3 py-3 font-semibold text-gray-900 text-right whitespace-nowrap">
                  {formatPrecio(orden.total, orden.moneda)}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="text-gray-900">{fechas.principal}</div>
                  {fechas.secundaria && (
                    <div className="text-xs text-gray-400 mt-0.5">{fechas.secundaria}</div>
                  )}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <OrdenBadgeEstado estado={orden.estado} />
                </td>
                <td className="px-3 py-3 text-center whitespace-nowrap">
                  <div className="flex items-center justify-center gap-1">
                    {orden.estado === 'pendiente' && (
                      <>
                        <button
                          onClick={(e) => onApproveClick(orden.id, e)}
                          className="p-1.5 text-gray-400 hover:text-green-600 rounded-md hover:bg-green-100 hover:scale-105 active:scale-95 transition-all duration-200"
                          title="Aprobar"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => onRejectClick(orden.id, e)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-100 hover:scale-105 active:scale-95 transition-all duration-200"
                          title="Rechazar"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectOrden(orden)
                      }}
                      className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50 hover:scale-105 active:scale-95 transition-all duration-200"
                      title="Ver detalles"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => onDeleteClick(orden.id, e)}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded-md hover:bg-red-50 hover:scale-105 active:scale-95 transition-all duration-200"
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
  )
}
