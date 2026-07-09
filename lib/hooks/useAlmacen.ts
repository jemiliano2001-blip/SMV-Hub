import { useState, useEffect } from 'react'
import {
  listarEntradas,
  crearEntrada,
  actualizarEntrada,
  eliminarEntrada,
  listarSalidas,
  crearSalida,
  actualizarSalida,
  eliminarSalida,
  type NuevaEntradaPayload,
  type NuevaSalidaPayload,
} from '@/lib/almacen'
import type { EntradaAlmacen, SalidaAlmacen } from '@/lib/schemas'

export function useEntradas() {
  const [entradas, setEntradas] = useState<EntradaAlmacen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchEntradas()
  }, [])

  async function fetchEntradas() {
    setLoading(true)
    setError(null)
    try {
      const data = await listarEntradas()
      setEntradas(data)
    } catch (err) {
      console.error('Error cargando entradas de almacén:', err)
      setError('No se pudieron cargar las entradas. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function agregarEntrada(payload: NuevaEntradaPayload): Promise<void> {
    await crearEntrada(payload)
    await fetchEntradas()
  }

  async function editarEntrada(
    id: string,
    cambios: Partial<Omit<EntradaAlmacen, 'id' | 'creadoEn'>>
  ): Promise<void> {
    await actualizarEntrada(id, cambios)
    setEntradas((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...cambios } : e))
    )
  }

  async function borrarEntrada(id: string): Promise<void> {
    await eliminarEntrada(id)
    setEntradas((prev) => prev.filter((e) => e.id !== id))
  }

  return {
    entradas,
    loading,
    error,
    fetchEntradas,
    agregarEntrada,
    editarEntrada,
    borrarEntrada,
  }
}

export function useSalidas() {
  const [salidas, setSalidas] = useState<SalidaAlmacen[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSalidas()
  }, [])

  async function fetchSalidas() {
    setLoading(true)
    setError(null)
    try {
      const data = await listarSalidas()
      setSalidas(data)
    } catch (err) {
      console.error('Error cargando salidas de almacén:', err)
      setError('No se pudieron cargar las salidas. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function agregarSalida(payload: NuevaSalidaPayload): Promise<void> {
    await crearSalida(payload)
    await fetchSalidas()
  }

  async function editarSalida(
    id: string,
    cambios: Partial<Omit<SalidaAlmacen, 'id' | 'creadoEn'>>
  ): Promise<void> {
    await actualizarSalida(id, cambios)
    setSalidas((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...cambios } : s))
    )
  }

  async function borrarSalida(id: string): Promise<void> {
    await eliminarSalida(id)
    setSalidas((prev) => prev.filter((s) => s.id !== id))
  }

  return {
    salidas,
    loading,
    error,
    fetchSalidas,
    agregarSalida,
    editarSalida,
    borrarSalida,
  }
}
