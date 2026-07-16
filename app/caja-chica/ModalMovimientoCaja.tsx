import { useState } from 'react'
import { X } from 'lucide-react'
import { useCajaChica } from '@/lib/hooks/useCajaChica'
import type { MovimientoCajaChica, TipoMovimientoCaja, ComprobanteCaja } from '@/lib/schemas'
import { fechaHoyLocal } from '@/lib/format'

interface ModalProps {
  movimiento: MovimientoCajaChica | null
  onClose: () => void
}

const CATEGORIAS = [
  "Agua", "Telefonía", "Fletes", "Peaje/Puente", "Mantenimiento", 
  "Refacciones", "Herramienta", "Consumibles/Comida", "Posada/Evento", 
  "Limpieza/Basura", "Papelería", "Salud", "Yonque", "Reposición", "Otros"
]

export default function ModalMovimientoCaja({ movimiento, onClose }: ModalProps) {
  const isEditing = !!movimiento
  const { agregarMovimiento, actualizarMovimiento } = useCajaChica()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [tipo, setTipo] = useState<TipoMovimientoCaja>(movimiento?.tipo || 'SALIDA')
  const [fecha, setFecha] = useState(movimiento?.fecha || fechaHoyLocal())
  const [descripcion, setDescripcion] = useState(movimiento?.descripcion || '')
  const [proveedor, setProveedor] = useState(movimiento?.proveedor || '')
  const [categoria, setCategoria] = useState(movimiento?.categoria || '')
  const [solicitante, setSolicitante] = useState(movimiento?.solicitante || '')
  const [monto, setMonto] = useState(movimiento?.monto.toString() || '')
  const [comprobante, setComprobante] = useState<ComprobanteCaja>(movimiento?.comprobante || 'NINGUNO')
  const [deducible, setDeducible] = useState(movimiento?.deducible || false)

  const handleTipoChange = (nuevoTipo: TipoMovimientoCaja) => {
    setTipo(nuevoTipo)
    // Si es entrada, forzar algunos campos a vacío para no ensuciar
    if (nuevoTipo === 'ENTRADA') {
      setComprobante('NINGUNO')
      setDeducible(false)
      if (!isEditing) {
        setCategoria('Recarga de Caja')
        setDescripcion('Recarga')
      }
    } else if (!isEditing && categoria === 'Recarga de Caja') {
      setCategoria('')
      setDescripcion('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const montoNum = parseFloat(monto)
    if (isNaN(montoNum) || montoNum < 0) {
      setError("El monto debe ser un número válido mayor a 0.")
      setLoading(false)
      return
    }

    try {
      const payload = {
        fecha,
        periodo: fecha.substring(0, 7), // YYYY-MM
        descripcion,
        proveedor,
        categoria,
        solicitante,
        monto: montoNum,
        comprobante,
        deducible,
        tipo,
        costoReal: montoNum, // En el futuro se puede agregar cálculo si descuentan IVA
        ivaEstimado: deducible ? parseFloat((montoNum * 0.16).toFixed(2)) : 0, // Estimación básica
        verificado: movimiento?.verificado || false
      }

      if (isEditing) {
        await actualizarMovimiento(movimiento.id, payload)
      } else {
        await agregarMovimiento(payload)
      }
      onClose()
    } catch (err: unknown) {
      console.error(err)
      setError("Ocurrió un error al guardar el movimiento.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEditing ? 'Editar Movimiento' : 'Nuevo Movimiento'}
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-200">
              {error}
            </div>
          )}

          {/* Tipo de Movimiento Toggle */}
          <div className="flex bg-gray-100 p-1 rounded-lg w-fit">
            <button
              type="button"
              onClick={() => handleTipoChange('SALIDA')}
              className={`px-6 py-2 text-sm font-medium rounded-md transition-all ${
                tipo === 'SALIDA'
                  ? 'bg-white text-rose-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Gasto (Salida)
            </button>
            <button
              type="button"
              onClick={() => handleTipoChange('ENTRADA')}
              className={`px-6 py-2 text-sm font-medium rounded-md transition-all ${
                tipo === 'ENTRADA'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Recarga (Entrada)
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Fecha</label>
              <input
                type="date"
                required
                value={fecha}
                onChange={e => setFecha(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#0369A1] focus:border-[#0369A1]"
              />
            </div>
            
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Monto</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0"
                  value={monto}
                  onChange={e => setMonto(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#0369A1] focus:border-[#0369A1]"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Descripción</label>
              <input
                type="text"
                required
                value={descripcion}
                onChange={e => setDescripcion(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#0369A1] focus:border-[#0369A1]"
                placeholder="Ej. Recarga Telcel"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Proveedor / Lugar</label>
              <input
                type="text"
                required
                value={proveedor}
                onChange={e => setProveedor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#0369A1] focus:border-[#0369A1]"
                placeholder="Ej. Oxxo"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Categoría</label>
              <input
                type="text"
                list="categorias-caja"
                required
                value={categoria}
                onChange={e => setCategoria(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#0369A1] focus:border-[#0369A1]"
                placeholder="Selecciona o escribe..."
              />
              <datalist id="categorias-caja">
                {CATEGORIAS.map(c => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">Solicitante</label>
              <input
                type="text"
                required
                value={solicitante}
                onChange={e => setSolicitante(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#0369A1] focus:border-[#0369A1]"
                placeholder="¿Quién pidió el dinero?"
              />
            </div>

            {tipo === 'SALIDA' && (
              <>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">Tipo de Comprobante</label>
                  <select
                    value={comprobante}
                    onChange={e => setComprobante(e.target.value as ComprobanteCaja)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#0369A1] focus:border-[#0369A1]"
                  >
                    <option value="NINGUNO">Ninguno</option>
                    <option value="TICKET">Ticket</option>
                    <option value="VALE">Vale</option>
                    <option value="FACTURA">Factura</option>
                  </select>
                </div>

                <div className="space-y-1 flex items-center h-full pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deducible}
                      onChange={e => setDeducible(e.target.checked)}
                      className="h-4 w-4 text-[#0369A1] focus:ring-[#0369A1] border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">Es Deducible</span>
                  </label>
                </div>
              </>
            )}
          </div>

          <div className="pt-6 border-t border-gray-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0369A1]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-[#0369A1] border border-transparent rounded-md hover:bg-[#0284C7] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0369A1] disabled:opacity-50"
            >
              {loading ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Registrar Movimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
