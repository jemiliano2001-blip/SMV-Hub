'use client'

import { useMemo, useState } from 'react'
import { Search, Trophy, Plus, Building2, Check, DollarSign } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatPrecio } from '@/lib/format'
import { aMXN, aUSD, TIPO_CAMBIO_DEFAULT_USD_MXN } from '@/lib/tipo-cambio'
import type { CompraOdooItem } from '@/lib/schemas'
import { CATEGORIAS_PRODUCTO_REGISTRO, obtenerCategoriaDef } from '@/lib/compras-odoo'

type Props = {
  items: CompraOdooItem[]
  onAgregarAPresupuesto: (item: CompraOdooItem, cantidad?: number) => void
  usdToMxn?: number
}

function normalizarTexto(txt: string): string {
  return txt
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
}

export default function ComparadorPreciosInsumos({
  items,
  onAgregarAPresupuesto,
  usdToMxn = TIPO_CAMBIO_DEFAULT_USD_MXN,
}: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas')
  const [modoMoneda, setModoMoneda] = useState<'original' | 'MXN' | 'USD'>('original')
  const [agregados, setAgregados] = useState<Set<string>>(new Set())

  // Filtrar ítems por texto y categoría
  const itemsFiltrados = useMemo(() => {
    const qNorm = normalizarTexto(busqueda)
    const tokens = qNorm.split(/\s+/).filter(Boolean)

    return items.filter((it) => {
      if (categoriaFiltro !== 'todas' && it.categoriaId !== categoriaFiltro) {
        return false
      }

      if (tokens.length === 0) return true

      const descNorm = normalizarTexto(it.descripcion)
      const tipoNorm = normalizarTexto(it.tipoInsumo ?? it.tipoMetal ?? '')
      const medNorm = normalizarTexto(it.medida ?? '')
      const provNorm = normalizarTexto(it.proveedorNombre)
      const catOdooNorm = normalizarTexto(it.odooCategoria ?? '')

      const textoCompleto = `${descNorm} ${tipoNorm} ${medNorm} ${provNorm} ${catOdooNorm}`
      return tokens.every((token) => textoCompleto.includes(token))
    })
  }, [items, busqueda, categoriaFiltro])

  // Calcular el precio mínimo en MXN por grupo/búsqueda para resaltar la mejor opción
  const precioMinimoMxnPorItem = useMemo(() => {
    const mapMin = new Map<string, number>()
    for (const it of itemsFiltrados) {
      if (it.precioUnitario <= 0) continue
      const pxMxn = aMXN(it.precioUnitario, (it.moneda ?? 'MXN') as 'USD' | 'MXN', usdToMxn)
      // Agrupar por descripción normalizada + medida
      const key = `${normalizarTexto(it.descripcion)}_${normalizarTexto(it.medida ?? '')}`
      const minPrevio = mapMin.get(key)
      if (minPrevio === undefined || pxMxn < minPrevio) {
        mapMin.set(key, pxMxn)
      }
    }
    return mapMin
  }, [itemsFiltrados, usdToMxn])

  function handleAgregar(item: CompraOdooItem) {
    onAgregarAPresupuesto(item, 1)
    setAgregados((prev) => new Set(prev).add(item.id))
    setTimeout(() => {
      setAgregados((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
    }, 1500)
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
      {/* Encabezado y Barra de Búsqueda */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <Search className="h-4 w-4 text-sky-600" />
            Comparador Inteligente de Precios y Proveedores
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Busca cualquier solera, acero, fresa o insumo para ver qué proveedor ofrece el mejor precio.
          </p>
        </div>

        {/* Control de Moneda */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg self-start md:self-auto">
          <span className="text-[11px] font-bold text-slate-500 px-2 flex items-center gap-1">
            <DollarSign className="h-3 w-3" /> Moneda:
          </span>
          <button
            type="button"
            onClick={() => setModoMoneda('original')}
            className={`px-2.5 py-1 text-[11px] font-extrabold rounded-md transition-all ${
              modoMoneda === 'original'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Original
          </button>
          <button
            type="button"
            onClick={() => setModoMoneda('MXN')}
            className={`px-2.5 py-1 text-[11px] font-extrabold rounded-md transition-all ${
              modoMoneda === 'MXN'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            MXN
          </button>
          <button
            type="button"
            onClick={() => setModoMoneda('USD')}
            className={`px-2.5 py-1 text-[11px] font-extrabold rounded-md transition-all ${
              modoMoneda === 'USD'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            USD (${usdToMxn.toFixed(2)})
          </button>
        </div>
      </div>

      {/* Inputs de Filtro */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-3 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder='Buscar material o especificación (ej. "solera 1/4 x 2", "redondo 6061", "fresa 1/2")…'
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50/50"
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold"
            >
              ✕
            </button>
          )}
        </div>

        <div>
          <select
            value={categoriaFiltro}
            onChange={(e) => setCategoriaFiltro(e.target.value)}
            className="w-full py-2 px-3 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-semibold text-slate-700"
          >
            <option value="todas">Todas las Familias</option>
            {CATEGORIAS_PRODUCTO_REGISTRO.map((c) => (
              <option key={c.id} value={c.id}>
                {c.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Resultados de Búsqueda */}
      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-extrabold text-slate-700">
            {itemsFiltrados.length} resultados encontrados
          </span>
          {busqueda && (
            <span className="text-[11px] text-slate-500 font-mono">
              Filtro: &quot;{busqueda}&quot;
            </span>
          )}
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-3 py-2.5">Proveedor</th>
                <th className="px-3 py-2.5">Descripción Material</th>
                <th className="px-3 py-2.5">Familia / Tipo</th>
                <th className="px-3 py-2.5">Medida</th>
                <th className="px-3 py-2.5">Doc. Ref</th>
                <th className="px-3 py-2.5">Fecha</th>
                <th className="px-3 py-2.5 text-right">Precio Unitario</th>
                <th className="px-3 py-2.5 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itemsFiltrados.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-xs">
                    No se encontraron insumos que coincidan con la búsqueda.
                  </td>
                </tr>
              )}

              {itemsFiltrados.slice(0, 150).map((it) => {
                const keyGroup = `${normalizarTexto(it.descripcion)}_${normalizarTexto(it.medida ?? '')}`
                const precioMxnActual = aMXN(
                  it.precioUnitario,
                  (it.moneda ?? 'MXN') as 'USD' | 'MXN',
                  usdToMxn
                )
                const minGroupMxn = precioMinimoMxnPorItem.get(keyGroup)
                const esMejorPrecio =
                  minGroupMxn !== undefined &&
                  precioMxnActual > 0 &&
                  Math.abs(precioMxnActual - minGroupMxn) < 0.05

                // Formatear precio según el modo de moneda
                let precioDisplay: string
                if (modoMoneda === 'MXN') {
                  precioDisplay = formatPrecio(precioMxnActual, 'MXN')
                } else if (modoMoneda === 'USD') {
                  const pxUsd = aUSD(
                    it.precioUnitario,
                    (it.moneda ?? 'MXN') as 'USD' | 'MXN',
                    usdToMxn
                  )
                  precioDisplay = formatPrecio(pxUsd, 'USD')
                } else {
                  precioDisplay = formatPrecio(
                    it.precioUnitario,
                    it.moneda === 'USD' ? 'USD' : 'MXN'
                  )
                }

                const yaAgregado = agregados.has(it.id)

                return (
                  <tr
                    key={it.id}
                    className={`hover:bg-slate-50 transition-colors ${
                      esMejorPrecio ? 'bg-amber-50/40' : ''
                    }`}
                  >
                    <td className="px-3 py-2 font-bold text-slate-900 flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[160px]">{it.proveedorNombre}</span>
                    </td>

                    <td className="px-3 py-2 max-w-[240px]">
                      <p className="font-semibold text-slate-900 truncate" title={it.descripcion}>
                        {it.descripcion}
                      </p>
                      {it.odooCategoria && (
                        <p className="text-[10px] text-slate-400 font-mono truncate">
                          {it.odooCategoria}
                        </p>
                      )}
                    </td>

                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-0.5">
                        <Badge variant="outline" className="w-fit text-[10px] font-mono">
                          {obtenerCategoriaDef(it.categoriaId)?.etiqueta ?? it.categoriaId}
                        </Badge>

                        {(it.tipoInsumo || it.tipoMetal) && (
                          <span className="text-[10px] text-slate-600 font-mono">
                            {it.tipoInsumo ?? it.tipoMetal}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2 font-mono font-medium text-slate-700">
                      {it.medida ?? '—'}
                    </td>

                    <td className="px-3 py-2 font-mono text-[11px] text-slate-500">
                      {it.referenciaDoc}
                    </td>

                    <td className="px-3 py-2 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {it.fecha ?? '—'}
                    </td>

                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span
                          className={`font-mono font-extrabold text-sm ${
                            esMejorPrecio ? 'text-emerald-700' : 'text-slate-900'
                          }`}
                        >
                          {precioDisplay}
                        </span>

                        {esMejorPrecio && (
                          <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[9px] px-1 py-0 font-extrabold flex items-center gap-1">
                            <Trophy className="h-2.5 w-2.5 text-amber-600" />
                            Mejor Precio
                          </Badge>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => handleAgregar(it)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                          yaAgregado
                            ? 'bg-emerald-600 text-white'
                            : 'bg-sky-50 text-sky-700 hover:bg-sky-600 hover:text-white border border-sky-200'
                        }`}
                      >
                        {yaAgregado ? (
                          <>
                            <Check className="h-3 w-3" /> Agregado
                          </>
                        ) : (
                          <>
                            <Plus className="h-3 w-3" /> Presupuesto
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
