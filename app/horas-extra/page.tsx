'use client'

import { useState } from 'react'
import AuthGuard from '../AuthGuard'
import HorasExtraGrid from './HorasExtraGrid'
import type { Departamento } from '@/lib/schemas'

export default function HorasExtraPage() {
  const [departamento, setDepartamento] = useState<Departamento>('diseno')
  
  // Semana empieza en miércoles. Por defecto, tomar el miércoles más cercano hacia atrás.
  const [semana, setSemana] = useState(() => {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day < 3 ? -4 : 3)
    const dt = new Date(d.setDate(diff))
    return dt.toISOString().split('T')[0]
  })

  return (
    <AuthGuard>
      <main className="min-h-screen bg-gray-50 flex flex-col">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Control de Horas Extra</h1>
              <p className="text-sm text-gray-500 mt-1">
                Registro semanal por departamento
              </p>
            </div>
          </div>

          {/* Filtros Globales */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-wrap gap-6">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Departamento</label>
              <select
                value={departamento}
                onChange={(e) => setDepartamento(e.target.value as Departamento)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:border-[#0369A1]"
              >
                <option value="diseno">Diseño</option>
                <option value="automatizacion">Automatización</option>
                <option value="taller">Taller / Tool Room</option>
                <option value="cnc">CNC / Producción</option>
              </select>
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Semana (Miércoles de inicio)</label>
              <input
                type="date"
                value={semana}
                onChange={(e) => setSemana(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-[#0369A1]"
              />
              <span className="text-xs text-gray-500">La semana abarca de Miércoles a Martes</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 overflow-x-auto">
            <HorasExtraGrid departamento={departamento} semanaInicio={semana} />
          </div>
        </div>
      </main>
    </AuthGuard>
  )
}
