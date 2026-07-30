import type { MotivoSolicitudBorradoBano, ReglaAutoAprobacion, RegistroBano, RegistroResumenSolicitud } from "@/lib/schemas"

export const MOTIVOS_SOLICITUD_BORRADO_BANO: { value: MotivoSolicitudBorradoBano; label: string }[] = [
  { value: "accidental", label: "Agregado por accidente" },
  { value: "bano_equivocado", label: "Baño/área equivocada" },
  { value: "operador_equivocado", label: "Operador equivocado" },
  { value: "hora_mal_capturada", label: "Hora capturada mal" },
  { value: "duplicado", label: "Registro duplicado" },
  { value: "otro", label: "Otro" },
]

const VENTANA_DUPLICADO_MIN = 10
const VENTANA_ARREPENTIMIENTO_MIN = 2

function minutosEntreHoras(horaA: string, horaB: string): number {
  const [hA, mA] = horaA.split(":").map(Number)
  const [hB, mB] = horaB.split(":").map(Number)
  return Math.abs(hA * 60 + mA - (hB * 60 + mB))
}

/**
 * Reglas fijas y deterministas — no hay llamada a un modelo de IA. La primera
 * regla que aplique gana; si ninguna aplica, la solicitud queda pendiente.
 */
export function evaluarReglaAutoAprobacion(
  registro: RegistroBano,
  registrosRelacionados: readonly RegistroBano[],
  solicitudCreadaEn: Date
): ReglaAutoAprobacion | null {
  const hayDuplicadoCercano = registrosRelacionados.some(
    (otro) =>
      otro.id !== registro.id &&
      otro.operador === registro.operador &&
      otro.bano === registro.bano &&
      otro.fecha === registro.fecha &&
      minutosEntreHoras(otro.horaEntrada, registro.horaEntrada) <= VENTANA_DUPLICADO_MIN
  )
  if (hayDuplicadoCercano) return "duplicado_10min"

  const minutosDesdeCreacion = (solicitudCreadaEn.getTime() - registro.creadoEn.getTime()) / 60000
  if (minutosDesdeCreacion <= VENTANA_ARREPENTIMIENTO_MIN) return "arrepentimiento_2min"

  return null
}

export function construirResumenRegistro(registro: RegistroBano): RegistroResumenSolicitud {
  return {
    operador: registro.operador,
    bano: registro.bano,
    fecha: registro.fecha,
    horaEntrada: registro.horaEntrada,
    horaLlegada: registro.horaLlegada,
    tiempoMinutos: registro.tiempoMinutos,
  }
}
