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
  Clock,
  Zap,
  ArrowRight,
  ClipboardCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { useConfirmDialog } from '@/components/ConfirmDialogProvider'
import ModuleSurface from '@/components/layout/ModuleSurface'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Props {
  departamento: Departamento
  semanaInicio: string
  /** false → modo solo lectura: sin captura, sin acciones de lote ni borrado. */
  puedeEditar: boolean
}

type CampoEditable = DiaSemana | 'notas'
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const FIN_DE_SEMANA = new Set<DiaSemana>(['sabado', 'domingo'])

export default function HorasExtraGrid({ departamento, semanaInicio, puedeEditar }: Props) {
  const confirmar = useConfirmDialog()
  const {
    registros,
    loading,
    error,
    fetchRegistros,
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

  const [celdaCopiada, setCeldaCopiada] = useState<string | null>(null)

  const operadoresDept = operadores.filter(
    (op) => op.activo && areaCorrespondeDepartamento(op.area, departamento)
  )

  const aplicarValorACelda = async (rowId: string, dia: DiaSemana, val: string | null) => {
    if (!puedeEditar) return
    await editarDias(rowId, { [dia]: val })
    toast.success(`Asignado "${val ?? '0'}" para ${etiquetaDia(dia)}`)
  }

  /** Pide confirmación solo cuando la acción masiva pisa horas ya capturadas. */
  const confirmarSobrescritura = async (
    rowId: string,
    title: string,
    description: string
  ): Promise<boolean> => {
    const registro = registros.find((r) => r.id === rowId)
    if (!registro || calcularTotalHoras(registro) === 0) return true
    return confirmar({ title, description, confirmLabel: 'Aplicar', variant: 'destructive' })
  }

  const replicarALaSemana = async (rowId: string, val: string | null) => {
    if (!puedeEditar) return
    const ok = await confirmarSobrescritura(
      rowId,
      'Replicar valor a toda la semana',
      `Se reemplazarán las horas de lunes a viernes con "${val ?? '0'}".`
    )
    if (!ok) return
    await editarDias(rowId, {
      lunes: val,
      martes: val,
      miercoles: val,
      jueves: val,
      viernes: val,
    })
    toast.success(`Valor "${val ?? '0'}" replicado a Lun-Vie`)
  }

  const llenarSemanaEstandar = async (rowId: string, nombre: string) => {
    if (!puedeEditar) return
    const ok = await confirmarSobrescritura(
      rowId,
      'Asignar semana estándar',
      `Se reemplazarán las horas ya capturadas de ${nombre} con 2 h de lunes a viernes.`
    )
    if (!ok) return
    await editarDias(rowId, {
      lunes: '2',
      martes: '2',
      miercoles: '2',
      jueves: '2',
      viernes: '2',
    })
    toast.success(`Semana estándar (2h L-V) asignada a ${nombre}`)
  }

  const limpiarSemanaOperador = async (rowId: string, nombre: string) => {
    if (!puedeEditar) return
    const aceptado = await confirmar({
      title: 'Limpiar la semana completa',
      description: `Se borrarán las horas de los siete días de ${nombre}. No se puede deshacer.`,
      confirmLabel: 'Limpiar semana',
      variant: 'destructive',
    })
    if (!aceptado) return
    await editarDias(rowId, {
      lunes: null,
      martes: null,
      miercoles: null,
      jueves: null,
      viernes: null,
      sabado: null,
      domingo: null,
    })
    toast.success(`Semana limpiada para ${nombre}`)
  }

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
    if (!puedeEditar) return
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
    return <div className="animate-pulse h-64 bg-muted rounded-lg" />
  }

  if (error) {
    return (
      <div className="text-red-600 bg-red-50 border border-red-200 p-4 rounded-lg text-sm space-y-2">
        <p>{error}</p>
        <button onClick={fetchRegistros} className="font-semibold underline hover:no-underline">Reintentar</button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Acciones y progreso */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {puedeEditar && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleCargarEquipo()}
            disabled={accionLote !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-card border border-border rounded-md hover:bg-muted disabled:opacity-50"
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-card border border-border rounded-md hover:bg-muted disabled:opacity-50"
          >
            {accionLote === 'copiar' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
            Copiar semana anterior
          </button>
        </div>
        )}
        {total > 0 && (
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-primary">{conHoras}/{total}</span> empleados con horas
            <div className="mt-1 w-48 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${total > 0 ? (conHoras / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {mensaje && (
        <p className="text-sm text-muted-foreground bg-muted border border-border rounded-md px-3 py-2">
          {mensaje}
        </p>
      )}

      {/* Agregar empleado */}
      {puedeEditar && (
      <form onSubmit={handleAgregar} className="flex gap-3 max-w-md">
        <select
          required
          value={nuevoEmpleado}
          onChange={(e) => setNuevoEmpleado(e.target.value)}
          className="flex-1 px-3 py-1.5 text-sm border border-border rounded-md bg-card focus:outline-none focus:border-primary"
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
          className="bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
        </button>
      </form>
      )}

      {/* Chips rápidos al editar */}
      {activeCell && activeCell.field !== 'notas' && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-muted-foreground mr-1">Rápido:</span>
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
      <ModuleSurface>
        <Table className="min-w-[800px] text-sm text-center">
          <TableHeader className="bg-muted text-muted-foreground font-medium border-b border-border">
            <TableRow>
              <TableHead className="h-auto px-4 py-3 text-left w-48 sticky left-0 bg-muted border-r border-border z-10">
                Nombre del Empleado
              </TableHead>
              {DIAS_SEMANA.map((d) => (
                <TableHead
                  key={d}
                  className={`px-2 py-3 w-20 text-center border-r border-border ${
                    FIN_DE_SEMANA.has(d) ? 'bg-amber-50/80' : ''
                  }`}
                >
                  {etiquetaDia(d)}
                </TableHead>
              ))}
              <TableHead className="px-3 py-3 w-24 text-center border-r border-border bg-muted">Total Hrs</TableHead>
              <TableHead className="px-3 py-3 text-left min-w-[180px]">Notas</TableHead>
              <TableHead className="px-2 py-3 w-16" />
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border">
            {registros.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="px-4 py-12 text-center text-muted-foreground">
                  No hay registros. Usa &quot;Cargar equipo&quot; o agrega empleados manualmente.
                </TableCell>
              </TableRow>
            ) : (
              registros.map((r) => {
                const status = saveStatus[r.id] ?? 'idle'
                const totalFila = calcularTotalHoras(r)

                return (
                  <TableRow key={r.id} className="hover:bg-muted/80">
                    <TableCell className="p-0 font-medium text-foreground text-left sticky left-0 bg-card border-r border-border z-10">
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <div className="px-4 py-2 flex items-center justify-between gap-2 cursor-context-menu w-full h-full select-none">
                            <span className="truncate">{r.empleado}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              {status === 'saving' && (
                                <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
                              )}
                              {status === 'saved' && (
                                <Check className="h-3 w-3 text-emerald-500" />
                              )}
                            </div>
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-56">
                          <ContextMenuItem
                            onClick={() => {
                              void navigator.clipboard.writeText(r.empleado)
                              toast.success('Nombre copiado', { description: r.empleado })
                            }}
                          >
                            <Copy className="text-muted-foreground" />
                            <span>Copiar nombre ({r.empleado})</span>
                          </ContextMenuItem>

                          {puedeEditar && (
                            <>
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                onClick={() => void llenarSemanaEstandar(r.id, r.empleado)}
                              >
                                <Zap className="text-amber-600" />
                                <span>Semana estándar (2h L-V)</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                onClick={() => void limpiarSemanaOperador(r.id, r.empleado)}
                              >
                                <Clock className="text-muted-foreground" />
                                <span>Limpiar toda la semana</span>
                              </ContextMenuItem>
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                className="text-rose-600"
                                onClick={() => handleEliminar(r.id, r.empleado)}
                              >
                                <Trash2 className="text-rose-600" />
                                <span>Remover de la cuadrícula</span>
                              </ContextMenuItem>
                            </>
                          )}
                        </ContextMenuContent>
                      </ContextMenu>
                    </TableCell>

                    {DIAS_SEMANA.map((dia) => {
                      const isActive =
                        activeCell?.rowId === r.id && activeCell.field === dia
                      const valorCelda = r[dia]
                      const { valor, advertencia } = parseHorasConEstado(valorCelda)
                      const finSemana = FIN_DE_SEMANA.has(dia)

                      return (
                        <TableCell
                          key={dia}
                          className={`p-0.5 border-r border-border ${finSemana ? 'bg-amber-50/40' : ''}`}
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
                              className="w-full h-8 text-center text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-ring bg-card"
                              placeholder="-"
                            />
                          ) : (
                            <ContextMenu>
                              {/* Sin permiso de edición no hay menú que mostrar: dejamos
                                  el clic derecho al navegador en vez de tragárnoslo. */}
                              <ContextMenuTrigger asChild disabled={!puedeEditar}>
                                <div
                                  {...(puedeEditar
                                    ? {
                                        role: 'button' as const,
                                        tabIndex: 0,
                                        onClick: () => iniciarEdicion(r, dia),
                                        onKeyDown: (e: React.KeyboardEvent) => {
                                          if (e.key === 'Enter' || e.key === ' ') iniciarEdicion(r, dia)
                                        },
                                      }
                                    : {})}
                                  title={
                                    advertencia
                                      ? 'Formato no reconocido — usa 2, 2.5 o 2 30'
                                      : undefined
                                  }
                                  className={`w-full h-8 flex items-center justify-center gap-0.5 rounded text-foreground select-none ${
                                    puedeEditar ? 'cursor-text hover:ring-1 hover:ring-border' : ''
                                  } ${intensidadHeatmap(valor)}`}
                                >
                                  {advertencia && (
                                    <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                                  )}
                                  {valorCelda || '-'}
                                </div>
                              </ContextMenuTrigger>

                              {puedeEditar && (
                                <ContextMenuContent className="w-52">
                                  <ContextMenuSub>
                                    <ContextMenuSubTrigger>
                                      <Clock className="text-sky-600" />
                                      <span>Horas rápidas</span>
                                    </ContextMenuSubTrigger>
                                    <ContextMenuSubContent className="w-36">
                                      {['2', '2.5', '3', '4', '5', '8'].map((hrs) => (
                                        <ContextMenuItem
                                          key={hrs}
                                          onClick={() => void aplicarValorACelda(r.id, dia, hrs)}
                                        >
                                          <span>+{hrs} horas</span>
                                        </ContextMenuItem>
                                      ))}
                                      <ContextMenuSeparator />
                                      <ContextMenuItem
                                        onClick={() => void aplicarValorACelda(r.id, dia, null)}
                                      >
                                        <span className="text-muted-foreground">0 hrs (Limpiar)</span>
                                      </ContextMenuItem>
                                    </ContextMenuSubContent>
                                  </ContextMenuSub>

                                  <ContextMenuSub>
                                    <ContextMenuSubTrigger>
                                      <ClipboardCheck className="text-amber-600" />
                                      <span>Códigos especiales</span>
                                    </ContextMenuSubTrigger>
                                    <ContextMenuSubContent className="w-44">
                                      {[
                                        { code: 'F', label: 'F (Falta)' },
                                        { code: 'I', label: 'I (Incapacidad)' },
                                        { code: 'V', label: 'V (Vacaciones)' },
                                        { code: 'P', label: 'P (Permiso)' },
                                      ].map(({ code, label }) => (
                                        <ContextMenuItem
                                          key={code}
                                          onClick={() => void aplicarValorACelda(r.id, dia, code)}
                                        >
                                          <span>{label}</span>
                                        </ContextMenuItem>
                                      ))}
                                    </ContextMenuSubContent>
                                  </ContextMenuSub>

                                  {valorCelda && (
                                    <>
                                      <ContextMenuSeparator />
                                      <ContextMenuItem
                                        onClick={() => void replicarALaSemana(r.id, valorCelda)}
                                      >
                                        <ArrowRight className="text-emerald-600" />
                                        <span>Replicar a Lun-Vie</span>
                                      </ContextMenuItem>
                                    </>
                                  )}

                                  <ContextMenuSeparator />

                                  <ContextMenuItem
                                    onClick={() => {
                                      setCeldaCopiada(valorCelda ?? '')
                                      void navigator.clipboard.writeText(valorCelda ?? '')
                                      toast.success('Valor de celda copiado')
                                    }}
                                  >
                                    <Copy className="text-muted-foreground" />
                                    <span>Copiar celda</span>
                                  </ContextMenuItem>

                                  {celdaCopiada != null && (
                                    <ContextMenuItem
                                      onClick={() => void aplicarValorACelda(r.id, dia, celdaCopiada || null)}
                                    >
                                      <Check className="text-emerald-600" />
                                      <span>Pegar ({celdaCopiada || 'vacío'})</span>
                                    </ContextMenuItem>
                                  )}
                                </ContextMenuContent>
                              )}
                            </ContextMenu>
                          )}
                        </TableCell>
                      )
                    })}

                    <TableCell className="px-3 py-2 border-r border-border bg-muted font-medium text-primary">
                      {totalFila > 0 ? totalFila.toFixed(1).replace(/\.0$/, '') : (r.totalHoras ?? 0)}
                    </TableCell>

                    <TableCell className="p-0.5">
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
                          className="w-full h-8 px-2 text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-ring bg-card"
                          placeholder="Nota (ej. Permiso)"
                        />
                      ) : (
                        <div
                          {...(puedeEditar
                            ? {
                                role: 'button' as const,
                                tabIndex: 0,
                                onClick: () => iniciarEdicion(r, 'notas'),
                                onKeyDown: (e: React.KeyboardEvent) => {
                                  if (e.key === 'Enter' || e.key === ' ') iniciarEdicion(r, 'notas')
                                },
                              }
                            : {})}
                          className={`w-full h-8 px-2 flex items-center rounded text-muted-foreground text-xs ${
                            puedeEditar ? 'cursor-text hover:bg-muted' : ''
                          }`}
                        >
                          {r.notas ||
                            (puedeEditar ? (
                              <span className="text-muted-foreground italic">Clic para nota...</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            ))}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="px-2 py-2">
                      {puedeEditar && (
                        <button
                          type="button"
                          onClick={() => void handleEliminar(r.id, r.empleado)}
                          className="text-muted-foreground hover:text-red-500 p-1.5 hover:bg-red-50 rounded transition-colors"
                          title="Remover fila"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </ModuleSurface>

      {puedeEditar ? (
        <p className="text-xs text-muted-foreground">
          Clic en celda para editar.{' '}
          <kbd className="bg-muted border border-input px-1 rounded text-muted-foreground">Tab</kbd> avanza,{' '}
          <kbd className="bg-muted border border-input px-1 rounded text-muted-foreground">Enter</kbd> baja,{' '}
          <kbd className="bg-muted border border-input px-1 rounded text-muted-foreground">Esc</kbd> cancela.
          Auto-guardado al salir de cada celda.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Vista de solo lectura. La captura la realiza compras, contabilidad o automatización.
        </p>
      )}
    </div>
  )
}
