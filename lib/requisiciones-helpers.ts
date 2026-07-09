import type { EstatusRequisicion } from "@/lib/schemas"

export const ESTADOS_REQUISICION: EstatusRequisicion[] = [
  "no_comprado",
  "en_proceso",
  "comprado",
  "parcial",
  "recibido",
]

export const ESTADO_LABEL: Record<EstatusRequisicion, string> = {
  no_comprado: "No comprado",
  en_proceso: "En proceso",
  comprado: "Comprado",
  parcial: "Parcial",
  recibido: "Recibido",
}

export const ESTADO_BADGE: Record<EstatusRequisicion, string> = {
  no_comprado: "bg-gray-100 text-gray-700 ring-gray-600/20",
  en_proceso: "bg-orange-50 text-orange-800 ring-orange-600/20",
  comprado: "bg-yellow-50 text-yellow-800 ring-yellow-600/20",
  parcial: "bg-pink-50 text-pink-800 ring-pink-600/20",
  recibido: "bg-blue-50 text-blue-700 ring-blue-600/20",
}

export const EMPRESA_BADGE: Record<string, string> = {
  AFX: "bg-gray-900 text-white",
  OHD: "bg-red-900 text-white",
  Siltech: "bg-orange-200 text-orange-900",
  Taller: "bg-slate-100 text-slate-800",
}

export const REVISION_FINANZAS_OPCIONES = [
  "",
  "Pendiente",
  "Aprobado",
  "Entrega parcial",
  "Rechazado",
] as const

export function badgeEmpresa(empresa: string | null | undefined): string {
  if (!empresa) return ""
  return EMPRESA_BADGE[empresa] ?? "bg-gray-100 text-gray-700"
}

export function truncarNota(nota: string | null | undefined, max = 48): string {
  if (!nota?.trim()) return ""
  const t = nota.trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}
