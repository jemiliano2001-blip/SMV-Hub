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
      <main className="min-h-screen bg-gray-50 flex flex-col">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
          <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Control de Almacén</h1>
              <p className="text-sm text-gray-500 mt-1">
                Registro de materiales recibidos y herramientas entregadas al piso
              </p>
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-200/50 p-1 rounded-lg w-fit">
              <button
                onClick={() => setTab('entradas')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  tab === 'entradas'
                    ? 'bg-white text-[#0369A1] shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                }`}
              >
                <PackagePlus className="h-4 w-4" />
                Entradas
              </button>
              <button
                onClick={() => setTab('salidas')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  tab === 'salidas'
                    ? 'bg-white text-emerald-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
                }`}
              >
                <PackageMinus className="h-4 w-4" />
                Salidas
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
            {tab === 'entradas' ? <EntradasList /> : <SalidasList />}
          </div>
        </div>
      </main>
    </AuthGuard>
  )
}
