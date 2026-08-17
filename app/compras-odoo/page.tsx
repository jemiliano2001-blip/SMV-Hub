'use client'

import { useState } from 'react'
import AuthGuard from '../AuthGuard'
import CapturaOdooForm from './CapturaOdooForm'
import HistorialOdooList from './HistorialOdooList'
import { PlusCircle, History } from 'lucide-react'

type TabModo = 'captura' | 'historial'

export default function ComprasOdooPage() {
  const [tab, setTab] = useState<TabModo>('captura')

  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 space-y-5">
          {/* ── Encabezado Principal Utilitario ─────────────────────────────── */}
          <div className="bg-white border border-slate-200/90 p-5 rounded-xl shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-base font-bold text-slate-900 tracking-tight">
                    Compras Odoo (Cotizaciones Rápidas)
                  </h1>
                  <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200/80 px-2 py-0.5 rounded-full">
                    Odoo ERP · RFQ
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Pega filas desde Excel / Google Sheets o escanea cotizaciones con IA para generar solicitudes de cotización en Odoo ERP al instante.
                </p>
              </div>

              {/* Selector de Pestañas */}
              <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 border border-slate-200 self-start sm:self-auto" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'captura'}
                  onClick={() => setTab('captura')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    tab === 'captura'
                      ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <PlusCircle className="h-3.5 w-3.5 text-blue-600" />
                  Nueva Cotización
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'historial'}
                  onClick={() => setTab('historial')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    tab === 'historial'
                      ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <History className="h-3.5 w-3.5 text-slate-600" />
                  Historial Odoo
                </button>
              </div>
            </div>
          </div>

          {/* ── Contenido Activo ────────────────────────────────────────────── */}
          {tab === 'captura' ? (
            <CapturaOdooForm onCotizacionCreada={() => setTab('historial')} />
          ) : (
            <HistorialOdooList />
          )}
        </div>
      </main>
    </AuthGuard>
  )
}
