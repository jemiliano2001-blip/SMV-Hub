'use client'

import { useState } from 'react'
import {
  Search,
  LayoutGrid,
  Table as TableIcon,
  ArrowUpDown,
  Building2,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import TarjetaProveedor from './TarjetaProveedor'
import type { Proveedor, CategoriaProveedor } from '@/lib/schemas'
import type { OrdenamientoProveedor } from '@/lib/proveedores/directorio'

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
}: DirectorioProveedoresProps) {
  const [vista, setVista] = useState<'grid' | 'tabla'>('grid')

  const categoriasNav: { id: CategoriaFiltro; label: string }[] = [
    { id: 'todas', label: 'Todas las categorías' },
    { id: 'endmills', label: 'Endmills (Cortadores)' },
    { id: 'insertos', label: 'Insertos de Torneado/Fresado' },
    { id: 'tooling', label: 'Tooling & Conos' },
    { id: 'consumibles', label: 'Consumibles Taller' },
    { id: 'otros', label: 'Otros / Misceláneo' },
  ]

  return (
    <div className="space-y-4">
      {/* Barra de Filtros & Búsqueda */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Campo Búsqueda */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <Input
              placeholder="Buscar por nombre, marca (ej. YG-1, Harvey, Shars), contacto o broker..."
              value={busqueda}
              onChange={(e) => onBusquedaChange(e.target.value)}
              className="pl-10 text-xs bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-[#0369A1]"
            />
          </div>

          {/* Ordenamiento & Conmutador Grid/Tabla */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <select
                value={ordenamiento}
                onChange={(e) => onOrdenamientoChange(e.target.value as OrdenamientoProveedor)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:border-[#0369A1]"
              >
                <option value="nombre">Nombre (A → Z)</option>
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
                className={`p-1.5 rounded-md transition-all ${
                  vista === 'grid'
                    ? 'bg-white text-[#0369A1] shadow-2xs font-bold'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Vista en Rejilla de Tarjetas"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setVista('tabla')}
                aria-label="Mostrar proveedores en tabla"
                aria-pressed={vista === 'tabla'}
                className={`p-1.5 rounded-md transition-all ${
                  vista === 'tabla'
                    ? 'bg-white text-[#0369A1] shadow-2xs font-bold'
                    : 'text-slate-400 hover:text-slate-700'
                }`}
                title="Vista en Tabla de Datos"
              >
                <TableIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Chips de Categorías */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {categoriasNav.map((cat) => (
            <button
              type="button"
              key={cat.id}
              onClick={() => onCategoriaChange(cat.id)}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all ${
                categoriaFiltro === cat.id
                  ? 'bg-[#0369A1] text-white shadow-2xs font-extrabold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Estado Carga o Vacío */}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-white px-6 py-12 text-center" role="alert">
          <h3 className="text-base font-bold text-slate-900">No pudimos cargar los proveedores</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{error}</p>
          <Button
            type="button"
            onClick={onRetry}
            className="mt-5 min-h-10 bg-[#0369A1] hover:bg-[#075985]"
          >
            Intentar nuevamente
          </Button>
        </div>
      ) : cargando ? (
        <div className="py-20 text-center space-y-3">
          <div className="inline-block w-8 h-8 border-4 border-[#0369A1] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500 font-medium">Cargando directorio de proveedores...</p>
        </div>
      ) : proveedores.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-8 space-y-3">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">
            No se encontraron proveedores
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Intenta cambiar los términos de búsqueda o selecciona otra categoría.
          </p>
        </div>
      ) : vista === 'grid' ? (
        /* VISTA REJILLA (GRID) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {proveedores.map((prov) => (
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
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="p-3.5">Proveedor</th>
                <th className="p-3.5">Tier / Nivel</th>
                <th className="p-3.5">País</th>
                <th className="p-3.5">Marcas</th>
                <th className="p-3.5">Lead Time</th>
                <th className="p-3.5">Rating</th>
                <th className="p-3.5">Contacto</th>
                <th className="p-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {proveedores.map((prov) => (
                <tr
                  key={prov.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="p-3.5 font-bold text-slate-900">
                    <button
                      type="button"
                      onClick={() => onSelectProveedor(prov)}
                      className="hover:text-[#0369A1] transition-colors text-left"
                    >
                      {prov.nombre}
                    </button>
                  </td>

                  <td className="p-3.5">
                    <Badge
                      variant="outline"
                      className={`text-[9px] uppercase font-bold ${
                        prov.tipoProveedor === 'premium'
                          ? 'border-purple-300 text-purple-800 bg-purple-50'
                          : prov.tipoProveedor === 'barato'
                          ? 'border-amber-300 text-amber-800 bg-amber-50'
                          : 'border-sky-300 text-[#0369A1] bg-sky-50'
                      }`}
                    >
                      {prov.tipoProveedor}
                    </Badge>
                  </td>

                  <td className="p-3.5 text-slate-600">
                    {prov.pais === 'Estados Unidos' ? '🇺🇸 USA' : '🇲🇽 MX'}
                  </td>

                  <td className="p-3.5 max-w-xs">
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
                  </td>

                  <td className="p-3.5 text-slate-700">
                    {prov.leadTimeDias || '3-5'}d
                  </td>

                  <td className="p-3.5 font-bold text-amber-500">
                    ⭐ {prov.calificacion || 5}.0
                  </td>

                  <td className="p-3.5 text-slate-600">
                    {prov.email || prov.telefono || prov.contacto || '—'}
                  </td>

                  <td className="p-3.5 text-right space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSelectProveedor(prov)}
                      className="h-7 text-xs font-bold text-[#0369A1]"
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!error && !cargando && proveedores.length > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row">
          <p className="text-xs font-medium text-slate-500" aria-live="polite">
            Mostrando <span className="font-bold text-slate-800">{proveedores.length}</span>
            {typeof totalMercado === 'number' && (
              <> de <span className="font-bold text-slate-800">{totalMercado}</span></>
            )}{' '}
            proveedores
          </p>
          {hayMas && onCargarMas && (
            <Button
              type="button"
              variant="outline"
              onClick={onCargarMas}
              disabled={cargandoMas}
              className="min-h-10 min-w-32 border-slate-300 text-xs font-bold text-[#0369A1]"
            >
              {cargandoMas ? 'Cargando…' : 'Cargar más'}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
