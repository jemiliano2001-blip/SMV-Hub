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
import { PackageCheck, Loader2, Building2, ShoppingBag } from 'lucide-react'
import type { OrdenCompra } from '@/lib/schemas'
import { recibirOrdenesLoteAlmacenApi } from '@/lib/services/recepcion-almacen'
import { Badge } from '@/components/ui/badge'

interface ModalRecibirLoteAlmacenProps {
  ordenes: OrdenCompra[]
  abierto: boolean
  onCerrar: () => void
  onExito?: () => void
}

export default function ModalRecibirLoteAlmacen({
  ordenes,
  abierto,
  onCerrar,
  onExito,
}: ModalRecibirLoteAlmacenProps) {
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (ordenes.length === 0) return null

  const handleConfirmar = async () => {
    setGuardando(true)
    setError(null)
    try {
      const ordenIds = ordenes.map((o) => o.id)
      const res = await recibirOrdenesLoteAlmacenApi(ordenIds, notas)

      if (res.recibidas.length > 0) {
        toast.success(`Recepción en lote completada`, {
          description: `Se registraron como recibidas ${res.recibidas.length} orden(es) en almacén.${
            res.fallidas.length > 0 ? ` (${res.fallidas.length} no se pudieron procesar)` : ''
          }`,
        })
      }

      if (res.fallidas.length > 0 && res.recibidas.length === 0) {
        toast.error('No se pudo registrar la recepción de las órdenes seleccionadas', {
          description: res.fallidas[0]?.error,
        })
      }

      setNotas('')
      onExito?.()
      onCerrar()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar la recepción masiva'
      setError(msg)
      toast.error('No se pudo completar la recepción en lote', { description: msg })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open={abierto} onOpenChange={(open) => !guardando && !open && onCerrar()}>
      <DialogContent className="sm:max-w-lg bg-card border-border text-foreground">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <PackageCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Recepción Masiva en Almacén
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Registra la entrada física de {ordenes.length} {ordenes.length === 1 ? 'orden' : 'órdenes'} seleccionadas.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3.5 py-2">
          {/* Lista de órdenes a recibir (sin precios ni montos para respetar privacidad de almacén) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">
              Órdenes a procesar ({ordenes.length}):
            </Label>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-muted/40 divide-y divide-border p-1">
              {ordenes.map((orden) => {
                const totalItems = orden.items?.length || 0
                return (
                  <div key={orden.id} className="p-2.5 flex items-center justify-between text-xs gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-semibold text-foreground truncate">
                          {orden.proveedor || 'Sin proveedor'}
                        </span>
                        {orden.numeroFactura && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0 border-border text-foreground font-mono">
                            #{orden.numeroFactura}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {orden.requisicionId ? `Requisición: ${orden.requisicionId}` : 'Compra directa'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0 font-medium">
                      <ShoppingBag className="h-3 w-3" />
                      <span>{totalItems} {totalItems === 1 ? 'partida' : 'partidas'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Campo de notas / ubicación opcional */}
          <div className="space-y-1.5">
            <Label htmlFor="notas-lote" className="text-xs font-medium text-foreground">
              Ubicación de almacenamiento o notas (opcional):
            </Label>
            <Textarea
              id="notas-lote"
              placeholder="Ej. Estante A3, caja completa, verificado con el proveedor…"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="resize-none text-xs h-20 bg-background border-border"
              disabled={guardando}
            />
          </div>

          {error && (
            <div className="p-2.5 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCerrar}
            disabled={guardando}
            className="text-xs"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleConfirmar}
            disabled={guardando}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5"
          >
            {guardando ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Recibiendo…</span>
              </>
            ) : (
              <>
                <PackageCheck className="h-3.5 w-3.5" />
                <span>Confirmar ({ordenes.length})</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
