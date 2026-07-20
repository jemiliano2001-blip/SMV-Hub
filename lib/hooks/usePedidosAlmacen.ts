import { useState, useEffect } from 'react'
import {
  listarPedidosAlmacen,
  crearPedidoAlmacen,
  marcarPedidoAlmacenComprado,
  cancelarPedidoAlmacen,
} from '@/lib/pedidos-almacen'
import type { PedidoAlmacen, NuevoPedidoAlmacen } from '@/lib/schemas'

export function usePedidosAlmacen() {
  const [pedidos, setPedidos] = useState<PedidoAlmacen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPedidos()
  }, [])

  async function fetchPedidos() {
    setLoading(true)
    setError(null)
    try {
      const data = await listarPedidosAlmacen()
      setPedidos(data)
    } catch (err) {
      console.error('Error cargando pedidos de almacén:', err)
      setError('No se pudieron cargar los pedidos. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function agregarPedido(payload: NuevoPedidoAlmacen): Promise<void> {
    await crearPedidoAlmacen(payload)
    await fetchPedidos()
  }

  async function marcarComprado(id: string, ordenId: string): Promise<void> {
    await marcarPedidoAlmacenComprado(id, ordenId)
    setPedidos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, estado: 'comprado', ordenIdVinculada: ordenId } : p))
    )
  }

  async function cancelarPedido(id: string): Promise<void> {
    await cancelarPedidoAlmacen(id)
    setPedidos((prev) => prev.map((p) => (p.id === id ? { ...p, estado: 'cancelado' } : p)))
  }

  return {
    pedidos,
    loading,
    error,
    fetchPedidos,
    agregarPedido,
    marcarComprado,
    cancelarPedido,
  }
}
