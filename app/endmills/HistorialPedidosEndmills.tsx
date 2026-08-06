"use client"

import { useEffect, useState } from "react"
import { Ban, PackageCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { listarPartidasPedidoEndmills } from "@/lib/endmills"
import { formatPrecio } from "@/lib/format"
import type {
  PartidaPedidoEndmills,
  PedidoEndmills,
  RecibirPedidoEndmillsInput,
} from "@/lib/schemas"

export default function HistorialPedidosEndmills({
  pedidos,
  loading,
  onRegistrarRecepcion,
  onCancelar,
}: {
  pedidos: PedidoEndmills[]
  loading: boolean
  onRegistrarRecepcion: (pedidoId: string, input: RecibirPedidoEndmillsInput) => Promise<void>
  onCancelar: (pedidoId: string, motivo: string) => Promise<void>
}) {
  const [seleccionado, setSeleccionado] = useState<PedidoEndmills | null>(null)

  if (loading && pedidos.length === 0) {
    return <div className="rounded-xl border bg-white p-4"><Skeleton className="h-48 w-full" /></div>
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      {pedidos.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">Todavía no hay ciclos de compra registrados.</div>
      ) : (
        <Table>
          <TableHeader><TableRow><TableHead>Fecha / folio</TableHead><TableHead>Proveedor</TableHead><TableHead>Estado</TableHead><TableHead className="text-right">Piezas</TableHead><TableHead className="text-right">Artículos</TableHead><TableHead className="text-right">Total USD</TableHead><TableHead><span className="sr-only">Acciones</span></TableHead></TableRow></TableHeader>
          <TableBody>
            {pedidos.map((pedido) => (
              <TableRow key={pedido.id}>
                <TableCell><div className="font-semibold">{pedido.fecha}</div><div className="text-[10px] text-slate-500">{pedido.numeroProveedor || "Sin folio"}</div></TableCell>
                <TableCell>{pedido.proveedor.nombre}</TableCell>
                <TableCell><EstadoPedido estado={pedido.estado} /></TableCell>
                <TableCell className="text-right font-bold">{pedido.numeroPiezas}</TableCell>
                <TableCell className="text-right">{formatPrecio(pedido.costoItemsUSD, "USD")}</TableCell>
                <TableCell className="text-right font-black text-emerald-700">{formatPrecio(pedido.totalUSD, "USD")}</TableCell>
                <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => setSeleccionado(pedido)}>Ver</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {seleccionado && (
        <DetallePedido
          key={seleccionado.id}
          pedido={seleccionado}
          onClose={() => setSeleccionado(null)}
          onRegistrarRecepcion={onRegistrarRecepcion}
          onCancelar={onCancelar}
        />
      )}
    </section>
  )
}

function DetallePedido({
  pedido,
  onClose,
  onRegistrarRecepcion,
  onCancelar,
}: {
  pedido: PedidoEndmills
  onClose: () => void
  onRegistrarRecepcion: (pedidoId: string, input: RecibirPedidoEndmillsInput) => Promise<void>
  onCancelar: (pedidoId: string, motivo: string) => Promise<void>
}) {
  const [carga, setCarga] = useState<{ pedidoId: string; rows: PartidaPedidoEndmills[] } | null>(null)
  const [recibidas, setRecibidas] = useState<Record<string, number>>({})
  const [motivo, setMotivo] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    void listarPartidasPedidoEndmills(pedido.id)
      .then((rows) => {
        if (cancelado) return
        setCarga({ pedidoId: pedido.id, rows })
        setRecibidas(Object.fromEntries(rows.map((linea) => [linea.id, linea.cantidadRecibida])))
      })
      .catch((err: unknown) => {
        console.error("No se pudieron cargar partidas endmills:", err)
        if (!cancelado) setError("No se pudieron cargar las partidas.")
      })
    return () => { cancelado = true }
  }, [pedido.id])

  async function guardarRecepcion() {
    if (!carga) return
    setGuardando(true)
    setError(null)
    try {
      await onRegistrarRecepcion(pedido.id, {
        partidas: carga.rows.map((linea) => ({
          partidaId: linea.id,
          cantidadRecibida: recibidas[linea.id] ?? linea.cantidadRecibida,
        })),
      })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la recepción.")
    } finally {
      setGuardando(false)
    }
  }

  async function cancelar() {
    setGuardando(true)
    setError(null)
    try {
      await onCancelar(pedido.id, motivo)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo cancelar el pedido.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader><DialogTitle>Pedido {pedido.numeroProveedor || pedido.fecha}</DialogTitle><DialogDescription>{pedido.proveedor.nombre} · {formatPrecio(pedido.totalUSD, "USD")}</DialogDescription></DialogHeader>
        <div className="grid gap-2 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-4">
          <div><span className="text-xs text-slate-500">Artículos</span><div className="font-bold">{formatPrecio(pedido.costoItemsUSD, "USD")}</div></div>
          <div><span className="text-xs text-slate-500">Ali Cost</span><div className="font-bold">{formatPrecio(pedido.aliCostUSD, "USD")}</div></div>
          <div><span className="text-xs text-slate-500">Shipping</span><div className="font-bold">{formatPrecio(pedido.shippingUSD, "USD")}</div></div>
          <div><span className="text-xs text-slate-500">Total</span><div className="font-black text-emerald-700">{formatPrecio(pedido.totalUSD, "USD")}</div></div>
        </div>
        {!carga || carga.pedidoId !== pedido.id ? <Skeleton className="h-48 w-full" /> : (
          <Table>
            <TableHeader><TableRow><TableHead>Medida / descripción</TableHead><TableHead className="text-right">Pedidas</TableHead><TableHead className="text-right">Recibidas</TableHead><TableHead className="text-right">Precio</TableHead><TableHead className="text-right">Subtotal</TableHead></TableRow></TableHeader>
            <TableBody>{carga.rows.map((linea) => (
              <TableRow key={linea.id}>
                <TableCell className="max-w-md whitespace-normal"><div className="font-semibold">{linea.medidaPulgadas}&quot; · {linea.descripcion}</div>{linea.tipo === "fuera_catalogo" && <div className="text-[10px] font-bold text-amber-700">Fuera del catálogo actual</div>}</TableCell>
                <TableCell className="text-right font-bold">{linea.cantidadPedida}</TableCell>
                <TableCell className="text-right">
                  {pedido.estado === "confirmado" ? <Input aria-label={`Cantidad recibida de ${linea.descripcion}`} type="number" min={linea.cantidadRecibida} max={linea.cantidadPedida} step={1} value={recibidas[linea.id] ?? linea.cantidadRecibida} onChange={(e) => setRecibidas((actual) => ({ ...actual, [linea.id]: Math.max(0, Math.trunc(Number(e.target.value) || 0)) }))} className="ml-auto w-20 text-right" /> : linea.cantidadRecibida}
                </TableCell>
                <TableCell className="text-right">{formatPrecio(linea.precioUnitarioUSD, "USD")}</TableCell>
                <TableCell className="text-right font-semibold">{formatPrecio(linea.subtotalUSD, "USD")}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
        {pedido.estado === "confirmado" && (
          <div className="grid gap-3 rounded-lg border border-rose-100 bg-rose-50/50 p-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div><Label htmlFor="motivo-cancelar">Cancelar pedido (motivo obligatorio)</Label><Input id="motivo-cancelar" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. proveedor canceló la fabricación" /></div>
            <Button variant="destructive" onClick={() => void cancelar()} disabled={guardando || !motivo.trim()}><Ban /> Cancelar pedido</Button>
          </div>
        )}
        {error && <p className="rounded bg-rose-50 p-2 text-sm text-rose-700">{error}</p>}
        <DialogFooter><Button variant="outline" onClick={onClose}>Cerrar</Button>{pedido.estado === "confirmado" && <Button onClick={() => void guardarRecepcion()} disabled={guardando || !carga}><PackageCheck /> {guardando ? "Guardando..." : "Guardar recepción"}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EstadoPedido({ estado }: { estado: PedidoEndmills["estado"] }) {
  const config = {
    confirmado: "border-sky-200 bg-sky-50 text-sky-700",
    recibido: "border-emerald-200 bg-emerald-50 text-emerald-700",
    cancelado: "border-rose-200 bg-rose-50 text-rose-700",
  }[estado]
  return <Badge variant="outline" className={config}>{estado}</Badge>
}
