'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import { useHorasExtra } from '@/lib/hooks/useHorasExtra'
import { useOperadores } from '@/lib/hooks/useOperadores'
import { areaCorrespondeDepartamento } from '@/lib/operadores-departamento'
import type { Departamento, HorasExtra } from '@/lib/schemas'
import {
  getDiaSemanaActual,
  etiquetaDia,
  estadoCelda,
  CHIPS_RAPIDOS,
} from '@/lib/horas-extra-parse'
import { Check, Loader2, AlertCircle, Minus, Plus } from 'lucide-react'
import { vibrarExito, vibrarTap } from '@/lib/haptics'

interface Props {
  departamento: Departamento
  semanaInicio: string
  /** false → modo solo lectura: sin captura ni chips. */
  puedeEditar: boolean
}

export default function VistaHoy({ departamento, semanaInicio, puedeEditar }: Props) {
  const {
    registros,
    loading,
    error,
    editarDias,
    cargarEquipo,
  } = useHorasExtra(semanaInicio, departamento)
  const { operadores, loading: loadingOps, error: errorOps } = useOperadores()

  const diaHoy = getDiaSemanaActual()
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState<Record<string, boolean>>({})
  const [cargandoEquipo, setCargandoEquipo] = useState(false)
  const [errorCargarEquipo, setErrorCargarEquipo] = useState<string | null>(null)
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const guardandoRefs = useRef<Record<string, boolean>>({})

  useEffect(() => {
    const timers = debounceRefs.current
    return () => {
      for (const timer of Object.values(timers)) {
        clearTimeout(timer)
      }
    }
  }, [])

  const operadoresDept = useMemo(
    () =>
      operadores.filter(
        (op) => op.activo && areaCorrespondeDepartamento(op.area, departamento)
      ),
    [operadores, departamento]
  )

  const filas = useMemo(() => {
    const lista: { id: string; empleado: string; reg?: HorasExtra }[] = []
    const porNombre = new Map(registros.map((r) => [r.empleado.toLowerCase(), r]))
    for (const reg of registros) {
      lista.push({ id: reg.id, empleado: reg.empleado, reg })
    }
    for (const op of operadoresDept) {
      if (!porNombre.has(op.nombre.toLowerCase())) {
        lista.push({ id: `nuevo-${op.id}`, empleado: op.nombre })
      }
    }
    return lista.sort((a, b) => a.empleado.localeCompare(b.empleado, 'es'))
  }, [registros, operadoresDept])

  async function guardar(
    filaId: string,
    empleado: string,
    valor: string,
    reg?: HorasExtra
  ) {
    if (guardandoRefs.current[filaId]) return
    const normalizado = valor.trim() === '' ? null : valor.trim()
    const actual = reg ? reg[diaHoy] : null
    if (actual === normalizado) return

    guardandoRefs.current[filaId] = true
    setGuardando((g) => ({ ...g, [filaId]: true }))
    try {
      if (reg) {
        await editarDias(reg.id, { [diaHoy]: normalizado })
      } else {
        const payload = {
          empleado,
          departamento,
          semanaInicio,
          miercoles: null,
          jueves: null,
          viernes: null,
          sabado: null,
          domingo: null,
          lunes: null,
          martes: null,
          [diaHoy]: normalizado,
        }
        const res = await fetch('/api/horas-extra', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Error al crear registro de horas extra')
      }
      vibrarExito()
    } catch (err) {
      console.error('Error guardando horas extra:', err)
    } finally {
      guardandoRefs.current[filaId] = false
      setGuardando((g) => ({ ...g, [filaId]: false }))
    }
  }

  function cancelarDebounce(filaId: string) {
    if (debounceRefs.current[filaId]) {
      clearTimeout(debounceRefs.current[filaId])
      delete debounceRefs.current[filaId]
    }
  }

  function actualizarValor(
    filaId: string,
    empleado: string,
    nuevoValor: string,
    reg?: HorasExtra
  ) {
    setDrafts((d) => ({ ...d, [filaId]: nuevoValor }))
    cancelarDebounce(filaId)
    debounceRefs.current[filaId] = setTimeout(() => {
      void guardar(filaId, empleado, nuevoValor, reg)
    }, 800)
  }

  function aplicarChip(
    filaId: string,
    empleado: string,
    chip: string,
    reg?: HorasExtra
  ) {
    cancelarDebounce(filaId)
    vibrarTap()
    setDrafts((d) => ({ ...d, [filaId]: chip }))
    void guardar(filaId, empleado, chip, reg)
  }

  function ajustarHorasStepper(
    filaId: string,
    empleado: string,
    delta: number,
    reg?: HorasExtra
  ) {
    const valorActual = drafts[filaId] !== undefined ? drafts[filaId] : (reg?.[diaHoy] ?? '')
    const num = parseFloat(valorActual) || 0
    const nuevoNum = Math.max(0, Math.min(24, Math.round((num + delta) * 10) / 10))
    const nuevoValor = nuevoNum === 0 ? '' : nuevoNum.toString()

    cancelarDebounce(filaId)
    vibrarTap()
    setDrafts((d) => ({ ...d, [filaId]: nuevoValor }))
    void guardar(filaId, empleado, nuevoValor, reg)
  }

  async function cargarEquipoSeguro() {
    setCargandoEquipo(true)
    setErrorCargarEquipo(null)
    try {
      await cargarEquipo(operadores)
      vibrarExito()
    } catch (err) {
      console.error('Error cargando equipo de horas extra:', err)
      setErrorCargarEquipo(
        err instanceof Error ? err.message : 'No se pudo cargar el equipo'
      )
    } finally {
      setCargandoEquipo(false)
    }
  }

  if (loading || loadingOps) {
    return <div className="animate-pulse h-48 bg-muted rounded-xl" />
  }

  if (error || errorOps) {
    return <div className="text-destructive bg-destructive/10 border border-destructive/30 p-4 rounded-xl text-sm">{error ?? errorOps}</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border rounded-xl px-4 py-3 shadow-2xs">
        <div>
          <p className="text-sm font-bold text-foreground">
            Captura rápida — {etiquetaDia(diaHoy)}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Semana del {semanaInicio}. Modificaciones reflejadas en la grilla semanal.
          </p>
        </div>
        {filas.length === 0 && puedeEditar && (
          <button
            type="button"
            onClick={() => void cargarEquipoSeguro()}
            disabled={cargandoEquipo}
            className="text-xs font-bold text-primary hover:underline cursor-pointer"
          >
            {cargandoEquipo ? 'Cargando equipo…' : 'Cargar equipo del departamento'}
          </button>
        )}
      </div>

      {errorCargarEquipo && (
        <div className="text-destructive bg-destructive/10 border border-destructive/30 p-3 rounded-xl text-xs">
          {errorCargarEquipo}
        </div>
      )}

      {filas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl bg-card">
          <p className="text-sm">No hay empleados en esta semana.</p>
          {puedeEditar && (
            <button
              type="button"
              onClick={() => void cargarEquipoSeguro()}
              disabled={cargandoEquipo}
              className="mt-3 text-xs font-bold text-primary hover:underline cursor-pointer"
            >
              {cargandoEquipo ? 'Cargando equipo…' : 'Cargar equipo'}
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filas.map((fila) => {
            const valor =
              drafts[fila.id] !== undefined
                ? drafts[fila.id]
                : (fila.reg?.[diaHoy] ?? '')
            const estado = estadoCelda(valor || null)
            const isSaving = guardando[fila.id]

            const badgeClass =
              estado === 'capturado'
                ? 'bg-emerald-100 text-emerald-800'
                : estado === 'vacaciones'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-muted text-muted-foreground'

            return (
              <div
                key={fila.id}
                className="border border-border rounded-xl p-4 bg-card shadow-2xs hover:shadow-xs transition-shadow space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-bold text-sm text-foreground truncate">{fila.empleado}</h3>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${badgeClass}`}>
                    {estado === 'capturado'
                      ? 'Capturado'
                      : estado === 'vacaciones'
                        ? 'Vac/Permiso'
                        : 'Pendiente'}
                  </span>
                </div>

                {/* Control Táctil con Steppers (-0.5h / +0.5h) */}
                <div className="flex items-center gap-2">
                  {puedeEditar && (
                    <button
                      type="button"
                      onClick={() => ajustarHorasStepper(fila.id, fila.empleado, -0.5, fila.reg)}
                      className="size-11 flex items-center justify-center rounded-xl border border-border bg-card text-foreground hover:bg-muted active:scale-95 transition-transform cursor-pointer shadow-2xs shrink-0"
                      title="Restar 0.5 horas"
                    >
                      <Minus className="size-4" />
                    </button>
                  )}

                  <div className="relative flex-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={valor}
                      disabled={!puedeEditar}
                      onChange={(e) =>
                        actualizarValor(fila.id, fila.empleado, e.target.value, fila.reg)
                      }
                      onBlur={(e) => {
                        cancelarDebounce(fila.id)
                        void guardar(fila.id, fila.empleado, e.target.value, fila.reg)
                      }}
                      placeholder={puedeEditar ? 'Horas' : '0'}
                      className="w-full h-11 text-xl font-extrabold text-center border border-input rounded-xl bg-card text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-muted disabled:text-muted-foreground"
                    />
                    {isSaving && (
                      <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground animate-spin" />
                    )}
                    {!isSaving && estado === 'capturado' && (
                      <Check className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-emerald-500" />
                    )}
                  </div>

                  {puedeEditar && (
                    <button
                      type="button"
                      onClick={() => ajustarHorasStepper(fila.id, fila.empleado, 0.5, fila.reg)}
                      className="size-11 flex items-center justify-center rounded-xl border border-border bg-card text-foreground hover:bg-muted active:scale-95 transition-transform cursor-pointer shadow-2xs shrink-0"
                      title="Sumar 0.5 horas"
                    >
                      <Plus className="size-4 text-primary" />
                    </button>
                  )}
                </div>

                {/* Chips de 1-Toque */}
                {puedeEditar && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {CHIPS_RAPIDOS.map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() =>
                          aplicarChip(fila.id, fila.empleado, chip.value, fila.reg)
                        }
                        className="flex-1 min-w-[2.4rem] py-1 text-xs font-bold bg-muted border border-border rounded-lg text-foreground hover:border-primary/50 hover:bg-sky-50/40 active:scale-95 transition-all cursor-pointer select-none"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1">
        <AlertCircle className="size-3.5 shrink-0 text-primary" />
        <span>
          {puedeEditar
            ? 'Optimizado para supervisores en celular. Usa los botones + / −, chips de 1-toque o escribe directamente.'
            : 'Vista de solo lectura. La captura la realiza compras, contabilidad o automatización.'}
        </span>
      </p>
    </div>
  )
}
