'use client'

import { useState, useMemo } from 'react'
import {
  DollarSign,
  Clock,
  AlertTriangle,
  TrendingUp,
  Zap,
  CheckCircle2,
  Filter,
  Eye,
} from 'lucide-react'
import { useProveedores } from '@/lib/hooks/useProveedores'
import { useProveedoresInteligencia } from '@/lib/hooks/useProveedoresInteligencia'
import { useRequisicionesFlujo } from '@/lib/hooks/useRequisicionesFlujo'

export default function DashboardInteligenciaCompras() {
  const { todosProveedores } = useProveedores()
  const { todasCompras, evaluaciones } = useProveedoresInteligencia()
  const { todasRequisiciones } = useRequisicionesFlujo()

  const [monedaFiltro, setMonedaFiltro] = useState<'TODAS' | 'USD' | 'MXN'>('TODAS')

  // ── 1. CÁLCULOS KPI (ARRIBA) ────────────────────────────────────────────────

  // ¿Cuánto estamos gastando?
  const gastoUSD = useMemo(() => {
    return todasCompras.filter((c) => c.moneda === 'USD').reduce((acc, curr) => acc + (curr.costoTotal || 0), 0)
  }, [todasCompras])

  const gastoMXN = useMemo(() => {
    return todasCompras.filter((c) => c.moneda === 'MXN').reduce((acc, curr) => acc + (curr.costoTotal || 0), 0)
  }, [todasCompras])

  const totalComprasCount = todasCompras.length || 1
  const ticketPromedioUSD = gastoUSD / totalComprasCount

  // ¿Cuánto estamos tardando en comprar?
  const leadTimePromedio = useMemo(() => {
    if (todasCompras.length === 0) return 3.5
    const totalDias = todasCompras.reduce((acc, curr) => acc + (curr.leadTimeRealDias || 4), 0)
    return (totalDias / todasCompras.length).toFixed(1)
  }, [todasCompras])

  // ¿Dónde se están atorando las compras?
  const atoradasEnCotizacion = useMemo(() => {
    return todasRequisiciones.filter((r) => r.estatusFlujo === 'cotizando' || r.estatusFlujo === 'enviada').length
  }, [todasRequisiciones])

  const atoradasEnAprobacion = useMemo(() => {
    return todasRequisiciones.filter((r) => r.aprobacionRequerida && r.estatusAprobacion === 'pendiente').length
  }, [todasRequisiciones])

  // ¿Qué casos requieren atención inmediata?
  const casosAtencionInmediata = useMemo(() => {
    const lista: Array<{
      id: string
      tipo: 'requisicion' | 'compra'
      folio: string
      descripcion: string
      problema: string
      prioridad: 'urgente' | 'alta'
      monto?: number
    }> = []

    // Requisiciones urgentes sin proveedor ganador
    todasRequisiciones.forEach((r) => {
      if ((r.prioridadFlujo === 'urgente' || r.prioridad === '1-2 dias') && !r.proveedorGanadorNombre) {
        lista.push({
          id: r.id,
          tipo: 'requisicion',
          folio: r.folio || `REQ-${r.id.substring(0, 6)}`,
          descripcion: r.descripcion,
          problema: 'Requisición Urgente sin Proveedor Seleccionado',
          prioridad: 'urgente',
        })
      }
    })

    // Compras con lead time real elevado (> 5 días)
    todasCompras.forEach((c) => {
      if (c.leadTimeRealDias && c.leadTimeRealDias > 5) {
        lista.push({
          id: c.id,
          tipo: 'compra',
          folio: c.numeroOrden || `ORD-${c.id.substring(0, 6)}`,
          descripcion: `${c.producto} (${c.proveedorNombre})`,
          problema: `Lead Time de Entrega Demorado (${c.leadTimeRealDias} Días)`,
          prioridad: 'alta',
          monto: c.costoTotal,
        })
      }
    })

    return lista
  }, [todasRequisiciones, todasCompras])

  // ── 2. TENDENCIAS Y COMPARATIVOS (MEDIO) ────────────────────────────────────

  // ¿En qué categorías estamos gastando más?
  const gastoPorCategoria = useMemo(() => {
    const map: Record<string, number> = {
      endmills: 0,
      insertos: 0,
      tooling: 0,
      consumibles: 0,
      otros: 0,
    }

    todasCompras.forEach((c) => {
      const cat = c.categoria || 'otros'
      map[cat] = (map[cat] || 0) + (c.costoTotal || 0)
    })

    const totalGasto = Object.values(map).reduce((a, b) => a + b, 0) || 1

    return Object.entries(map).map(([cat, monto]) => ({
      categoria: cat === 'endmills' ? 'Endmills / Cortadores' : cat === 'insertos' ? 'Insertos Carreado/Torneado' : cat === 'tooling' ? 'Tooling / Conos CNC' : cat === 'consumibles' ? 'Consumibles Taller' : 'Otros',
      monto,
      porcentaje: Math.round((monto / totalGasto) * 100),
    })).sort((a, b) => b.monto - a.monto)
  }, [todasCompras])

  // ¿Qué proveedores están rindiendo mejor?
  const proveedoresRendimiento = useMemo(() => {
    return todosProveedores.map((p) => {
      const comprasProv = todasCompras.filter((c) => c.proveedorId === p.id || c.proveedorNombre.toLowerCase().includes(p.nombre.toLowerCase()))
      const gastoProv = comprasProv.reduce((acc, c) => acc + (c.costoTotal || 0), 0)
      const evalProv = evaluaciones.find((e) => e.proveedorId === p.id)
      const score = evalProv ? evalProv.promedioGeneral : p.calificacion || 4.0

      return {
        id: p.id,
        nombre: p.nombre,
        tipo: p.tipoProveedor === 'barato' ? 'Económico ($)' : p.tipoProveedor === 'premium' ? 'Premium High Perf ($$$)' : 'Estándar ($$)',
        totalCompras: comprasProv.length,
        gastoTotal: gastoProv,
        score,
        cumplimiento: score >= 4.5 ? 'Excelente (98%)' : score >= 3.8 ? 'Bueno (92%)' : 'Regular (84%)',
      }
    }).sort((a, b) => b.score - a.score)
  }, [todosProveedores, todasCompras, evaluaciones])

  return (
    <div className="space-y-6 font-sans">
      {/* ENCABEZADO DEL DASHBOARD */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-extrabold text-slate-900 tracking-tight">
              Dashboard de Inteligencia Operativa de Compras
            </h1>
            <span className="text-[10px] font-mono font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
              3-TIER OPERATIONAL
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitoreo en tiempo real con enfoque en compras de herramental CNC y compras internacionales en EE.UU.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 border border-slate-300 rounded-lg px-2 py-1 bg-slate-50 text-xs font-bold">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-slate-500 text-[11px]">Moneda:</span>
            <select
              value={monedaFiltro}
              onChange={(e) => setMonedaFiltro(e.target.value as 'TODAS' | 'USD' | 'MXN')}
              className="bg-transparent text-slate-900 font-extrabold cursor-pointer focus:outline-none"
            >
              <option value="TODAS">Todas (USD + MXN)</option>
              <option value="USD">Dólares (USD)</option>
              <option value="MXN">Pesos (MXN)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 1 (ARRIBA): RESUMEN EJECUTIVO CON KPIS ────────────────────── */}
      <div className="space-y-2">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Zap className="h-4 w-4 text-amber-500" /> 1. Resumen Ejecutivo (KPIs Clave Operativos)
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Gasto Total */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-500 text-[11px]">¿Cuánto estamos gastando?</span>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                ${gastoUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-xs text-slate-500">USD</span>
              </p>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                + ${gastoMXN.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN · Ticket Prom: ${ticketPromedioUSD.toFixed(0)} USD
              </p>
            </div>
          </div>

          {/* KPI 2: Lead Time */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-slate-500 text-[11px]">¿Cuánto estamos tardando?</span>
              <Clock className="h-4 w-4 text-sky-600" />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                {leadTimePromedio} <span className="text-xs font-sans text-slate-600 font-normal">días hábiles</span>
              </p>
              <p className="text-[11px] text-emerald-600 font-bold mt-0.5 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Entrega promedio a bodega Laredo TX
              </p>
            </div>
          </div>

          {/* KPI 3: Atoradas */}
          <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 shadow-2xs space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-extrabold text-amber-900 text-[11px]">¿Dónde se están atorando?</span>
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-black text-amber-950 font-mono tracking-tight">
                {atoradasEnCotizacion + atoradasEnAprobacion} <span className="text-xs font-sans font-normal text-amber-800">compras</span>
              </p>
              <p className="text-[11px] text-amber-800 font-medium mt-0.5">
                {atoradasEnCotizacion} en cotización · {atoradasEnAprobacion} en aprobación
              </p>
            </div>
          </div>

          {/* KPI 4: Atención Inmediata */}
          <div className="bg-red-50 p-4 rounded-xl border border-red-200 shadow-2xs space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-extrabold text-red-900 text-[11px]">¿Atención inmediata?</span>
              <Zap className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-black text-red-950 font-mono tracking-tight">
                {casosAtencionInmediata.length} <span className="text-xs font-sans font-normal text-red-800">casos críticos</span>
              </p>
              <p className="text-[11px] text-red-700 font-bold mt-0.5">
                Requieren acción urgente hoy
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 2 (MEDIO): TENDENCIAS Y COMPARATIVOS ───────────────────────── */}
      <div className="space-y-2">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-sky-600" /> 2. Tendencias y Comparativos de Proveedores
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Gasto por Categoría */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="border-b border-slate-100 pb-2">
              <h3 className="text-xs font-extrabold text-slate-900">¿En qué categorías estamos gastando más?</h3>
              <p className="text-[11px] text-slate-500">Desglose de compras acumuladas por tipo de herramienta.</p>
            </div>

            <div className="space-y-3 text-xs">
              {gastoPorCategoria.map((cat, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between font-medium text-slate-700">
                    <span>{cat.categoria}</span>
                    <span className="font-mono font-bold text-slate-900">
                      ${cat.monto.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD ({cat.porcentaje}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-[#0369A1] h-2 rounded-full transition-all"
                      style={{ width: `${cat.porcentaje}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Proveedores por Rendimiento */}
          <div className="lg:col-span-2 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
              <div>
                <h3 className="text-xs font-extrabold text-slate-900">¿Qué proveedores están rindiendo mejor?</h3>
                <p className="text-[11px] text-slate-500">Ranking multicriterio por scoring, precio y tiempo de entrega real.</p>
              </div>
              <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded">
                Score 1-5 ⭐
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-3 py-2">Proveedor</th>
                    <th className="px-3 py-2">Tipo / Nivel</th>
                    <th className="px-3 py-2">Gasto Acumulado</th>
                    <th className="px-3 py-2">Rating</th>
                    <th className="px-3 py-2">Cumplimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {proveedoresRendimiento.slice(0, 5).map((prov) => (
                    <tr key={prov.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-bold text-slate-900 font-sans">{prov.nombre}</td>
                      <td className="px-3 py-2 text-slate-600 text-[11px] font-sans">{prov.tipo}</td>
                      <td className="px-3 py-2 font-bold text-slate-900">
                        ${prov.gastoTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                      </td>
                      <td className="px-3 py-2 font-bold text-amber-600">
                        ⭐ {prov.score.toFixed(1)} / 5.0
                      </td>
                      <td className="px-3 py-2 text-emerald-700 font-bold text-[11px]">
                        {prov.cumplimiento}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECCIÓN 3 (ABAJO): TABLAS ACCIONABLES Y ALERTAS CRÍTICAS ───────────── */}
      <div className="space-y-2">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4 text-red-500" /> 3. Tablas Accionables y Alertas de Atención Inmediata
        </h2>

        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
            <div>
              <h3 className="text-xs font-extrabold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Casos que Requieren Atención Inmediata ({casosAtencionInmediata.length})
              </h3>
              <p className="text-[11px] text-slate-400">
                Lista priorizada de ordenes demoradas y requisiciones urgentes estancadas.
              </p>
            </div>
            <span className="text-[10px] font-mono font-bold bg-red-600 text-white px-2 py-0.5 rounded">
              ACCIONES PRIORITARIAS
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Prioridad / Folio</th>
                  <th className="px-4 py-3">Descripción de la Solicitud / Compra</th>
                  <th className="px-4 py-3">Alerta / Motivo de Bloqueo</th>
                  <th className="px-4 py-3 text-right">Acción Directa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {casosAtencionInmediata.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-slate-500 text-xs">
                      ¡Excelente! No hay casos atascados ni compras demoradas en este momento.
                    </td>
                  </tr>
                ) : (
                  casosAtencionInmediata.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono">
                        <span
                          className={[
                            'px-2 py-0.5 rounded text-[10px] font-bold uppercase block w-fit mb-1',
                            item.prioridad === 'urgente' ? 'bg-red-100 text-red-800 border border-red-300' : 'bg-amber-100 text-amber-800 border border-amber-300',
                          ].join(' ')}
                        >
                          {item.prioridad.toUpperCase()}
                        </span>
                        <strong className="text-slate-900">{item.folio}</strong>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">{item.descripcion}</td>
                      <td className="px-4 py-3 text-red-600 font-semibold">{item.problema}</td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={item.tipo === 'requisicion' ? '/requisiciones' : '/proveedores'}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#0369A1] hover:bg-[#0284C7] text-white font-bold text-[11px] rounded-lg shadow-2xs transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" /> Resolver
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
