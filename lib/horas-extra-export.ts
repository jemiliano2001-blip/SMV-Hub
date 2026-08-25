import { generarBufferExcelFormal, type ColumnaExcelConfig } from "./excel-export-base"
import type { EmpleadoResumen } from "./horas-extra-resumen"
import { totalHorasRegistro } from "./horas-extra-resumen"
import type { HorasExtra } from "./schemas"
import { parseHoras } from "./horas-extra-parse"

export const COLUMNAS_EXCEL_RESUMEN_HE: ColumnaExcelConfig[] = [
  { header: "Empleado", width: 30, align: "left" },
  { header: "Total Horas", width: 16, align: "right", numFmt: "#,##0.0" },
  { header: "Semanas con Registro", width: 22, align: "right", numFmt: "#,##0" },
]

export const COLUMNAS_EXCEL_DETALLE_HE: ColumnaExcelConfig[] = [
  { header: "Empleado", width: 28, align: "left" },
  { header: "Semana", width: 14, align: "center" },
  { header: "Departamento", width: 18, align: "left" },
  { header: "Lun", width: 10, align: "right", numFmt: "#,##0.0" },
  { header: "Mar", width: 10, align: "right", numFmt: "#,##0.0" },
  { header: "Mié", width: 10, align: "right", numFmt: "#,##0.0" },
  { header: "Jue", width: 10, align: "right", numFmt: "#,##0.0" },
  { header: "Vie", width: 10, align: "right", numFmt: "#,##0.0" },
  { header: "Sáb", width: 10, align: "right", numFmt: "#,##0.0" },
  { header: "Dom", width: 10, align: "right", numFmt: "#,##0.0" },
  { header: "Total Semana", width: 15, align: "right", numFmt: "#,##0.0" },
]

export function armarFilasResumenHE(resumen: EmpleadoResumen[]): (string | number)[][] {
  return resumen.map((item) => [
    item.empleado,
    item.totalHoras,
    item.semanas.length,
  ])
}

export function armarFilasDetalleHE(registros: HorasExtra[]): (string | number)[][] {
  return registros.map((r) => [
    r.empleado,
    r.semanaInicio,
    r.departamento,
    parseHoras(r.lunes),
    parseHoras(r.martes),
    parseHoras(r.miercoles),
    parseHoras(r.jueves),
    parseHoras(r.viernes),
    parseHoras(r.sabado),
    parseHoras(r.domingo),
    totalHorasRegistro(r),
  ])
}

export async function generarExcelResumenHorasExtra(opts: {
  resumen: EmpleadoResumen[]
  mes: string
  departamentoLabel: string
  generadoEn?: Date
}): Promise<ArrayBuffer> {
  const filas = armarFilasResumenHE(opts.resumen)
  const totalHoras = opts.resumen.reduce((s, r) => s + r.totalHoras, 0)

  return generarBufferExcelFormal({
    nombreHoja: "Resumen Horas Extra",
    titulo: `Control de Horas Extra — ${opts.departamentoLabel}`,
    subtitulo: `Mes: ${opts.mes}`,
    metadatos: `${opts.resumen.length} empleados registrados`,
    columnas: COLUMNAS_EXCEL_RESUMEN_HE,
    filas,
    totales: {
      labelColSpan: 1,
      label: "TOTAL GENERAL",
      valores: [
        { colIndex: 2, valor: totalHoras, numFmt: "#,##0.0" },
      ],
    },
    orientacion: "portrait",
    generadoEn: opts.generadoEn,
  })
}

export async function generarExcelDetalleHorasExtra(opts: {
  registros: HorasExtra[]
  mes: string
  departamentoLabel: string
  generadoEn?: Date
}): Promise<ArrayBuffer> {
  const filas = armarFilasDetalleHE(opts.registros)
  const totalHoras = opts.registros.reduce((s, r) => s + totalHorasRegistro(r), 0)

  return generarBufferExcelFormal({
    nombreHoja: "Detalle Semanas",
    titulo: `Detalle Semanal de Horas Extra — ${opts.departamentoLabel}`,
    subtitulo: `Mes: ${opts.mes}`,
    metadatos: `${opts.registros.length} registros semanales`,
    columnas: COLUMNAS_EXCEL_DETALLE_HE,
    filas,
    totales: {
      labelColSpan: 10,
      label: "TOTAL HORAS",
      valores: [{ colIndex: 11, valor: totalHoras, numFmt: "#,##0.0" }],
    },
    orientacion: "landscape",
    generadoEn: opts.generadoEn,
  })
}
