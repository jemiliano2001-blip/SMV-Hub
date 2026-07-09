import { useState, useEffect } from 'react'
import {
  listarCotizaciones,
  actualizarCotizacion,
  eliminarCotizacion,
  eliminarCotizacionesLote,
} from '@/lib/cotizaciones'
import type { Cotizacion } from '@/lib/schemas'

export function useCotizaciones() {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCotizaciones()
  }, [])

  async function fetchCotizaciones() {
    setLoading(true)
    setError(null)
    try {
      const data = await listarCotizaciones()
      setCotizaciones(data)
    } catch (err) {
      console.error('Error cargando cotizaciones:', err)
      setError('No se pudieron cargar las cotizaciones. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  /** Inserta o reemplaza una cotización en el estado local (tras crear/editar en el modal). */
  function addOrUpdateCotizacion(c: Cotizacion) {
    setCotizaciones((prev) => {
      const existe = prev.some((x) => x.id === c.id)
      return existe ? prev.map((x) => (x.id === c.id ? c : x)) : [c, ...prev]
    })
  }

  async function handleEliminar(id: string): Promise<boolean> {
    try {
      await eliminarCotizacion(id)
      setCotizaciones((prev) => prev.filter((c) => c.id !== id))
      return true
    } catch (err) {
      console.error('Error eliminando cotización:', err)
      return false
    }
  }

  async function handleEliminarLote(ids: string[]): Promise<boolean> {
    try {
      await eliminarCotizacionesLote(ids)
      setCotizaciones((prev) => prev.filter((c) => !ids.includes(c.id)))
      return true
    } catch (err) {
      console.error('Error eliminando cotizaciones en lote:', err)
      return false
    }
  }

  async function handleCambiarEstado(
    id: string,
    estatus: Cotizacion['estatus']
  ): Promise<boolean> {
    try {
      await actualizarCotizacion(id, { estatus })
      setCotizaciones((prev) => prev.map((c) => (c.id === id ? { ...c, estatus } : c)))
      return true
    } catch (err) {
      console.error('Error actualizando estatus de cotización:', err)
      return false
    }
  }

  return {
    cotizaciones,
    loading,
    error,
    fetchCotizaciones,
    addOrUpdateCotizacion,
    handleEliminar,
    handleEliminarLote,
    handleCambiarEstado,
  }
}
