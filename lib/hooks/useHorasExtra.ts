/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react"
import {
  suscribirHorasExtra,
  crearHorasExtra,
  crearHorasExtraLote,
  actualizarHorasExtra,
  eliminarHorasExtra,
  listarHorasExtra,
  listarHorasExtraRango,
  type NuevaHorasExtraPayload,
} from "@/lib/horas-extra"
import {
  calcularTotalHoras,
  offsetSemana,
} from "@/lib/horas-extra-parse"
import { areaCorrespondeDepartamento } from "@/lib/operadores-departamento"
import type { HorasExtra, Departamento, Operador } from "@/lib/schemas"

export { parseHorasConEstado } from "@/lib/horas-extra-parse"
export {
  getMiercolesSemana,
  getSemanaActualISO,
  offsetSemana,
  esSemanaActual,
  getDiaSemanaActual,
  DIAS_SEMANA,
} from "@/lib/horas-extra-parse"
export type { DiaSemana } from "@/lib/horas-extra-parse"

function payloadVacio(
  empleado: string,
  departamento: Departamento,
  semanaInicio: string,
  notas: string | null = null
): Omit<NuevaHorasExtraPayload, "totalHoras"> {
  return {
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
    notas,
  }
}

function calcularTotalPayload(
  payload: Partial<Pick<HorasExtra, "miercoles" | "jueves" | "viernes" | "sabado" | "domingo" | "lunes" | "martes">>
): number | null {
  const total = calcularTotalHoras(payload)
  return total > 0 ? total : null
}

export function useHorasExtra(semanaInicioFiltro?: string, departamentoFiltro?: Departamento) {
  const [registros, setRegistros] = useState<HorasExtra[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!semanaInicioFiltro || !departamentoFiltro) {
      setRegistros([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const unsubscribe = suscribirHorasExtra(
      semanaInicioFiltro,
      departamentoFiltro,
      (data) => {
        setRegistros(data)
        setLoading(false)
      },
      (err) => {
        console.error("Error cargando horas extra:", err)
        setError("No se pudieron cargar los registros. Intenta de nuevo.")
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [semanaInicioFiltro, departamentoFiltro])

  const fetchRegistros = useCallback(async () => {
    if (!semanaInicioFiltro || !departamentoFiltro) return
    try {
      const data = await listarHorasExtra(semanaInicioFiltro, departamentoFiltro)
      setRegistros(data)
    } catch (err) {
      console.error("Error recargando horas extra:", err)
      setError("No se pudieron cargar los registros. Intenta de nuevo.")
    }
  }, [semanaInicioFiltro, departamentoFiltro])

  async function agregarRegistro(
    payload: Omit<NuevaHorasExtraPayload, "totalHoras">
  ): Promise<void> {
    const duplicado = registros.some(
      (r) => r.empleado.toLowerCase() === payload.empleado.toLowerCase()
    )
    if (duplicado) {
      throw new Error(`${payload.empleado} ya está en esta semana`)
    }

    await crearHorasExtra({
      ...payload,
      totalHoras: calcularTotalPayload(payload),
    })
  }

  async function editarDias(
    id: string,
    dias: Partial<
      Pick<
        HorasExtra,
        "miercoles" | "jueves" | "viernes" | "sabado" | "domingo" | "lunes" | "martes" | "notas"
      >
    >
  ): Promise<void> {
    const reg = registros.find((r) => r.id === id)
    if (!reg) return

    const combined = { ...reg, ...dias }
    const totalHoras = calcularTotalPayload(combined) ?? combined.totalHoras

    await actualizarHorasExtra(id, { ...dias, totalHoras })
    setRegistros((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...dias, totalHoras } : r))
    )
  }

  async function borrarRegistro(id: string): Promise<void> {
    await eliminarHorasExtra(id)
    setRegistros((prev) => prev.filter((r) => r.id !== id))
  }

  async function cargarEquipo(operadores: Operador[]): Promise<number> {
    if (!semanaInicioFiltro || !departamentoFiltro) return 0

    const existentes = new Set(registros.map((r) => r.empleado.toLowerCase()))
    const nuevos = operadores
      .filter((op) => op.activo && areaCorrespondeDepartamento(op.area, departamentoFiltro))
      .filter((op) => !existentes.has(op.nombre.toLowerCase()))
      .map((op) => ({
        ...payloadVacio(op.nombre, departamentoFiltro, semanaInicioFiltro),
        totalHoras: null,
      }))

    if (nuevos.length === 0) return 0
    await crearHorasExtraLote(nuevos)
    return nuevos.length
  }

  async function copiarSemanaAnterior(incluirNotas = false): Promise<number> {
    if (!semanaInicioFiltro || !departamentoFiltro) return 0

    const semanaAnterior = offsetSemana(semanaInicioFiltro, -1)
    const anteriores = await listarHorasExtra(semanaAnterior, departamentoFiltro)
    const existentes = new Set(registros.map((r) => r.empleado.toLowerCase()))

    const nuevos = anteriores
      .filter((r) => !existentes.has(r.empleado.toLowerCase()))
      .map((r) => ({
        ...payloadVacio(
          r.empleado,
          departamentoFiltro,
          semanaInicioFiltro,
          incluirNotas ? r.notas : null
        ),
        totalHoras: null,
      }))

    if (nuevos.length === 0) return 0
    await crearHorasExtraLote(nuevos)
    return nuevos.length
  }

  return {
    registros,
    loading,
    error,
    fetchRegistros,
    agregarRegistro,
    editarDias,
    borrarRegistro,
    cargarEquipo,
    copiarSemanaAnterior,
  }
}

export function useHorasExtraMensual(mes: string, departamento: Departamento) {
  const [registros, setRegistros] = useState<HorasExtra[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    listarHorasExtraRango(mes, departamento)
      .then(setRegistros)
      .catch((err) => {
        console.error("Error cargando resumen mensual:", err)
        setError("No se pudo cargar el resumen del mes.")
      })
      .finally(() => setLoading(false))
  }, [mes, departamento])

  return { registros, loading, error }
}
