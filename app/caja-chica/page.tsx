'use client'

import { useState } from 'react'
import AuthGuard from '../AuthGuard'
import MovimientosCaja from './MovimientosCaja'
import ResumenCaja from './ResumenCaja'
import ArqueoCaja from './ArqueoCaja'
import ReportesCaja from './ReportesCaja'
import { Wallet, PieChart, Calculator, Receipt } from 'lucide-react'

export default function CajaChicaPage() {
  const [tab, setTab] = useState<'movimientos' | 'resumen' | 'arqueo' | 'reportes'>('movimientos')

  return (
    <AuthGuard>
      <main className="min-h-screen bg-gray-50 flex flex-col print:bg-white">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 print:hidden">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Caja Chica</h1>
              <p className="text-sm text-gray-500 mt-1">
                Control de efectivo, comprobantes y gastos menores
              </p>
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-200/50 p-1 rounded-lg w-fit flex-wrap">
              <button
                onClick={() => setTab('movimientos')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  tab === 'movimientos'
                    ? 'bg-white text-[#0369A1] shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                }`}
              >
                <Wallet className="h-4 w-4" />
                Movimientos
              </button>
              <button
                onClick={() => setTab('resumen')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  tab === 'resumen'
                    ? 'bg-white text-[#0369A1] shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                }`}
              >
                <PieChart className="h-4 w-4" />
                Resumen
              </button>
              <button
                onClick={() => setTab('arqueo')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  tab === 'arqueo'
                    ? 'bg-white text-[#0369A1] shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                }`}
              >
                <Calculator className="h-4 w-4" />
                Arqueo de Caja
              </button>
              <button
                onClick={() => setTab('reportes')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  tab === 'reportes'
                    ? 'bg-white text-[#0369A1] shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                }`}
              >
                <Receipt className="h-4 w-4" />
                Reportes
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 print:border-0 print:shadow-none print:p-0">
            {tab === 'movimientos' && <MovimientosCaja />}
            {tab === 'resumen' && <ResumenCaja />}
            {tab === 'arqueo' && <ArqueoCaja />}
            {tab === 'reportes' && <ReportesCaja />}
          </div>
        </div>
      </main>
    </AuthGuard>
  )
}
