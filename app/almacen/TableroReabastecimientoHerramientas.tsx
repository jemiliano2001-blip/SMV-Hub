/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · tone: utilitario-premium · scope: almacen-reabastecimiento */
'use client'

import { useState, useMemo } from 'react'
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShoppingCart,
  Search,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import {
  DEMO_ITEMS_RECOMPRA,
  convertirSugerenciaEnRequisicion,
  type ItemRecompra,
} from '@/lib/recompra-herramientas'

export default function TableroReabastecimientoHerramientas() {
  const [items, setItems] = useState<ItemRecompra[]>(DEMO_ITEMS_RECOMPRA)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODAS')
  const [filtroEstatus, setFiltroEstatus] = useState<string>('TODOS')
  const [procesandoItem, setProcesandoItem] = useState<string | null>(null)
  const [exitoItem, setExitoItem] = useState<{ id: string; reqId: string } | null>(null)

  // Filtrar items
  const itemsFiltrados = useMemo(() => {
    return items.filter((item) => {
      const coincideBusqueda =
        item.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        item.marca.toLowerCase().includes(busqueda.toLowerCase()) ||
        item.especificacionTecnica.toLowerCase().includes(busqueda.toLowerCase())

      const coincideCategoria = filtroCategoria === 'TODAS' || item.categoria === filtroCategoria
      const coincideEstatus = filtroEstatus === 'TODOS' || item.estatusRecompra === filtroEstatus

      return coincideBusqueda && coincideCategoria && coincideEstatus
    })
  }, [items, busqueda, filtroCategoria, filtroEstatus])

  // KPIs del Tablero
  const countUrgentes = items.filter((i) => i.estatusRecompra === 'urgente').length
  const countSugeridas = items.filter((i) => i.estatusRecompra === 'sugerir_recompra').length
  const countMonitorear = items.filter((i) => i.estatusRecompra === 'monitorear').length

  const inversionEstimadaUSD = items
    .filter((i) => i.estatusRecompra !== 'monitorear')
    .reduce((acc, curr) => acc + curr.cantidadSugerida * curr.costoEstimadoUSD, 0)

  // 1-Click Crear Requisición con Sonner Toast Feedback
  const handleCrearRequisicion = async (item: ItemRecompra) => {
    setProcesandoItem(item.id)
    try {
      const res = await convertirSugerenciaEnRequisicion(item)
      setExitoItem({ id: item.id, reqId: res.id })
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, revisionRealizada: true } : i))
      )
      toast.success(`Requisición generada exitosamente`, {
        description: `Se creó la solicitud para ${item.nombre} (${item.cantidadSugerida} ${item.unidad}) a favor de ${item.proveedorPreferidoNombre}.`,
      })
    } catch (err) {
      console.error(err)
      toast.error('Error al generar requisición', {
        description: 'No se pudo registrar la solicitud en Firestore.',
      })
    } finally {
      setProcesandoItem(null)
    }
  }

  return (
    <div className="space-y-6 font-sans">
      {/* ENCABEZADO Y KPIS CON ESTILO HALLMARK & EXPERTO UI/UX */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-50 text-[#0369A1] rounded-xl border border-sky-200">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                Tablero Inteligente de Reabastecimiento de Tooling
                <Badge variant="outline" className="bg-sky-50 text-[#0369A1] border-sky-200 font-mono text-[10px] font-bold">
                  ROP &amp; EOQ ENGINE
                </Badge>
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Monitoreo algorítmico continuo de inventario de corte CNC con emisión de requisición en 1-Click.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* TARJETAS KPI DE REABASTECIMIENTO CON 8PX GRID & SHADOW DYNAMICS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-red-50 to-red-100/50 p-5 rounded-2xl border border-red-200 shadow-2xs space-y-2">
          <div className="flex justify-between items-center text-xs text-red-900 font-black uppercase tracking-wider">
            <span>Recompra Urgente</span>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </div>
          <p className="text-3xl font-black text-red-950 font-mono tracking-tight">{countUrgentes}</p>
          <p className="text-xs text-red-700 font-semibold flex items-center gap-1">
            <span className="inline-block size-2 rounded-full bg-red-600 animate-pulse" />
            Items por debajo del stock de seguridad
          </p>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 p-5 rounded-2xl border border-amber-200 shadow-2xs space-y-2">
          <div className="flex justify-between items-center text-xs text-amber-900 font-black uppercase tracking-wider">
            <span>Programar Recompra</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-3xl font-black text-amber-950 font-mono tracking-tight">{countSugeridas}</p>
          <p className="text-xs text-amber-800 font-semibold">Alcanzando Punto de Reorden (ROP)</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-5 rounded-2xl border border-emerald-200 shadow-2xs space-y-2">
          <div className="flex justify-between items-center text-xs text-emerald-900 font-black uppercase tracking-wider">
            <span>Stock Saludable</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-3xl font-black text-emerald-950 font-mono tracking-tight">{countMonitorear}</p>
          <p className="text-xs text-emerald-700 font-semibold">Sin riesgo de paro de maquinado</p>
        </div>

        <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-400 font-black uppercase tracking-wider">
            <span>Inversión Sugerida</span>
            <ShoppingCart className="h-4 w-4 text-amber-400" />
          </div>
          <p className="text-3xl font-black text-white font-mono tracking-tight">
            ${inversionEstimadaUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-xs font-sans text-slate-400 font-normal">USD</span>
          </p>
          <p className="text-xs text-slate-400 font-mono">Presupuesto óptimo de pedido</p>
        </div>
      </div>

      {/* CONTROLES DE FILTRO Y BÚSQUEDA */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar herramienta, código o especificación técnica..."
            className="w-full pl-10 pr-4 py-2.5 text-xs font-medium border border-slate-300 rounded-xl bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0369A1]/30 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="px-3.5 py-2.5 border border-slate-300 rounded-xl bg-slate-50/50 font-bold text-slate-800 focus:bg-white focus:outline-none transition-all cursor-pointer"
          >
            <option value="TODAS">Todas las Categorías</option>
            <option value="endmills">Endmills / Cortadores</option>
            <option value="insertos">Insertos CNC</option>
            <option value="tooling">Tooling / Conos BT40</option>
            <option value="consumibles">Consumibles Taller</option>
          </select>

          <select
            value={filtroEstatus}
            onChange={(e) => setFiltroEstatus(e.target.value)}
            className="px-3.5 py-2.5 border border-slate-300 rounded-xl bg-slate-50/50 font-bold text-slate-800 focus:bg-white focus:outline-none transition-all cursor-pointer"
          >
            <option value="TODOS">Todos los Estatus</option>
            <option value="urgente">🔴 Recompra Urgente</option>
            <option value="sugerir_recompra">🟡 Programar Recompra</option>
            <option value="monitorear">🟢 Monitorear</option>
          </select>
        </div>
      </div>

      {/* TABLA DE REABASTECIMIENTO DE HERRAMIENTAS CON COMPONENTES SHADCN PROGRESS & BADGES */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-slate-100/80 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-5 py-3.5">Estatus &amp; Urgencia</th>
                <th className="px-5 py-3.5">Herramienta / Especificación</th>
                <th className="px-5 py-3.5">Stock Actual vs ROP</th>
                <th className="px-5 py-3.5">Consumo &amp; Lead Time</th>
                <th className="px-5 py-3.5">Proveedor Sugerido</th>
                <th className="px-5 py-3.5 text-right">Pedido Sugerido</th>
                <th className="px-5 py-3.5 text-right">Acción Recompra</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60">
              {itemsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400 text-xs">
                    No se encontraron sugerencias de recompra con los criterios especificados.
                  </td>
                </tr>
              ) : (
                itemsFiltrados.map((item) => {
                  const pctStock = Math.min(100, Math.round((item.stockActual / (item.puntoRecompraROP || 1)) * 100))

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Estatus Badge */}
                      <td className="px-5 py-4 font-mono">
                        <Badge
                          variant="outline"
                          className={[
                            'font-bold text-[10px] uppercase px-2.5 py-1 shadow-2xs',
                            item.estatusRecompra === 'urgente'
                              ? 'bg-red-50 text-red-900 border-red-300'
                              : item.estatusRecompra === 'sugerir_recompra'
                              ? 'bg-amber-50 text-amber-900 border-amber-300'
                              : 'bg-emerald-50 text-emerald-900 border-emerald-300',
                          ].join(' ')}
                        >
                          {item.estatusRecompra === 'urgente'
                            ? '🔴 URGENTE'
                            : item.estatusRecompra === 'sugerir_recompra'
                            ? '🟡 RECOMPRAR'
                            : '🟢 SALUDABLE'}
                        </Badge>
                      </td>

                      {/* Herramienta */}
                      <td className="px-5 py-4 space-y-0.5">
                        <strong className="text-slate-900 block font-bold text-xs">{item.nombre}</strong>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Marca: {item.marca} · Categoría: {item.categoria.toUpperCase()}
                        </span>
                        <p className="text-[11px] text-slate-400 italic">{item.especificacionTecnica}</p>
                      </td>

                      {/* Stock vs ROP con shadcn Progress */}
                      <td className="px-5 py-4 space-y-1.5 min-w-[180px]">
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="font-bold text-slate-900">
                            {item.stockActual} {item.unidad}
                          </span>
                          <span className="text-slate-500 font-semibold">ROP: {item.puntoRecompraROP} {item.unidad}</span>
                        </div>
                        <Progress value={pctStock} className="h-2 bg-slate-100" />
                        <span className="text-[10px] text-slate-400 font-mono block text-right">
                          {pctStock}% del ROP acumulado
                        </span>
                      </td>

                      {/* Consumo / Lead Time */}
                      <td className="px-5 py-4 font-mono text-[11px]">
                        <span className="text-slate-900 font-bold block">
                          {item.consumoPromedioSemanal} {item.unidad} / semana
                        </span>
                        <span className="text-slate-500">Lead time: {item.leadTimeDias} días hábiles</span>
                      </td>

                      {/* Proveedor Sugerido */}
                      <td className="px-5 py-4">
                        <strong className="text-[#0369A1] font-bold block text-xs">{item.proveedorPreferidoNombre}</strong>
                        <span className="text-[11px] text-slate-500 font-mono">
                          P. Unitario: ${item.costoEstimadoUSD.toFixed(2)} USD
                        </span>
                      </td>

                      {/* Pedido Sugerido */}
                      <td className="px-5 py-4 text-right font-mono">
                        <strong className="text-slate-900 text-sm block font-black">
                          {item.cantidadSugerida} {item.unidad}
                        </strong>
                        <span className="text-[11px] text-slate-500 font-semibold">
                          Total: ${(item.cantidadSugerida * item.costoEstimadoUSD).toFixed(2)} USD
                        </span>
                      </td>

                      {/* Acción 1-Click con Tactile Feedback */}
                      <td className="px-5 py-4 text-right">
                        {exitoItem?.id === item.id ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-300 shadow-2xs">
                            <Check className="h-3.5 w-3.5 text-emerald-600" /> Requisición Generada
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={procesandoItem === item.id}
                            onClick={() => handleCrearRequisicion(item)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#0369A1] hover:bg-[#0284C7] active:scale-98 disabled:bg-slate-300 text-white font-bold text-[11px] rounded-xl shadow-xs transition-all cursor-pointer"
                          >
                            <ShoppingCart className="h-3.5 w-3.5" />
                            {procesandoItem === item.id ? 'Creando...' : '1-Click Requisición'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
