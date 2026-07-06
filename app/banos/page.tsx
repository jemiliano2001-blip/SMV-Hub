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
      <main className="min-h-screen bg-gray-50 flex flex-col">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Control de Baños</h1>
              <p className="text-sm text-gray-500 mt-1">
                Registro de tiempos y cálculos de cuenta diaria y resumen mensual
              </p>
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-200/50 p-1 rounded-lg w-fit">
              <button
                onClick={() => setTab('registro')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  tab === 'registro'
                    ? 'bg-white text-[#0369A1] shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                }`}
              >
                <Clock className="h-4 w-4" />
                Registro
              </button>
              <button
                onClick={() => setTab('diaria')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  tab === 'diaria'
                    ? 'bg-white text-[#0369A1] shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                }`}
              >
                <CalendarDays className="h-4 w-4" />
                Cuenta Diaria
              </button>
              <button
                onClick={() => setTab('mensual')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  tab === 'mensual'
                    ? 'bg-white text-[#0369A1] shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                }`}
              >
                <Calculator className="h-4 w-4" />
                Resumen
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            {tab === 'registro' && <RegistroBanoList />}
            {tab === 'diaria' && <CuentaDiaria />}
            {tab === 'mensual' && <ResumenMensual />}
          </div>
        </div>
      </main>
    </AuthGuard>
  )
}
