import { useState, useRef } from 'react'
import { useBanos } from '@/lib/hooks/useBanos'
import { useOperadores } from '@/lib/hooks/useOperadores'
import type { Bano } from '@/lib/schemas'
import {
  fechaHoyLocal,
  horaAhoraLocal,
  formatIndicadorCapturaBano,
} from '@/lib/format'
import { resolverOperadorActivo } from '@/lib/banos-captura'
import { Plus, Trash2, Check, Search } from 'lucide-react'

const BANOS: Bano[] = ['Baño #1', 'Baño #2', 'CNC', 'Automatizacion']

const AREA_COLORS: Record<string, string> = {
  taller: 'bg-blue-100 text-blue-700',
  diseno: 'bg-purple-100 text-purple-700',
  automatizacion: 'bg-emerald-100 text-emerald-700',
  cnc: 'bg-amber-100 text-amber-700',
  limpieza: 'bg-gray-100 text-gray-600',
  administracion: 'bg-rose-100 text-rose-700',
}

function getInitials(name: string) {
  return name.trim().split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
}

export default function RegistroBanoList() {
  const { registros, loading: loadingBanos, error, registrarEntrada, registrarLlegada, borrarRegistro } = useBanos()
  const { activos: operadoresActivos, loading: loadingOps } = useOperadores()

  const [agregando, setAgregando] = useState(false)
  const [errorDuplicado, setErrorDuplicado] = useState<string | null>(null)
  const [errorCaptura, setErrorCaptura] = useState<string | null>(null)
  const [mensajeExito, setMensajeExito] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const [bano, setBano] = useState<Bano | null>(null)
  const [operador, setOperador] = useState('')
  const [indicadorHora, setIndicadorHora] = useState(() => new Date())
  const operadorInputRef = useRef<HTMLInputElement>(null)

  const fechaHoy = fechaHoyLocal()

  const yaEnCurso = operador
    ? registros.some((r) => r.fecha === fechaHoy && r.operador === operador.trim() && !r.horaLlegada)
    : false

  async function handleAgregar(e: React.FormEvent) {
    e.preventDefault()
    setMensajeExito(null)
    setErrorCaptura(null)
    setErrorDuplicado(null)

    if (!bano) {
      setErrorCaptura('Selecciona un baño primero')
      return
    }

    const op = resolverOperadorActivo(operador, operadoresActivos)
    if (!op) {
      setErrorCaptura('Operador no encontrado en el catálogo')
      return
    }

    if (
      registros.some(
        (r) => r.fecha === fechaHoy && r.operador === op.nombre && !r.horaLlegada
      )
    ) {
      setErrorDuplicado(
        `${op.nombre} ya tiene un registro abierto hoy. Marca "Llegó" antes de registrar otro.`
      )
      return
    }

    const ahora = new Date()
    const fecha = fechaHoyLocal(ahora)
    const horaEntrada = horaAhoraLocal(ahora)

    setAgregando(true)
    try {
      await registrarEntrada({ fecha, operador: op.nombre, bano, horaEntrada })
      setMensajeExito(`${op.nombre} registrado — ${bano}, ${horaEntrada}`)
      setOperador('')
      setIndicadorHora(ahora)
      setTimeout(() => operadorInputRef.current?.focus(), 0)
    } catch (err) {
      console.error('Error registrando entrada:', err)
      setErrorCaptura('No se pudo registrar la entrada. Intenta de nuevo.')
    } finally {
      setAgregando(false)
    }
  }

  async function handleLlegada(id: string, horaOriginal: string) {
    const horaLlegada = horaAhoraLocal()
    try {
      await registrarLlegada(id, horaLlegada, horaOriginal)
    } catch (err) {
      console.error('Error registrando llegada:', err)
      setErrorCaptura('No se pudo registrar la llegada. Intenta de nuevo.')
    }
  }

  async function handleEliminar(id: string, op: string) {
    if (!confirm(`¿Eliminar el registro de ${op}?`)) return
    try {
      await borrarRegistro(id)
    } catch (err) {
      console.error('Error eliminando registro:', err)
    }
  }

  if (loadingBanos || loadingOps) {
    return <div className="animate-pulse h-64 bg-gray-100 rounded-lg"></div>
  }

  if (error) {
    return <div className="text-red-600 bg-red-50 p-4 rounded-lg text-sm">{error}</div>
  }

  const registrosHoy = registros.filter(r => r.fecha === fechaHoy)
  const enCursoTodos = registrosHoy.filter(r => !r.horaLlegada)
  const terminadosTodos = registrosHoy.filter(r => r.horaLlegada)

  const enCursoOrdenados = [...enCursoTodos].sort((a, b) =>
    b.horaEntrada.localeCompare(a.horaEntrada)
  )

  const filtro = busqueda.trim().toLowerCase()
  const enCurso = filtro ? enCursoOrdenados.filter(r => r.operador.toLowerCase().includes(filtro)) : enCursoOrdenados
  const terminados = filtro ? terminadosTodos.filter(r => r.operador.toLowerCase().includes(filtro)) : terminadosTodos

  const totalMinutos = terminadosTodos.reduce((acc, curr) => acc + (curr.tiempoMinutos || 0), 0)
  const promedio = terminadosTodos.length ? Math.round(totalMinutos / terminadosTodos.length) : 0
  const maxTiempo = terminadosTodos.length ? Math.max(...terminadosTodos.map(t => t.tiempoMinutos || 0)) : 0
  const personaMax = terminadosTodos.find(t => t.tiempoMinutos === maxTiempo)?.operador || ''

  return (
    <div className="space-y-8">
      {terminadosTodos.length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm bg-blue-50 text-blue-800 p-3 rounded-lg border border-blue-100">
          <div><strong>Promedio hoy:</strong> {promedio} min</div>
          <div className="w-px bg-blue-200 hidden sm:block"></div>
          <div><strong>Persona con más tiempo:</strong> {personaMax} ({maxTiempo} min)</div>
        </div>
      )}

      {mensajeExito && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-emerald-800 text-sm">
          {mensajeExito}
        </div>
      )}
      {errorCaptura && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-red-700 text-sm">
          {errorCaptura}
        </div>
      )}
      {errorDuplicado && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 text-amber-700 text-sm">
          {errorDuplicado}
        </div>
      )}

      <form
        onSubmit={handleAgregar}
        className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3"
      >
        <div className="flex flex-wrap gap-2">
          <span className="text-xs font-medium text-gray-500 w-full sm:w-auto sm:self-center">
            Baño / Área
          </span>
          {BANOS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => {
                setBano(b)
                setErrorCaptura(null)
              }}
              className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
                bano === b
                  ? 'bg-[#0369A1] text-white border-[#0369A1]'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-[#0369A1]/50'
              }`}
            >
              {b}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-64">
            <label className="block text-xs font-medium text-gray-500 mb-1">Operador</label>
            <input
              list="operadores-list"
              ref={operadorInputRef}
              required
              placeholder="Buscar o escribir..."
              value={operador}
              onChange={(e) => {
                setOperador(e.target.value)
                setErrorDuplicado(null)
                setErrorCaptura(null)
              }}
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:border-[#0369A1]"
            />
            <datalist id="operadores-list">
              {operadoresActivos.map(op => (
                <option key={op.id} value={op.nombre} />
              ))}
            </datalist>
            <p className="mt-1 text-xs text-gray-500">
              {formatIndicadorCapturaBano(indicadorHora)}
            </p>
          </div>

          <button
            type="submit"
            disabled={agregando || yaEnCurso || !bano}
            title={
              yaEnCurso
                ? `${operador} ya tiene un registro abierto hoy`
                : !bano
                  ? 'Selecciona un baño primero'
                  : undefined
            }
            className="bg-[#0369A1] hover:bg-[#0284C7] text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 sm:ml-auto"
          >
            <Plus className="h-4 w-4" />
            Registrar Entrada
          </button>
        </div>
      </form>

      <div className="relative w-full sm:w-64">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar operador..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-[#0369A1]"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            En el baño ({enCurso.length})
          </h3>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2">Operador</th>
                  <th className="px-4 py-2">Baño</th>
                  <th className="px-4 py-2 w-20">Entrada</th>
                  <th className="px-4 py-2 w-28 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {enCurso.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-gray-500 text-xs">
                      {filtro && enCursoTodos.length > 0 ? 'Sin coincidencias' : 'Nadie en el baño'}
                    </td>
                  </tr>
                ) : (
                  enCurso.map((r) => (
                    <tr key={r.id} className="hover:bg-amber-50/50">
                      <td className="px-4 py-2 font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${AREA_COLORS[operadoresActivos.find(o => o.nombre === r.operador)?.area || 'taller'] || 'bg-gray-100 text-gray-600'}`}>
                            {getInitials(r.operador)}
                          </div>
                          {r.operador}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-gray-600">{r.bano}</td>
                      <td className="px-4 py-2 text-gray-900">{r.horaEntrada}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleLlegada(r.id, r.horaEntrada)}
                          className="text-xs font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-2.5 py-1 rounded-md inline-flex items-center gap-1 transition-colors"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Llegó
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-300"></span>
            Completados hoy ({terminados.length})
          </h3>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2">Operador</th>
                  <th className="px-4 py-2">Baño</th>
                  <th className="px-4 py-2 w-32">Horario</th>
                  <th className="px-4 py-2 w-20 text-right">Total</th>
                  <th className="px-4 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {terminados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500 text-xs">
                      {filtro && terminadosTodos.length > 0 ? 'Sin coincidencias' : 'No hay registros completados'}
                    </td>
                  </tr>
                ) : (
                  terminados.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-900">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold ${AREA_COLORS[operadoresActivos.find(o => o.nombre === r.operador)?.area || 'taller'] || 'bg-gray-100 text-gray-600'}`}>
                            {getInitials(r.operador)}
                          </div>
                          {r.operador}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-gray-500 text-xs">{r.bano}</td>
                      <td className="px-4 py-2 text-gray-500 text-xs tracking-tighter">
                        {r.horaEntrada} - {r.horaLlegada}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-gray-900">
                        {r.tiempoMinutos} m
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleEliminar(r.id, r.operador)}
                          className="text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
