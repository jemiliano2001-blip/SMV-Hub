export type VarianteConfirmacion = "default" | "destructive"

export interface OpcionesConfirmacion {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: VarianteConfirmacion
}

export interface ConfirmacionNormalizada {
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  variant: VarianteConfirmacion
}

export function normalizarConfirmacion(
  opciones: OpcionesConfirmacion
): ConfirmacionNormalizada {
  return {
    title: opciones.title.trim() || "Confirmar acción",
    description:
      opciones.description.trim() || "Revisa la acción antes de continuar.",
    confirmLabel: opciones.confirmLabel?.trim() || "Confirmar",
    cancelLabel: opciones.cancelLabel?.trim() || "Cancelar",
    variant: opciones.variant ?? "default",
  }
}

