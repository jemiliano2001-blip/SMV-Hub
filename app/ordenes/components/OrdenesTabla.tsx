/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · tone: utilitario · scope: ordenes-tabla */
import type { Dispatch, SetStateAction } from 'react'
import { CheckCircle2, Eye, Tags, Trash2, XCircle } from 'lucide-react'
import type { OrdenCompra } from '@/lib/schemas'
import { formatPrecio } from '@/lib/format'
import {
  formatFechaOrden,
  cuentaCargoEfectiva,
  ordenTieneSatPendiente,
  displayOGuion,
  generarMensajeWhatsApp,
  copiarOrdenAlPortapapeles,
  LINK_GRUPO_WHATSAPP,
} from '@/lib/ordenes-display'
import OrdenBadgeEstado from './OrdenBadgeEstado'
import WhatsAppIcon from '@/components/WhatsAppIcon'

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
  onPrepararFiltros: () => void;
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
  onPrepararFiltros,
}: OrdenesTablaProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden font-sans">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left text-slate-600 whitespace-nowrap">
          <thead className="text-[11px] font-mono text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-3 py-2.5 w-8 text-center">
                <input
                  type="checkbox"
                  checked={ordenesFiltradas.length > 0 && selectedIds.size === ordenesFiltradas.length}
                  onChange={toggleAllSelection}
                  className="rounded border-slate-300 text-[#0369A1] focus:ring-[#0369A1] cursor-pointer"
                />
              </th>
              <th className="px-3 py-2.5 font-bold align-top">
                <div>Proveedor</div>
                <select 
                  value={colFiltros.proveedor} 
                  onChange={e => setColFiltros({...colFiltros, proveedor: e.target.value})}
                  onFocus={onPrepararFiltros}
                  className="mt-1.5 block w-full max-w-[130px] text-[11px] font-normal border border-slate-300 rounded p-1 bg-white text-slate-900 focus:outline-none focus:border-[#0369A1]"
                >
                  <option value="">Todos</option>
                  {proveedoresUnicos.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </th>
              <th className="px-3 py-2.5 font-bold align-top">
                <div>Requisitor</div>
                <select 
                  value={colFiltros.requisitor} 
                  onChange={e => setColFiltros({...colFiltros, requisitor: e.target.value})}
                  onFocus={onPrepararFiltros}
                  className="mt-1.5 block w-full max-w-[100px] text-[11px] font-normal border border-slate-300 rounded p-1 bg-white text-slate-900 focus:outline-none focus:border-[#0369A1]"
                >
                  <option value="">Todos</option>
                  {requisitoresUnicos.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </th>
              <th className="px-3 py-2.5 font-bold align-top">No. Factura</th>
              <th className="px-3 py-2.5 font-bold align-top">
                <div>Empresa</div>
                <select 
                  value={colFiltros.empresa} 
                  onChange={e => setColFiltros({...colFiltros, empresa: e.target.value})}
                  onFocus={onPrepararFiltros}
                  className="mt-1.5 block w-full max-w-[100px] text-[11px] font-normal border border-slate-300 rounded p-1 bg-white text-slate-900 focus:outline-none focus:border-[#0369A1]"
                >
                  <option value="">Todos</option>
                  {empresasUnicas.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </th>
              <th className="px-3 py-2.5 font-bold align-top">
                <div>Cuenta cargo</div>
                <select 
                  value={colFiltros.cuentaCargo} 
                  onChange={e => setColFiltros({...colFiltros, cuentaCargo: e.target.value})}
                  onFocus={onPrepararFiltros}
                  className="mt-1.5 block w-full max-w-[130px] text-[11px] font-normal border border-slate-300 rounded p-1 bg-white text-slate-900 focus:outline-none focus:border-[#0369A1]"
                >
                  <option value="">Todos</option>
                  {cuentasUnicas.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </th>
              <th className="px-3 py-2.5 font-bold text-right align-top">Total</th>
              <th className="px-3 py-2.5 font-bold align-top">Fecha</th>
              <th className="px-3 py-2.5 font-bold align-top">Estado</th>
              <th className="px-3 py-2.5 font-bold text-center align-top">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ordenesFiltradas.map((orden) => {
              const fechas = formatFechaOrden(orden)
              return (
              <tr 
                key={orden.id} 
                onClick={() => onSelectOrden(orden)}
                className="hover:bg-sky-50/40 cursor-pointer transition-colors"
              >
                <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(orden.id)}
                    onChange={(e) => toggleSelection(orden.id, e as unknown as React.MouseEvent)}
                    className="rounded border-slate-300 text-[#0369A1] focus:ring-[#0369A1] cursor-pointer"
                  />
                </td>
                <td className="px-3 py-2.5 font-semibold text-slate-900 truncate max-w-[140px]" title={orden.proveedor}>
                  <span className="inline-flex items-center gap-1.5 w-full">
                    <span className="truncate">{orden.proveedor}</span>
                    {ordenTieneSatPendiente(orden) && (
                      <span title="Falta clave SAT en algún ítem" aria-label="SAT pendiente">
                        <Tags className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap truncate max-w-[100px]" title={orden.requisitor || ''}>
                  {displayOGuion(orden.requisitor)}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap font-mono text-slate-900 truncate max-w-[120px]" title={orden.numeroFactura || ''}>
                  {displayOGuion(orden.numeroFactura)}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap truncate max-w-[100px]" title={orden.empresa || ''}>
                  {displayOGuion(orden.empresa)}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap truncate max-w-[140px]" title={cuentaCargoEfectiva(orden) || ''}>
                  {displayOGuion(cuentaCargoEfectiva(orden))}
                </td>
                <td className="px-3 py-2.5 font-mono font-bold text-slate-900 text-right whitespace-nowrap tabular-nums">
                  {formatPrecio(orden.total, orden.moneda)}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap font-mono">
                  <div className="text-slate-900">{fechas.principal}</div>
                  {fechas.secundaria && (
                    <div className="text-[10px] text-slate-400">{fechas.secundaria}</div>
                  )}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap">
                  <OrdenBadgeEstado estado={orden.estado} />
                </td>
                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                  <div className="flex items-center justify-center gap-1">
                    {orden.estado === 'pendiente' && (
                      <>
                        <button
                          onClick={(e) => onApproveClick(orden.id, e)}
                          className="p-1 text-slate-400 hover:text-emerald-600 rounded hover:bg-emerald-50 transition-colors"
                          title="Aprobar"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => onRejectClick(orden.id, e)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                          title="Rechazar"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        const msg = generarMensajeWhatsApp(orden)
                        try {
                          await copiarOrdenAlPortapapeles(msg)
                        } catch {
                          // Ignorar
                        }
                        window.open(LINK_GRUPO_WHATSAPP, '_blank')
                      }}
                      className="p-1 text-[#0369A1] hover:text-emerald-600 rounded hover:bg-emerald-50 transition-colors"
                      title="Notificar por WhatsApp (copia texto al portapapeles y abre el grupo)"
                    >
                      <WhatsAppIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectOrden(orden)
                      }}
                      className="p-1 text-slate-400 hover:text-[#0369A1] hover:bg-sky-50 rounded transition-colors"
                      title="Ver detalles"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => onDeleteClick(orden.id, e)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
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
