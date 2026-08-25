/**
 * Helper seguro para retroalimentación táctil / háptica (Web Vibration API).
 * Funciona de forma transparente en navegadores móviles compatibles sin arrojar errores en escritorio.
 */

export function puedeVibrar(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

/** Vibración sutil de 20ms para toques en botones, chips y navegación */
export function vibrarTap(): boolean {
  if (!puedeVibrar()) return false
  try {
    return navigator.vibrate(20)
  } catch {
    return false
  }
}

/** Vibración doble de confirmación de éxito (guardado, escaneo completado) */
export function vibrarExito(): boolean {
  if (!puedeVibrar()) return false
  try {
    return navigator.vibrate([25, 40, 25])
  } catch {
    return false
  }
}

/** Vibración de advertencia o confirmación destructiva */
export function vibrarAlerta(): boolean {
  if (!puedeVibrar()) return false
  try {
    return navigator.vibrate([50, 60, 50])
  } catch {
    return false
  }
}

/** Vibración de error */
export function vibrarError(): boolean {
  if (!puedeVibrar()) return false
  try {
    return navigator.vibrate([80, 50, 80])
  } catch {
    return false
  }
}
