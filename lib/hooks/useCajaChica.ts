import { useState, useEffect, useCallback } from 'react'
import type { MovimientoCajaChica } from '@/lib/schemas'
import {
  listarMovimientosCajaChica,
  crearMovimientoCajaChica,
  actualizarMovimientoCajaChica,
  eliminarMovimientoCajaChica,
  NuevoMovimientoCajaPayload
} from '@/lib/caja-chica'

export function useCajaChica(periodo?: string) {
  const [movimientos, setMovimientos] = useState<MovimientoCajaChica[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargarMovimientos = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await listarMovimientosCajaChica(periodo)
      setMovimientos(data)
    } catch (err: unknown) {
      console.error("Error cargando caja chica:", err)
      setError("No se pudieron cargar los movimientos.")
    } finally {
      setLoading(false)
    }
  }, [periodo])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarMovimientos()
  }, [cargarMovimientos])

  const agregarMovimiento = async (payload: NuevoMovimientoCajaPayload) => {
    try {
      await crearMovimientoCajaChica(payload)
      await cargarMovimientos() // refetch
    } catch (err: unknown) {
      console.error("Error agregando movimiento:", err)
      throw err
    }
  }

  const actualizarMovimiento = async (id: string, cambios: Partial<Omit<MovimientoCajaChica, 'id' | 'creadoEn'>>) => {
    try {
      await actualizarMovimientoCajaChica(id, cambios)
      await cargarMovimientos()
    } catch (err: unknown) {
      console.error("Error actualizando movimiento:", err)
      throw err
    }
  }

  const borrarMovimiento = async (id: string) => {
    try {
      await eliminarMovimientoCajaChica(id)
      await cargarMovimientos()
    } catch (err: unknown) {
      console.error("Error eliminando movimiento:", err)
      throw err
    }
  }

  return {
    movimientos,
    loading,
    error,
    agregarMovimiento,
    actualizarMovimiento,
    borrarMovimiento,
    recargar: cargarMovimientos,
  }
}
