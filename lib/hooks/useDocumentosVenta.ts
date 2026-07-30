"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  agregarMensajeSolicitud,
  actualizarEstadoSolicitudDocumento,
  crearSolicitudDocumento,
  suscribirMensajesSolicitud,
  suscribirSolicitudesDocumento,
} from "@/lib/documentos-venta"
import {
  suscribirVentasOdooSo,
  suscribirVentasOdooSyncState,
  type EstadoSyncVentasOdoo,
} from "@/lib/documentos-venta-odoo"
import { sincronizarVentasOdoo } from "@/lib/services/ventas-odoo-sync"
import type {
  EstadoSolicitudDocumento,
  MensajeSolicitudDocumento,
  NuevaSolicitudDocumento,
  SolicitudDocumento,
  VentaOdooSo,
} from "@/lib/schemas"

export function useDocumentosVenta(opts: {
  uid: string | null
  atiende: boolean
  solicitudIdSeleccionada?: string | null
}) {
  const { uid, atiende, solicitudIdSeleccionada = null } = opts

  const [sos, setSos] = useState<VentaOdooSo[]>([])
  const [syncState, setSyncState] = useState<EstadoSyncVentasOdoo | null>(null)
  const [solicitudesRaw, setSolicitudesRaw] = useState<SolicitudDocumento[]>([])
  const [mensajes, setMensajes] = useState<MensajeSolicitudDocumento[]>([])
  const [loading, setLoading] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsubSo = suscribirVentasOdooSo(
      (rows) => {
        setSos(rows)
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err.message || "No se pudieron cargar las órdenes de venta")
        setLoading(false)
      }
    )

    const unsubSync = suscribirVentasOdooSyncState(
      (state) => {
        setSyncState(state)
      },
      (err) => {
        console.error(err)
        setError((prev) => prev ?? (err.message || "No se pudo leer el estado de sincronización"))
      }
    )

    const unsubSolicitudes = suscribirSolicitudesDocumento(
      (rows) => {
        setSolicitudesRaw(rows)
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err.message || "No se pudieron cargar las solicitudes")
        setLoading(false)
      },
      { atiende, uid }
    )

    return () => {
      unsubSo()
      unsubSync()
      unsubSolicitudes()
    }
  }, [atiende, uid])

  useEffect(() => {
    if (!solicitudIdSeleccionada) {
      setMensajes([])
      return
    }

    const unsub = suscribirMensajesSolicitud(
      solicitudIdSeleccionada,
      (rows) => {
        setMensajes(rows)
      },
      (err) => {
        console.error(err)
        setError(err.message || "No se pudieron cargar los mensajes")
      }
    )

    return unsub
  }, [solicitudIdSeleccionada])

  const solicitudes = useMemo(() => {
    if (atiende) return solicitudesRaw
    if (!uid) return []
    return solicitudesRaw.filter((s) => s.solicitadoPorUid === uid)
  }, [solicitudesRaw, atiende, uid])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const sincronizar = useCallback(async () => {
    setSincronizando(true)
    setError(null)
    try {
      await sincronizarVentasOdoo()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falló la sincronización con Odoo"
      setError(
        /internal|CORS|not-found|NOT_FOUND/i.test(msg)
          ? `${msg} — ¿ya se desplegó syncOdooVentasManual?`
          : msg
      )
      throw e
    } finally {
      setSincronizando(false)
    }
  }, [])

  const crearSolicitud = useCallback(
    async (
      data: NuevaSolicitudDocumento,
      opts?: { lineasSo?: readonly { odooLineId: number; qtyPending: number }[] }
    ): Promise<string> => {
      setError(null)
      try {
        return await crearSolicitudDocumento(data, opts)
      } catch (e) {
        const msg = e instanceof Error ? e.message : "No se pudo crear la solicitud"
        setError(msg)
        throw e
      }
    },
    []
  )

  const actualizarEstado = useCallback(
    async (args: {
      id: string
      desde: EstadoSolicitudDocumento
      hacia: EstadoSolicitudDocumento
      esAtendedor: boolean
      esSolicitante: boolean
      uid: string
      nombre: string
      folioOdoo?: string | null
      motivoRechazo?: string | null
    }): Promise<void> => {
      setError(null)
      try {
        await actualizarEstadoSolicitudDocumento(args)
      } catch (e) {
        const msg = e instanceof Error ? e.message : "No se pudo actualizar el estado"
        setError(msg)
        throw e
      }
    },
    []
  )

  const agregarMensaje = useCallback(
    async (solicitudId: string, texto: string, autorUid: string, autorNombre: string) => {
      setError(null)
      try {
        return await agregarMensajeSolicitud(solicitudId, texto, autorUid, autorNombre)
      } catch (e) {
        const msg = e instanceof Error ? e.message : "No se pudo enviar el mensaje"
        setError(msg)
        throw e
      }
    },
    []
  )

  return {
    sos,
    syncState,
    solicitudes,
    mensajes,
    loading,
    sincronizando,
    error,
    clearError,
    sincronizar,
    crearSolicitud,
    actualizarEstado,
    agregarMensaje,
  }
}
