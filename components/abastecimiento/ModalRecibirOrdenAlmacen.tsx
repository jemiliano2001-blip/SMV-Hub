'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { PackageCheck, Loader2, AlertCircle, Building2, ShoppingBag } from 'lucide-react'
import type { OrdenCompra } from '@/lib/schemas'
import { recibirOrdenAlmacenApi } from '@/lib/services/recepcion-almacen'

interface ModalRecibirOrdenAlmacenProps {
  orden: OrdenCompra | null
  abierto: boolean
  onCerrar: () => void
  onExito?: () => void
}

export default function ModalRecibirOrdenAlmacen({
  orden,
  abierto,
  onCerrar,
  onExito,
}: ModalRecibirOrdenAlmacenProps) {
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!orden) return null

  const handleConfirmar = async () => {
    setGuardando(true)
    setError(null)
    try {
      await recibirOrdenAlmacenApi(orden.id, notas)
      toast.success('Material recibido en almacén', {
        description: `Se registró la entrada física de la orden ${orden.proveedor || orden.id}.`,
      })
      setNotas('')
      onExito?.()
      onCerrar()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar la recepción'
      setError(msg)
      toast.error('No se pudo registrar la recepción', { description: msg })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(open) => !guardando && !open && onCerrar()}>
      <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-zinc-100">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <PackageCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold text-zinc-100">
                Recibir Material en Almacén
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Registra la entrada física y cierra el ciclo de abastecimiento.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tarjeta resumen de la orden */}
          <div className="p-3.5 rounded-lg bg-zinc-800/50 border border-zinc-700/50 space-y-2 text-xs">
            <div className="flex justify-between items-center text-zinc-300">
              <span className="font-medium text-zinc-400 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-zinc-500" />
                Proveedor:
              </span>
              <span className="font-semibold text-zinc-100">{orden.proveedor || 'Sin proveedor'}</span>
            </div>

            {orden.numeroFactura && (
              <div className="flex justify-between items-center text-zinc-300">
                <span className="text-zinc-400">Factura / Referencia:</span>
                <span className="font-mono text-zinc-200">{orden.numeroFactura}</span>
              </div>
            )}

            <div className="flex justify-between items-center text-zinc-300">
              <span className="text-zinc-400 flex items-center gap-1.5">
                <ShoppingBag className="h-3.5 w-3.5 text-zinc-500" />
                Partidas / Items:
              </span>
              <span className="text-zinc-200">
                {orden.items?.length || 0} artículo{orden.items?.length === 1 ? '' : 's'}
              </span>
            </div>

            {orden.requisicionId && (
              <div className="flex justify-between items-center text-zinc-300 pt-1 border-t border-zinc-700/40">
                <span className="text-amber-400/90 font-medium">Requisición vinculada:</span>
                <span className="text-amber-300 font-mono text-[11px]">{orden.requisicionId}</span>
              </div>
            )}
          </div>

          {/* Notas de recepción */}
          <div className="space-y-1.5">
            <Label htmlFor="notas-recepcion" className="text-xs text-zinc-300">
              Notas o condición del material (opcional)
            </Label>
            <Textarea
              id="notas-recepcion"
              placeholder="Ej: Paquete en buen estado, entregado a taller..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              disabled={guardando}
              className="h-20 text-xs bg-zinc-950 border-zinc-700 placeholder:text-zinc-600 focus-visible:ring-emerald-500/30 resize-none"
            />
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={onCerrar}
            disabled={guardando}
            className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirmar}
            disabled={guardando}
            className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 font-medium"
          >
            {guardando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Registrando...
              </>
            ) : (
              <>
                <PackageCheck className="h-4 w-4" />
                Confirmar Entrada
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
