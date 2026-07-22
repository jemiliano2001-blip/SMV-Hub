import { useState } from 'react'
import { useSalidas } from '@/lib/hooks/useAlmacen'
import { useOperadores } from '@/lib/hooks/useOperadores'
import { Plus, Trash2, Search } from 'lucide-react'
import type { SalidaAlmacen } from '@/lib/schemas'
import { fechaHoyLocal } from '@/lib/format'

type SalidaCardProps = {
  s: SalidaAlmacen
  onEliminar: (id: string, desc: string) => void
}

// Tarjeta para < md: mismos datos que la fila de tabla, sin scroll horizontal.
function SalidaCard({ s, onEliminar }: SalidaCardProps) {
  return (
    <div className="p-4 space-y-2.5">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-500">{s.fecha}</p>
          <p className="text-sm font-semibold text-gray-900 break-words">{s.herramienta}</p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-gray-900">x{s.cantidad}</span>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center font-medium text-gray-600">
            {s.operador.charAt(0).toUpperCase()}
          </div>
          {s.operador}
        </div>
        <button onClick={() => onEliminar(s.id, s.herramienta)} className="p-1.5 text-gray-400 hover:text-red-500" title="Eliminar">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default function SalidasList() {
  const { salidas, loading: loadingSalidas, error, agregarSalida, borrarSalida } = useSalidas()
  const { activos: operadoresActivos, loading: loadingOps } = useOperadores()

  const [busqueda, setBusqueda] = useState('')
  const [agregando, setAgregando] = useState(false)

  // Form state
  const hoy = fechaHoyLocal()
  const [fecha, setFecha] = useState(hoy)
  const [herramienta, setHerramienta] = useState('')
  const [cantidad, setCantidad] = useState(1)
  const [operador, setOperador] = useState('')

  const filtradas = salidas.filter((s) => {
    if (!busqueda) return true
    const q = busqueda.toLowerCase()
    return s.herramienta.toLowerCase().includes(q) || s.operador.toLowerCase().includes(q)
  })

  async function handleAgregar(e: React.FormEvent) {
    e.preventDefault()
    if (!herramienta || !operador || cantidad < 1) return

    setAgregando(true)
    try {
      await agregarSalida({
        fecha,
        herramienta,
        cantidad,
        operador,
        cambio: null,
      })
      // Reset only tool and qty, keep date and operator
      setHerramienta('')
      setCantidad(1)
    } catch (err) {
      console.error('Error agregando salida:', err)
    } finally {
      setAgregando(false)
    }
  }

  async function handleEliminar(id: string, desc: string) {
    if (!confirm(`¿Eliminar la salida de "${desc}"?`)) return
    try {
      await borrarSalida(id)
    } catch (err) {
      console.error('Error eliminando salida:', err)
    }
  }

  if (loadingSalidas || loadingOps) {
    return <div className="animate-pulse h-64 bg-gray-100 rounded-lg"></div>
  }

  if (error) {
    return <div className="text-red-600 bg-red-50 p-4 rounded-lg text-sm">{error}</div>
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="flex items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por herramienta u operador..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
          />
        </div>
      </div>

      {/* Add Form */}
      <form onSubmit={handleAgregar} className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex flex-wrap items-end gap-3">
        <div className="w-32">
          <label className="block text-xs font-medium text-gray-500 mb-1">Fecha</label>
          <input
            type="date"
            required
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-emerald-600"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">Herramienta</label>
          <input
            type="text"
            required
            placeholder="Ej. Machuelo 1/4-20"
            value={herramienta}
            onChange={(e) => setHerramienta(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-emerald-600"
          />
        </div>
        <div className="w-24">
          <label className="block text-xs font-medium text-gray-500 mb-1">Cantidad</label>
          <input
            type="number"
            required
            min="1"
            value={cantidad}
            onChange={(e) => setCantidad(parseInt(e.target.value) || 1)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-emerald-600"
          />
        </div>
        <div className="w-48">
          <label className="block text-xs font-medium text-gray-500 mb-1">Operador</label>
          <select
            required
            value={operador}
            onChange={(e) => setOperador(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:border-emerald-600"
          >
            <option value="" disabled>Seleccionar...</option>
            {operadoresActivos.map(op => (
              <option key={op.id} value={op.nombre}>{op.nombre}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={agregando}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Registrar Salida
        </button>
      </form>

      {/* Table (desktop) */}
      <div className="hidden md:block overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 w-28">Fecha</th>
              <th className="px-4 py-3">Herramienta</th>
              <th className="px-4 py-3 w-24">Cantidad</th>
              <th className="px-4 py-3 w-48">Operador</th>
              <th className="px-4 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  {busqueda ? 'No se encontraron salidas' : 'No hay salidas registradas'}
                </td>
              </tr>
            ) : (
              filtradas.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-500">{s.fecha}</td>
                  <td className="px-4 py-2 font-medium text-gray-900">{s.herramienta}</td>
                  <td className="px-4 py-2 text-gray-700">{s.cantidad}</td>
                  <td className="px-4 py-2 text-gray-600 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                      {s.operador.charAt(0).toUpperCase()}
                    </div>
                    {s.operador}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => handleEliminar(s.id, s.herramienta)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Cards (mobile) */}
      <div className="md:hidden border border-gray-200 rounded-lg divide-y divide-gray-100">
        {filtradas.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">
            {busqueda ? 'No se encontraron salidas' : 'No hay salidas registradas'}
          </div>
        ) : (
          filtradas.map((s) => <SalidaCard key={s.id} s={s} onEliminar={handleEliminar} />)
        )}
      </div>
    </div>
  )
}
