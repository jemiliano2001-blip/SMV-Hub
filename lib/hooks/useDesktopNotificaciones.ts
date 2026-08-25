'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type EstadoPermisoEscritorio,
  filtrarNotificacionesNuevas,
  getPreferenciaEscritorio,
  getPreferenciaSonido,
  mostrarNotificacionEscritorio,
  obtenerEstadoPermisoEscritorio,
  reproducirTimbreNotificacion,
  setPreferenciaEscritorio,
  setPreferenciaSonido,
  solicitarPermisoNotificaciones,
  soportaNotificacionesEscritorio,
} from '@/lib/desktop-notificaciones'
import type { NotificacionConLeida } from '@/lib/schemas'

/**
 * Registro de notificaciones ya alertadas, **a nivel de módulo y no por instancia**.
 *
 * `NavBar` monta `<NotificacionesBell />` dos veces (la variante de escritorio y la
 * móvil se ocultan por CSS, pero ambas se montan en React) y `/notificaciones`
 * agrega una tercera. Con el registro por instancia, cada una detectaba la misma
 * notificación como "nueva" y sonaba el timbre 2 o 3 veces.
 *
 * Compartiéndolo, la primera instancia cuyo efecto corre marca los ids y las demás
 * ya no los ven como nuevos. Todas leen la misma suscripción de Firestore, así que
 * cuál gane la carrera es indistinto.
 */
const idsAlertados = new Set<string>()
let registroInicializado = false

/** Tope defensivo: la sesión puede durar días y el set solo crece. */
const MAX_IDS_RECORDADOS = 500

function recordarId(id: string): void {
  if (idsAlertados.size >= MAX_IDS_RECORDADOS) {
    const masViejo = idsAlertados.values().next()
    if (!masViejo.done) idsAlertados.delete(masViejo.value)
  }
  idsAlertados.add(id)
}

/** Título base de la pestaña, capturado antes de que le pongamos el contador. */
let tituloBase: string | null = null

export function useDesktopNotificaciones(opciones?: {
  items?: readonly NotificacionConLeida[]
  noLeidas?: number
  enabled?: boolean
}) {
  const enabled = opciones?.enabled !== false
  const [soportado, setSoportado] = useState(false)
  const [permiso, setPermiso] = useState<EstadoPermisoEscritorio>('default')
  const [escritorioActivo, setEscritorioActivo] = useState<boolean>(true)
  const [sonidoActivo, setSonidoActivo] = useState<boolean>(true)

  // El soporte se resuelve en un efecto y no en el render: `window.Notification`
  // no existe en el servidor, así que calcularlo durante el render devolvía
  // `false` en SSR y `true` al hidratar — desajuste de hidratación en las vistas
  // que condicionan secciones enteras con este valor.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- capacidades del navegador, solo disponibles en cliente
    setSoportado(soportaNotificacionesEscritorio())
    setPermiso(obtenerEstadoPermisoEscritorio())
    setEscritorioActivo(getPreferenciaEscritorio())
    setSonidoActivo(getPreferenciaSonido())
  }, [])

  // Espejo en un ref para no re-disparar el efecto de detección cuando cambian las
  // preferencias: solo debe correr cuando llegan notificaciones nuevas.
  const prefsRef = useRef({ sonidoActivo, escritorioActivo, permiso })
  useEffect(() => {
    prefsRef.current = { sonidoActivo, escritorioActivo, permiso }
  }, [sonidoActivo, escritorioActivo, permiso])

  useEffect(() => {
    const items = opciones?.items
    if (!items || !enabled) return

    // La primera pasada útil solo siembra el registro: al abrir la app no deben
    // sonar de golpe todas las notificaciones no leídas acumuladas.
    if (!registroInicializado) {
      for (const item of items) recordarId(item.id)
      registroInicializado = true
      return
    }

    const nuevas = filtrarNotificacionesNuevas(items, idsAlertados)
    if (nuevas.length === 0) return

    for (const n of nuevas) recordarId(n.id)

    const { sonidoActivo: sonido, escritorioActivo: escritorio, permiso: permisoActual } =
      prefsRef.current

    if (sonido) reproducirTimbreNotificacion()

    if (escritorio && permisoActual === 'granted') {
      // `items` viene ordenado por creadoEn desc desde suscribirNotificaciones.
      const masReciente = nuevas[0]
      mostrarNotificacionEscritorio({
        titulo: masReciente.titulo,
        cuerpo: masReciente.cuerpo,
        href: masReciente.href,
        tag: `smv-${masReciente.origenModulo}-${masReciente.origenId}`,
      })
    }
  }, [opciones?.items, enabled])

  // Contador de no leídas en el título de la pestaña.
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (tituloBase === null) {
      // Se respeta el título que puso la página en vez de forzar un literal.
      tituloBase = document.title.replace(/^\(\d+\+?\)\s*/, '') || 'SMV Hub'
    }
    const base = tituloBase
    const noLeidas = opciones?.noLeidas ?? 0
    document.title = noLeidas > 0 ? `(${noLeidas > 99 ? '99+' : noLeidas}) ${base}` : base

    return () => {
      // Sin esta limpieza el contador quedaba pegado al desmontar.
      document.title = base
    }
  }, [opciones?.noLeidas])

  const solicitar = useCallback(async () => {
    const nuevoPermiso = await solicitarPermisoNotificaciones()
    setPermiso(nuevoPermiso)
    if (nuevoPermiso === 'granted') {
      setEscritorioActivo(true)
      setPreferenciaEscritorio(true)
    }
    return nuevoPermiso
  }, [])

  const toggleSonido = useCallback(() => {
    setSonidoActivo((prev) => {
      const siguiente = !prev
      setPreferenciaSonido(siguiente)
      if (siguiente) {
        reproducirTimbreNotificacion()
      }
      return siguiente
    })
  }, [])

  const toggleEscritorio = useCallback(async () => {
    if (permiso !== 'granted') {
      const p = await solicitar()
      if (p !== 'granted') return
    }
    setEscritorioActivo((prev) => {
      const siguiente = !prev
      setPreferenciaEscritorio(siguiente)
      return siguiente
    })
  }, [permiso, solicitar])

  const probarTimbre = useCallback(() => {
    reproducirTimbreNotificacion()
  }, [])

  const probarNotificacion = useCallback(async () => {
    if (permiso !== 'granted') {
      const p = await solicitar()
      if (p !== 'granted') return
    }
    reproducirTimbreNotificacion()
    mostrarNotificacionEscritorio({
      titulo: 'Notificación de prueba · SMV Hub',
      cuerpo: 'Las notificaciones de escritorio en Windows y PC están funcionando correctamente.',
      tag: 'smv-test-notif',
    })
  }, [permiso, solicitar])

  return {
    soportado,
    permiso,
    escritorioActivo,
    sonidoActivo,
    solicitarPermiso: solicitar,
    toggleSonido,
    toggleEscritorio,
    probarTimbre,
    probarNotificacion,
  }
}

/** Solo para pruebas: limpia el registro compartido entre casos. */
export function __resetRegistroAlertas(): void {
  idsAlertados.clear()
  registroInicializado = false
  tituloBase = null
}
