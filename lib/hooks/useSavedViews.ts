'use client'

import { useState, useCallback } from 'react'

export interface VistaGuardada<T> {
  id: string
  nombre: string
  filtros: T
  creadoEn: number
}

/**
 * Hook para gestionar Vistas Guardadas (Saved Views) de filtros por módulo.
 * Permite a los usuarios guardar combinaciones frecuentes de filtros en localStorage.
 */
export function useSavedViews<T>(modulo: string) {
  const clave = `smv_vistas_${modulo}`

  const [vistas, setVistas] = useState<VistaGuardada<T>[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const serializado = localStorage.getItem(clave)
        if (serializado) {
          const parsed = JSON.parse(serializado)
          if (Array.isArray(parsed)) {
            return parsed
          }
        }
      } catch {
        // Ignorar fallos de lectura en SSR
      }
    }
    return []
  })

  const guardarVista = useCallback(
    (nombre: string, filtros: T) => {
      const nueva: VistaGuardada<T> = {
        id: `vista_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        nombre: nombre.trim() || 'Vista sin título',
        filtros,
        creadoEn: Date.now(),
      }

      setVistas((prev) => {
        const actualizadas = [nueva, ...prev.filter((v) => v.nombre !== nueva.nombre)]
        try {
          localStorage.setItem(clave, JSON.stringify(actualizadas))
        } catch {
          // Ignorar fallos de guardado
        }
        return actualizadas
      })

      return nueva
    },
    [clave]
  )

  const eliminarVista = useCallback(
    (id: string) => {
      setVistas((prev) => {
        const actualizadas = prev.filter((v) => v.id !== id)
        try {
          localStorage.setItem(clave, JSON.stringify(actualizadas))
        } catch {
          // Ignorar fallos de guardado
        }
        return actualizadas
      })
    },
    [clave]
  )

  return {
    vistas,
    guardarVista,
    eliminarVista,
  }
}
