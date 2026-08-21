'use client'

import { useState, useMemo } from 'react'
import { Search, Upload, Database, DollarSign, Globe2, FileSpreadsheet } from 'lucide-react'
import CotizacionesList from './CotizacionesList'
import ImportarCotizaciones from './ImportarCotizaciones'
import { useCotizaciones } from '@/lib/hooks/useCotizaciones'
import ModuleTabs from '@/components/layout/ModuleTabs'
import ModuleSurface from '@/components/layout/ModuleSurface'

type Modo = 'consultar' | 'importar'

export default function CotizacionesTabs() {
  const [modo, setModo] = useState<Modo>('consultar')
  const { cotizaciones } = useCotizaciones()

  const stats = useMemo(() => {
    const total = cotizaciones.length
    const usa = cotizaciones.filter((c) => c.ubicacion === 'USA').length
    const mx = cotizaciones.filter((c) => c.ubicacion === 'MX').length
    const cotizados = cotizaciones.filter((c) => c.estatus === 'cotizado').length
    return { total, usa, mx, cotizados }
  }, [cotizaciones])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ModuleSurface className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Cotizaciones</span>
            <Database className="h-4 w-4 text-sky-600" />
          </div>
          <p className="text-xl font-bold text-foreground mt-1 font-mono">{stats.total}</p>
        </ModuleSurface>

        <ModuleSurface className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Cotizadas (USA)</span>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-xl font-bold text-foreground mt-1 font-mono">{stats.usa}</p>
        </ModuleSurface>

        <ModuleSurface className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Cotizadas (MX)</span>
            <Globe2 className="h-4 w-4 text-indigo-600" />
          </div>
          <p className="text-xl font-bold text-foreground mt-1 font-mono">{stats.mx}</p>
        </ModuleSurface>

        <ModuleSurface className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Estatus &apos;Cotizado&apos;</span>
            <FileSpreadsheet className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-xl font-bold text-foreground mt-1 font-mono">{stats.cotizados}</p>
        </ModuleSurface>
      </div>

      <ModuleTabs
        value={modo}
        onValueChange={(value) => setModo(value as Modo)}
        items={[
          {
            value: 'consultar',
            label: (
              <span className="inline-flex items-center gap-2">
                <Search className="h-4 w-4" />
                Consultar Catálogo
              </span>
            ),
            content: <CotizacionesList onIrAImportar={() => setModo('importar')} />,
          },
          {
            value: 'importar',
            label: (
              <span className="inline-flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Carga Manual desde CSV
              </span>
            ),
            content: <ImportarCotizaciones />,
          },
        ]}
      />
    </div>
  )
}
