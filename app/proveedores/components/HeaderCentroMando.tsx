'use client'

import { Building2, Plus, Printer, Globe, Sparkles } from 'lucide-react'
// ponytail: KPI de Lead Time y desglose USA/MX/legado se eliminaron — eran valores
// hardcodeados o un artefacto de un where() que no matchea documentos sin `mercado`.
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface HeaderCentroMandoProps {
  totalProveedores: number
  totalUSA: number
  totalMexico: number
  sinMercado?: number
  mercadoActivo: 'usa' | 'mexico'
  onMercadoChange: (mercado: 'usa' | 'mexico') => void
  onNuevoProveedor: () => void
  onGenerarPDF: () => void
  onAbrirInvestigacion?: () => void
}

export default function HeaderCentroMando({
  totalProveedores,
  totalUSA,
  totalMexico,
  sinMercado = 0,
  mercadoActivo,
  onMercadoChange,
  onNuevoProveedor,
  onGenerarPDF,
  onAbrirInvestigacion,
}: HeaderCentroMandoProps) {
  return (
    <div className="space-y-4">
      {/* Banner Principal / Hero Light Theme */}
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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
            <h1 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">
              <Building2 className="h-5 w-5 shrink-0 text-[#0369A1]" />
              Inteligencia de Compras & Proveedores
            </h1>
            <p className="text-xs leading-relaxed text-slate-500">
              Directorio de proveedores USA & México, comparador de cotizaciones en tiempo real, matriz primario/backup y scorecards 360° para taller CNC y automatización.
            </p>
          </div>

          {/* Botones de Acción Principal */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {onAbrirInvestigacion && (
              <Button
                onClick={onAbrirInvestigacion}
                variant="outline"
                className="bg-sky-50 hover:bg-sky-100 text-[#0369A1] border-sky-200 shadow-2xs gap-1.5 text-xs font-extrabold"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#0369A1]" />
                Investigar Precios IA
              </Button>
            )}

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

        {/* Tarjeta KPI: Fuentes Activas */}
        <div className="mt-4 border-t border-slate-100 pt-3">
          <div className="w-full max-w-xs space-y-1 rounded-lg border border-slate-200/80 bg-slate-50 p-2.5">
            <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
              <span>Fuentes Activas</span>
              <Globe className="w-4 h-4 text-[#0369A1]" />
            </div>
            <div className="text-lg font-extrabold text-slate-900">{totalProveedores}</div>
          </div>
        </div>
      </div>

      {/* Selector de Mercado (USA vs México) */}
      <div className="flex items-center justify-between overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xs">
        <div className="flex w-max items-center gap-1.5 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => onMercadoChange('usa')}
            aria-pressed={mercadoActivo === 'usa'}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-4 py-1.5 text-xs font-bold transition-all ${
              mercadoActivo === 'usa'
                ? 'bg-white text-[#0369A1] shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🇺🇸 USA Tooling ({totalUSA}{sinMercado > 0 ? '+' : ''})
          </button>

          <button
            type="button"
            onClick={() => onMercadoChange('mexico')}
            aria-pressed={mercadoActivo === 'mexico'}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-4 py-1.5 text-xs font-bold transition-all ${
              mercadoActivo === 'mexico'
                ? 'bg-white text-emerald-800 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            🇲🇽 Proveedores México ({totalMexico}{sinMercado > 0 ? '+' : ''})
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium hidden sm:block pr-2">
          Moneda base: <span className="font-bold text-slate-800">{mercadoActivo === 'usa' ? 'USD ($)' : 'MXN ($)'}</span>
        </div>
      </div>
    </div>
  )
}
