import {
  generarBufferExcelFormal,
  descargarExcelEnNavegador,
  type ColumnaExcelConfig,
} from "./excel-export-base"
import type { UsuarioAdmin } from "./hooks/useUsuarios"
import type { Operador } from "./schemas"
import { esMatrizPersonalizada } from "./roles"

export const COLUMNAS_EXCEL_USUARIOS: ColumnaExcelConfig[] = [
  { header: "Correo", width: 28, align: "left" },
  { header: "Operador Vinculado", width: 24, align: "left" },
  { header: "Área Operador", width: 16, align: "center" },
  { header: "Plantilla", width: 14, align: "center" },
  { header: "Módulos Asignados", width: 34, align: "left", wrapText: true },
  { header: "Total Módulos", width: 14, align: "right", numFmt: "#,##0" },
  { header: "Super Admin", width: 12, align: "center" },
  { header: "Doc. Venta", width: 12, align: "center" },
  { header: "Horas Extra", width: 12, align: "center" },
  { header: "Matriz Custom", width: 12, align: "center" },
  { header: "Proveedor Auth", width: 14, align: "center" },
  { header: "Estado", width: 12, align: "center" },
]

export function armarFilasUsuarios(
  usuarios: readonly UsuarioAdmin[],
  operadoresMap?: Map<string, Operador>
): (string | number)[][] {
  return usuarios.map((u) => {
    const op = u.operadorId && operadoresMap ? operadoresMap.get(u.operadorId) : null
    const areaOp = op?.area ?? "—"
    const modulosTexto = u.modulos.join(", ")
    const esCustom = esMatrizPersonalizada(u.plantilla, u.modulos) ? "SÍ" : "NO"

    return [
      u.email,
      u.operadorNombre ?? "—",
      areaOp,
      u.plantilla,
      modulosTexto,
      u.modulos.length,
      u.esSuperAdmin ? "SÍ" : "NO",
      u.atiendeDocumentosVenta ? "SÍ" : "NO",
      u.editaHorasExtra ? "SÍ" : "NO",
      esCustom,
      u.proveedor,
      u.activo ? "ACTIVO" : "INACTIVO",
    ]
  })
}

export function generarCSVUsuarios(
  usuarios: readonly UsuarioAdmin[],
  operadoresMap?: Map<string, Operador>
): string {
  const headers = [
    "Correo",
    "Operador Vinculado",
    "Area Operador",
    "Plantilla",
    "Modulos Asignados",
    "Total Modulos",
    "Super Admin",
    "Atiende Doc Venta",
    "Edita Horas Extra",
    "Matriz Custom",
    "Proveedor Auth",
    "Estado",
  ]

  const filas = armarFilasUsuarios(usuarios, operadoresMap)
  const lineas = [
    headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","),
    ...filas.map((fila) =>
      fila
        .map((val) => {
          const s = String(val ?? "")
          return `"${s.replace(/"/g, '""')}"`
        })
        .join(",")
    ),
  ]

  return lineas.join("\r\n")
}

export function descargarCSVUsuarios(
  usuarios: readonly UsuarioAdmin[],
  operadores?: Operador[],
  nombreArchivo = "usuarios_smv_hub.csv"
): void {
  const map = new Map<string, Operador>()
  if (operadores) {
    for (const op of operadores) map.set(op.id, op)
  }

  const csv = generarCSVUsuarios(usuarios, map)
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = nombreArchivo.endsWith(".csv") ? nombreArchivo : `${nombreArchivo}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function exportarExcelUsuarios(
  usuarios: readonly UsuarioAdmin[],
  operadores?: Operador[],
  nombreArchivo = "usuarios_smv_hub.xlsx"
): Promise<void> {
  const map = new Map<string, Operador>()
  if (operadores) {
    for (const op of operadores) map.set(op.id, op)
  }

  const filas = armarFilasUsuarios(usuarios, map)
  const buffer = await generarBufferExcelFormal({
    nombreHoja: "Usuarios",
    titulo: "Directorio de Usuarios y Matriz de Permisos",
    subtitulo: "Control de Acceso y Roles SMV Hub",
    metadatos: `${usuarios.length} cuentas registradas`,
    columnas: COLUMNAS_EXCEL_USUARIOS,
    filas,
    orientacion: "landscape",
  })

  descargarExcelEnNavegador(buffer, nombreArchivo)
}
