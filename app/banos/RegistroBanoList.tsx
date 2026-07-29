import { useState, useRef } from 'react'
import { authBypassActivo, useUsuario } from '@/lib/auth'
import { usePermisos } from '@/lib/hooks/useRol'
import { calcularMinutos, useBanos } from '@/lib/hooks/useBanos'
import { useOperadores } from '@/lib/hooks/useOperadores'
import type { Bano, RegistroBano } from '@/lib/schemas'
import {
  fechaHoyLocal,
  horaAhoraLocal,
  formatIndicadorCapturaBano,
} from '@/lib/format'
import { resolverOperadorActivo } from '@/lib/banos-captura'
import { Plus, Trash2, Check, Search, Pencil, X, Clock } from 'lucide-react'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'

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
  const { usuario } = useUsuario()
  const { esSuperAdmin } = usePermisos(authBypassActivo() ? null : usuario)
  const puedeEliminar = esSuperAdmin || authBypassActivo()

  const confirmar = useConfirmDialog()
  const {
    registros,
    loading: loadingBanos,
    error,
    fetchRegistros,
    registrarEntrada,
    registrarLlegada,
    actualizarHorario,
    borrarRegistro,
  } = useBanos()
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

  // Estado para modal de edición de horario
  const [editandoRegistro, setEditandoRegistro] = useState<RegistroBano | null>(null)
  const [editHoraEntrada, setEditHoraEntrada] = useState('')
  const [editHoraLlegada, setEditHoraLlegada] = useState('')
  const [guardandoEdit, setGuardandoEdit] = useState(false)
  const [errorEdit, setErrorEdit] = useState<string | null>(null)

  function abrirModalEditar(r: RegistroBano) {
    setEditandoRegistro(r)
    setEditHoraEntrada(r.horaEntrada)
    setEditHoraLlegada(r.horaLlegada || horaAhoraLocal())
    setErrorEdit(null)
  }

  async function handleGuardarHorario(e: React.FormEvent) {
    e.preventDefault()
    if (!editandoRegistro) return
    if (!editHoraEntrada || !editHoraLlegada) {
      setErrorEdit('Ingresa tanto la hora de entrada como la de llegada.')
      return
    }

    setGuardandoEdit(true)
    setErrorEdit(null)
    try {
      await actualizarHorario(editandoRegistro.id, editHoraEntrada, editHoraLlegada)
      const mins = calcularMinutos(editHoraEntrada, editHoraLlegada)
      setMensajeExito(
        `Horario de ${editandoRegistro.operador} actualizado a ${editHoraEntrada} - ${editHoraLlegada} (${mins} min)`
      )
      setEditandoRegistro(null)
    } catch (err) {
      console.error('Error guardando horario:', err)
      setErrorEdit('No se pudo actualizar el horario. Intenta de nuevo.')
    } finally {
      setGuardandoEdit(false)
    }
  }

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
    const aceptado = await confirmar({
      title: 'Eliminar registro de baño',
      description: `Se eliminará el registro de ${op}.`,
      confirmLabel: 'Eliminar',
      variant: 'destructive',
    })
    if (!aceptado) return
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
    return (
      <div className="text-red-600 bg-red-50 border border-red-200 p-4 rounded-lg text-sm space-y-2">
        <p>{error}</p>
        <button onClick={fetchRegistros} className="font-semibold underline hover:no-underline">Reintentar</button>
      </div>
    )
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
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-[560px] w-full text-left text-xs">
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
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => abrirModalEditar(r)}
                            title="Editar hora de entrada"
                            className="text-xs font-semibold text-[#0369A1] bg-sky-50 hover:bg-sky-100 border border-sky-200/80 px-2 py-0.5 rounded-md inline-flex items-center gap-1 transition-colors"
                          >
                            <Pencil className="h-3 w-3" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLlegada(r.id, r.horaEntrada)}
                            className="text-xs font-medium bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-2.5 py-1 rounded-md inline-flex items-center gap-1 transition-colors"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Llegó
                          </button>
                        </div>
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
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-[560px] w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2">Operador</th>
                  <th className="px-4 py-2">Baño</th>
                  <th className="px-4 py-2 w-32">Horario</th>
                  <th className="px-4 py-2 w-20 text-right">Total</th>
                  <th className="px-4 py-2 w-16 text-right">Acciones</th>
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
                      <td
                        onClick={() => abrirModalEditar(r)}
                        className="px-4 py-2 text-gray-600 text-xs tracking-tighter cursor-pointer hover:text-[#0369A1] hover:underline"
                        title="Clic para editar horario"
                      >
                        {r.horaEntrada} - {r.horaLlegada}
                      </td>
                      <td className="px-4 py-2 text-right font-medium text-gray-900">
                        {r.tiempoMinutos} m
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => abrirModalEditar(r)}
                            title="Editar hora que llegó / horario"
                            className="text-xs font-semibold text-[#0369A1] bg-sky-50 hover:bg-sky-100 border border-sky-200/80 px-2 py-0.5 rounded-md inline-flex items-center gap-1 transition-colors"
                          >
                            <Pencil className="h-3 w-3" />
                            Editar
                          </button>
                          {puedeEliminar && (
                            <button
                              type="button"
                              onClick={() => handleEliminar(r.id, r.operador)}
                              title="Eliminar registro (Solo Super Admin)"
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal de edición de horario */}
      {editandoRegistro && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Editar Horario de Registro</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editandoRegistro.operador} — <span className="font-medium text-slate-700">{editandoRegistro.bano}</span> ({editandoRegistro.fecha})
                </p>
              </div>
              <button
                onClick={() => setEditandoRegistro(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {errorEdit && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-2.5 rounded-lg text-xs">
                {errorEdit}
              </div>
            )}

            <form onSubmit={handleGuardarHorario} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    Hora Entrada
                  </label>
                  <input
                    type="time"
                    required
                    value={editHoraEntrada}
                    onChange={(e) => setEditHoraEntrada(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0369A1]/20 focus:border-[#0369A1]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    Hora Llegada
                  </label>
                  <input
                    type="time"
                    required
                    value={editHoraLlegada}
                    onChange={(e) => setEditHoraLlegada(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0369A1]/20 focus:border-[#0369A1]"
                  />
                </div>
              </div>

              {/* Dynamic preview badge */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Duración recalculada:</span>
                <span className="font-bold text-[#0369A1] text-sm bg-sky-50 border border-sky-200/60 px-2 py-0.5 rounded">
                  {editHoraEntrada && editHoraLlegada ? `${calcularMinutos(editHoraEntrada, editHoraLlegada)} min` : '--'}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditandoRegistro(null)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoEdit}
                  className="px-4 py-1.5 text-xs font-semibold bg-[#0369A1] hover:bg-[#0284C7] text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                >
                  {guardandoEdit ? 'Guardando...' : 'Guardar Horario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

