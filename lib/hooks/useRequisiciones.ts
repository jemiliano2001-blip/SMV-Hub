import { useState, useEffect } from 'react'
import {
  listarRequisiciones,
  crearRequisicion,
  actualizarRequisicion,
  eliminarRequisicion,
  eliminarRequisicionesLote,
  type NuevaRequisicionPayload,
} from '@/lib/requisiciones'
import type { Requisicion, EstatusRequisicion } from '@/lib/schemas'

export function useRequisiciones() {
  const [requisiciones, setRequisiciones] = useState<Requisicion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRequisiciones()
  }, [])

  async function fetchRequisiciones() {
    setLoading(true)
    setError(null)
    try {
      const data = await listarRequisiciones()
      setRequisiciones(data)
    } catch (err) {
      console.error('Error cargando requisiciones:', err)
      setError('No se pudieron cargar las requisiciones. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function agregarRequisicion(payload: NuevaRequisicionPayload): Promise<void> {
    await crearRequisicion(payload)
    await fetchRequisiciones()
  }

  async function actualizarEstado(id: string, estado: EstatusRequisicion): Promise<void> {
    await actualizarRequisicion(id, { estado })
    setRequisiciones((prev) =>
      prev.map((r) => (r.id === id ? { ...r, estado } : r))
    )
  }

  async function borrarRequisicion(id: string): Promise<void> {
    await eliminarRequisicion(id)
    setRequisiciones((prev) => prev.filter((r) => r.id !== id))
  }

  async function editarRequisicion(
    id: string,
    cambios: Partial<Omit<Requisicion, 'id' | 'creadoEn'>>
  ): Promise<void> {
    await actualizarRequisicion(id, cambios)
    setRequisiciones((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...cambios } : r))
    )
  }

  async function borrarRequisicionesLote(ids: string[]): Promise<boolean> {
    try {
      await eliminarRequisicionesLote(ids)
      setRequisiciones((prev) => prev.filter((r) => !ids.includes(r.id)))
      return true
    } catch (err) {
      console.error('Error eliminando requisiciones en lote:', err)
      return false
    }
  }

  return {
    requisiciones,
    loading,
    error,
    fetchRequisiciones,
    agregarRequisicion,
    actualizarEstado,
    borrarRequisicion,
    editarRequisicion,
    borrarRequisicionesLote,
  }
}
