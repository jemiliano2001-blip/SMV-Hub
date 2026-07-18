import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  eliminarSeguimientoCobranza,
  guardarSeguimientoCobranza,
  listarSeguimientosCobranza,
} from "@/lib/finanzas-seguimiento"
import type {
  SeguimientoCobranza,
  SeguimientoCobranzaInput,
} from "@/lib/schemas"

export function useSeguimientoCobranza() {
  const [seguimientos, setSeguimientos] = useState<SeguimientoCobranza[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const montado = useRef(true)
  const solicitudActual = useRef(0)

  const cargar = useCallback(async () => {
    const solicitud = ++solicitudActual.current
    if (montado.current) {
      setLoading(true)
      setError(null)
    }
    try {
      const datos = await listarSeguimientosCobranza()
      if (montado.current && solicitud === solicitudActual.current) {
        setSeguimientos(datos)
      }
    } catch (err) {
      console.error("Error cargando seguimiento de cobranza:", err)
      if (montado.current && solicitud === solicitudActual.current) {
        setError("No se pudo cargar el seguimiento de cobranza.")
      }
    } finally {
      if (montado.current && solicitud === solicitudActual.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    montado.current = true
    const solicitud = ++solicitudActual.current
    listarSeguimientosCobranza()
      .then((datos) => {
        if (montado.current && solicitud === solicitudActual.current) {
          setSeguimientos(datos)
        }
      })
      .catch((err: unknown) => {
        console.error("Error cargando seguimiento de cobranza:", err)
        if (montado.current && solicitud === solicitudActual.current) {
          setError("No se pudo cargar el seguimiento de cobranza.")
        }
      })
      .finally(() => {
        if (montado.current && solicitud === solicitudActual.current) {
          setLoading(false)
        }
      })
    return () => {
      montado.current = false
      solicitudActual.current += 1
    }
  }, [])

  const porFactura = useMemo(
    () => new Map(seguimientos.map((seguimiento) => [seguimiento.facturaId, seguimiento])),
    [seguimientos]
  )

  const guardar = useCallback(async (entrada: SeguimientoCobranzaInput): Promise<void> => {
    const guardado = await guardarSeguimientoCobranza(entrada)
    if (!montado.current) return
    setSeguimientos((actuales) => [
      ...actuales.filter((item) => item.facturaId !== guardado.facturaId),
      guardado,
    ])
  }, [])

  const eliminar = useCallback(async (facturaId: string): Promise<void> => {
    await eliminarSeguimientoCobranza(facturaId)
    if (!montado.current) return
    setSeguimientos((actuales) =>
      actuales.filter((item) => item.facturaId !== facturaId)
    )
  }, [])

  return {
    seguimientos,
    porFactura,
    loading,
    error,
    recargar: cargar,
    guardar,
    eliminar,
  }
}
