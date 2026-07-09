import { useState, useEffect } from 'react'
import {
  listarOrdenesServicio,
  crearOrdenServicio,
  actualizarOrdenServicio,
  eliminarOrdenServicio,
  eliminarOrdenesServicioLote,
  type NuevaOrdenServicioPayload,
} from '@/lib/ordenes-servicio'
import type { OrdenServicio, EstatusOrdenServicio } from '@/lib/schemas'

export function useOrdenesServicio() {
  const [ordenes, setOrdenes] = useState<OrdenServicio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchOrdenes()
  }, [])

  async function fetchOrdenes() {
    setLoading(true)
    setError(null)
    try {
      const data = await listarOrdenesServicio()
      setOrdenes(data)
    } catch (err) {
      console.error('Error cargando órdenes de servicio:', err)
      setError('No se pudieron cargar las órdenes. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

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
      return true
    } catch (err) {
      console.error('Error eliminando órdenes de servicio en lote:', err)
      return false
    }
  }

  return {
    ordenes,
    loading,
    error,
    fetchOrdenes,
    agregarOrden,
    actualizarEstatus,
    borrarOrden,
    editarOrden,
    borrarOrdenesServicioLote,
  }
}
