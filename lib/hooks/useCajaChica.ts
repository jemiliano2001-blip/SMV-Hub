import { useState, useEffect, useCallback } from 'react'
import type { MovimientoCajaChica } from '@/lib/schemas'
import {
  listarMovimientosCajaChica,
  crearMovimientoCajaChica,
  actualizarMovimientoCajaChica,
  eliminarMovimientoCajaChica,
  crearCorteCaja,
  NuevoMovimientoCajaPayload,
  OpcionesFiltroCaja
} from '@/lib/caja-chica'

export function useCajaChica(filtro?: string | OpcionesFiltroCaja) {
  const [movimientos, setMovimientos] = useState<MovimientoCajaChica[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Serialización simple para useCallback dependency si es un objeto
  const filtroKey = typeof filtro === 'object' ? JSON.stringify(filtro) : filtro ?? 'CICLO_ACTIVO'

  const cargarMovimientos = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await listarMovimientosCajaChica(filtro)
      setMovimientos(data)
    } catch (err: unknown) {
      console.error("Error cargando caja chica:", err)
      setError("No se pudieron cargar los movimientos.")
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroKey])

  useEffect(() => {
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

  const realizarCorteCaja = async (nota?: string, montoReabastecimiento?: number) => {
    try {
      const res = await crearCorteCaja({ nota, montoReabastecimiento })
      await cargarMovimientos()
      return res
    } catch (err: unknown) {
      console.error("Error realizando corte de caja:", err)
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
    realizarCorteCaja,
    recargar: cargarMovimientos,
  }
}
