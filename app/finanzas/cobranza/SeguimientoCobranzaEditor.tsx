'use client'

import { useState, type FormEvent } from "react"
import { AlertCircle, Loader2, Save, Trash2 } from "lucide-react"
import type {
  SeguimientoCobranza,
  SeguimientoCobranzaInput,
} from "@/lib/schemas"
import { useConfirmDialog } from "@/components/ConfirmDialogProvider"

type Props = {
  facturaId: string
  seguimiento?: SeguimientoCobranza
  actualizadoPor: string
  onGuardar: (entrada: SeguimientoCobranzaInput) => Promise<void>
  onEliminar: (facturaId: string) => Promise<void>
}

export default function SeguimientoCobranzaEditor({
  facturaId,
  seguimiento,
  actualizadoPor,
  onGuardar,
  onEliminar,
}: Props) {
  const confirmar = useConfirmDialog()
  const [nota, setNota] = useState(seguimiento?.nota ?? "")
  const [promesaPagoFecha, setPromesaPagoFecha] = useState(
    seguimiento?.promesaPagoFecha ?? ""
  )
  const [enDisputa, setEnDisputa] = useState(seguimiento?.enDisputa ?? false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  async function guardar(event: FormEvent) {
    event.preventDefault()
    setGuardando(true)
    setError(null)
    setMensaje(null)
    try {
      await onGuardar({
        facturaId,
        nota,
        promesaPagoFecha,
        enDisputa,
        actualizadoPor,
      })
      setMensaje("Seguimiento guardado.")
    } catch (err) {
      console.error("Error guardando seguimiento de cobranza:", err)
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar el seguimiento. Intenta de nuevo."
      )
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar() {
    const aceptado = await confirmar({
      title: "Eliminar seguimiento de cobranza",
      description: "Se eliminarán la nota, la promesa de pago y el estado de disputa.",
      confirmLabel: "Eliminar seguimiento",
      variant: "destructive",
    })
    if (!aceptado) return
    setGuardando(true)
    setError(null)
    setMensaje(null)
    try {
      await onEliminar(facturaId)
      setNota("")
      setPromesaPagoFecha("")
      setEnDisputa(false)
      setMensaje("Seguimiento eliminado.")
    } catch (err) {
      console.error("Error eliminando seguimiento de cobranza:", err)
      setError("No se pudo eliminar el seguimiento. Intenta de nuevo.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} className="rounded-lg border border-sky-100 bg-sky-50/60 p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_auto] lg:items-end">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-foreground">
            Nota de seguimiento
          </span>
          <textarea
            value={nota}
            onChange={(event) => setNota(event.target.value)}
            maxLength={2000}
            rows={2}
            placeholder="Ej. Compras confirmó pago para el viernes."
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-foreground">
            Promesa de pago
          </span>
          <input
            type="date"
            value={promesaPagoFecha}
            onChange={(event) => setPromesaPagoFecha(event.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
        </label>

        <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-foreground">
          <input
            type="checkbox"
            checked={enDisputa}
            onChange={(event) => setEnDisputa(event.target.checked)}
            className="h-4 w-4 rounded border-border text-primary"
          />
          En disputa
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-h-5 text-xs">
          {error && (
            <span className="inline-flex items-center gap-1 text-rose-600">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </span>
          )}
          {!error && mensaje && <span className="text-emerald-700">{mensaje}</span>}
          {!error && !mensaje && seguimiento && (
            <span className="text-muted-foreground">
              Última actualización por {seguimiento.actualizadoPor}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          {seguimiento && (
            <button
              type="button"
              onClick={eliminar}
              disabled={guardando}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar seguimiento
            </button>
          )}
          <button
            type="submit"
            disabled={guardando}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-2 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-50"
          >
            {guardando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Guardar seguimiento
          </button>
        </div>
      </div>
    </form>
  )
}
