'use client'

import { useSyncExternalStore } from 'react'
import type { VentaOdooSo } from '@/lib/schemas'
import { suscribirVentasOdooSo } from '@/lib/documentos-venta-odoo'

interface VentasOdooStore {
  sos: VentaOdooSo[]
  loading: boolean
  error: string | null
}

let currentSnapshot: VentasOdooStore = {
  sos: [],
  loading: true,
  error: null,
}

const listeners = new Set<() => void>()
let cancelSuscripcion: (() => void) | null = null

function iniciarSuscripcionGlobal() {
  if (cancelSuscripcion) return

  try {
    cancelSuscripcion = suscribirVentasOdooSo(
      (rows) => {
        currentSnapshot = {
          sos: rows,
          loading: false,
          error: null,
        }
        listeners.forEach((l) => l())
      },
      (err) => {
        console.warn('[useVentasOdoo] no se pudieron cargar órdenes de Odoo:', err.message)
        currentSnapshot = {
          sos: currentSnapshot.sos,
          loading: false,
          error: err.message,
        }
        listeners.forEach((l) => l())
      }
    )
  } catch (err: unknown) {
    console.warn('[useVentasOdoo] error iniciando suscripción:', err)
    currentSnapshot = {
      sos: currentSnapshot.sos,
      loading: false,
      error: err instanceof Error ? err.message : 'Error cargando órdenes',
    }
    listeners.forEach((l) => l())
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback)
  iniciarSuscripcionGlobal()
  return () => {
    listeners.delete(callback)
  }
}

function getSnapshot(): VentasOdooStore {
  return currentSnapshot
}

/**
 * Hook reactivo y compartido para consultar las órdenes de venta sincronizadas desde Odoo.
 * Utiliza useSyncExternalStore para compartir de manera óptima una única suscripción en memoria.
 */
export function useVentasOdoo(): VentasOdooStore {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
