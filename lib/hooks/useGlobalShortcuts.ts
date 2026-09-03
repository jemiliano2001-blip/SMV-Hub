'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Hook para gestionar el atajo global de ayuda (?) y el estado del diálogo de atajos.
 */
export function useGlobalShortcuts() {
  const [open, setOpen] = useState(false)

  const toggleOpen = useCallback(() => {
    setOpen((prev) => !prev)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase()
      const esEditable =
        tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target as HTMLElement)?.isContentEditable

      if (esEditable) return

      // Atajo '?' (Shift + / o tecla ?)
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return {
    open,
    setOpen,
    toggleOpen,
  }
}
