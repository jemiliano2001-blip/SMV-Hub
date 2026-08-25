/**
 * Utilidades para notificaciones nativas de escritorio (Windows / Mac / PC)
 * y síntesis de audio para alertas amigables en SMV Hub.
 */

export type EstadoPermisoEscritorio = 'granted' | 'denied' | 'default' | 'unsupported'

const PREF_ESCRITORIO_KEY = 'smv_notif_desktop_activo'
const PREF_SONIDO_KEY = 'smv_notif_sonido_activo'

/** Comprueba si el navegador actual soporta la API de Notificaciones de escritorio. */
export function soportaNotificacionesEscritorio(): boolean {
  if (typeof window === 'undefined') return false
  return 'Notification' in window && typeof window.Notification !== 'undefined'
}

/** Devuelve el estado actual de permisos del navegador. */
export function obtenerEstadoPermisoEscritorio(): EstadoPermisoEscritorio {
  if (!soportaNotificacionesEscritorio()) return 'unsupported'
  return (window.Notification?.permission ?? 'unsupported') as EstadoPermisoEscritorio
}

/** Solicita permiso al usuario para mostrar notificaciones nativas. */
export async function solicitarPermisoNotificaciones(): Promise<EstadoPermisoEscritorio> {
  if (!soportaNotificacionesEscritorio()) return 'unsupported'
  try {
    const res = await window.Notification.requestPermission()
    return res as EstadoPermisoEscritorio
  } catch (err) {
    console.error('Error al solicitar permiso de notificaciones:', err)
    return obtenerEstadoPermisoEscritorio()
  }
}

/** Obtiene la preferencia del usuario sobre si desea notificaciones de escritorio. */
export function getPreferenciaEscritorio(): boolean {
  if (typeof window === 'undefined') return true
  const valor = localStorage.getItem(PREF_ESCRITORIO_KEY)
  return valor === null ? true : valor === 'true'
}

/** Guarda la preferencia de notificaciones de escritorio. */
export function setPreferenciaEscritorio(activo: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(PREF_ESCRITORIO_KEY, String(activo))
}

/** Obtiene la preferencia del usuario sobre si desea sonido de alerta. */
export function getPreferenciaSonido(): boolean {
  if (typeof window === 'undefined') return true
  const valor = localStorage.getItem(PREF_SONIDO_KEY)
  return valor === null ? true : valor === 'true'
}

/** Guarda la preferencia de sonido de alerta. */
export function setPreferenciaSonido(activo: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(PREF_SONIDO_KEY, String(activo))
}

/**
 * Contexto de audio reutilizado entre timbres.
 *
 * Antes se creaba uno nuevo en cada llamada y nunca se cerraba. Los navegadores
 * limitan los AudioContext concurrentes por documento (Chrome, ~6): pasado el
 * tope el constructor lanza y el timbre dejaba de sonar en silencio, porque el
 * catch de abajo solo hace `console.debug`.
 */
let ctxCompartido: AudioContext | null = null

type ConstructorAudioContext = new () => AudioContext

function obtenerAudioContext(): AudioContext | null {
  if (ctxCompartido && ctxCompartido.state !== 'closed') return ctxCompartido

  const ventana = window as typeof window & {
    webkitAudioContext?: ConstructorAudioContext
  }
  const AudioContextClass: ConstructorAudioContext | undefined =
    window.AudioContext ?? ventana.webkitAudioContext
  if (!AudioContextClass) return null

  ctxCompartido = new AudioContextClass()
  return ctxCompartido
}

/**
 * Sintetiza un timbre suave, elegante y amigable de dos tonos (E5 -> B5)
 * utilizando Web Audio API nativa. No requiere descargar archivos externos.
 */
export function reproducirTimbreNotificacion(): void {
  if (typeof window === 'undefined') return
  try {
    const ctx = obtenerAudioContext()
    if (!ctx) return

    // Los navegadores suspenden el contexto hasta que hay interacción del usuario.
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }

    const ahora = ctx.currentTime

    // Tono 1: Mi5 (659.25 Hz)
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(659.25, ahora)
    gain1.gain.setValueAtTime(0.12, ahora)
    gain1.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.35)

    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.start(ahora)
    osc1.stop(ahora + 0.35)

    // Tono 2: Si5 (987.77 Hz) - armónico suave posterior
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(987.77, ahora + 0.1)
    gain2.gain.setValueAtTime(0.15, ahora + 0.1)
    gain2.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.55)

    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.start(ahora + 0.1)
    osc2.stop(ahora + 0.55)
  } catch (err) {
    // Si el navegador bloquea audio por falta de interacción previa, no rompemos el flujo
    console.debug('No se pudo reproducir audio chime:', err)
  }
}

/** Solo para pruebas: descarta el AudioContext compartido entre casos. */
export function __resetAudioContext(): void {
  ctxCompartido = null
}

/**
 * Notificaciones que aún no han disparado una alerta.
 *
 * Vive fuera del hook a propósito: `NavBar` monta la campana dos veces (escritorio
 * y móvil) y `/notificaciones` agrega una tercera, así que el conjunto de ids ya
 * alertados se comparte entre todas. Al ser una función pura sobre ese conjunto,
 * la segunda y tercera instancia ven la lista vacía y no repiten el timbre.
 */
export function filtrarNotificacionesNuevas<T extends { id: string; leida: boolean }>(
  items: readonly T[],
  yaAlertados: ReadonlySet<string>
): T[] {
  return items.filter((n) => !n.leida && !yaAlertados.has(n.id))
}

export type OpcionesNotificacionEscritorio = {
  titulo: string
  cuerpo: string
  tag?: string
  href?: string
  onClick?: () => void
}

/**
 * Lanza una notificación nativa del sistema operativo (Windows / Mac / PC).
 */
export function mostrarNotificacionEscritorio(
  opciones: OpcionesNotificacionEscritorio
): Notification | null {
  if (!soportaNotificacionesEscritorio()) return null
  if (window.Notification.permission !== 'granted') return null
  if (!getPreferenciaEscritorio()) return null

  try {
    const notif = new window.Notification(opciones.titulo, {
      body: opciones.cuerpo,
      icon: '/icon.png',
      badge: '/icon.png',
      tag: opciones.tag || 'smv-hub-alerta',
    })

    notif.onclick = () => {
      window.focus()
      if (opciones.onClick) {
        opciones.onClick()
      } else if (opciones.href) {
        window.location.href = opciones.href
      }
      notif.close()
    }

    return notif
  } catch (err) {
    console.error('Error al mostrar notificación de escritorio:', err)
    return null
  }
}
