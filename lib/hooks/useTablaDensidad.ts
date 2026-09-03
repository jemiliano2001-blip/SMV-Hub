'use client'

import { useState, useCallback } from 'react'

export type DensidadTabla = 'compacta' | 'comoda'

const CLAVE_STORAGE = 'smv_tabla_densidad'

/**
 * Hook para alternar la densidad visual de las tablas de datos (SaaS style).
 * - 'compacta': mayor número de renglones visibles en pantalla (monitores de compras/admin).
 * - 'comoda': mayor espaciado y objetivos táctiles para tablets de planta o uso relajado.
 */
export function useTablaDensidad(densidadInicial: DensidadTabla = 'compacta') {
  const [densidad, setDensidadState] = useState<DensidadTabla>(() => {
    if (typeof window !== 'undefined') {
      try {
        const guardada = localStorage.getItem(CLAVE_STORAGE)
        if (guardada === 'compacta' || guardada === 'comoda') {
          return guardada
        }
      } catch {
        // Entorno seguro en SSR
      }
    }
    return densidadInicial
  })

  const setDensidad = useCallback((nueva: DensidadTabla) => {
    setDensidadState(nueva)
    try {
      localStorage.setItem(CLAVE_STORAGE, nueva)
    } catch {
      // Ignorar fallos de localStorage
    }
  }, [])

  const toggleDensidad = useCallback(() => {
    const siguiente: DensidadTabla = densidad === 'compacta' ? 'comoda' : 'compacta'
    setDensidad(siguiente)
  }, [densidad, setDensidad])

  const esCompacta = densidad === 'compacta'

  return {
    densidad,
    setDensidad,
    toggleDensidad,
    esCompacta,
    clasesTh: esCompacta ? 'py-1.5 px-2.5 text-[11px]' : 'py-3 px-3.5 text-xs',
    clasesTd: esCompacta ? 'py-1.5 px-2.5 text-xs' : 'py-3 px-3.5 text-sm',
    clasesIcono: esCompacta ? 'size-3.5' : 'size-4',
  }
}
