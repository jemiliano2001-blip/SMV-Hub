"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { formatPrecio } from "@/lib/format"
import { listarHistorialMedidaEndmills } from "@/lib/endmills"
import type { EndmillMedida, PartidaPedidoEndmills } from "@/lib/schemas"

export default function ModalDetalleEndmill({
  medida,
  onClose,
  onActualizarStock,
  onConfirmarMedida,
}: {
  medida: EndmillMedida
  onClose: () => void
  onActualizarStock: (id: string, stock: number) => Promise<void>
  onConfirmarMedida?: (id: string) => Promise<void>
}) {
  const [stockEditado, setStockEditado] = useState(String(medida.stockActual))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historial, setHistorial] = useState<{
    medidaId: string
    rows: PartidaPedidoEndmills[]
  } | null>(null)

  useEffect(() => {
    let cancelado = false
    const medidaId = medida.id
    void listarHistorialMedidaEndmills(medidaId)
      .then((rows) => {
        if (!cancelado) setHistorial({ medidaId, rows })
      })
      .catch((err: unknown) => {
        console.error("No se pudo cargar historial de endmill:", err)
        if (!cancelado) setHistorial({ medidaId, rows: [] })
      })
    return () => {
      cancelado = true
    }
  }, [medida.id])

  async function handleGuardarStock() {
    if (!medida) return
    const stock = Number(stockEditado)
    if (!Number.isInteger(stock) || stock < 0) {
      setError("Captura un número entero no negativo.")
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await onActualizarStock(medida.id, stock)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el stock.")
    } finally {
      setGuardando(false)
    }
  }

  async function handleResolverConfirmacion() {
    if (!medida || !onConfirmarMedida) return
    setGuardando(true)
    setError(null)
    try {
      await onConfirmarMedida(medida.id)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{medida.descripcion}</span>
            {medida.requiereConfirmacion && onConfirmarMedida && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleResolverConfirmacion()}
                disabled={guardando}
                className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Marcar confirmada
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>{medida.specPropuesta}</DialogDescription>
        </DialogHeader>

        {medida.requiereConfirmacion && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Precio o especificación pendientes de confirmar con China. Esta partida no entra automáticamente en un pedido.
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="stock-endmill">Stock actual</Label>
            <Input
              id="stock-endmill"
              type="number"
              min={0}
              step={1}
              value={stockEditado}
              onChange={(event) => setStockEditado(event.target.value)}
            />
          </div>
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="text-xs text-slate-500">Precio vigente</div>
            <div className="font-bold text-emerald-700">{formatPrecio(medida.precioActualUSD, "USD")}</div>
            <div className="mt-2 text-xs text-slate-500">Objetivo base</div>
            <div className="font-bold">{medida.objetivoPar ?? "Sin base"}</div>
          </div>
        </div>

        {medida.notas && <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{medida.notas}</p>}

        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-bold">
            <History className="h-4 w-4" /> Historial de compras y variación de precios
          </div>
          {historial?.medidaId !== medida.id ? (
            <Skeleton className="h-16 w-full" />
          ) : historial.rows.length === 0 ? (
            <p className="text-xs text-slate-500">Sin pedidos rastreados para esta medida.</p>
          ) : (
            <div className="space-y-1">
              {historial.rows.map((linea, index) => {
                const anterior = historial.rows[index + 1]
                let pctVar: string | null = null
                if (anterior && anterior.precioUnitarioUSD > 0) {
                  const diff = ((linea.precioUnitarioUSD - anterior.precioUnitarioUSD) / anterior.precioUnitarioUSD) * 100
                  pctVar = `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}%`
                }
                return (
                  <div key={linea.id} className="flex items-center justify-between rounded border px-3 py-2 text-xs">
                    <span>{linea.fechaPedido} · {linea.cantidadPedida} pzas</span>
                    <div className="flex items-center gap-2 font-semibold">
                      {pctVar && (
                        <span className={`text-[10px] font-bold ${pctVar.startsWith("+") ? "text-rose-600" : "text-emerald-600"}`}>
                          ({pctVar})
                        </span>
                      )}
                      <span>{formatPrecio(linea.precioUnitarioUSD, "USD")} c/u</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-rose-700">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          <Button onClick={() => void handleGuardarStock()} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar stock"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
