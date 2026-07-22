import { useState, useEffect, useCallback } from 'react'
import {
  listarPedidosAlmacen,
  suscribirPedidosAlmacen,
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
    const unsub = suscribirPedidosAlmacen(
      (data) => {
        setPedidos(data)
        setLoading(false)
      },
      (err) => {
        console.error('Error suscribiendo a pedidos de almacén:', err)
        setError('No se pudieron cargar los pedidos en tiempo real. Intenta de nuevo.')
        setLoading(false)
      }
    )
    return () => unsub()
  }, [])

  const fetchPedidos = useCallback(async () => {
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
  }, [])

  async function agregarPedido(payload: NuevoPedidoAlmacen): Promise<void> {
    await crearPedidoAlmacen(payload)
  }

  async function marcarComprado(id: string, ordenId: string): Promise<void> {
    await marcarPedidoAlmacenComprado(id, ordenId)
  }

  async function cancelarPedido(id: string): Promise<void> {
    await cancelarPedidoAlmacen(id)
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
