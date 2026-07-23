'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useHorasExtra } from '@/lib/hooks/useHorasExtra'
import { useOperadores } from '@/lib/hooks/useOperadores'
import { areaCorrespondeDepartamento } from '@/lib/operadores-departamento'
import { progresoSemana } from '@/lib/horas-extra-resumen'
import type { Departamento, HorasExtra } from '@/lib/schemas'
import {
  DIAS_SEMANA,
  type DiaSemana,
  parseHorasConEstado,
  etiquetaDia,
  intensidadHeatmap,
  CHIPS_RAPIDOS,
  calcularTotalHoras,
} from '@/lib/horas-extra-parse'
import {
  Plus,
  Trash2,
  AlertTriangle,
  Users,
  Copy,
  Check,
  Loader2,
} from 'lucide-react'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'

interface Props {
  departamento: Departamento
  semanaInicio: string
}

type CampoEditable = DiaSemana | 'notas'
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const FIN_DE_SEMANA = new Set<DiaSemana>(['sabado', 'domingo'])

export default function HorasExtraGrid({ departamento, semanaInicio }: Props) {
  const confirmar = useConfirmDialog()
  const {
    registros,
    loading,
    error,
    agregarRegistro,
    editarDias,
    borrarRegistro,
    cargarEquipo,
    copiarSemanaAnterior,
  } = useHorasExtra(semanaInicio, departamento)
  const { operadores, loading: loadingOps } = useOperadores()

  const [nuevoEmpleado, setNuevoEmpleado] = useState('')
  const [agregando, setAgregando] = useState(false)
  const [accionLote, setAccionLote] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  const [activeCell, setActiveCell] = useState<{
    rowId: string
    field: CampoEditable
  } | null>(null)
  const [draft, setDraft] = useState('')
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({})

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const operadoresDept = operadores.filter(
    (op) => op.activo && areaCorrespondeDepartamento(op.area, departamento)
  )

  const { conHoras, total } = progresoSemana(registros)

  useEffect(() => {
    if (activeCell && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [activeCell])

  const guardarCelda = useCallback(
    async (rowId: string, field: CampoEditable, valor: string) => {
      const reg = registros.find((r) => r.id === rowId)
      if (!reg) return

      const normalizado = valor.trim() === '' ? null : valor.trim()
      const actual = field === 'notas' ? reg.notas : reg[field]
      if (actual === normalizado || (actual == null && normalizado == null)) return

      setSaveStatus((s) => ({ ...s, [rowId]: 'saving' }))
      try {
        await editarDias(rowId, { [field]: normalizado })
        setSaveStatus((s) => ({ ...s, [rowId]: 'saved' }))
        setTimeout(() => {
          setSaveStatus((s) => ({ ...s, [rowId]: 'idle' }))
        }, 1500)
      } catch {
        setSaveStatus((s) => ({ ...s, [rowId]: 'error' }))
      }
    },
    [registros, editarDias]
  )

  function iniciarEdicion(reg: HorasExtra, field: CampoEditable) {
    const valor = field === 'notas' ? reg.notas : reg[field]
    setActiveCell({ rowId: reg.id, field })
    setDraft(valor ?? '')
  }

  function cerrarEdicion(guardar = true) {
    if (!activeCell) return
    const { rowId, field } = activeCell
    if (guardar) {
      void guardarCelda(rowId, field, draft)
    }
    setActiveCell(null)
    setDraft('')
  }

  function programarGuardado(rowId: string, field: CampoEditable, valor: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void guardarCelda(rowId, field, valor)
    }, 400)
  }

  function siguienteCelda(
    rowId: string,
    field: CampoEditable,
    direccion: 'next' | 'prev' | 'down'
  ) {
    const rowIndex = registros.findIndex((r) => r.id === rowId)
    if (rowIndex < 0) return

    const campos: CampoEditable[] = [...DIAS_SEMANA, 'notas']
    const colIndex = campos.indexOf(field)

    if (direccion === 'down') {
      const nextRow = registros[rowIndex + 1]
      if (nextRow) iniciarEdicion(nextRow, field)
      return
    }

    const delta = direccion === 'next' ? 1 : -1
    let ni = rowIndex
    let ci = colIndex + delta

    if (ci >= campos.length) {
      ni += 1
      ci = 0
    } else if (ci < 0) {
      ni -= 1
      ci = campos.length - 1
    }

    const nextReg = registros[ni]
    if (nextReg) iniciarEdicion(nextReg, campos[ci])
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!activeCell) return

    if (e.key === 'Enter') {
      e.preventDefault()
      cerrarEdicion(true)
      siguienteCelda(activeCell.rowId, activeCell.field, 'down')
    } else if (e.key === 'Tab') {
      e.preventDefault()
      cerrarEdicion(true)
      siguienteCelda(activeCell.rowId, activeCell.field, e.shiftKey ? 'prev' : 'next')
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setActiveCell(null)
      setDraft('')
    }
  }

  async function handleAgregar(e: React.FormEvent) {
    e.preventDefault()
    if (!nuevoEmpleado) return
    setAgregando(true)
    setMensaje(null)
    try {
      await agregarRegistro({
        empleado: nuevoEmpleado,
        departamento,
        semanaInicio,
        miercoles: null,
        jueves: null,
        viernes: null,
        sabado: null,
        domingo: null,
        lunes: null,
        martes: null,
        notas: null,
      })
      setNuevoEmpleado('')
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : 'No se pudo agregar')
    } finally {
      setAgregando(false)
    }
  }

  async function handleCargarEquipo() {
    setAccionLote('equipo')
    setMensaje(null)
    try {
      const n = await cargarEquipo(operadores)
      setMensaje(n > 0 ? `Se agregaron ${n} empleados` : 'El equipo ya está en la semana')
    } catch {
      setMensaje('Error al cargar el equipo')
    } finally {
      setAccionLote(null)
    }
  }

  async function handleCopiarSemana() {
    setAccionLote('copiar')
    setMensaje(null)
    try {
      const n = await copiarSemanaAnterior(false)
      setMensaje(
        n > 0 ? `Se copiaron ${n} empleados de la semana anterior` : 'No hay empleados nuevos que copiar'
      )
    } catch {
      setMensaje('Error al copiar la semana anterior')
    } finally {
      setAccionLote(null)
    }
  }

  async function handleEliminar(id: string, nombre: string) {
    const aceptado = await confirmar({
      title: 'Remover registro semanal',
      description: `Se removerá a ${nombre} de esta semana.`,
      confirmLabel: 'Remover',
      variant: 'destructive',
    })
    if (!aceptado) return
    try {
      await borrarRegistro(id)
    } catch (err) {
      console.error('Error eliminando:', err)
    }
  }

  function aplicarChip(valor: string) {
    if (!activeCell) return
    setDraft(valor)
    programarGuardado(activeCell.rowId, activeCell.field, valor)
  }

  if (loading || loadingOps) {
    return <div className="animate-pulse h-64 bg-gray-100 rounded-lg" />
  }

  if (error) {
    return <div className="text-red-600 bg-red-50 p-4 rounded-lg text-sm">{error}</div>
  }

  return (
    <div className="space-y-4">
      {/* Acciones y progreso */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleCargarEquipo()}
            disabled={accionLote !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {accionLote === 'equipo' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            Cargar equipo
          </button>
          <button
            type="button"
            onClick={() => void handleCopiarSemana()}
            disabled={accionLote !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {accionLote === 'copiar' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            Copiar semana anterior
          </button>
        </div>
        {total > 0 && (
          <div className="text-sm text-gray-600">
            <span className="font-medium text-[#0369A1]">{conHoras}/{total}</span> empleados con horas
            <div className="mt-1 w-48 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#0369A1] rounded-full transition-all"
                style={{ width: `${total > 0 ? (conHoras / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {mensaje && (
        <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
          {mensaje}
        </p>
      )}

      {/* Agregar empleado */}
      <form onSubmit={handleAgregar} className="flex gap-3 max-w-md">
        <select
          required
          value={nuevoEmpleado}
          onChange={(e) => setNuevoEmpleado(e.target.value)}
          className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:border-[#0369A1]"
        >
          <option value="" disabled>
            Agregar empleado a la semana...
          </option>
          {operadoresDept.map((op) => (
            <option key={op.id} value={op.nombre}>
              {op.nombre}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={agregando}
          className="bg-[#0369A1] hover:bg-[#0284C7] text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
        </button>
      </form>

      {/* Chips rápidos al editar */}
      {activeCell && activeCell.field !== 'notas' && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-gray-500 mr-1">Rápido:</span>
          {CHIPS_RAPIDOS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => aplicarChip(chip.value)}
              className="px-2 py-0.5 text-xs font-medium bg-sky-50 text-sky-800 border border-sky-200 rounded hover:bg-sky-100"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="border border-gray-200 rounded-lg overflow-x-auto min-w-[800px]">
        <table className="w-full text-sm text-center">
          <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left w-48 sticky left-0 bg-gray-50 border-r border-gray-200 z-10">
                Nombre del Empleado
              </th>
              {DIAS_SEMANA.map((d) => (
                <th
                  key={d}
                  className={`px-2 py-3 w-20 border-r border-gray-100 ${
                    FIN_DE_SEMANA.has(d) ? 'bg-amber-50/80' : ''
                  }`}
                >
                  {etiquetaDia(d)}
                </th>
              ))}
              <th className="px-3 py-3 w-24 border-r border-gray-200 bg-gray-50">Total Hrs</th>
              <th className="px-3 py-3 text-left min-w-[180px]">Notas</th>
              <th className="px-2 py-3 w-16" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {registros.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-gray-500">
                  No hay registros. Usa &quot;Cargar equipo&quot; o agrega empleados manualmente.
                </td>
              </tr>
            ) : (
              registros.map((r) => {
                const status = saveStatus[r.id] ?? 'idle'
                const totalFila = calcularTotalHoras(r)

                return (
                  <tr key={r.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-2 font-medium text-gray-900 text-left sticky left-0 bg-white border-r border-gray-200 z-10">
                      <div className="flex items-center gap-2">
                        {r.empleado}
                        {status === 'saving' && (
                          <Loader2 className="h-3 w-3 text-gray-400 animate-spin" />
                        )}
                        {status === 'saved' && (
                          <Check className="h-3 w-3 text-emerald-500" />
                        )}
                      </div>
                    </td>

                    {DIAS_SEMANA.map((dia) => {
                      const isActive =
                        activeCell?.rowId === r.id && activeCell.field === dia
                      const valorCelda = r[dia]
                      const { valor, advertencia } = parseHorasConEstado(valorCelda)
                      const finSemana = FIN_DE_SEMANA.has(dia)

                      return (
                        <td
                          key={dia}
                          className={`p-0.5 border-r border-gray-100 ${finSemana ? 'bg-amber-50/40' : ''}`}
                        >
                          {isActive ? (
                            <input
                              ref={inputRef}
                              type="text"
                              value={draft}
                              onChange={(e) => {
                                setDraft(e.target.value)
                                programarGuardado(r.id, dia, e.target.value)
                              }}
                              onBlur={() => cerrarEdicion(true)}
                              onKeyDown={handleKeyDown}
                              className="w-full h-8 text-center text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0369A1] bg-white"
                              placeholder="-"
                            />
                          ) : (
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => iniciarEdicion(r, dia)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') iniciarEdicion(r, dia)
                              }}
                              title={
                                advertencia
                                  ? 'Formato no reconocido — usa 2, 2.5 o 2 30'
                                  : undefined
                              }
                              className={`w-full h-8 flex items-center justify-center gap-0.5 cursor-text rounded text-gray-700 hover:ring-1 hover:ring-gray-200 ${intensidadHeatmap(valor)}`}
                            >
                              {advertencia && (
                                <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                              )}
                              {valorCelda || '-'}
                            </div>
                          )}
                        </td>
                      )
                    })}

                    <td className="px-3 py-2 border-r border-gray-200 bg-gray-50 font-medium text-[#0369A1]">
                      {totalFila > 0 ? totalFila.toFixed(1).replace(/\.0$/, '') : (r.totalHoras ?? 0)}
                    </td>

                    <td className="p-0.5">
                      {activeCell?.rowId === r.id && activeCell.field === 'notas' ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={draft}
                          onChange={(e) => {
                            setDraft(e.target.value)
                            programarGuardado(r.id, 'notas', e.target.value)
                          }}
                          onBlur={() => cerrarEdicion(true)}
                          onKeyDown={handleKeyDown}
                          className="w-full h-8 px-2 text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0369A1] bg-white"
                          placeholder="Nota (ej. Permiso)"
                        />
                      ) : (
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => iniciarEdicion(r, 'notas')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') iniciarEdicion(r, 'notas')
                          }}
                          className="w-full h-8 px-2 flex items-center cursor-text hover:bg-gray-100 rounded text-gray-600 text-xs"
                        >
                          {r.notas || (
                            <span className="text-gray-300 italic">Clic para nota...</span>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => void handleEliminar(r.id, r.empleado)}
                        className="text-gray-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded transition-colors"
                        title="Remover fila"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">
        Clic en celda para editar.{' '}
        <kbd className="bg-gray-100 border border-gray-300 px-1 rounded text-gray-600">Tab</kbd> avanza,{' '}
        <kbd className="bg-gray-100 border border-gray-300 px-1 rounded text-gray-600">Enter</kbd> baja,{' '}
        <kbd className="bg-gray-100 border border-gray-300 px-1 rounded text-gray-600">Esc</kbd> cancela.
        Auto-guardado al salir de cada celda.
      </p>
    </div>
  )
}
