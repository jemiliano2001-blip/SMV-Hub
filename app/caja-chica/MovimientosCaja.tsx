/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 · tone: utilitario · scope: movimientos-caja */
'use client'

import { useState, useMemo } from 'react'
import { useCajaChica } from '@/lib/hooks/useCajaChica'
import { Plus, Search, Trash2, Edit2, CheckCircle, FileText, Filter, AlertTriangle, UserCheck } from 'lucide-react'
import ModalMovimientoCaja from './ModalMovimientoCaja'
import type { MovimientoCajaChica } from '@/lib/schemas'

type FiltroTipo = 'TODOS' | 'ENTRADA' | 'SALIDA'
type FiltroEstado = 'TODOS' | 'VERIFICADO' | 'PENDIENTE'

// Regla de negocio: caja chica siempre es MXN.
const formatearDinero = (monto: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(monto)

type AccionesMovimiento = {
  m: MovimientoCajaChica
  onVerificar: (m: MovimientoCajaChica) => void
  onEditar: (m: MovimientoCajaChica) => void
  onBorrar: (m: MovimientoCajaChica) => void
}

function MovimientoRow({ m, onVerificar, onEditar, onBorrar }: AccionesMovimiento) {
  const isVale = m.comprobante === 'VALE'
  return (
    <tr className={`hover:bg-slate-50/80 transition-colors text-xs ${isVale ? 'bg-amber-50/30' : ''}`}>
      <td className="px-3 py-2.5 font-mono text-slate-700">{m.fecha}</td>
      <td className="px-3 py-2.5 font-medium text-slate-900 max-w-[220px] truncate" title={m.descripcion}>
        <span>{m.descripcion}</span>
        {isVale && (
          <span className="ml-2 bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold">
            VALE PENDIENTE
          </span>
        )}
      </td>
      <td className="px-3 py-2.5 text-slate-600">{m.proveedor}</td>
      <td className="px-3 py-2.5 text-slate-600">
        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200 text-[11px] font-medium">
          {m.categoria}
        </span>
      </td>
      <td className="px-3 py-2.5 text-slate-600">{m.solicitante}</td>
      <td className="px-3 py-2.5 text-slate-600 font-mono text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className={isVale ? 'text-amber-700 font-bold' : ''}>{m.comprobante}</span>
          {m.archivoUrl && (
            <a
              href={m.archivoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#0369A1] hover:text-sky-800 flex items-center gap-0.5 shrink-0"
              title="Ver comprobante digital"
            >
              <FileText className="h-3.5 w-3.5" />
            </a>
          )}
          {m.deducible && (
            <span className="text-[9px] font-bold text-sky-700 bg-sky-50 px-1 py-0.2 rounded border border-sky-200">
              DED
            </span>
          )}
        </div>
      </td>
      <td className="px-3 py-2.5 text-right text-emerald-700 font-mono font-semibold tabular-nums">
        {m.tipo === 'ENTRADA' ? formatearDinero(m.monto) : '—'}
      </td>
      <td className="px-3 py-2.5 text-right text-rose-700 font-mono font-semibold tabular-nums">
        {m.tipo === 'SALIDA' ? formatearDinero(m.monto) : '—'}
      </td>
      <td className="px-3 py-2.5 text-center">
        <button
          onClick={() => onVerificar(m)}
          className={`transition-transform active:scale-90 ${m.verificado ? 'text-emerald-600' : 'text-slate-300 hover:text-slate-400'}`}
          title={m.verificado ? 'Verificado' : 'Marcar como verificado'}
        >
          <CheckCircle className="h-4.5 w-4.5 mx-auto" />
        </button>
      </td>
      <td className="px-3 py-2.5 text-right">
        <div className="flex justify-end gap-1">
          <button
            onClick={() => onEditar(m)}
            className="p-1 text-slate-400 hover:text-[#0369A1] hover:bg-sky-50 rounded transition-colors"
            title="Editar"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onBorrar(m)}
            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}

function MovimientoCard({ m, onVerificar, onEditar, onBorrar }: AccionesMovimiento) {
  const isVale = m.comprobante === 'VALE'
  return (
    <div className={`p-3.5 border rounded-lg shadow-xs space-y-2.5 mb-2.5 ${isVale ? 'bg-amber-50/40 border-amber-200' : 'bg-white border-slate-200'}`}>
      <div className="flex justify-between items-start gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-slate-500">{m.fecha}</span>
            {isVale && <span className="bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold">VALE</span>}
          </div>
          <h4 className="text-xs font-bold text-slate-900 mt-0.5 break-words">{m.descripcion}</h4>
        </div>
        <span className={`text-xs font-mono font-bold shrink-0 tabular-nums ${m.tipo === 'ENTRADA' ? 'text-emerald-700' : 'text-rose-700'}`}>
          {m.tipo === 'ENTRADA' ? '+' : '-'}{formatearDinero(m.monto)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="min-w-0">
          <span className="text-slate-400 block text-[10px] uppercase font-mono">Proveedor</span>
          <span className="text-slate-800 truncate block font-medium">{m.proveedor}</span>
        </div>
        <div className="min-w-0">
          <span className="text-slate-400 block text-[10px] uppercase font-mono">Categoría</span>
          <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-medium w-fit block truncate">
            {m.categoria}
          </span>
        </div>
        <div className="min-w-0">
          <span className="text-slate-400 block text-[10px] uppercase font-mono">Comprobante</span>
          <div className="flex items-center gap-1">
            <span className={isVale ? 'text-amber-800 font-bold' : 'text-slate-800'}>{m.comprobante}</span>
            {m.archivoUrl && (
              <a href={m.archivoUrl} target="_blank" rel="noopener noreferrer" className="text-[#0369A1]">
                <FileText className="h-3 w-3" />
              </a>
            )}
            {m.deducible && <span className="text-[9px] text-sky-700 bg-sky-50 px-1 py-0.2 rounded border border-sky-200">DED</span>}
          </div>
        </div>
        <div className="min-w-0">
          <span className="text-slate-400 block text-[10px] uppercase font-mono">Solicitante</span>
          <span className="text-slate-800 truncate block font-medium">{m.solicitante}</span>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
        <button
          onClick={() => onVerificar(m)}
          className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded transition-colors ${m.verificado ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          {m.verificado ? 'Verificado' : 'Pendiente'}
        </button>
        <div className="flex gap-1">
          <button
            onClick={() => onEditar(m)}
            className="p-1 text-slate-400 hover:text-[#0369A1] hover:bg-sky-50 rounded"
            title="Editar"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onBorrar(m)}
            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

function SkeletonRow() {
  return (
    <tr>
      <td colSpan={10} className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-4">
          <div className="h-3.5 bg-slate-200 rounded w-16 animate-pulse"></div>
          <div className="h-3.5 bg-slate-200 rounded w-48 animate-pulse"></div>
          <div className="h-3.5 bg-slate-200 rounded w-24 animate-pulse"></div>
          <div className="h-3.5 bg-slate-200 rounded w-20 animate-pulse"></div>
          <div className="h-3.5 bg-slate-200 rounded w-16 animate-pulse"></div>
          <div className="h-3.5 bg-slate-200 rounded w-16 animate-pulse"></div>
          <div className="h-3.5 bg-slate-200 rounded w-16 animate-pulse"></div>
          <div className="h-3.5 bg-slate-200 rounded w-16 animate-pulse"></div>
          <div className="h-5 w-5 bg-slate-200 rounded-full animate-pulse"></div>
          <div className="h-5 w-10 bg-slate-200 rounded animate-pulse"></div>
        </div>
      </td>
    </tr>
  )
}

export default function MovimientosCaja() {
  const [periodo, setPeriodo] = useState(() => {
    const hoy = new Date()
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
  })

  const { movimientos, loading, error, agregarMovimiento, borrarMovimiento, actualizarMovimiento } =
    useCajaChica(periodo)
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('TODOS')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('TODOS')

  const [modalOpen, setModalOpen] = useState(false)
  const [movimientoEditar, setMovimientoEditar] = useState<MovimientoCajaChica | null>(null)
  const [initialValores, setInitialValores] = useState<Partial<MovimientoCajaChica> | undefined>(undefined)
  const [movimientoABorrar, setMovimientoABorrar] = useState<MovimientoCajaChica | null>(null)

  const saldoPeriodo = useMemo(() => {
    return movimientos.reduce((acc, m) => {
      return m.tipo === 'ENTRADA' ? acc + m.monto : acc - m.monto
    }, 0)
  }, [movimientos])

  const handleEliminar = async () => {
    if (movimientoABorrar) {
      await borrarMovimiento(movimientoABorrar.id)
      setMovimientoABorrar(null)
    }
  }

  const handleToggleVerificado = async (mov: MovimientoCajaChica) => {
    await actualizarMovimiento(mov.id, { verificado: !mov.verificado })
  }

  const handleEditar = (mov: MovimientoCajaChica) => {
    setMovimientoEditar(mov)
    setInitialValores(undefined)
    setModalOpen(true)
  }

  const handleNuevoGasto = () => {
    setMovimientoEditar(null)
    setInitialValores({ tipo: 'SALIDA' })
    setModalOpen(true)
  }

  const handleNuevoVale = () => {
    setMovimientoEditar(null)
    setInitialValores({ 
      tipo: 'SALIDA', 
      comprobante: 'VALE',
      descripcion: 'Préstamo provisional para gasto',
      proveedor: 'Pendiente'
    })
    setModalOpen(true)
  }

  const filtrados = useMemo(() => {
    const query = busqueda.toLowerCase()
    return movimientos.filter(m => {
      const matchBusqueda = m.descripcion.toLowerCase().includes(query) ||
                            m.proveedor.toLowerCase().includes(query) ||
                            m.solicitante.toLowerCase().includes(query) ||
                            m.categoria.toLowerCase().includes(query)
      const matchTipo = filtroTipo === 'TODOS' || m.tipo === filtroTipo
      const matchEstado = filtroEstado === 'TODOS' ||
                         (filtroEstado === 'VERIFICADO' && m.verificado) ||
                         (filtroEstado === 'PENDIENTE' && !m.verificado)
      return matchBusqueda && matchTipo && matchEstado
    })
  }, [movimientos, busqueda, filtroTipo, filtroEstado])

  return (
    <div className="space-y-4 font-sans">
      {/* Header & Balance Utilitario */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <p className="text-xs font-mono font-medium text-slate-500 uppercase tracking-wider">Saldo acumulado del periodo</p>
          <p className={`text-2xl font-bold font-mono tracking-tight ${saldoPeriodo >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
            {formatearDinero(saldoPeriodo)}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={handleNuevoVale}
            className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-3.5 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 justify-center active:scale-[0.98]"
          >
            <UserCheck className="h-4 w-4" />
            Nuevo Vale (Préstamo)
          </button>
          <button
            onClick={handleNuevoGasto}
            className="bg-[#0369A1] hover:bg-[#0284C7] text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 justify-center shadow-xs active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Nuevo Movimiento
          </button>
        </div>
      </div>

      {/* Toolbar de Filtros Rápido */}
      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por descripción, proveedor..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:border-[#0369A1] focus:ring-1 focus:ring-[#0369A1] text-slate-900"
            />
          </div>
          <div className="flex flex-wrap sm:flex-nowrap gap-2">
            <div className="flex items-center gap-1.5 text-xs w-full sm:w-auto">
              <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value as FiltroTipo)}
                className="w-full sm:w-auto px-2.5 py-1.5 bg-white text-xs border border-slate-300 rounded-md focus:outline-none focus:border-[#0369A1]"
              >
                <option value="TODOS">Todos los Tipos</option>
                <option value="ENTRADA">Entradas</option>
                <option value="SALIDA">Salidas</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5 text-xs w-full sm:w-auto">
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}
                className="w-full sm:w-auto px-2.5 py-1.5 bg-white text-xs border border-slate-300 rounded-md focus:outline-none focus:border-[#0369A1]"
              >
                <option value="TODOS">Todos los Estados</option>
                <option value="VERIFICADO">Verificados</option>
                <option value="PENDIENTE">Pendientes</option>
              </select>
            </div>
            <input
              type="month"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="w-full sm:w-auto px-2.5 py-1.5 bg-white text-xs border border-slate-300 rounded-md focus:outline-none focus:border-[#0369A1] font-mono"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-lg text-xs flex items-center gap-2 font-medium">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Tabla Utilitaria para Escritorio */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-xl overflow-x-auto shadow-xs">
        <table className="w-full text-xs text-left whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-600 font-mono text-[11px] uppercase tracking-wider border-b border-slate-200">
            <tr>
              <th className="px-3 py-2.5">Fecha</th>
              <th className="px-3 py-2.5">Descripción</th>
              <th className="px-3 py-2.5">Proveedor</th>
              <th className="px-3 py-2.5">Categoría</th>
              <th className="px-3 py-2.5">Solicitante</th>
              <th className="px-3 py-2.5">Comprobante</th>
              <th className="px-3 py-2.5 text-right">Entrada</th>
              <th className="px-3 py-2.5 text-right">Salida</th>
              <th className="px-3 py-2.5 text-center">Verif.</th>
              <th className="px-3 py-2.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : filtrados.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-500 font-mono text-xs">
                  Sin movimientos registrados para el filtro seleccionado.
                </td>
              </tr>
            ) : (
              filtrados.map((m) => (
                <MovimientoRow
                  key={m.id}
                  m={m}
                  onVerificar={handleToggleVerificado}
                  onEditar={handleEditar}
                  onBorrar={setMovimientoABorrar}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Vista Móvil / Tarjetas Compactas */}
      <div className="md:hidden space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white p-4 border border-slate-200 rounded-lg animate-pulse h-28"></div>
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="bg-white p-6 border border-slate-200 rounded-lg text-center text-slate-500 text-xs font-mono">
            No hay movimientos.
          </div>
        ) : (
          filtrados.map((m) => (
            <MovimientoCard
              key={m.id}
              m={m}
              onVerificar={handleToggleVerificado}
              onEditar={handleEditar}
              onBorrar={setMovimientoABorrar}
            />
          ))
        )}
      </div>

      {/* Modal de Confirmación de Borrado */}
      {movimientoABorrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-5 border border-slate-200">
            <div className="flex items-center gap-2.5 text-rose-600 mb-3">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-sm font-bold text-slate-900">Confirmar Eliminación</h3>
            </div>
            <p className="text-slate-600 text-xs mb-5">
              ¿Eliminar el movimiento{' '}
              <span className="font-bold text-slate-900">&ldquo;{movimientoABorrar.descripcion}&rdquo;</span>{' '}
              por{' '}
              <span className="font-mono font-bold text-slate-900">{formatearDinero(movimientoABorrar.monto)}</span>?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setMovimientoABorrar(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminar}
                className="px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-md"
              >
                Sí, Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar */}
      {modalOpen && (
        <ModalMovimientoCaja
          movimiento={movimientoEditar}
          initialValores={initialValores}
          agregarMovimiento={agregarMovimiento}
          actualizarMovimiento={actualizarMovimiento}
          onClose={() => {
            setModalOpen(false)
            setMovimientoEditar(null)
          }}
        />
      )}
    </div>
  )
}
