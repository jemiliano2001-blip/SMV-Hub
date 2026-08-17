'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Search,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  DollarSign,
  Layers,
  RefreshCw,
  Clock,
} from 'lucide-react'
import type { RegistroCotizacionOdoo } from '@/lib/schemas'
import { listarCotizacionesOdoo } from '@/lib/compras-odoo-cotizaciones'

export default function HistorialOdooList() {
  const [registros, setRegistros] = useState<RegistroCotizacionOdoo[]>([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [expandidoId, setExpandidoId] = useState<string | null>(null)

  const cargarHistorial = useCallback(async () => {
    try {
      setCargando(true)
      const items = await listarCotizacionesOdoo(150)
      setRegistros(items)
    } catch (err) {
      console.error('Error al cargar historial de Odoo:', err)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    let activo = true
    async function inicializar() {
      try {
        const items = await listarCotizacionesOdoo(150)
        if (activo) {
          setRegistros(items)
          setCargando(false)
        }
      } catch (err) {
        console.error('Error al cargar historial de Odoo:', err)
        if (activo) setCargando(false)
      }
    }
    void inicializar()
    return () => {
      activo = false
    }
  }, [])

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    if (!q) return registros

    return registros.filter(
      (r) =>
        r.odooName.toLowerCase().includes(q) ||
        r.proveedor.toLowerCase().includes(q) ||
        (r.referenciaProveedor && r.referenciaProveedor.toLowerCase().includes(q)) ||
        (r.creadoPorEmail && r.creadoPorEmail.toLowerCase().includes(q))
    )
  }, [registros, busqueda])

  const stats = useMemo(() => {
    const total = filtrados.length
    const totalMxn = filtrados
      .filter((r) => r.moneda === 'MXN')
      .reduce((acc, r) => acc + (r.total || 0), 0)
    const totalUsd = filtrados
      .filter((r) => r.moneda === 'USD')
      .reduce((acc, r) => acc + (r.total || 0), 0)
    return { total, totalMxn, totalUsd }
  }, [filtrados])

  const toggleExpandir = (id: string) => {
    setExpandidoId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="space-y-4">
      {/* ── Métricas Resumen ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Cotizaciones Enviadas</span>
            <Layers className="h-4 w-4 text-blue-600" />
          </div>
          <p className="text-xl font-bold text-slate-900 mt-1 font-mono tabular-nums">{stats.total}</p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Monto Total MXN</span>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-xl font-bold text-emerald-950 mt-1 font-mono tabular-nums">
            ${stats.totalMxn.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
            <span className="text-xs font-normal text-emerald-700">MXN</span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Monto Total USD</span>
            <DollarSign className="h-4 w-4 text-sky-600" />
          </div>
          <p className="text-xl font-bold text-sky-950 mt-1 font-mono tabular-nums">
            ${stats.totalUsd.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
            <span className="text-xs font-normal text-sky-700">USD</span>
          </p>
        </div>
      </div>

      {/* ── Buscador y Control ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por folio (P00XXX), proveedor, ref..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-lg border border-slate-300 pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
          />
        </div>

        <button
          type="button"
          onClick={cargarHistorial}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${cargando ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* ── Tabla de Historial ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200/90 bg-white shadow-2xs overflow-hidden">
        {cargando ? (
          <div className="py-12 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
            Cargando historial de cotizaciones Odoo...
          </div>
        ) : filtrados.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Clock className="h-8 w-8 text-slate-300 mx-auto" />
            <p className="text-xs font-semibold text-slate-700">No se encontraron cotizaciones creadas.</p>
            <p className="text-[11px] text-slate-500">
              Las cotizaciones que envíes a Odoo desde la pestaña de captura se registrarán aquí automáticamente.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100/90 text-[11px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-8"></th>
                  <th className="py-2.5 px-3">Folio Odoo</th>
                  <th className="py-2.5 px-3">Proveedor</th>
                  <th className="py-2.5 px-3">Ref. Cotización</th>
                  <th className="py-2.5 px-3 text-center">Partidas</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                  <th className="py-2.5 px-3">Creado Por</th>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3 text-center w-28">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtrados.map((r) => {
                  const estaExpandido = expandidoId === r.id
                  return (
                    <tr key={r.id} className="group hover:bg-slate-50/70 transition-colors">
                      <td colSpan={9} className="p-0">
                        <div className="flex flex-col">
                          {/* Fila Principal */}
                          <div className="flex items-center w-full py-2.5 px-3 border-b border-slate-100 last:border-0">
                            <div className="w-8 shrink-0">
                              <button
                                type="button"
                                onClick={() => toggleExpandir(r.id)}
                                className="p-1 rounded hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 transition-colors"
                                title="Ver partidas"
                              >
                                {estaExpandido ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                            </div>

                            <div className="flex-1 grid grid-cols-8 items-center gap-2">
                              <div className="font-mono font-bold text-blue-900 flex items-center gap-1.5">
                                <span className="bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded text-[11px]">
                                  {r.odooName}
                                </span>
                              </div>

                              <div className="font-semibold text-slate-900 col-span-2 truncate">
                                {r.proveedor}
                              </div>

                              <div className="font-mono text-slate-600 text-[11px] truncate">
                                {r.referenciaProveedor || '—'}
                              </div>

                              <div className="text-center font-mono text-slate-700 font-medium">
                                <span className="bg-slate-100 px-2 py-0.5 rounded-full text-[11px]">
                                  {r.itemsCount} partidas
                                </span>
                              </div>

                              <div className="text-right font-mono font-bold text-slate-900 tabular-nums">
                                ${r.total.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                                <span className="text-[10px] text-slate-500 font-normal">{r.moneda}</span>
                              </div>

                              <div className="text-[11px] text-slate-500 truncate">
                                {r.creadoPorEmail?.split('@')[0] || '—'}
                              </div>

                              <div className="text-center">
                                <a
                                  href={`https://system.maquinadosvazquez.com/web#id=${r.odooId}&model=purchase.order&view_type=form`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded bg-slate-100 border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-colors"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Odoo ERP
                                </a>
                              </div>
                            </div>
                          </div>

                          {/* Partidas Desplegadas */}
                          {estaExpandido && (
                            <div className="bg-slate-50/80 p-3.5 border-b border-slate-200 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                  <FileSpreadsheet className="h-3.5 w-3.5 text-slate-500" />
                                  Desglose de Partidas ({r.partidas.length})
                                </span>
                              </div>

                              <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead className="bg-slate-100/80 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                                    <tr>
                                      <th className="py-1.5 px-2.5 w-8 text-center">#</th>
                                      <th className="py-1.5 px-2.5 w-24">Clave</th>
                                      <th className="py-1.5 px-2.5">Descripción</th>
                                      <th className="py-1.5 px-2.5 w-24">Requisitor</th>
                                      <th className="py-1.5 px-2.5 w-20">Empresa</th>
                                      <th className="py-1.5 px-2.5 w-20">Uso</th>
                                      <th className="py-1.5 px-2.5 w-16 text-right">Cant.</th>
                                      <th className="py-1.5 px-2.5 w-20 text-right">P. Unit.</th>
                                      <th className="py-1.5 px-2.5 w-24 text-right">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-[11px]">
                                    {r.partidas.map((p, idx) => (
                                      <tr key={p.id || idx} className="hover:bg-slate-50/50">
                                        <td className="py-1.5 px-2.5 text-center text-slate-400 font-mono">
                                          {p.partida || idx + 1}
                                        </td>
                                        <td className="py-1.5 px-2.5 font-mono text-slate-600">
                                          {p.clave || '—'}
                                        </td>
                                        <td className="py-1.5 px-2.5 font-medium text-slate-900">
                                          {p.descripcion}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-slate-600">{p.requisitor || '—'}</td>
                                        <td className="py-1.5 px-2.5 text-slate-600">{p.empresa || '—'}</td>
                                        <td className="py-1.5 px-2.5 text-slate-600">{p.uso || '—'}</td>
                                        <td className="py-1.5 px-2.5 text-right font-mono font-semibold text-slate-800 tabular-nums">
                                          {p.cantidad} {p.udm}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-right font-mono text-slate-700 tabular-nums">
                                          ${p.precioUnitario.toFixed(2)}
                                        </td>
                                        <td className="py-1.5 px-2.5 text-right font-mono font-bold text-slate-900 tabular-nums">
                                          ${p.subtotal.toFixed(2)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
