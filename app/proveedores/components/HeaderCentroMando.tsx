'use client'

import {
  Building2,
  Plus,
  Printer,
  Calculator,
  ShieldCheck,
  Award,
  Clock,
  Globe,
  Sparkles,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface HeaderCentroMandoProps {
  totalProveedores: number
  totalUSA: number
  totalMexico: number
  mercadoActivo: 'usa' | 'mexico'
  onMercadoChange: (mercado: 'usa' | 'mexico') => void
  onNuevoProveedor: () => void
  onGenerarPDF: () => void
  onAbrirCalculadora: () => void
  proveedoresFantasmaCount?: number
  onAbrirMantenimiento?: () => void
  leadTimePromedio?: number
  scorecardPromedio?: number
}

export default function HeaderCentroMando({
  totalProveedores,
  totalUSA,
  totalMexico,
  mercadoActivo,
  onMercadoChange,
  onNuevoProveedor,
  onGenerarPDF,
  onAbrirCalculadora,
  proveedoresFantasmaCount = 0,
  onAbrirMantenimiento,
  leadTimePromedio = 3.5,
  scorecardPromedio = 4.8,
}: HeaderCentroMandoProps) {
  return (
    <div className="space-y-4">
      {/* Banner Principal / Hero Light Theme */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 md:p-7 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Título & Subtítulo */}
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-[#0369A1] border border-sky-200">
                <Sparkles className="w-3.5 h-3.5 text-[#0369A1]" /> SMV Tooling & Procurement Hub
              </span>
              <Badge variant="outline" className="text-slate-600 border-slate-200 bg-slate-50">
                USD ↔ MXN Sync
              </Badge>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900 flex items-center gap-3">
              <Building2 className="w-7 h-7 text-[#0369A1] shrink-0" />
              Inteligencia de Compras & Proveedores
            </h1>
            <p className="text-slate-500 text-sm leading-relaxed">
              Directorio de proveedores USA & México, comparador de cotizaciones en tiempo real, matriz primario/backup y scorecards 360° para taller CNC y automatización.
            </p>
          </div>

          {/* Botones de Acción Principal */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              onClick={onAbrirCalculadora}
              variant="outline"
              className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs gap-2 text-xs font-bold"
            >
              <Calculator className="w-4 h-4 text-emerald-600" />
              Calculadora Landed Price
            </Button>

            <Button
              onClick={onGenerarPDF}
              variant="outline"
              className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs gap-2 text-xs font-bold"
            >
              <Printer className="w-4 h-4 text-sky-600" />
              Reporte PO (PDF)
            </Button>

            <Button
              onClick={onNuevoProveedor}
              className="bg-[#0369A1] hover:bg-[#0284C7] text-white shadow-xs gap-2 font-extrabold text-xs"
            >
              <Plus className="w-4 h-4" />
              Nuevo Proveedor
            </Button>
          </div>
        </div>

        {/* Tarjetas KPI Internas */}
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3.5 pt-5 border-t border-slate-100">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
              <span>Fuentes Activas</span>
              <Globe className="w-4 h-4 text-[#0369A1]" />
            </div>
            <div className="text-xl font-extrabold text-slate-900">
              {totalProveedores} <span className="text-xs font-normal text-slate-500">({totalUSA} USA / {totalMexico} MX)</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
              <span>Lead Time Promedio</span>
              <Clock className="w-4 h-4 text-sky-600" />
            </div>
            <div className="text-xl font-extrabold text-slate-900">
              {leadTimePromedio} <span className="text-xs font-normal text-slate-500">días hábiles</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
              <span>Scorecard 360°</span>
              <Award className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-extrabold text-slate-900 flex items-center gap-1">
              ⭐ {scorecardPromedio.toFixed(1)} <span className="text-xs font-normal text-slate-500">/ 5.0</span>
            </div>
          </div>

          <div
            onClick={onAbrirMantenimiento}
            className={`p-3.5 rounded-xl border space-y-1 cursor-pointer transition-all ${
              proveedoresFantasmaCount > 0
                ? 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100/80'
                : 'bg-slate-50 border-slate-200/80 text-slate-700'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-bold">
              <span>Mantenimiento</span>
              {proveedoresFantasmaCount > 0 ? (
                <AlertTriangle className="w-4 h-4 text-amber-600 animate-bounce" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              )}
            </div>
            <div className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              {proveedoresFantasmaCount > 0 ? (
                <span className="text-amber-700">{proveedoresFantasmaCount} por vincular</span>
              ) : (
                <span className="text-emerald-700 text-sm font-bold">100% Vinculados</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Selector de Mercado (USA vs México) */}
      <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => onMercadoChange('usa')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${
              mercadoActivo === 'usa'
                ? 'bg-white text-[#0369A1] shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🇺🇸 USA Tooling ({totalUSA})
          </button>

          <button
            onClick={() => onMercadoChange('mexico')}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${
              mercadoActivo === 'mexico'
                ? 'bg-white text-emerald-800 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🇲🇽 Proveedores México ({totalMexico})
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium hidden sm:block pr-2">
          Moneda base: <span className="font-bold text-slate-800">{mercadoActivo === 'usa' ? 'USD ($)' : 'MXN ($)'}</span>
        </div>
      </div>
    </div>
  )
}
