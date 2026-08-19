'use client'

import { Building2, Globe, Plus, Printer, Search } from 'lucide-react'

import PageHeader from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
  const suffix = sinMercado > 0 ? '+' : ''

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Proveedores"
        badge="USA · México"
        icon={Building2}
        description="Directorio, comparador de precios Odoo, matriz primario/backup y scorecards para taller y automatización."
        actions={
          <>
            {onAbrirInvestigacion ? (
              <Button variant="outline" size="sm" onClick={onAbrirInvestigacion}>
                <Search data-icon="inline-start" />
                Investigar precios
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={onGenerarPDF}>
              <Printer data-icon="inline-start" />
              Reporte PO
            </Button>
            <Button size="sm" onClick={onNuevoProveedor}>
              <Plus data-icon="inline-start" />
              Nuevo proveedor
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-max items-center gap-1.5 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => onMercadoChange('usa')}
            aria-pressed={mercadoActivo === 'usa'}
            className={cn(
              'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-4 py-1.5 text-xs font-bold transition-all',
              mercadoActivo === 'usa'
                ? 'border border-border bg-background text-primary shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              USA
            </Badge>
            Tooling ({totalUSA}
            {suffix})
          </button>

          <button
            type="button"
            onClick={() => onMercadoChange('mexico')}
            aria-pressed={mercadoActivo === 'mexico'}
            className={cn(
              'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-4 py-1.5 text-xs font-bold transition-all',
              mercadoActivo === 'mexico'
                ? 'border border-border bg-background text-emerald-800 shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 px-1.5 py-0 text-[10px] text-emerald-800">
              MX
            </Badge>
            México ({totalMexico}
            {suffix})
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 font-medium">
            <Globe className="size-4 text-primary" aria-hidden />
            <span>
              Fuentes activas:{' '}
              <span className="font-bold text-foreground">{totalProveedores}</span>
            </span>
          </div>
          <span className="hidden sm:inline">
            Moneda:{' '}
            <span className="font-bold text-foreground">
              {mercadoActivo === 'usa' ? 'USD' : 'MXN'}
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}
