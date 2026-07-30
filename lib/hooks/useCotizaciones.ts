import { useCallback, useEffect, useRef, useState } from 'react'
import {
  listarCotizaciones,
  obtenerPaginaCotizaciones,
  actualizarCotizacion,
  eliminarCotizacion,
  eliminarCotizacionesLote,
  type CursorCotizaciones,
} from '@/lib/cotizaciones'
import type { Cotizacion } from '@/lib/schemas'

const TAMANO_PAGINA = 50

export function useCotizaciones() {
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
  const [cursor, setCursor] = useState<CursorCotizaciones | null>(null)
  const [hayMas, setHayMas] = useState(false)
  const [coleccionCompleta, setColeccionCompleta] = useState(false)
  const [loading, setLoading] = useState(true)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [cargandoCompleto, setCargandoCompleto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const promesaCompleta = useRef<Promise<Cotizacion[]> | null>(null)

  const fetchCotizaciones = useCallback(async () => {
    setLoading(true)
    setError(null)
    setColeccionCompleta(false)
    try {
      const pagina = await obtenerPaginaCotizaciones(TAMANO_PAGINA)
      setCotizaciones(pagina.items)
      setCursor(pagina.siguienteCursor)
      setHayMas(pagina.hayMas)
    } catch (err) {
      console.error('Error cargando cotizaciones:', err)
      setError('No se pudieron cargar las cotizaciones. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => void fetchCotizaciones(), 0)
    return () => window.clearTimeout(id)
  }, [fetchCotizaciones])

  const cargarMas = useCallback(async () => {
    if (!cursor || !hayMas || cargandoMas || loading || coleccionCompleta) return
    setCargandoMas(true)
    setError(null)
    try {
      const pagina = await obtenerPaginaCotizaciones(TAMANO_PAGINA, cursor)
      setCotizaciones((actuales) => {
        const ids = new Set(actuales.map((c) => c.id))
        return [...actuales, ...pagina.items.filter((c) => !ids.has(c.id))]
      })
      setCursor(pagina.siguienteCursor)
      setHayMas(pagina.hayMas)
    } catch (err) {
      console.error('Error cargando más cotizaciones:', err)
      setError('No se pudo cargar la siguiente página de cotizaciones.')
    } finally {
      setCargandoMas(false)
    }
  }, [cargandoMas, coleccionCompleta, cursor, hayMas, loading])

  const cargarTodas = useCallback(async (): Promise<Cotizacion[]> => {
    if (coleccionCompleta) return cotizaciones
    if (promesaCompleta.current) return promesaCompleta.current

    setCargandoCompleto(true)
    setError(null)
    const promesa = listarCotizaciones()
      .then((data) => {
        setCotizaciones(data)
        setCursor(null)
        setHayMas(false)
        setColeccionCompleta(true)
        return data
      })
      .catch((err) => {
        console.error('Error cargando historial completo de cotizaciones:', err)
        setError('No se pudo cargar el historial completo de cotizaciones.')
        throw err
      })
      .finally(() => {
        promesaCompleta.current = null
        setCargandoCompleto(false)
      })

    promesaCompleta.current = promesa
    return promesa
  }, [coleccionCompleta, cotizaciones])

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
    cargandoMas,
    cargandoCompleto,
    coleccionCompleta,
    hayMas,
    error,
    fetchCotizaciones,
    cargarMas,
    cargarTodas,
    addOrUpdateCotizacion,
    handleEliminar,
    handleEliminarLote,
    handleCambiarEstado,
  }
}
