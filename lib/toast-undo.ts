'use client'

import { toast } from 'sonner'

export interface ToastUndoOptions {
  mensaje: string
  descripcion?: string
  duracionMs?: number
  onUndo: () => void | Promise<void>
  onDismiss?: () => void
}

/**
 * Muestra una notificación Toast con botón interactivo de "Deshacer" (SaaS Undo Pattern).
 * Permite ejecutar cambios optimistas de inmediato mientras ofrece una ventana de tiempo
 * para revertirlos sin modales bloqueantes.
 */
export function toastConDeshacer({
  mensaje,
  descripcion,
  duracionMs = 5000,
  onUndo,
  onDismiss,
}: ToastUndoOptions): string | number {
  let fueDeshecho = false

  const toastId = toast(mensaje, {
    description: descripcion,
    duration: duracionMs,
    action: {
      label: 'Deshacer',
      onClick: async () => {
        fueDeshecho = true
        try {
          await onUndo()
          toast.success('Acción deshecha correctamente')
        } catch {
          toast.error('No se pudo revertir la acción')
        }
      },
    },
    onDismiss: () => {
      if (!fueDeshecho && onDismiss) {
        onDismiss()
      }
    },
  })

  return toastId
}
