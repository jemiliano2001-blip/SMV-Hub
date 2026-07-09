import type { Area, Departamento } from "@/lib/schemas"

const AREA_A_DEPARTAMENTO: Partial<Record<Area, Departamento>> = {
  diseno: "diseno",
  automatizacion: "automatizacion",
  taller: "taller",
  cnc: "cnc",
}

export function areaCorrespondeDepartamento(
  area: Area,
  departamento: Departamento
): boolean {
  return AREA_A_DEPARTAMENTO[area] === departamento
}

export function departamentoDesdeArea(area: Area): Departamento | null {
  return AREA_A_DEPARTAMENTO[area] ?? null
}
