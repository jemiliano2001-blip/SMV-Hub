import { useCallback, useEffect, useRef, useState } from 'react'
import {
  listarRequisiciones,
  obtenerPaginaRequisiciones,
  contarRequisiciones,
  crearRequisicion,
  actualizarRequisicion,
  eliminarRequisicion,
  eliminarRequisicionesLote,
  type CursorRequisiciones,
  type NuevaRequisicionPayload,
} from '@/lib/requisiciones'
import type { Requisicion, EstatusRequisicion } from '@/lib/schemas'

const TAMANO_PAGINA = 50

interface UseRequisicionesOptions {
  completoInicial?: boolean
}

export function useRequisiciones({ completoInicial = false }: UseRequisicionesOptions = {}) {
  const [requisiciones, setRequisiciones] = useState<Requisicion[]>([])
  const [cursor, setCursor] = useState<CursorRequisiciones | null>(null)
  const [hayMas, setHayMas] = useState(false)
  const [totalRequisiciones, setTotalRequisiciones] = useState(0)
  const [coleccionCompleta, setColeccionCompleta] = useState(false)
  const [loading, setLoading] = useState(true)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [cargandoCompleto, setCargandoCompleto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const promesaCompleta = useRef<Promise<Requisicion[]> | null>(null)

  const fetchRequisiciones = useCallback(async () => {
    setLoading(true)
    setError(null)
    setColeccionCompleta(false)
    try {
      if (completoInicial) {
        const data = await listarRequisiciones()
        setRequisiciones(data)
        setCursor(null)
        setHayMas(false)
        setTotalRequisiciones(data.length)
        setColeccionCompleta(true)
        return
      }

      const [pagina, total] = await Promise.all([
        obtenerPaginaRequisiciones(TAMANO_PAGINA),
        contarRequisiciones(),
      ])
      setRequisiciones(pagina.items)
      setCursor(pagina.siguienteCursor)
      setHayMas(pagina.hayMas)
      setTotalRequisiciones(total)
    } catch (err) {
      console.error('Error cargando requisiciones:', err)
      setError('No se pudieron cargar las requisiciones. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [completoInicial])

  useEffect(() => {
    // La consulta externa actualiza el estado cuando Firestore responde.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchRequisiciones()
  }, [fetchRequisiciones])

  const cargarMas = useCallback(async () => {
    if (!cursor || !hayMas || cargandoMas || loading || coleccionCompleta) return
    setCargandoMas(true)
    setError(null)
    try {
      const pagina = await obtenerPaginaRequisiciones(TAMANO_PAGINA, cursor)
      setRequisiciones((actuales) => {
        const ids = new Set(actuales.map((requisicion) => requisicion.id))
        return [
          ...actuales,
          ...pagina.items.filter((requisicion) => !ids.has(requisicion.id)),
        ]
      })
      setCursor(pagina.siguienteCursor)
      setHayMas(pagina.hayMas)
    } catch (err) {
      console.error('Error cargando más requisiciones:', err)
      setError('No se pudo cargar la siguiente página de requisiciones.')
    } finally {
      setCargandoMas(false)
    }
  }, [cargandoMas, coleccionCompleta, cursor, hayMas, loading])

  const cargarTodas = useCallback(async (): Promise<Requisicion[]> => {
    if (coleccionCompleta) return requisiciones
    if (promesaCompleta.current) return promesaCompleta.current

    setCargandoCompleto(true)
    setError(null)
    const promesa = listarRequisiciones()
      .then((data) => {
        setRequisiciones(data)
        setCursor(null)
        setHayMas(false)
        setColeccionCompleta(true)
        setTotalRequisiciones(data.length)
        return data
      })
      .catch((err) => {
        console.error('Error cargando el catálogo completo de requisiciones:', err)
        setError('No se pudo preparar el historial completo de requisiciones.')
        throw err
      })
      .finally(() => {
        promesaCompleta.current = null
        setCargandoCompleto(false)
      })

    promesaCompleta.current = promesa
    return promesa
  }, [coleccionCompleta, requisiciones])

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
    setTotalRequisiciones((total) => Math.max(0, total - 1))
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
      const idsSet = new Set(ids)
      setRequisiciones((prev) => prev.filter((r) => !idsSet.has(r.id)))
      setTotalRequisiciones((total) => Math.max(0, total - idsSet.size))
      return true
    } catch (err) {
      console.error('Error eliminando requisiciones en lote:', err)
      return false
    }
  }

  function addOrUpdateRequisicion(requisicionGuardada: Requisicion) {
    setRequisiciones((prev) => {
      const existe = prev.some((requisicion) => requisicion.id === requisicionGuardada.id)
      if (existe) {
        return prev.map((requisicion) =>
          requisicion.id === requisicionGuardada.id ? requisicionGuardada : requisicion
        )
      }
      setTotalRequisiciones((total) => total + 1)
      return [requisicionGuardada, ...prev]
    })
  }

  return {
    requisiciones,
    loading,
    cargandoMas,
    cargandoCompleto,
    coleccionCompleta,
    hayMas,
    totalRequisiciones,
    error,
    fetchRequisiciones,
    cargarMas,
    cargarTodas,
    agregarRequisicion,
    actualizarEstado,
    borrarRequisicion,
    editarRequisicion,
    borrarRequisicionesLote,
    addOrUpdateRequisicion,
  }
}
