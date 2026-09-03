'use client'

import { useState, useEffect, useSyncExternalStore } from 'react'
import { WifiOff, Wifi } from 'lucide-react'
import { cn } from '@/lib/utils'

function suscribirRed(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function getRedSnapshot() {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

function getRedServerSnapshot() {
  return true
}

/**
 * Indicador visual de resiliencia y conectividad de red.
 * Alerta sutilmente si el usuario pierde conexión Wi-Fi en el taller o almacén.
 */
export default function NetworkStatusIndicator() {
  const estaEnLinea = useSyncExternalStore(suscribirRed, getRedSnapshot, getRedServerSnapshot)
  const [mostrarReconexion, setMostrarReconexion] = useState(false)
  const [prevEnLinea, setPrevEnLinea] = useState(estaEnLinea)

  if (estaEnLinea !== prevEnLinea) {
    setPrevEnLinea(estaEnLinea)
    if (estaEnLinea) {
      setMostrarReconexion(true)
    }
  }

  useEffect(() => {
    if (!mostrarReconexion) return
    const timer = setTimeout(() => {
      setMostrarReconexion(false)
    }, 3500)
    return () => clearTimeout(timer)
  }, [mostrarReconexion])

  if (estaEnLinea && !mostrarReconexion) {
    return null
  }

  return (
    <aside
      role="status"
      aria-live="polite"
      className={cn(
        'fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold shadow-xl backdrop-blur-md transition-all duration-300',
        'animate-in fade-in slide-in-from-bottom-2',
        !estaEnLinea
          ? 'border border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300'
          : 'border border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
      )}
    >
      {!estaEnLinea ? (
        <>
          <WifiOff className="size-4 shrink-0 text-amber-600 animate-pulse" />
          <span>Sin conexión · Modo lectura</span>
        </>
      ) : (
        <>
          <Wifi className="size-4 shrink-0 text-emerald-600" />
          <span>Conexión restablecida</span>
        </>
      )}
    </aside>
  )
}
