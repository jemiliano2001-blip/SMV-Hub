'use client'

import { useMemo, useState } from 'react'
import {
  Search,
  Trophy,
  Plus,
  Building2,
  Check,
  DollarSign,
  Info,
  X,
  FileText,
  Tag,
  Package,
  Calendar,
  Layers,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatPrecio } from '@/lib/format'
import { aMXN, aUSD, TIPO_CAMBIO_DEFAULT_USD_MXN } from '@/lib/tipo-cambio'
import type { CompraOdooItem } from '@/lib/schemas'
import { CATEGORIAS_PRODUCTO_REGISTRO, obtenerCategoriaDef, esItemComprable } from '@/lib/compras-odoo'

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

function claveComparacion(item: CompraOdooItem): string {
  const sku = normalizarTexto(item.odooRefInterna ?? '')
  if (sku) return `sku:${sku}`

  const descripcion = normalizarTexto(item.descripcion)
  const medida = normalizarTexto(item.medida ?? '')
  const unidad = normalizarTexto(item.unidad ?? item.odooUom ?? '')
  return `material:${descripcion}|medida:${medida}|unidad:${unidad}`
}

export default function ComparadorPreciosInsumos({
  items,
  onAgregarAPresupuesto,
  usdToMxn = TIPO_CAMBIO_DEFAULT_USD_MXN,
}: Props) {
  const [busqueda, setBusqueda] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas')
  const [proveedorFiltro, setProveedorFiltro] = useState<string>('todos')
  const [tipoDocFiltro, setTipoDocFiltro] = useState<'todos' | 'po_confirmada' | 'rfq' | 'factura'>('todos')
  const [modoMoneda, setModoMoneda] = useState<'original' | 'MXN' | 'USD'>('original')
  const [soloComparables, setSoloComparables] = useState(true)
  const [agregados, setAgregados] = useState<Set<string>>(new Set())
  const [itemDetalle, setItemDetalle] = useState<CompraOdooItem | null>(null)

  // Lista única de proveedores para el filtro
  const listaProveedores = useMemo(() => {
    const map = new Map<string, string>()
    for (const it of items) {
      if (it.proveedorNombre) {
        map.set(it.proveedorNombre, it.proveedorNombre)
      }
    }
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b))
  }, [items])

  // Filtrar ítems por precio comprable, texto, categoría, proveedor y tipo de documento
  const itemsCoincidentes = useMemo(() => {
    const qNorm = normalizarTexto(busqueda)
    const tokens = qNorm.split(/\s+/).filter(Boolean)

    const filtrados = items.filter((it) => {
      if (!esItemComprable(it)) return false

      if (categoriaFiltro !== 'todas' && it.categoriaId !== categoriaFiltro) {
        return false
      }

      if (proveedorFiltro !== 'todos' && it.proveedorNombre !== proveedorFiltro) {
        return false
      }

      if (tipoDocFiltro === 'po_confirmada' && (it.fuente !== 'po' || it.esRfq)) {
        return false
      }
      if (tipoDocFiltro === 'rfq' && (it.fuente !== 'po' || !it.esRfq)) {
        return false
      }
      if (tipoDocFiltro === 'factura' && it.fuente !== 'factura') {
        return false
      }

      if (tokens.length === 0) return true

      const descNorm = normalizarTexto(it.descripcion)
      const tipoNorm = normalizarTexto(it.tipoInsumo ?? it.tipoMetal ?? '')
      const medNorm = normalizarTexto(it.medida ?? '')
      const provNorm = normalizarTexto(it.proveedorNombre)
      const catOdooNorm = normalizarTexto(it.odooCategoria ?? '')
      const refDocNorm = normalizarTexto(it.referenciaDoc ?? '')
      const refIntNorm = normalizarTexto(it.odooRefInterna ?? '')
      const satNorm = normalizarTexto(it.claveProdServ ?? '')

      const textoCompleto = `${descNorm} ${tipoNorm} ${medNorm} ${provNorm} ${catOdooNorm} ${refDocNorm} ${refIntNorm} ${satNorm}`
      return tokens.every((token) => textoCompleto.includes(token))
    })

    if (tokens.length === 0) return filtrados

    // Con búsqueda activa, ordenar por precio (MXN) ascendente para que lo más barato destaque arriba
    return [...filtrados].sort((a, b) => {
      const pxA = aMXN(a.precioUnitario, (a.moneda ?? 'MXN') as 'USD' | 'MXN', usdToMxn)
      const pxB = aMXN(b.precioUnitario, (b.moneda ?? 'MXN') as 'USD' | 'MXN', usdToMxn)
      return pxA - pxB
    })
  }, [items, busqueda, categoriaFiltro, proveedorFiltro, tipoDocFiltro, usdToMxn])

  const comparacionesPorItem = useMemo(() => {
    const comparaciones = new Map<string, { min: number; max: number; proveedores: Set<number> }>()
    for (const it of itemsCoincidentes) {
      const pxMxn = aMXN(it.precioUnitario, (it.moneda ?? 'MXN') as 'USD' | 'MXN', usdToMxn)
      const key = claveComparacion(it)
      const grupo = comparaciones.get(key)
      if (!grupo) {
        comparaciones.set(key, { min: pxMxn, max: pxMxn, proveedores: new Set([it.odooPartnerId]) })
      } else {
        grupo.proveedores.add(it.odooPartnerId)
        if (pxMxn < grupo.min) grupo.min = pxMxn
        if (pxMxn > grupo.max) grupo.max = pxMxn
      }
    }
    return comparaciones
  }, [itemsCoincidentes, usdToMxn])

  const itemsFiltrados = useMemo(
    () =>
      soloComparables
        ? itemsCoincidentes.filter((item) => (comparacionesPorItem.get(claveComparacion(item))?.proveedores.size ?? 0) >= 2)
        : itemsCoincidentes,
    [comparacionesPorItem, itemsCoincidentes, soloComparables]
  )

  const gruposComparables = useMemo(
    () => Array.from(comparacionesPorItem.values()).filter((grupo) => grupo.proveedores.size >= 2).length,
    [comparacionesPorItem]
  )

  const hayCriterio = busqueda.trim().length > 0 || categoriaFiltro !== 'todas' || proveedorFiltro !== 'todos'

  function handleAgregar(item: CompraOdooItem) {
    onAgregarAPresupuesto(item, item.cantidad > 0 ? item.cantidad : 1)
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
            Comparador inteligente de precios
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Busca un material o SKU y compara únicamente alternativas equivalentes entre proveedores.
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
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        {/* Búsqueda por Texto */}
        <div className="sm:col-span-2 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder='Buscar por material, SKU, ref, clave SAT (ej. "D-2", "broca 3/8", "P00552")…'
            className="w-full pl-9 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 bg-slate-50/50"
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

        {/* Filtro por Proveedor */}
        <div>
          <select
            value={proveedorFiltro}
            onChange={(e) => setProveedorFiltro(e.target.value)}
            className="w-full py-2 px-3 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 font-semibold text-slate-700"
          >
            <option value="todos">Todos los Proveedores ({listaProveedores.length})</option>
            {listaProveedores.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro por Familia */}
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

      {/* Selector de Pestaña de Estado de Documento */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 text-xs">
        <span className="font-bold text-slate-500 mr-1 flex items-center gap-1">
          <FileText className="h-3.5 w-3.5" /> Filtrar Documento:
        </span>

        <button
          type="button"
          onClick={() => setTipoDocFiltro('todos')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
            tipoDocFiltro === 'todos'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Todos los Documentos
        </button>

        <button
          type="button"
          onClick={() => setTipoDocFiltro('po_confirmada')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
            tipoDocFiltro === 'po_confirmada'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
          Órdenes de Compra
        </button>

        <button
          type="button"
          onClick={() => setTipoDocFiltro('rfq')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
            tipoDocFiltro === 'rfq'
              ? 'bg-sky-700 text-white shadow-xs'
              : 'bg-sky-50 text-sky-800 hover:bg-sky-100 border border-sky-200'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-sky-400 inline-block"></span>
          Solicitudes / Cotizaciones
        </button>

        <button
          type="button"
          onClick={() => setTipoDocFiltro('factura')}
          className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
            tipoDocFiltro === 'factura'
              ? 'bg-purple-700 text-white shadow-xs'
              : 'bg-purple-50 text-purple-800 hover:bg-purple-100 border border-purple-200'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-purple-400 inline-block"></span>
          Facturas Publicadas
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2">
        <p className="text-xs text-sky-900">
          {gruposComparables > 0
            ? `${gruposComparables} grupos tienen alternativas de dos o más proveedores.`
            : 'Aún no hay alternativas equivalentes con los filtros actuales.'}
        </p>
        <button
          type="button"
          aria-pressed={soloComparables}
          onClick={() => setSoloComparables((actual) => !actual)}
          className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${
            soloComparables
              ? 'bg-sky-700 text-white shadow-xs'
              : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          {soloComparables ? 'Sólo alternativas comparables' : 'Mostrar todos los resultados'}
        </button>
      </div>

      {/* Resultados de Búsqueda */}
      <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-extrabold text-slate-700">
            {!hayCriterio
              ? 'Busca un material, SKU o filtra una familia para empezar a comparar'
              : `${itemsFiltrados.length} resultados ${soloComparables ? 'comparables' : 'encontrados'}${proveedorFiltro !== 'todos' ? ` para "${proveedorFiltro}"` : ''}`}
            {itemsFiltrados.length > 300 ? ` (mostrando 300)` : ''}
          </span>
          {busqueda && (
            <span className="text-[11px] text-slate-500 font-mono">
              Búsqueda: &quot;{busqueda}&quot;
            </span>
          )}
        </div>

        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[10px] z-10 shadow-xs">
              <tr>
                <th className="px-3 py-2.5">Proveedor</th>
                <th className="px-3 py-2.5">Descripción Material</th>
                <th className="px-3 py-2.5">Familia / Tipo</th>
                <th className="px-3 py-2.5 text-center">Cant. / UdM</th>
                <th className="px-3 py-2.5">Doc. Ref / Estado</th>
                <th className="px-3 py-2.5">Fecha</th>
                <th className="px-3 py-2.5 text-right">Precio Unitario</th>
                <th className="px-3 py-2.5 text-center">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!hayCriterio && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500 text-xs">
                    Escribe el material, SKU, referencia o clave SAT. El comparador evitará mezclar piezas distintas.
                  </td>
                </tr>
              )}
              {hayCriterio && itemsFiltrados.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400 text-xs">
                    No se encontraron insumos o compras que coincidan con los filtros aplicados.
                  </td>
                </tr>
              )}

              {hayCriterio && itemsFiltrados.slice(0, 300).map((it) => {
                const grupo = comparacionesPorItem.get(claveComparacion(it))
                const precioMxnActual = aMXN(
                  it.precioUnitario,
                  (it.moneda ?? 'MXN') as 'USD' | 'MXN',
                  usdToMxn
                )
                const esMejorPrecio =
                  grupo !== undefined &&
                  grupo.proveedores.size >= 2 &&
                  Math.abs(precioMxnActual - grupo.min) < 0.05

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
                const unidadTexto = it.unidad || it.odooUom || 'Pza'

                return (
                  <tr
                    key={it.id}
                    className={`hover:bg-sky-50/50 transition-colors cursor-pointer ${
                      esMejorPrecio ? 'bg-amber-50/40' : ''
                    }`}
                    onClick={() => setItemDetalle(it)}
                  >
                    {/* Proveedor */}
                    <td className="px-3 py-2.5 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[150px]" title={it.proveedorNombre}>
                          {it.proveedorNombre}
                        </span>
                      </div>
                    </td>

                    {/* Descripción & Detalles del Material */}
                    <td className="px-3 py-2.5 max-w-[260px]">
                      <p className="font-bold text-slate-900 truncate" title={it.descripcion}>
                        {it.descripcion}
                      </p>
                      <div className="flex flex-wrap items-center gap-1 mt-0.5">
                        {it.odooRefInterna && (
                          <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1 py-0 rounded border border-slate-200">
                            SKU: {it.odooRefInterna}
                          </span>
                        )}
                        {it.claveProdServ && (
                          <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-1 py-0 rounded border border-blue-200">
                            SAT: {it.claveProdServ}
                          </span>
                        )}
                        {it.odooCategoria && !it.odooRefInterna && !it.claveProdServ && (
                          <span className="text-[10px] text-slate-400 font-mono truncate max-w-[180px]">
                            {it.odooCategoria}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Familia / Tipo */}
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <Badge variant="outline" className="w-fit text-[10px] font-mono">
                          {obtenerCategoriaDef(it.categoriaId)?.etiqueta ?? it.categoriaId}
                        </Badge>
                        {(it.tipoInsumo || it.tipoMetal || it.medida) && (
                          <span className="text-[10px] text-slate-600 font-mono">
                            {[it.tipoInsumo ?? it.tipoMetal, it.medida].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Cantidad & UdM */}
                    <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-800">
                      <div className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md text-[11px] border border-slate-200">
                        <Package className="h-3 w-3 text-slate-500" />
                        <span>{it.cantidad} {unidadTexto}</span>
                      </div>
                    </td>

                    {/* Doc. Ref & Badge de Estado */}
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-[11px] font-bold text-slate-700 flex items-center gap-1">
                          <FileText className="h-3 w-3 text-slate-400" />
                          {it.referenciaDoc}
                        </span>

                        {it.fuente === 'factura' ? (
                          <span className="text-[9px] font-extrabold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded w-fit">
                            Factura
                          </span>
                        ) : it.esRfq ? (
                          <span className="text-[9px] font-extrabold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.2 rounded w-fit">
                            Cotización
                          </span>
                        ) : (
                          <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded w-fit">
                            Orden de compra
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Fecha */}
                    <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {it.fecha ?? '—'}
                    </td>

                    {/* Precio Unitario */}
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span
                          className={`font-mono font-extrabold text-sm ${
                            esMejorPrecio ? 'text-emerald-700' : 'text-slate-900'
                          }`}
                        >
                          {precioDisplay}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          / {unidadTexto}
                        </span>

                        {esMejorPrecio && (
                          <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[9px] px-1 py-0 font-extrabold flex items-center gap-1">
                            <Trophy className="h-2.5 w-2.5 text-amber-600" />
                            Mejor Precio
                          </Badge>
                        )}
                        {grupo && grupo.proveedores.size >= 2 && !esMejorPrecio && (
                          <span className="text-[9px] font-mono text-amber-700">
                            +{formatPrecio(precioMxnActual - grupo.min, 'MXN')} vs. mejor
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Acción */}
                    <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setItemDetalle(it)}
                          title="Ver ficha completa de la compra"
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
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
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal / Drawer Ficha de Detalle de Compra Odoo */}
      {itemDetalle && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 font-mono">
                  Ficha de Registro Odoo #{itemDetalle.odooDocId}
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-0.5">
                  {itemDetalle.descripcion}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setItemDetalle(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Proveedor
                </span>
                <p className="font-extrabold text-slate-900 text-sm">{itemDetalle.proveedorNombre}</p>
                <p className="text-[11px] text-slate-500 font-mono">Partner ID: #{itemDetalle.odooPartnerId}</p>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Documento Odoo
                </span>
                <p className="font-extrabold text-slate-900 text-sm">{itemDetalle.referenciaDoc}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {itemDetalle.fuente === 'factura' ? (
                    <Badge className="bg-purple-100 text-purple-800 border-purple-300 text-[10px]">Factura de Proveedor</Badge>
                  ) : itemDetalle.esRfq ? (
                    <Badge className="bg-sky-100 text-sky-800 border-sky-300 text-[10px]">Solicitud de Cotización (RFQ)</Badge>
                  ) : (
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">Orden de Compra Confirmada</Badge>
                  )}
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                  <Package className="h-3 w-3" /> Cantidad y Medida
                </span>
                <p className="font-extrabold text-slate-900 text-sm">
                  {itemDetalle.cantidad} {itemDetalle.unidad || itemDetalle.odooUom || 'Pieza'}
                </p>
                {itemDetalle.medida && (
                  <p className="text-[11px] text-slate-600 font-mono">Espec: {itemDetalle.medida}</p>
                )}
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Precio Unitario & Subtotal
                </span>
                <p className="font-extrabold text-emerald-700 text-sm font-mono">
                  {formatPrecio(itemDetalle.precioUnitario, itemDetalle.moneda === 'USD' ? 'USD' : 'MXN')}
                </p>
                <p className="text-[11px] text-slate-500 font-mono">
                  Subtotal: {formatPrecio(itemDetalle.subtotal, itemDetalle.moneda === 'USD' ? 'USD' : 'MXN')} {itemDetalle.moneda}
                </p>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1 font-mono">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                Fecha: {itemDetalle.fecha ?? 'Sin fecha'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleAgregar(itemDetalle)
                    setItemDetalle(null)
                  }}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" /> Agregar al Presupuesto
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

