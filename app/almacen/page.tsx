/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · tone: utilitario · scope: almacen */
'use client'

import { useState } from 'react'
import AuthGuard from '../AuthGuard'
import EntradasList from './EntradasList'
import SalidasList from './SalidasList'
import { PackagePlus, PackageMinus } from 'lucide-react'

export default function AlmacenPage() {
  const [tab, setTab] = useState<'entradas' | 'salidas'>('entradas')

  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 tracking-tight">Control de Almacén</h1>
                <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                  Inventarios
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Registro utilitario de materiales recibidos y entregas de herramientas al taller.
              </p>
            </div>

            {/* Utilitarian Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 w-fit">
              <button
                onClick={() => setTab('entradas')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                  tab === 'entradas'
                    ? 'bg-white text-[#0369A1] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PackagePlus className="h-3.5 w-3.5" />
                Entradas
              </button>
              <button
                onClick={() => setTab('salidas')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                  tab === 'salidas'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PackageMinus className="h-3.5 w-3.5" />
                Salidas
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 sm:p-5">
            {tab === 'entradas' ? <EntradasList /> : <SalidasList />}
          </div>
        </div>
      </main>
    </AuthGuard>
  )
}
