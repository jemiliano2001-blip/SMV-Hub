'use client'

import { useState, useMemo } from 'react'
import { Search, Upload, Database, DollarSign, Globe2, Scale } from 'lucide-react'

import CotizacionesList from './CotizacionesList'
import CotizacionesComparadorView from './CotizacionesComparadorView'
import ImportarCotizaciones from './ImportarCotizaciones'
import { useCotizaciones } from '@/lib/hooks/useCotizaciones'
import { generarLlavePieza } from '@/lib/pieza-matching'
import ModuleTabs from '@/components/layout/ModuleTabs'
import ModuleSurface from '@/components/layout/ModuleSurface'

type Modo = 'consultar' | 'comparador' | 'importar'

export default function CotizacionesTabs() {
  const [modo, setModo] = useState<Modo>('consultar')
  const { cotizaciones } = useCotizaciones()

  const stats = useMemo(() => {
    const total = cotizaciones.length
    const usa = cotizaciones.filter((c) => c.ubicacion === 'USA').length
    const mx = cotizaciones.filter((c) => c.ubicacion === 'MX').length

    // Piezas comparables (con 2 o más cotizaciones)
    const mapa = new Map<string, number>()
    cotizaciones.forEach((c) => {
      const k = c.llavePieza || generarLlavePieza(c.numeroParte, c.descripcion)
      mapa.set(k, (mapa.get(k) || 0) + 1)
    })
    let piezasComparables = 0
    mapa.forEach((cant) => {
      if (cant >= 2) piezasComparables++
    })

    return { total, usa, mx, piezasComparables }
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
            <span className="text-xs font-medium text-muted-foreground">Piezas Comparables (2+)</span>
            <Scale className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-xl font-bold text-foreground mt-1 font-mono">{stats.piezasComparables}</p>
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
      </div>

      <ModuleTabs
        value={modo}
        onValueChange={(value) => setModo(value as Modo)}
        urlParam="tab"
        stickyHeader
        items={[
          {
            value: 'consultar',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Search className="h-4 w-4" />
                Consultar Catálogo
              </span>
            ),
            badge: stats.total,
            badgeVariant: 'sky',
            content: <CotizacionesList onIrAImportar={() => setModo('importar')} />,
          },
          {
            value: 'comparador',
            label: (
              <span className="inline-flex items-center gap-1.5">
                <Scale className="h-4 w-4" />
                Comparador por Pieza
              </span>
            ),
            badge: stats.piezasComparables > 0 ? stats.piezasComparables : undefined,
            badgeVariant: 'amber',
            content: <CotizacionesComparadorView cotizaciones={cotizaciones} />,
          },
          {
            value: 'importar',
            label: (
              <span className="inline-flex items-center gap-1.5">
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

