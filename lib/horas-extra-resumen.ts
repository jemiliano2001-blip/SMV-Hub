import type { HorasExtra, Departamento } from "@/lib/schemas"
import {
  calcularTotalHoras,
  registroTieneHoras,
  DIAS_SEMANA,
  parseHoras,
} from "@/lib/horas-extra-parse"

export interface SemanaEmpleado {
  semanaInicio: string
  horas: number
}

export interface EmpleadoResumen {
  empleado: string
  totalHoras: number
  semanas: SemanaEmpleado[]
}

export interface KpisResumen {
  totalHoras: number
  promedioPorEmpleado: number
  empleadosConHoras: number
  semanasIncompletas: number
}

export function filtrarPorMes(
  registros: HorasExtra[],
  mes: string,
  departamento?: Departamento
): HorasExtra[] {
  return registros.filter((r) => {
    if (departamento && r.departamento !== departamento) return false
    return r.semanaInicio.startsWith(mes)
  })
}

export function totalHorasRegistro(reg: HorasExtra): number {
  return calcularTotalHoras(reg)
}

export function totalesPorEmpleado(registros: HorasExtra[]): EmpleadoResumen[] {
  const map = new Map<string, SemanaEmpleado[]>()

  for (const reg of registros) {
    const horas = totalHorasRegistro(reg)
    const semanas = map.get(reg.empleado) ?? []
    semanas.push({ semanaInicio: reg.semanaInicio, horas })
    map.set(reg.empleado, semanas)
  }

  return Array.from(map.entries())
    .map(([empleado, semanas]) => ({
      empleado,
      semanas: semanas.sort((a, b) => a.semanaInicio.localeCompare(b.semanaInicio)),
      totalHoras: semanas.reduce((sum, s) => sum + s.horas, 0),
    }))
    .sort((a, b) => b.totalHoras - a.totalHoras)
}

export function calcularKpisResumen(registros: HorasExtra[]): KpisResumen {
  const resumen = totalesPorEmpleado(registros)
  const totalHoras = resumen.reduce((sum, r) => sum + r.totalHoras, 0)
  const empleadosConHoras = resumen.filter((r) => r.totalHoras > 0).length

  const semanasPorInicio = new Map<string, HorasExtra[]>()
  for (const reg of registros) {
    const lista = semanasPorInicio.get(reg.semanaInicio) ?? []
    lista.push(reg)
    semanasPorInicio.set(reg.semanaInicio, lista)
  }

  let semanasIncompletas = 0
  for (const [, filas] of semanasPorInicio) {
    const conHoras = filas.filter((r) => registroTieneHoras(r)).length
    if (filas.length > 0 && conHoras < filas.length) {
      semanasIncompletas += 1
    }
  }

  return {
    totalHoras,
    promedioPorEmpleado:
      empleadosConHoras > 0 ? totalHoras / empleadosConHoras : 0,
    empleadosConHoras,
    semanasIncompletas,
  }
}

export function progresoSemana(registros: HorasExtra[]): {
  conHoras: number
  total: number
} {
  const total = registros.length
  const conHoras = registros.filter((r) => registroTieneHoras(r)).length
  return { conHoras, total }
}

export function exportarCsvResumen(
  resumen: EmpleadoResumen[],
  mes: string,
  departamento: string
): string {
  const filas: string[][] = [
    ["Empleado", "Total Horas", "Semanas con registro"],
    ...resumen.map((r) => [
      r.empleado,
      r.totalHoras.toFixed(2),
      r.semanas.length.toString(),
    ]),
  ]
  const contenido = filas.map((f) => f.join(",")).join("\n")
  return `\uFEFFResumen Horas Extra - ${departamento} - ${mes}\n${contenido}`
}

export function detalleSemanasCsv(registros: HorasExtra[]): string {
  const encabezados = [
    "Empleado",
    "Semana",
    "Departamento",
    ...DIAS_SEMANA.map((d) => d.slice(0, 3)),
    "Total",
  ]
  const filas = registros.map((r) => [
    r.empleado,
    r.semanaInicio,
    r.departamento,
    ...DIAS_SEMANA.map((d) => r[d] ?? ""),
    totalHorasRegistro(r).toFixed(2),
  ])
  return [encabezados, ...filas].map((f) => f.join(",")).join("\n")
}

export function sumarHorasDia(
  registros: HorasExtra[],
  dia: (typeof DIAS_SEMANA)[number]
): number {
  return registros.reduce((sum, r) => sum + parseHoras(r[dia]), 0)
}
