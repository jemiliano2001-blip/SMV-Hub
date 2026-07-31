/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · tone: utilitario · scope: horas-extra */
'use client'

import { useState } from 'react'
import AuthGuard from '../AuthGuard'
import HorasExtraGrid from './HorasExtraGrid'
import VistaHoy from './VistaHoy'
import ResumenMensual from './ResumenMensual'
import { authBypassActivo, useUsuario } from '@/lib/auth'
import { usePermisos } from '@/lib/hooks/useRol'
import { puedeEditarHorasExtra } from '@/lib/roles'
import type { Departamento } from '@/lib/schemas'
import {
  getSemanaActualISO,
  offsetSemana,
  esSemanaActual,
} from '@/lib/horas-extra-parse'
import { CalendarDays, Grid3X3, BarChart3, ChevronLeft, ChevronRight, Eye } from 'lucide-react'

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

  const { usuario } = useUsuario()
  const { plantilla, esSuperAdmin, editaHorasExtra, cargando: cargandoPermisos } = usePermisos(
    authBypassActivo() ? null : usuario
  )
  // Edición restringida: admin/compras (incluye contabilidad), super-admin o el
  // flag por usuario (automatización). Diseño y el resto: solo lectura.
  const puedeEditar =
    authBypassActivo() || puedeEditarHorasExtra({ plantilla, esSuperAdmin, editaHorasExtra })
  const soloLectura = !cargandoPermisos && !puedeEditar

  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 tracking-tight">Control de Horas Extra</h1>
                <span className="text-[10px] font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 px-1.5 py-0.5 rounded">
                  Personal & Nomina
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Registro utilitario de horas extraordinarias por departamento del taller.
              </p>
              {soloLectura && (
                <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded mt-1.5">
                  <Eye className="h-3 w-3" />
                  Solo lectura — la captura la hace compras, contabilidad o automatización
                </p>
              )}
            </div>

            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 w-fit print:hidden">
              <TabButton
                active={tab === 'hoy'}
                onClick={() => setTab('hoy')}
                icon={<CalendarDays className="h-3.5 w-3.5" />}
                label="Hoy"
              />
              <TabButton
                active={tab === 'semana'}
                onClick={() => setTab('semana')}
                icon={<Grid3X3 className="h-3.5 w-3.5" />}
                label="Semana"
              />
              <TabButton
                active={tab === 'resumen'}
                onClick={() => setTab('resumen')}
                icon={<BarChart3 className="h-3.5 w-3.5" />}
                label="Resumen"
              />
            </div>
          </div>

          {/* Filtros Utilitarios */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-wrap gap-4 print:hidden">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600">Departamento</label>
              <select
                value={departamento}
                onChange={(e) => setDepartamento(e.target.value as Departamento)}
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:border-[#0369A1]"
              >
                <option value="diseno">Diseño</option>
                <option value="automatizacion">Automatización</option>
                <option value="taller">Taller / Tool Room</option>
                <option value="cnc">CNC / Producción</option>
              </select>
            </div>

            {tab !== 'resumen' && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-slate-600">
                  Semana (Miércoles de inicio)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSemana((s) => offsetSemana(s, -1))}
                    className="p-1.5 border border-slate-300 rounded-md hover:bg-slate-100 bg-white"
                    aria-label="Semana anterior"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 text-slate-600" />
                  </button>
                  <input
                    type="date"
                    value={semana}
                    onChange={(e) => setSemana(e.target.value)}
                    className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md font-mono bg-white text-slate-900 focus:outline-none focus:border-[#0369A1]"
                  />
                  <button
                    type="button"
                    onClick={() => setSemana((s) => offsetSemana(s, 1))}
                    className="p-1.5 border border-slate-300 rounded-md hover:bg-slate-100 bg-white"
                    aria-label="Semana siguiente"
                  >
                    <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                  </button>
                  {!esSemanaActual(semana) && (
                    <button
                      type="button"
                      onClick={() => setSemana(getSemanaActualISO())}
                      className="text-xs font-mono font-bold text-[#0369A1] hover:underline whitespace-nowrap"
                    >
                      Ir a hoy
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 sm:p-5 overflow-x-auto print:shadow-none print:border-0">
            {tab === 'semana' && (
              <HorasExtraGrid departamento={departamento} semanaInicio={semana} puedeEditar={puedeEditar} />
            )}
            {tab === 'hoy' && (
              <VistaHoy departamento={departamento} semanaInicio={semana} puedeEditar={puedeEditar} />
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
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
        active
          ? 'bg-white text-[#0369A1] shadow-xs'
          : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}
