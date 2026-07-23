'use client'

import { useState, useMemo } from 'react'
import { Search, Upload, Database, DollarSign, Globe2, FileSpreadsheet } from 'lucide-react'
import CotizacionesList from './CotizacionesList'
import ImportarCotizaciones from './ImportarCotizaciones'
import SyncSheetSection from './SyncSheetSection'
import { useCotizaciones } from '@/lib/hooks/useCotizaciones'

type Modo = 'consultar' | 'importar'

export default function CotizacionesTabs() {
  const [modo, setModo] = useState<Modo>('consultar')
  const { cotizaciones, fetchCotizaciones } = useCotizaciones()

  const stats = useMemo(() => {
    const total = cotizaciones.length
    const usa = cotizaciones.filter((c) => c.ubicacion === 'USA').length
    const mx = cotizaciones.filter((c) => c.ubicacion === 'MX').length
    const cotizados = cotizaciones.filter((c) => c.estatus === 'cotizado').length
    return { total, usa, mx, cotizados }
  }, [cotizaciones])

  const tab = (valor: Modo, label: string, Icon: typeof Search) => (
    <button
      type="button"
      onClick={() => setModo(valor)}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
        modo === valor
          ? 'bg-blue-600 text-white shadow-xs'
          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  )

  return (
    <div className="space-y-6">
      {/* ── Metric Summary Bar ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Total Cotizaciones</span>
            <Database className="h-4 w-4 text-sky-600" />
          </div>
          <p className="text-xl font-bold text-slate-900 mt-1 font-mono">{stats.total}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Cotizadas (USA)</span>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-xl font-bold text-slate-900 mt-1 font-mono">{stats.usa}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Cotizadas (MX)</span>
            <Globe2 className="h-4 w-4 text-indigo-600" />
          </div>
          <p className="text-xl font-bold text-slate-900 mt-1 font-mono">{stats.mx}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Estatus &apos;Cotizado&apos;</span>
            <FileSpreadsheet className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-xl font-bold text-slate-900 mt-1 font-mono">{stats.cotizados}</p>
        </div>
      </div>

      {/* ── Auto-Sync Control Panel ───────────────────────────────────────── */}
      <SyncSheetSection onSyncCompletada={fetchCotizaciones} />

      {/* ── Navigation Tabs & Main Body ───────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex gap-3 border-b border-slate-200 pb-3">
          {tab('consultar', 'Consultar Catálogo', Search)}
          {tab('importar', 'Carga Manual desde CSV', Upload)}
        </div>

        {modo === 'consultar' ? <CotizacionesList /> : <ImportarCotizaciones />}
      </div>
    </div>
  )
}
