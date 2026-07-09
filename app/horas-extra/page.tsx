'use client'

import { useState } from 'react'
import AuthGuard from '../AuthGuard'
import HorasExtraGrid from './HorasExtraGrid'
import VistaHoy from './VistaHoy'
import ResumenMensual from './ResumenMensual'
import type { Departamento } from '@/lib/schemas'
import {
  getSemanaActualISO,
  offsetSemana,
  esSemanaActual,
} from '@/lib/horas-extra-parse'
import { CalendarDays, Grid3X3, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react'

type Tab = 'semana' | 'hoy' | 'resumen'

function tabInicial(): Tab {
  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
    return 'hoy'
  }
  return 'semana'
}

export default function HorasExtraPage() {
  const [departamento, setDepartamento] = useState<Departamento>('diseno')
  const [semana, setSemana] = useState(getSemanaActualISO)
  const [tab, setTab] = useState<Tab>(tabInicial)

  return (
    <AuthGuard>
      <main className="min-h-screen bg-gray-50 flex flex-col">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
          <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Control de Horas Extra</h1>
              <p className="text-sm text-gray-500 mt-1">
                Registro semanal por departamento
              </p>
            </div>

            <div className="flex bg-gray-200/50 p-1 rounded-lg w-fit print:hidden">
              <TabButton
                active={tab === 'hoy'}
                onClick={() => setTab('hoy')}
                icon={<CalendarDays className="h-4 w-4" />}
                label="Hoy"
              />
              <TabButton
                active={tab === 'semana'}
                onClick={() => setTab('semana')}
                icon={<Grid3X3 className="h-4 w-4" />}
                label="Semana"
              />
              <TabButton
                active={tab === 'resumen'}
                onClick={() => setTab('resumen')}
                icon={<BarChart3 className="h-4 w-4" />}
                label="Resumen"
              />
            </div>
          </div>

          {/* Filtros globales (ocultos en resumen parcialmente) */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 flex flex-wrap gap-6 print:hidden">
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

            {tab !== 'resumen' && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">
                  Semana (Miércoles de inicio)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSemana((s) => offsetSemana(s, -1))}
                    className="p-1.5 border border-gray-200 rounded-md hover:bg-gray-50"
                    aria-label="Semana anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <input
                    type="date"
                    value={semana}
                    onChange={(e) => setSemana(e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-[#0369A1]"
                  />
                  <button
                    type="button"
                    onClick={() => setSemana((s) => offsetSemana(s, 1))}
                    className="p-1.5 border border-gray-200 rounded-md hover:bg-gray-50"
                    aria-label="Semana siguiente"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  {!esSemanaActual(semana) && (
                    <button
                      type="button"
                      onClick={() => setSemana(getSemanaActualISO())}
                      className="text-xs font-medium text-[#0369A1] hover:underline whitespace-nowrap"
                    >
                      Ir a hoy
                    </button>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  Miércoles a martes
                  {esSemanaActual(semana) && (
                    <span className="ml-2 text-emerald-600 font-medium">· Semana actual</span>
                  )}
                </span>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 overflow-x-auto print:shadow-none print:border-0">
            {tab === 'semana' && (
              <HorasExtraGrid departamento={departamento} semanaInicio={semana} />
            )}
            {tab === 'hoy' && (
              <VistaHoy departamento={departamento} semanaInicio={semana} />
            )}
            {tab === 'resumen' && <ResumenMensual departamento={departamento} />}
          </div>
        </div>
      </main>
    </AuthGuard>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
        active
          ? 'bg-white text-[#0369A1] shadow-sm'
          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
