import { useCallback, useEffect, useState } from "react"
import {
  actualizarStockBatchEndmills,
  actualizarStockEndmill,
  cancelarPedidoEndmills,
  confirmarMedidaEndmill,
  crearEndmillMedida,
  listarMedidasEndmills,
  listarPedidosEndmills,
  registrarPedidoEndmills,
  registrarRecepcionPedidoEndmills,
  reordenarMedidasEndmills,
  suscribirMedidasEndmills,
  suscribirPedidosEndmills,
  type ActorEndmills,
} from "@/lib/endmills"
import type {
  CrearEndmillMedidaInput,
  EndmillMedida,
  PedidoEndmills,
  RecibirPedidoEndmillsInput,
  RegistrarPedidoEndmillsInput,
  ReordenarMedidaItem,
} from "@/lib/schemas"

export function useEndmills() {
  const [medidas, setMedidas] = useState<EndmillMedida[]>([])
  const [pedidos, setPedidos] = useState<PedidoEndmills[]>([])
  const [loadingMedidas, setLoadingMedidas] = useState(true)
  const [loadingPedidos, setLoadingPedidos] = useState(true)
  const [errorMedidas, setErrorMedidas] = useState<string | null>(null)
  const [errorPedidos, setErrorPedidos] = useState<string | null>(null)

  useEffect(() => {
    const unsubMedidas = suscribirMedidasEndmills(
      (data) => {
        setMedidas(data)
        setLoadingMedidas(false)
        setErrorMedidas(null)
      },
      (error) => {
        console.error("Error en listener de medidas endmills:", error)
        setErrorMedidas("No se pudo actualizar el inventario en tiempo real.")
        setLoadingMedidas(false)
      }
    )
    const unsubPedidos = suscribirPedidosEndmills(
      (data) => {
        setPedidos(data)
        setLoadingPedidos(false)
        setErrorPedidos(null)
      },
      (error) => {
        console.error("Error en listener de pedidos endmills:", error)
        setErrorPedidos("No se pudo actualizar el historial en tiempo real.")
        setLoadingPedidos(false)
      }
    )
    return () => {
      unsubMedidas()
      unsubPedidos()
    }
  }, [])

  const fetchMedidas = useCallback(async () => {
    setLoadingMedidas(true)
    setErrorMedidas(null)
    try {
      setMedidas(await listarMedidasEndmills())
    } catch (error) {
      console.error("Error cargando medidas endmills:", error)
      setErrorMedidas("No se pudo cargar el inventario. Intenta de nuevo.")
    } finally {
      setLoadingMedidas(false)
    }
  }, [])

  const fetchPedidos = useCallback(async () => {
    setLoadingPedidos(true)
    setErrorPedidos(null)
    try {
      setPedidos(await listarPedidosEndmills())
    } catch (error) {
      console.error("Error cargando pedidos endmills:", error)
      setErrorPedidos("No se pudo cargar el historial. Intenta de nuevo.")
    } finally {
      setLoadingPedidos(false)
    }
  }, [])

  return {
    medidas,
    pedidos,
    loadingMedidas,
    loadingPedidos,
    errorMedidas,
    errorPedidos,
    fetchMedidas,
    fetchPedidos,
    crearMedida: (input: CrearEndmillMedidaInput) => crearEndmillMedida(input),
    reordenarMedidas: (items: readonly ReordenarMedidaItem[]) => reordenarMedidasEndmills(items),
    actualizarStock: actualizarStockEndmill,
    actualizarStockBatch: actualizarStockBatchEndmills,
    confirmarMedida: confirmarMedidaEndmill,
    registrarPedido: (input: RegistrarPedidoEndmillsInput, actor: ActorEndmills) =>
      registrarPedidoEndmills(input, actor),
    registrarRecepcion: (pedidoId: string, input: RecibirPedidoEndmillsInput) =>
      registrarRecepcionPedidoEndmills(pedidoId, input),
    cancelarPedido: cancelarPedidoEndmills,
  }
}

