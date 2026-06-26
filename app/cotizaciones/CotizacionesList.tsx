'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Loader2,
  AlertCircle,
  Search,
  ExternalLink,
  FileSearch,
} from 'lucide-react'
import type { Cotizacion, EstatusCotizacion, Ubicacion } from '@/lib/schemas'
import { formatPrecio, formatFecha } from '@/lib/format'
import { useCotizaciones } from '@/lib/hooks/useCotizaciones'

type FiltroUbicacion = 'todas' | Ubicacion
type FiltroEstatus = 'todos' | EstatusCotizacion

const ESTATUS_BADGE: Record<EstatusCotizacion, string> = {
  cotizado: 'bg-green-50 text-green-700 ring-green-600/20',
  cancelado: 'bg-red-50 text-red-700 ring-red-600/20',
  revisar: 'bg-yellow-50 text-yellow-800 ring-yellow-600/20',
}

export default function CotizacionesList() {
  const { cotizaciones, loading, error, fetchCotizaciones } = useCotizaciones()

  const [busqueda, setBusqueda] = useState('')
  const [filtroUbicacion, setFiltroUbicacion] = useState<FiltroUbicacion>('todas')
  const [filtroEstatus, setFiltroEstatus] = useState<FiltroEstatus>('todos')

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return cotizaciones.filter((c) => {
      if (filtroUbicacion !== 'todas' && c.ubicacion !== filtroUbicacion) return false
      if (filtroEstatus !== 'todos' && c.estatus !== filtroEstatus) return false
      if (q) {
        const heno = `${c.descripcion} ${c.numeroParte ?? ''} ${c.proveedor}`.toLowerCase()
        if (!heno.includes(q)) return false
      }
      return true
    })
  }, [cotizaciones, busqueda, filtroUbicacion, filtroEstatus])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-gray-200 shadow-xs">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500 mb-4" />
        <p className="text-gray-500 text-sm">Cargando cotizaciones…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-red-800">Error de carga</h3>
          <p className="text-sm text-red-700 mt-1">{error}</p>
          <button onClick={fetchCotizaciones} className="mt-3 text-xs font-semibold text-red-800 underline hover:text-red-900">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (cotizaciones.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-xl border border-gray-200 shadow-xs">
        <div className="mx-auto w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-4 text-gray-400">
          <FileSearch className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-gray-900">No hay cotizaciones</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
          Aún no hay cotizaciones registradas. Usa la pestaña <strong>Importar desde Sheet</strong> para cargar el histórico.
        </p>
      </div>
    )
  }

  const chip = (activo: boolean, onClick: () => void, label: string) => (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
        activo ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-4">
      {/* Buscador + filtros */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por descripción, no. de parte o proveedor…"
            className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 mr-1">Ubicación:</span>
          {chip(filtroUbicacion === 'todas', () => setFiltroUbicacion('todas'), 'Todas')}
          {chip(filtroUbicacion === 'MX', () => setFiltroUbicacion('MX'), 'México')}
          {chip(filtroUbicacion === 'USA', () => setFiltroUbicacion('USA'), 'EUA')}
          <span className="text-xs font-semibold text-gray-400 mx-1 ml-3">Estatus:</span>
          {chip(filtroEstatus === 'todos', () => setFiltroEstatus('todos'), 'Todos')}
          {chip(filtroEstatus === 'cotizado', () => setFiltroEstatus('cotizado'), 'Cotizado')}
          {chip(filtroEstatus === 'revisar', () => setFiltroEstatus('revisar'), 'Revisar')}
          {chip(filtroEstatus === 'cancelado', () => setFiltroEstatus('cancelado'), 'Cancelado')}
        </div>
        <p className="text-xs text-gray-500">
          {filtradas.length} de {cotizaciones.length} cotizaciones
        </p>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Fecha</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Solicitante</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Proveedor</th>
                <th className="px-4 py-3 font-semibold">Descripción</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">No. parte</th>
                <th className="px-4 py-3 font-semibold text-center">Ubic.</th>
                <th className="px-4 py-3 font-semibold text-center">Cant.</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">P. Unit.</th>
                <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Total</th>
                <th className="px-4 py-3 font-semibold">Estatus</th>
                <th className="px-4 py-3 font-semibold text-center">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtradas.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">{formatFecha(c.fecha)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{c.solicitante || '-'}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{c.proveedor}</td>
                  <td className="px-4 py-3 text-gray-900 min-w-[220px]">{c.descripcion}</td>
                  <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">{c.numeroParte || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${c.ubicacion === 'USA' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                      {c.ubicacion === 'USA' ? 'EUA' : 'MX'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">{c.cantidad ?? '-'}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{formatPrecio(c.precioUnitario, c.moneda)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">{formatPrecio(c.total, c.moneda)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${ESTATUS_BADGE[c.estatus]}`}>
                      {c.estatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {c.link && /^https?:\/\//i.test(c.link) ? (
                      <a href={c.link} target="_blank" rel="noopener noreferrer" className="inline-flex text-gray-500 hover:text-blue-600" title="Abrir enlace">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtradas.length === 0 && (
          <div className="text-center py-12 text-sm text-gray-500">
            Ninguna cotización coincide con la búsqueda.
          </div>
        )}
      </div>
    </div>
  )
}
