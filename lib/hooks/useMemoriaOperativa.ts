'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  consultarMemoriaOperativa,
  type ContextoOperativo,
  type PiezaConsulta,
} from '@/lib/services/memoria-operativa'

export interface OpcionesHookMemoriaOperativa {
  debounceMs?: number
  enabled?: boolean
}

export function useMemoriaOperativa(
  piezas: readonly PiezaConsulta[],
  opciones: OpcionesHookMemoriaOperativa = {}
) {
  const debounceMs = opciones.debounceMs ?? 500
  const enabled = opciones.enabled !== false

  const [contextos, setContextos] = useState<Map<number, ContextoOperativo>>(new Map())
  const [cargando, setCargando] = useState(false)
  const [verPrecios, setVerPrecios] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [intento, setIntento] = useState(0)

  // Huella de las piezas para evitar llamadas si nada cambió
  const huella = useMemo(() => {
    return (piezas ?? [])
      .map(
        (p) =>
          `${p?.descripcion || ''}|${p?.numeroParte || ''}|${p?.proveedorId || p?.proveedor || ''}|${p?.precioUnitario ?? ''}|${p?.moneda || ''}`
      )
      .join(';;')
  }, [piezas])

  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!enabled || !piezas || piezas.length === 0 || !piezas.some((p) => p?.descripcion?.trim())) {
      queueMicrotask(() => {
        setContextos(new Map())
        setCargando(false)
        setError(null)
      })
      return
    }

    let cancelado = false
    // Cancelar consulta anterior si aún estaba en vuelo
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    const timer = setTimeout(() => {
      if (cancelado) return

      setCargando(true)
      setError(null)

      consultarMemoriaOperativa(piezas, { signal: controller.signal })
        .then((res) => {
          if (cancelado) return

          if (res.ok) {
            const map = new Map<number, ContextoOperativo>()
            // El backend devuelve contextos ordenados según las piezas válidas enviadas
            res.respuesta.contextos.forEach((ctx, idx) => {
              // Si enviamos menos piezas válidas que el total, mapeamos al índice correcto
              map.set(ctx.indice ?? idx, ctx)
            })

            setContextos(map)
            setVerPrecios(res.respuesta.verPrecios)
            setError(null)
          } else {
            if (res.motivo !== 'cancelado') {
              setError(res.mensaje)
            }
          }
          setCargando(false)
        })
        .catch((err: unknown) => {
          if (cancelado) return
          if (controller.signal.aborted) return
          console.warn('Error en hook useMemoriaOperativa:', err)
          setError('No se pudo consultar el historial')
          setCargando(false)
        })
    }, debounceMs)

    return () => {
      cancelado = true
      clearTimeout(timer)
      controller.abort()
    }
  }, [debounceMs, enabled, huella, intento, piezas])

  const contextoPorIndice = useCallback(
    (indice: number): ContextoOperativo | null => {
      return contextos.get(indice) ?? null
    },
    [contextos]
  )

  const recargar = useCallback(() => {
    setIntento((prev) => prev + 1)
  }, [])

  return {
    contextos,
    contextoPorIndice,
    primerContexto: contextos.get(0) ?? null,
    cargando,
    verPrecios,
    error,
    recargar,
  }
}
