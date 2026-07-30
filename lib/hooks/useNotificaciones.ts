import { useCallback, useEffect, useMemo, useState } from "react"
import { getClienteAuth } from "@/lib/firebase"
import {
  contarNoLeidas,
  marcarNotificacionLeida,
  marcarTodasNotificacionesLeidas,
  mergeNotificacionesConLeidas,
  ordenarParaDropdown,
  suscribirNotificaciones,
  suscribirNotificacionesLeidas,
} from "@/lib/notificaciones"
import type { NotificacionConLeida, OrigenModuloNotificacion } from "@/lib/schemas"

export type FiltroLeida = "todas" | "no_leidas" | "leidas"
export type FiltroOrigen = "todos" | OrigenModuloNotificacion

export function useNotificaciones(opciones?: { enabled?: boolean }) {
  const enabled = opciones?.enabled !== false
  const [leidasIds, setLeidasIds] = useState<Set<string>>(new Set())
  const [raw, setRaw] = useState<Parameters<typeof mergeNotificacionesConLeidas>[0]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const uid = getClienteAuth().currentUser?.uid ?? null

  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset al deshabilitar el hook
      setCargando(false)
      setRaw([])
      return
    }
    setCargando(true)
    const unsub = suscribirNotificaciones(
      (lista) => {
        setRaw(lista)
        setCargando(false)
        setError(null)
      },
      (err) => {
        setError(err.message || "No se pudieron cargar las notificaciones")
        setCargando(false)
      }
    )
    return unsub
  }, [enabled])

  useEffect(() => {
    if (!enabled || !uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sin sesión no hay leídos
      setLeidasIds(new Set())
      return
    }
    const unsub = suscribirNotificacionesLeidas(
      uid,
      (ids) => setLeidasIds(ids),
      (err) => {
        console.error(err)
        setError(err.message || "No se pudieron cargar los leídos")
      }
    )
    return unsub
  }, [uid, enabled])

  const items = useMemo(
    () => mergeNotificacionesConLeidas(raw, leidasIds),
    [raw, leidasIds]
  )

  const noLeidas = useMemo(() => contarNoLeidas(items), [items])
  const paraDropdown = useMemo(() => ordenarParaDropdown(items).slice(0, 10), [items])

  const marcarLeida = useCallback(
    async (id: string) => {
      if (!uid) return
      try {
        await marcarNotificacionLeida(uid, id)
      } catch (err) {
        console.error(err)
        throw err
      }
    },
    [uid]
  )

  const marcarTodas = useCallback(async () => {
    if (!uid) return
    const ids = items.filter((n) => !n.leida).map((n) => n.id)
    if (ids.length === 0) return
    await marcarTodasNotificacionesLeidas(uid, ids)
  }, [uid, items])

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
    cargando,
    error,
    marcarLeida,
    marcarTodas,
    filtrar,
    uid,
  }
}
