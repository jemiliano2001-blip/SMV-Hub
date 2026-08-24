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
import { Check, Loader2, AlertCircle } from 'lucide-react'

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
    agregarRegistro,
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
          notas: null,
        } as Omit<HorasExtra, 'id' | 'creadoEn' | 'actualizadoEn' | 'totalHoras'>
        payload[diaHoy] = normalizado
        await agregarRegistro(payload)
      }
    } catch (err) {
      console.error('Error guardando horas del día:', err)
    } finally {
      guardandoRefs.current[filaId] = false
      setGuardando((g) => ({ ...g, [filaId]: false }))
      setDrafts((d) => {
        const next = { ...d }
        delete next[filaId]
        return next
      })
    }
  }

  function cancelarDebounce(filaId: string) {
    const timer = debounceRefs.current[filaId]
    if (timer) {
      clearTimeout(timer)
      delete debounceRefs.current[filaId]
    }
  }

  function actualizarValor(
    filaId: string,
    empleado: string,
    valor: string,
    reg?: HorasExtra
  ) {
    setDrafts((d) => ({ ...d, [filaId]: valor }))
    cancelarDebounce(filaId)
    const timer = setTimeout(() => {
      if (debounceRefs.current[filaId] === timer) delete debounceRefs.current[filaId]
      void guardar(filaId, empleado, valor, reg)
    }, 500)
    debounceRefs.current[filaId] = timer
  }

  function aplicarChip(
    filaId: string,
    empleado: string,
    chip: string,
    reg?: HorasExtra
  ) {
    cancelarDebounce(filaId)
    setDrafts((d) => ({ ...d, [filaId]: chip }))
    void guardar(filaId, empleado, chip, reg)
  }

  async function cargarEquipoSeguro() {
    setCargandoEquipo(true)
    setErrorCargarEquipo(null)
    try {
      await cargarEquipo(operadores)
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
    return <div className="animate-pulse h-48 bg-muted rounded-lg" />
  }

  if (error || errorOps) {
    return <div className="text-red-600 bg-red-50 p-4 rounded-lg text-sm">{error ?? errorOps}</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-sky-50 border border-sky-100 rounded-lg px-4 py-3">
        <div>
          <p className="text-sm font-medium text-sky-900">
            Captura rápida — {etiquetaDia(diaHoy)}
          </p>
          <p className="text-xs text-sky-700 mt-0.5">
            Semana del {semanaInicio}. Los cambios se reflejan en la grilla semanal.
          </p>
        </div>
        {filas.length === 0 && puedeEditar && (
           <button
             type="button"
             onClick={() => void cargarEquipoSeguro()}
             disabled={cargandoEquipo}
             className="text-sm font-medium text-primary hover:underline"
           >
             {cargandoEquipo ? 'Cargando equipo…' : 'Cargar equipo del departamento'}
           </button>
        )}
      </div>

       {errorCargarEquipo && (
         <div className="text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg text-sm">
           {errorCargarEquipo}
         </div>
       )}

       {filas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-lg">
          <p>No hay empleados en esta semana.</p>
          {puedeEditar && (
             <button
               type="button"
               onClick={() => void cargarEquipoSeguro()}
               disabled={cargandoEquipo}
               className="mt-3 text-sm font-medium text-primary hover:underline"
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
                className="border border-border rounded-xl p-4 bg-card shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="font-semibold text-foreground">{fila.empleado}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>
                    {estado === 'capturado'
                      ? 'Capturado'
                      : estado === 'vacaciones'
                        ? 'Vac/Permiso'
                        : 'Pendiente'}
                  </span>
                </div>

                <div className="relative">
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
                    placeholder={puedeEditar ? 'Horas hoy' : 'Solo lectura'}
                    className="w-full text-2xl font-bold text-center py-3 border border-border rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-ring/20 disabled:bg-muted disabled:text-muted-foreground"
                  />
                  {isSaving && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground animate-spin" />
                  )}
                  {!isSaving && estado === 'capturado' && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" />
                  )}
                </div>

                {puedeEditar && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {CHIPS_RAPIDOS.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() =>
                        aplicarChip(fila.id, fila.empleado, chip.value, fila.reg)
                      }
                      className="flex-1 min-w-[2.5rem] px-2 py-1.5 text-sm font-medium bg-muted border border-border rounded-md hover:bg-sky-50 hover:border-sky-200"
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

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <AlertCircle className="h-3.5 w-3.5" />
        {puedeEditar
          ? 'Ideal para captura en piso desde el celular. Usa números (2, 2.5) o chips rápidos.'
          : 'Vista de solo lectura. La captura la realiza compras, contabilidad o automatización.'}
      </p>
    </div>
  )
}
