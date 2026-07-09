import { useState, useEffect } from 'react'
import {
  listarOperadores,
  crearOperador,
  actualizarOperador,
  eliminarOperador,
  type NuevoOperadorPayload,
} from '@/lib/operadores'
import type { Operador, Area } from '@/lib/schemas'

export function useOperadores() {
  const [operadores, setOperadores] = useState<Operador[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchOperadores()
  }, [])

  async function fetchOperadores() {
    setLoading(true)
    setError(null)
    try {
      const data = await listarOperadores()
      setOperadores(data)
    } catch (err) {
      console.error('Error cargando operadores:', err)
      setError('No se pudieron cargar los operadores. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  async function agregarOperador(payload: NuevoOperadorPayload): Promise<void> {
    await crearOperador(payload)
    await fetchOperadores()
  }

  async function editarOperador(
    id: string,
    cambios: Partial<Omit<Operador, 'id' | 'creadoEn'>>
  ): Promise<void> {
    await actualizarOperador(id, cambios)
    setOperadores((prev) =>
      prev.map((op) => (op.id === id ? { ...op, ...cambios } : op))
    )
  }

  async function toggleActivo(id: string, activo: boolean): Promise<void> {
    await actualizarOperador(id, { activo })
    setOperadores((prev) =>
      prev.map((op) => (op.id === id ? { ...op, activo } : op))
    )
  }

  async function cambiarArea(id: string, area: Area): Promise<void> {
    await actualizarOperador(id, { area })
    setOperadores((prev) =>
      prev.map((op) => (op.id === id ? { ...op, area } : op))
    )
  }

  async function borrarOperador(id: string): Promise<void> {
    await eliminarOperador(id)
    setOperadores((prev) => prev.filter((op) => op.id !== id))
  }

  /** Operadores activos (para autocomplete en otros módulos). */
  const activos = operadores.filter((op) => op.activo)

  return {
    operadores,
    activos,
    loading,
    error,
    fetchOperadores,
    agregarOperador,
    editarOperador,
    toggleActivo,
    cambiarArea,
    borrarOperador,
  }
}
