/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · tone: utilitario · scope: banos */
'use client'

import { useState } from 'react'
import AuthGuard from '../AuthGuard'
import RegistroBanoList from './RegistroBanoList'
import CuentaDiaria from './CuentaDiaria'
import ResumenMensual from './ResumenMensual'
import { Clock, CalendarDays, Calculator } from 'lucide-react'

export default function BanosPage() {
  const [tab, setTab] = useState<'registro' | 'diaria' | 'mensual'>('registro')

  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 tracking-tight">Control de Baños</h1>
                <span className="text-[10px] font-mono font-bold bg-[#0369A1]/10 text-[#0369A1] border border-[#0369A1]/20 px-1.5 py-0.5 rounded">
                  Incidencias Taller
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Registro utilitario de tiempos y resúmenes diarios/mensuales de uso.
              </p>
            </div>

            {/* Utilitarian Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 w-fit">
              <button
                onClick={() => setTab('registro')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                  tab === 'registro'
                    ? 'bg-white text-[#0369A1] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="h-3.5 w-3.5" />
                Registro
              </button>
              <button
                onClick={() => setTab('diaria')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                  tab === 'diaria'
                    ? 'bg-white text-[#0369A1] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Cuenta Diaria
              </button>
              <button
                onClick={() => setTab('mensual')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                  tab === 'mensual'
                    ? 'bg-white text-[#0369A1] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calculator className="h-3.5 w-3.5" />
                Resumen
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 sm:p-5">
            {tab === 'registro' && <RegistroBanoList />}
            {tab === 'diaria' && <CuentaDiaria />}
            {tab === 'mensual' && <ResumenMensual />}
          </div>
        </div>
      </main>
    </AuthGuard>
  )
}
