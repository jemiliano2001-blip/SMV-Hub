'use client'

import { useEffect, useState } from 'react'
import {
  Search,
  LayoutGrid,
  Table as TableIcon,
  ArrowUpDown,
  Building2,
  Star,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import ModuleEmptyState from '@/components/layout/ModuleEmptyState'
import ModuleFilterChips from '@/components/layout/ModuleFilterChips'
import TarjetaProveedor from './TarjetaProveedor'
import type { Proveedor, CategoriaProveedor } from '@/lib/schemas'
import type { MercadoProveedor, OrdenamientoProveedor } from '@/lib/proveedores/directorio'
import { CATEGORIAS_PROVEEDOR_FILTRO } from '@/lib/proveedores/categorias-proveedor'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type CategoriaFiltro = CategoriaProveedor | 'todas'

interface DirectorioProveedoresProps {
  proveedores: Proveedor[]
  cargando: boolean
  error: string | null
  onRetry: () => void
  busqueda: string
  onBusquedaChange: (query: string) => void
  categoriaFiltro: CategoriaFiltro
  onCategoriaChange: (cat: CategoriaFiltro) => void
  ordenamiento: OrdenamientoProveedor
  onOrdenamientoChange: (ord: OrdenamientoProveedor) => void
  onSelectProveedor: (proveedor: Proveedor) => void
  onEditProveedor: (proveedor: Proveedor) => void
  proveedoresPrimarios?: Set<string>
  proveedoresBackup?: Set<string>
  hayMas?: boolean
  cargandoMas?: boolean
  totalMercado?: number
  onCargarMas?: () => void
  mercado: MercadoProveedor
}

export default function DirectorioProveedores({
  proveedores,
  cargando,
  error,
  onRetry,
  busqueda,
  onBusquedaChange,
  categoriaFiltro,
  onCategoriaChange,
  ordenamiento,
  onOrdenamientoChange,
  onSelectProveedor,
  onEditProveedor,
  proveedoresPrimarios = new Set(),
  proveedoresBackup = new Set(),
  hayMas = false,
  cargandoMas = false,
  totalMercado,
  onCargarMas,
  mercado,
}: DirectorioProveedoresProps) {
  const [vista, setVista] = useState<'grid' | 'tabla'>('grid')
  const [verTodos, setVerTodos] = useState(false)
  const tamanoHabituales = 18
  const esVistaHabitualDefault =
    mercado === 'mexico' &&
    ordenamiento === 'habitual' &&
    busqueda.trim().length === 0 &&
    categoriaFiltro === 'todas'
  const proveedoresVisibles =
    esVistaHabitualDefault && !verTodos
      ? proveedores.slice(0, tamanoHabituales)
      : proveedores
  const restantesHabituales = Math.max(0, proveedores.length - proveedoresVisibles.length)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVerTodos(false)
  }, [mercado, busqueda, categoriaFiltro, ordenamiento])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3.5 rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Campo Búsqueda */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <Input
              placeholder="Buscar por nombre, marca (ej. YG-1, Harvey, Shars), contacto o broker..."
              value={busqueda}
              onChange={(e) => onBusquedaChange(e.target.value)}
              className="border-border bg-card pl-10 text-xs text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Ordenamiento & Conmutador Grid/Tabla */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <select
                value={ordenamiento}
                onChange={(e) => onOrdenamientoChange(e.target.value as OrdenamientoProveedor)}
                className="rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
              >
                <option value="nombre">Nombre (A → Z)</option>
                {mercado === 'mexico' && (
                  <option value="habitual">Habituales (Odoo)</option>
                )}
                <option value="calificacion">Calificación (Mayor → Menor)</option>
                <option value="leadTime">Lead Time (Más rápido)</option>
              </select>
            </div>

            <div className="flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setVista('grid')}
                aria-label="Mostrar proveedores en tarjetas"
                aria-pressed={vista === 'grid'}
                className={cn(
                  'rounded-md p-1.5 transition-all',
                  vista === 'grid' ? 'bg-background font-bold text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground'
                )}
                title="Vista en Rejilla de Tarjetas"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setVista('tabla')}
                aria-label="Mostrar proveedores en tabla"
                aria-pressed={vista === 'tabla'}
                className={cn(
                  'rounded-md p-1.5 transition-all',
                  vista === 'tabla' ? 'bg-background font-bold text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground'
                )}
                title="Vista en Tabla de Datos"
              >
                <TableIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Chips de Categorías */}
        <ModuleFilterChips
          value={categoriaFiltro}
          onValueChange={(next) => onCategoriaChange(next as CategoriaFiltro)}
          ariaLabel="Filtrar proveedores por categoría"
          options={CATEGORIAS_PROVEEDOR_FILTRO.map((cat) => ({
            value: cat.id,
            label: cat.etiqueta,
          }))}
        />
      </div>

      {/* Estado Carga o Vacío */}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-card px-6 py-12 text-center" role="alert">
          <h3 className="text-base font-bold text-foreground">No pudimos cargar los proveedores</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{error}</p>
          <Button type="button" onClick={onRetry} className="mt-5 min-h-10" size="sm">
            Intentar nuevamente
          </Button>
        </div>
      ) : cargando ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">Cargando directorio de proveedores...</p>
        </div>
      ) : proveedores.length === 0 ? (
        <ModuleEmptyState
          icon={Building2}
          title="No se encontraron proveedores"
          description="Intenta cambiar los términos de búsqueda o selecciona otra categoría."
        />
      ) : vista === 'grid' ? (
        /* VISTA REJILLA (GRID) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {proveedoresVisibles.map((prov) => (
            <TarjetaProveedor
              key={prov.id}
              proveedor={prov}
              onSelect={onSelectProveedor}
              onEdit={onEditProveedor}
              esPrimario={proveedoresPrimarios.has(prov.id)}
              esBackup={proveedoresBackup.has(prov.id)}
            />
          ))}
        </div>
      ) : (
        /* VISTA TABLA DE ALTA DENSIDAD */
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
          <Table className="w-full text-left text-xs">
            <TableHeader className="bg-slate-50 border-b border-slate-200 font-bold uppercase tracking-wider text-slate-500">
              <TableRow>
                <TableHead className="p-3.5">Proveedor</TableHead>
                <TableHead className="p-3.5">Tier / Nivel</TableHead>
                <TableHead className="p-3.5">País</TableHead>
                <TableHead className="p-3.5">Marcas</TableHead>
                <TableHead className="p-3.5">Lead Time</TableHead>
                <TableHead className="p-3.5">Rating</TableHead>
                <TableHead className="p-3.5">Contacto</TableHead>
                <TableHead className="p-3.5 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100 font-medium text-slate-700">
              {proveedoresVisibles.map((prov) => (
                <TableRow
                  key={prov.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <TableCell className="p-3.5 font-bold text-slate-900">
                    <button
                      type="button"
                      onClick={() => onSelectProveedor(prov)}
                      className="text-left transition-colors hover:text-primary"
                    >
                      {prov.nombre}
                    </button>
                    {typeof prov.ordenesOdoo === 'number' && prov.ordenesOdoo >= 1 && (
                      <p className="mt-0.5 text-[10px] font-bold text-sky-800">
                        {prov.ordenesOdoo} compras Odoo
                      </p>
                    )}
                  </TableCell>

                  <TableCell className="p-3.5">
                    <Badge
                      variant="outline"
                      className={`text-[9px] uppercase font-bold ${
                        prov.tipoProveedor === 'premium'
                          ? 'border-purple-300 text-purple-800 bg-purple-50'
                          : prov.tipoProveedor === 'barato'
                          ? 'border-amber-300 text-amber-800 bg-amber-50'
                          : 'border-sky-300 text-primary bg-sky-50'
                      }`}
                    >
                      {prov.tipoProveedor}
                    </Badge>
                  </TableCell>

                  <TableCell className="p-3.5 text-muted-foreground">
                    {prov.pais === 'Estados Unidos' ? 'USA' : 'MX'}
                  </TableCell>

                  <TableCell className="p-3.5 max-w-xs">
                    <div className="flex flex-wrap gap-1">
                      {prov.marcas && prov.marcas.length > 0 ? (
                        prov.marcas.slice(0, 2).map((m, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-600 font-semibold"
                          >
                            {m}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 italic text-[10px]">—</span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="p-3.5 text-slate-700">
                    {prov.leadTimeDias || '3-5'}d
                  </TableCell>

                  <TableCell className="p-3.5 font-bold text-amber-500">
                    <span className="inline-flex items-center gap-1">
                      <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
                      {prov.calificacion || 5}.0
                    </span>
                  </TableCell>

                  <TableCell className="p-3.5 text-slate-600">
                    {prov.email || prov.telefono || prov.contacto || '—'}
                  </TableCell>

                  <TableCell className="p-3.5 text-right space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSelectProveedor(prov)}
                      className="h-7 text-xs font-bold text-primary"
                    >
                      Ver
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEditProveedor(prov)}
                      className="h-7 text-xs text-slate-500 hover:text-slate-800"
                    >
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!error && !cargando && proveedores.length > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row">
          <p className="text-xs font-medium text-slate-500" aria-live="polite">
            Mostrando <span className="font-bold text-slate-800">{proveedoresVisibles.length}</span>
            {typeof totalMercado === 'number' && (
              <> de <span className="font-bold text-slate-800">{totalMercado}</span></>
            )}{' '}
            proveedores
          </p>
          {esVistaHabitualDefault && restantesHabituales > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setVerTodos(true)}
              className="min-h-10 min-w-32 text-xs font-bold"
            >
              Ver todos ({restantesHabituales})
            </Button>
          )}
          {hayMas && onCargarMas && (
            <Button
              type="button"
              variant="outline"
              onClick={onCargarMas}
              disabled={cargandoMas}
              className="min-h-10 min-w-32 text-xs font-bold"
            >
              {cargandoMas ? 'Cargando…' : 'Cargar más'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
