'use client'

import { useEffect, useCallback } from 'react'
import { useFilePreview } from '@/components/FilePreviewProvider'
import type { ArchivoPreviewMetadata } from '@/lib/preview-helpers'

interface UseQuickLookOptions<T> {
  items: T[]
  selectedIndex: number | null
  getArchivoMetadata: (item: T) => ArchivoPreviewMetadata | null
  enabled?: boolean
}

/**
 * Hook para habilitar QuickLook (vista previa al presionar la tecla Espacio)
 * al navegar registros en una tabla o lista.
 */
export function useQuickLook<T>({
  items,
  selectedIndex,
  getArchivoMetadata,
  enabled = true,
}: UseQuickLookOptions<T>) {
  const { previewFile, closePreview, isOpen } = useFilePreview()

  const abrirQuickLook = useCallback(() => {
    const listado = items ?? []
    if (selectedIndex === null || selectedIndex < 0 || selectedIndex >= listado.length) {
      return
    }

    const itemActual = listado[selectedIndex]
    if (!itemActual) return
    const meta = getArchivoMetadata(itemActual)
    if (!meta || !meta.url) return

    // Generar la lista de todos los elementos que tienen archivo adjunto
    const listaConAdjunto: { meta: ArchivoPreviewMetadata; indexOriginal: number }[] = []
    listado.forEach((it, idx) => {
      const m = getArchivoMetadata(it)
      if (m && m.url) {
        listaConAdjunto.push({ meta: m, indexOriginal: idx })
      }
    })

    const listaFinal = listaConAdjunto.map((l) => l.meta)
    const indiceEnLista = Math.max(
      0,
      listaConAdjunto.findIndex((l) => l.indexOriginal === selectedIndex)
    )

    previewFile(meta, listaFinal, indiceEnLista)
  }, [items, selectedIndex, getArchivoMetadata, previewFile])

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si el usuario está escribiendo en un input, textarea o select
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      const esEditable =
        tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target as HTMLElement)?.isContentEditable

      if (esEditable) return

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault()
        if (isOpen) {
          closePreview()
        } else {
          abrirQuickLook()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, isOpen, closePreview, abrirQuickLook])

  return {
    abrirQuickLook,
    isOpen,
  }
}
