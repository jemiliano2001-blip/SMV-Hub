/** Tasa combinada máxima habitual en Texas (6.25% estatal + hasta 2% local). */
export const TASA_IMPUESTO_TEXAS = 0.0825

/** Tolerancia en centavos por redondeo de facturas y de la IA. */
export const TOLERANCIA_CENTAVOS_DEFAULT = 0.02

export type MontosFactura = {
  subtotal: number | null | undefined
  envio: number | null | undefined
  impuestos: number | null | undefined
  total: number | null | undefined
}

function monto(v: number | null | undefined): number {
  return v ?? 0
}

/** Suma parcial: subtotal + envío + impuestos (null se trata como 0). */
export function calcularTotalEsperado(montos: MontosFactura): number | null {
  const { subtotal, envio, impuestos, total } = montos
  if (subtotal == null && envio == null && impuestos == null) return null
  if (total == null) return null
  return monto(subtotal) + monto(envio) + monto(impuestos)
}

export type ResultadoCuadre = {
  cuadra: boolean
  esperado: number | null
  diferencia: number | null
  mensaje: string | null
}

/**
 * Verifica subtotal + envío + impuestos = total.
 * En facturas de proveedores USA (p. ej. McMaster), el envío suele ir aparte y el tax
 * (8.25% en Texas) se calcula sobre mercancía + envío.
 */
export function validarCuadreFactura(
  montos: MontosFactura,
  toleranciaCentavos = TOLERANCIA_CENTAVOS_DEFAULT
): ResultadoCuadre {
  const { total } = montos
  const esperado = calcularTotalEsperado(montos)

  if (total == null || esperado == null) {
    return { cuadra: true, esperado, diferencia: null, mensaje: null }
  }

  const diferencia = Math.abs(esperado - total)
  if (diferencia <= toleranciaCentavos) {
    return { cuadra: true, esperado, diferencia, mensaje: null }
  }

  const partes: string[] = []
  if (montos.subtotal != null) partes.push(`subtotal ${montos.subtotal.toFixed(2)}`)
  if (montos.envio != null && montos.envio !== 0) partes.push(`envío ${montos.envio.toFixed(2)}`)
  if (montos.impuestos != null) partes.push(`impuestos ${montos.impuestos.toFixed(2)}`)

  return {
    cuadra: false,
    esperado,
    diferencia,
    mensaje:
      partes.length > 0
        ? `${partes.join(" + ")} = ${esperado.toFixed(2)}, pero el total es ${total.toFixed(2)}`
        : `El total esperado (${esperado.toFixed(2)}) no coincide con ${total.toFixed(2)}`,
  }
}

export type ResultadoImpuestoTexas = {
  coherente: boolean
  baseGravable: number | null
  impuestoEsperado: number | null
  tasaImplicita: number | null
  mensaje: string | null
}

/** Compara impuestos contra 8.25% de (subtotal + envío), típico en Texas. */
export function validarImpuestoTexas(
  montos: Pick<MontosFactura, "subtotal" | "envio" | "impuestos">,
  tasa = TASA_IMPUESTO_TEXAS,
  toleranciaCentavos = TOLERANCIA_CENTAVOS_DEFAULT
): ResultadoImpuestoTexas {
  const { subtotal, envio, impuestos } = montos
  if (impuestos == null) {
    return {
      coherente: true,
      baseGravable: null,
      impuestoEsperado: null,
      tasaImplicita: null,
      mensaje: null,
    }
  }

  const base = monto(subtotal) + monto(envio)
  if (base <= 0) {
    return {
      coherente: true,
      baseGravable: base,
      impuestoEsperado: null,
      tasaImplicita: null,
      mensaje: null,
    }
  }

  const impuestoEsperado = Math.round(base * tasa * 100) / 100
  const diferencia = Math.abs(impuestos - impuestoEsperado)
  const tasaImplicita = Math.round((impuestos / base) * 10000) / 10000

  if (diferencia <= toleranciaCentavos) {
    return {
      coherente: true,
      baseGravable: base,
      impuestoEsperado,
      tasaImplicita,
      mensaje: null,
    }
  }

  // Si cuadra solo sobre subtotal (sin envío), sugerir que falta incluir envío en la base.
  const soloSubtotal = monto(subtotal)
  const impuestoSoloSubtotal =
    soloSubtotal > 0 ? Math.round(soloSubtotal * tasa * 100) / 100 : null
  const cuadraSinEnvio =
    impuestoSoloSubtotal != null &&
    Math.abs(impuestos - impuestoSoloSubtotal) <= toleranciaCentavos

  let mensaje = `Impuesto ${impuestos.toFixed(2)} no coincide con ${(tasa * 100).toFixed(2)}% sobre ${base.toFixed(2)} (esperado ~${impuestoEsperado.toFixed(2)})`
  if (cuadraSinEnvio && monto(envio) > 0) {
    mensaje += `. Parece calculado solo sobre subtotal; en Texas el tax suele incluir el envío.`
  }

  return {
    coherente: false,
    baseGravable: base,
    impuestoEsperado,
    tasaImplicita,
    mensaje,
  }
}
