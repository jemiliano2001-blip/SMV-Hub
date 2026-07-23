import { useState, useEffect, useCallback } from 'react'
import {
  obtenerPaginaOrdenesServicio,
  contarOrdenesServicio,
  crearOrdenServicio,
  actualizarOrdenServicio,
  eliminarOrdenServicio,
  eliminarOrdenesServicioLote,
  type NuevaOrdenServicioPayload,
  type CursorOrdenesServicio,
} from '@/lib/ordenes-servicio'
import type { OrdenServicio, EstatusOrdenServicio } from '@/lib/schemas'

const TAMANO_PAGINA = 50

export function useOrdenesServicio() {
  const [ordenes, setOrdenes] = useState<OrdenServicio[]>([])
  const [cursor, setCursor] = useState<CursorOrdenesServicio | null>(null)
  const [hayMas, setHayMas] = useState(false)
  const [totalOrdenes, setTotalOrdenes] = useState(0)
  const [loading, setLoading] = useState(true)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchOrdenes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [pagina, total] = await Promise.all([
        obtenerPaginaOrdenesServicio(TAMANO_PAGINA),
        contarOrdenesServicio(),
      ])
      setOrdenes(pagina.items)
      setCursor(pagina.siguienteCursor)
      setHayMas(pagina.hayMas)
      setTotalOrdenes(total)
    } catch (err) {
      console.error('Error cargando órdenes de servicio:', err)
      setError('No se pudieron cargar las órdenes. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchOrdenes()
  }, [fetchOrdenes])

  const cargarMas = useCallback(async () => {
    if (!cursor || !hayMas || cargandoMas || loading) return
    setCargandoMas(true)
    try {
      const pagina = await obtenerPaginaOrdenesServicio(TAMANO_PAGINA, cursor)
      setOrdenes((actuales) => {
        const ids = new Set(actuales.map((o) => o.id))
        return [...actuales, ...pagina.items.filter((o) => !ids.has(o.id))]
      })
      setCursor(pagina.siguienteCursor)
      setHayMas(pagina.hayMas)
    } catch (err) {
      console.error('Error cargando más órdenes de servicio:', err)
      setError('No se pudo cargar la siguiente página de órdenes.')
    } finally {
      setCargandoMas(false)
    }
  }, [cursor, hayMas, cargandoMas, loading])

  async function agregarOrden(payload: NuevaOrdenServicioPayload): Promise<void> {
    await crearOrdenServicio(payload)
    await fetchOrdenes()
  }

  async function actualizarEstatus(id: string, estatus: EstatusOrdenServicio): Promise<void> {
    await actualizarOrdenServicio(id, { estatus })
    setOrdenes((prev) =>
      prev.map((o) => (o.id === id ? { ...o, estatus } : o))
    )
  }

  async function borrarOrden(id: string): Promise<void> {
    await eliminarOrdenServicio(id)
    setOrdenes((prev) => prev.filter((o) => o.id !== id))
    setTotalOrdenes((total) => Math.max(0, total - 1))
  }

  async function editarOrden(
    id: string,
    cambios: Partial<Omit<OrdenServicio, 'id' | 'creadoEn'>>
  ): Promise<void> {
    await actualizarOrdenServicio(id, cambios)
    setOrdenes((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...cambios } : o))
    )
  }

  async function borrarOrdenesServicioLote(ids: string[]): Promise<boolean> {
    try {
      await eliminarOrdenesServicioLote(ids)
      setOrdenes((prev) => prev.filter((o) => !ids.includes(o.id)))
      setTotalOrdenes((total) => Math.max(0, total - ids.length))
      return true
    } catch (err) {
      console.error('Error eliminando órdenes de servicio en lote:', err)
      return false
    }
  }

  return {
    ordenes,
    loading,
    cargandoMas,
    hayMas,
    totalOrdenes,
    error,
    fetchOrdenes,
    cargarMas,
    agregarOrden,
    actualizarEstatus,
    borrarOrden,
    editarOrden,
    borrarOrdenesServicioLote,
  }
}
