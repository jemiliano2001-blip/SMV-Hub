import { useState } from 'react'
import { useCajaChica } from '@/lib/hooks/useCajaChica'
import { Plus, Search, Trash2, Edit2, CheckCircle } from 'lucide-react'
import ModalMovimientoCaja from './ModalMovimientoCaja'
import type { MovimientoCajaChica } from '@/lib/schemas'

export default function MovimientosCaja() {
  const [periodo, setPeriodo] = useState(() => {
    const hoy = new Date()
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  })
  
  const { movimientos, loading, error, borrarMovimiento, actualizarMovimiento } = useCajaChica(periodo)
  const [busqueda, setBusqueda] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [movimientoEditar, setMovimientoEditar] = useState<MovimientoCajaChica | null>(null)

  const handleEliminar = async (id: string, descripcion: string) => {
    if (confirm(`¿Estás seguro de eliminar el movimiento "${descripcion}"?`)) {
      await borrarMovimiento(id)
    }
  }

  const handleToggleVerificado = async (mov: MovimientoCajaChica) => {
    await actualizarMovimiento(mov.id, { verificado: !mov.verificado })
  }

  const filtro = busqueda.toLowerCase()
  const filtrados = movimientos.filter(m => 
    m.descripcion.toLowerCase().includes(filtro) ||
    m.proveedor.toLowerCase().includes(filtro) ||
    m.solicitante.toLowerCase().includes(filtro) ||
    m.categoria.toLowerCase().includes(filtro)
  )

  const formatearDinero = (monto: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar movimientos..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-[#0369A1]"
            />
          </div>
          <input
            type="month"
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-[#0369A1]"
          />
        </div>
        <button
          onClick={() => {
            setMovimientoEditar(null)
            setModalOpen(true)
          }}
          className="bg-[#0369A1] hover:bg-[#0284C7] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 w-full sm:w-auto justify-center"
        >
          <Plus className="h-4 w-4" />
          Nuevo Movimiento
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Descripción</th>
              <th className="px-4 py-3">Proveedor/Lugar</th>
              <th className="px-4 py-3">Categoría</th>
              <th className="px-4 py-3">Solicitante</th>
              <th className="px-4 py-3">Comprobante</th>
              <th className="px-4 py-3 text-right">Entrada</th>
              <th className="px-4 py-3 text-right">Salida</th>
              <th className="px-4 py-3 text-center">Verif.</th>
              <th className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                  <div className="animate-pulse flex justify-center">Cargando movimientos...</div>
                </td>
              </tr>
            ) : filtrados.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                  No se encontraron movimientos.
                </td>
              </tr>
            ) : (
              filtrados.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-900">{m.fecha}</td>
                  <td className="px-4 py-3 text-gray-900 max-w-[200px] truncate" title={m.descripcion}>
                    {m.descripcion}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{m.proveedor}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <span className="bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full text-xs font-medium">
                      {m.categoria}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{m.solicitante}</td>
                  <td className="px-4 py-3 text-gray-600 text-xs font-medium">
                    {m.comprobante}
                    {m.deducible && <span className="ml-2 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">DED</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                    {m.tipo === 'ENTRADA' ? formatearDinero(m.monto) : '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-rose-600 font-medium">
                    {m.tipo === 'SALIDA' ? formatearDinero(m.monto) : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button 
                      onClick={() => handleToggleVerificado(m)}
                      className={`hover:scale-110 transition-transform ${m.verificado ? 'text-emerald-500' : 'text-gray-300 hover:text-gray-400'}`}
                      title={m.verificado ? "Verificado" : "Marcar como verificado"}
                    >
                      <CheckCircle className="h-5 w-5 mx-auto" />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setMovimientoEditar(m)
                          setModalOpen(true)
                        }}
                        className="p-1.5 text-gray-400 hover:text-[#0369A1] hover:bg-blue-50 rounded-md transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEliminar(m.id, m.descripcion)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <ModalMovimientoCaja 
          movimiento={movimientoEditar}
          onClose={() => {
            setModalOpen(false)
            setMovimientoEditar(null)
          }} 
        />
      )}
    </div>
  )
}
