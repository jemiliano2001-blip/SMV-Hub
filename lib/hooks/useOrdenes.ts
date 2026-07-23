import { useCallback, useEffect, useRef, useState } from 'react'
import {
  listarOrdenes,
  obtenerPaginaOrdenes,
  contarOrdenes,
  eliminarOrden,
  actualizarOrden,
  eliminarOrdenesLote,
  actualizarOrdenesEstadoLote,
  type CursorOrdenes,
} from '@/lib/ordenes'
import type { OrdenCompra, EstadoOrden } from '@/lib/schemas'

const TAMANO_PAGINA = 50

export function useOrdenes() {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([])
  const [cursor, setCursor] = useState<CursorOrdenes | null>(null)
  const [hayMas, setHayMas] = useState(false)
  const [totalOrdenes, setTotalOrdenes] = useState(0)
  const [coleccionCompleta, setColeccionCompleta] = useState(false)
  const [loading, setLoading] = useState(true)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [cargandoCompleto, setCargandoCompleto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const promesaCompleta = useRef<Promise<OrdenCompra[]> | null>(null)

  const fetchOrdenes = useCallback(async () => {
    setLoading(true)
    setError(null)
    setColeccionCompleta(false)
    try {
      const [pagina, total] = await Promise.all([
        obtenerPaginaOrdenes(TAMANO_PAGINA),
        contarOrdenes(),
      ])
      setOrdenes(pagina.items)
      setCursor(pagina.siguienteCursor)
      setHayMas(pagina.hayMas)
      setTotalOrdenes(total)
    } catch (err) {
      console.error('Error fetching ordenes:', err)
      setError('No se pudieron cargar las órdenes de compra. Por favor, intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // La consulta externa actualiza el estado cuando Firestore responde.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchOrdenes()
  }, [fetchOrdenes])

  const cargarMas = useCallback(async () => {
    if (!cursor || !hayMas || cargandoMas || loading || coleccionCompleta) return
    setCargandoMas(true)
    setError(null)
    try {
      const pagina = await obtenerPaginaOrdenes(TAMANO_PAGINA, cursor)
      setOrdenes((actuales) => {
        const ids = new Set(actuales.map((orden) => orden.id))
        return [...actuales, ...pagina.items.filter((orden) => !ids.has(orden.id))]
      })
      setCursor(pagina.siguienteCursor)
      setHayMas(pagina.hayMas)
    } catch (err) {
      console.error('Error loading more ordenes:', err)
      setError('No se pudo cargar la siguiente página de órdenes.')
    } finally {
      setCargandoMas(false)
    }
  }, [cargandoMas, coleccionCompleta, cursor, hayMas, loading])

  const cargarTodas = useCallback(async (): Promise<OrdenCompra[]> => {
    if (coleccionCompleta) return ordenes
    if (promesaCompleta.current) return promesaCompleta.current

    setCargandoCompleto(true)
    setError(null)
    const promesa = listarOrdenes()
      .then((data) => {
        setOrdenes(data)
        setCursor(null)
        setHayMas(false)
        setColeccionCompleta(true)
        setTotalOrdenes(data.length)
        return data
      })
      .catch((err) => {
        console.error('Error loading complete orders catalog:', err)
        setError('No se pudo preparar el historial completo de órdenes.')
        throw err
      })
      .finally(() => {
        promesaCompleta.current = null
        setCargandoCompleto(false)
      })

    promesaCompleta.current = promesa
    return promesa
  }, [coleccionCompleta, ordenes])

  const handleEliminar = async (id: string) => {
    try {
      await eliminarOrden(id)
      setOrdenes((prev) => prev.filter((o) => o.id !== id))
      setTotalOrdenes((total) => Math.max(0, total - 1))
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
      setTotalOrdenes((total) => Math.max(0, total - idsSet.size))
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
      const existe = prev.some((o) => o.id === ordenGuardada.id)
      if (existe) {
        return prev.map((o) => (o.id === ordenGuardada.id ? ordenGuardada : o))
      }
      setTotalOrdenes((total) => total + 1)
      return [ordenGuardada, ...prev]
    })
  }

  return {
    ordenes,
    loading,
    cargandoMas,
    cargandoCompleto,
    coleccionCompleta,
    hayMas,
    totalOrdenes,
    error,
    fetchOrdenes,
    cargarMas,
    cargarTodas,
    handleEliminar,
    handleCambiarEstado,
    handleEliminarLote,
    handleCambiarEstadoLote,
    addOrUpdateOrden,
  }
}
