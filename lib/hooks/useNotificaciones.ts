import { useCallback, useEffect, useMemo, useState } from "react"
import { getClienteAuth } from "@/lib/firebase"
import {
  audienciasNotificacionParaUsuario,
  contarNoLeidas,
  descartarNotificacion as descartarNotificacionDb,
  descartarTodasNotificaciones as descartarTodasDb,
  marcarNotificacionLeida,
  marcarTodasNotificacionesLeidas,
  mergeNotificacionesConLeidas,
  ordenarParaDropdown,
  suscribirNotificaciones,
  suscribirNotificacionesDescartadas,
  suscribirNotificacionesLeidas,
} from "@/lib/notificaciones"
import type { ModuloId, NotificacionConLeida, OrigenModuloNotificacion } from "@/lib/schemas"

export type FiltroLeida = "todas" | "no_leidas" | "leidas"
export type FiltroOrigen = "todos" | OrigenModuloNotificacion

export function useNotificaciones(opciones?: {
  enabled?: boolean
  uid?: string | null
  modulos?: readonly ModuloId[] | null
  esSuperAdmin?: boolean
  atiendeDocumentosVenta?: boolean
}) {
  const enabled = opciones?.enabled !== false
  const uid =
    opciones && "uid" in opciones
      ? opciones.uid ?? null
      : getClienteAuth().currentUser?.uid ?? null
  const [leidasConfirmadas, setLeidasConfirmadas] = useState<Set<string>>(new Set())
  const [leidasOptimistas, setLeidasOptimistas] = useState<Set<string>>(new Set())
  const [descartadasConfirmadas, setDescartadasConfirmadas] = useState<Set<string>>(new Set())
  const [descartadasOptimistas, setDescartadasOptimistas] = useState<Set<string>>(new Set())
  const [raw, setRaw] = useState<Parameters<typeof mergeNotificacionesConLeidas>[0]>([])
  const [cargandoFeed, setCargandoFeed] = useState(enabled && Boolean(uid))
  const [cargandoLeidas, setCargandoLeidas] = useState(enabled && Boolean(uid))
  const [cargandoDescartadas, setCargandoDescartadas] = useState(enabled && Boolean(uid))
  const [errorFeed, setErrorFeed] = useState<string | null>(null)
  const [errorLeidas, setErrorLeidas] = useState<string | null>(null)
  const [errorDescartadas, setErrorDescartadas] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)
  const audiencias = useMemo(
    () =>
      audienciasNotificacionParaUsuario({
        modulos: opciones?.modulos,
        esSuperAdmin: opciones?.esSuperAdmin === true,
        atiendeDocumentosVenta: opciones?.atiendeDocumentosVenta === true,
      }),
    [opciones?.atiendeDocumentosVenta, opciones?.esSuperAdmin, opciones?.modulos]
  )
  const claveAudiencias = audiencias.join(",")

  useEffect(() => {
    if (!enabled || !uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset al deshabilitar el hook
      setCargandoFeed(false)
      setRaw([])
      setErrorFeed(null)
      return
    }
    setCargandoFeed(true)
    setErrorFeed(null)
    const unsub = suscribirNotificaciones(
      (lista) => {
        setRaw(lista)
        setCargandoFeed(false)
        setErrorFeed(null)
      },
      { uid, audiencias },
      (err) => {
        setErrorFeed(err.message || "No se pudieron cargar las notificaciones")
        setCargandoFeed(false)
      }
    )
    return unsub
  }, [audiencias, claveAudiencias, enabled, intento, uid])

  useEffect(() => {
    if (!enabled || !uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sin sesión no hay leídos
      setLeidasConfirmadas(new Set())
      setLeidasOptimistas(new Set())
      setCargandoLeidas(false)
      setErrorLeidas(null)
      return
    }
    setCargandoLeidas(true)
    setErrorLeidas(null)
    const unsub = suscribirNotificacionesLeidas(
      uid,
      (ids) => {
        setLeidasConfirmadas(ids)
        setLeidasOptimistas((previas) => {
          const pendientes = new Set([...previas].filter((id) => !ids.has(id)))
          return pendientes.size === previas.size ? previas : pendientes
        })
        setCargandoLeidas(false)
        setErrorLeidas(null)
      },
      (err) => {
        console.error(err)
        setErrorLeidas(err.message || "No se pudieron cargar los leídos")
        setCargandoLeidas(false)
      }
    )
    return unsub
  }, [uid, enabled, intento])

  useEffect(() => {
    if (!enabled || !uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sin sesión no hay descartadas
      setDescartadasConfirmadas(new Set())
      setDescartadasOptimistas(new Set())
      setCargandoDescartadas(false)
      setErrorDescartadas(null)
      return
    }
    setCargandoDescartadas(true)
    setErrorDescartadas(null)
    const unsub = suscribirNotificacionesDescartadas(
      uid,
      (ids) => {
        setDescartadasConfirmadas(ids)
        setDescartadasOptimistas((previas) => {
          const pendientes = new Set([...previas].filter((id) => !ids.has(id)))
          return pendientes.size === previas.size ? previas : pendientes
        })
        setCargandoDescartadas(false)
        setErrorDescartadas(null)
      },
      (err) => {
        console.error(err)
        setErrorDescartadas(err.message || "No se pudieron cargar las notificaciones descartadas")
        setCargandoDescartadas(false)
      }
    )
    return unsub
  }, [uid, enabled, intento])

  const leidasIds = useMemo(
    () => new Set([...leidasConfirmadas, ...leidasOptimistas]),
    [leidasConfirmadas, leidasOptimistas]
  )

  const descartadasIds = useMemo(
    () => new Set([...descartadasConfirmadas, ...descartadasOptimistas]),
    [descartadasConfirmadas, descartadasOptimistas]
  )

  const items = useMemo(
    () => mergeNotificacionesConLeidas(raw, leidasIds, descartadasIds),
    [raw, leidasIds, descartadasIds]
  )

  const noLeidas = useMemo(() => contarNoLeidas(items), [items])
  const paraDropdown = useMemo(() => ordenarParaDropdown(items).slice(0, 10), [items])

  const marcarLeida = useCallback(
    async (id: string) => {
      if (!uid) throw new Error("No hay una sesión activa para guardar el leído")
      setLeidasOptimistas((previas) => new Set(previas).add(id))
      try {
        await marcarNotificacionLeida(uid, id)
      } catch (err) {
        setLeidasOptimistas((previas) => {
          const siguientes = new Set(previas)
          siguientes.delete(id)
          return siguientes
        })
        console.error(err)
        throw err
      }
    },
    [uid]
  )

  const marcarTodas = useCallback(async () => {
    if (!uid) throw new Error("No hay una sesión activa para guardar los leídos")
    const ids = items.filter((n) => !n.leida).map((n) => n.id)
    if (ids.length === 0) return
    setLeidasOptimistas((previas) => new Set([...previas, ...ids]))
    try {
      await marcarTodasNotificacionesLeidas(uid, ids)
    } catch (err) {
      setLeidasOptimistas((previas) => {
        const siguientes = new Set(previas)
        for (const id of ids) siguientes.delete(id)
        return siguientes
      })
      throw err
    }
  }, [uid, items])

  const descartarNotificacion = useCallback(
    async (id: string) => {
      if (!uid) throw new Error("No hay una sesión activa para descartar la notificación")
      setDescartadasOptimistas((previas) => new Set(previas).add(id))
      try {
        await descartarNotificacionDb(uid, id)
      } catch (err) {
        setDescartadasOptimistas((previas) => {
          const siguientes = new Set(previas)
          siguientes.delete(id)
          return siguientes
        })
        console.error(err)
        throw err
      }
    },
    [uid]
  )

  const descartarTodas = useCallback(
    async (idsParaDescartar?: readonly string[]) => {
      if (!uid) throw new Error("No hay una sesión activa para descartar notificaciones")
      const ids = idsParaDescartar ? [...idsParaDescartar] : items.map((n) => n.id)
      if (ids.length === 0) return
      setDescartadasOptimistas((previas) => new Set([...previas, ...ids]))
      try {
        await descartarTodasDb(uid, ids)
      } catch (err) {
        setDescartadasOptimistas((previas) => {
          const siguientes = new Set(previas)
          for (const id of ids) siguientes.delete(id)
          return siguientes
        })
        throw err
      }
    },
    [uid, items]
  )

  const filtrar = useCallback(
    (origen: FiltroOrigen, leida: FiltroLeida): NotificacionConLeida[] => {
      return items.filter((n) => {
        if (origen !== "todos" && n.origenModulo !== origen) return false
        if (leida === "no_leidas" && n.leida) return false
        if (leida === "leidas" && !n.leida) return false
        return true
      })
    },
    [items]
  )

  return {
    items,
    paraDropdown,
    noLeidas,
    cargando: enabled && Boolean(uid) && (cargandoFeed || cargandoLeidas || cargandoDescartadas),
    error: errorFeed ?? errorLeidas ?? errorDescartadas,
    marcarLeida,
    marcarTodas,
    descartarNotificacion,
    descartarTodas,
    filtrar,
    uid,
    reintentar: () => setIntento((actual) => actual + 1),
  }
}
