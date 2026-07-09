import { useState, useEffect } from 'react'
import {
  listarOrdenes,
  eliminarOrden,
  actualizarOrden,
  eliminarOrdenesLote,
  actualizarOrdenesEstadoLote,
} from '@/lib/ordenes'
import type { OrdenCompra, EstadoOrden } from '@/lib/schemas'

export function useOrdenes() {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchOrdenes()
  }, [])

  async function fetchOrdenes() {
    setLoading(true)
    setError(null)
    try {
      const data = await listarOrdenes()
      setOrdenes(data)
    } catch (err) {
      console.error('Error fetching ordenes:', err)
      setError('No se pudieron cargar las órdenes de compra. Por favor, intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  const handleEliminar = async (id: string) => {
    try {
      await eliminarOrden(id)
      setOrdenes((prev) => prev.filter((o) => o.id !== id))
      return true
    } catch (err) {
      console.error('Error deleting orden:', err)
      return false
    }
  }

  const handleCambiarEstado = async (id: string, estado: EstadoOrden) => {
    try {
      await actualizarOrden(id, { estado })
      setOrdenes((prev) => prev.map((o) => (o.id === id ? { ...o, estado } : o)))
      return true
    } catch (err) {
      console.error('Error actualizando estado:', err)
      return false
    }
  }

  const handleEliminarLote = async (ids: string[]) => {
    try {
      await eliminarOrdenesLote(ids)
      const idsSet = new Set(ids)
      setOrdenes((prev) => prev.filter((o) => !idsSet.has(o.id)))
      return true
    } catch (err) {
      console.error('Error deleting ordenes en lote:', err)
      return false
    }
  }

  const handleCambiarEstadoLote = async (ids: string[], estado: EstadoOrden) => {
    try {
      await actualizarOrdenesEstadoLote(ids, estado)
      const idsSet = new Set(ids)
      setOrdenes((prev) =>
        prev.map((o) => (idsSet.has(o.id) ? { ...o, estado } : o))
      )
      return true
    } catch (err) {
      console.error('Error actualizando estado en lote:', err)
      return false
    }
  }

  const addOrUpdateOrden = (ordenGuardada: OrdenCompra) => {
    setOrdenes((prev) => {
      const existe = prev.some(o => o.id === ordenGuardada.id)
      if (existe) {
        return prev.map(o => o.id === ordenGuardada.id ? ordenGuardada : o)
      }
      return [ordenGuardada, ...prev]
    })
  }

  return {
    ordenes,
    loading,
    error,
    fetchOrdenes,
    handleEliminar,
    handleCambiarEstado,
    handleEliminarLote,
    handleCambiarEstadoLote,
    addOrUpdateOrden
  }
}
