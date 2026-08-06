"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, History, Pencil, Search } from "lucide-react"
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
import {
  calcularCantidadSugerida,
  clasificarStockEndmill,
} from "@/lib/endmills-calculos"
import { formatPrecio } from "@/lib/format"
import { listarHistorialMedidaEndmills } from "@/lib/endmills"
import type {
  CategoriaEndmill,
  EndmillMedida,
  PartidaPedidoEndmills,
} from "@/lib/schemas"

const CATEGORIAS: Array<{ id: CategoriaEndmill | "todas"; label: string }> = [
  { id: "todas", label: "Todas" },
  { id: "FLAT", label: "Flat" },
  { id: "BALL", label: "Ball" },
  { id: "LARGO_FLAT", label: "Largo Flat" },
  { id: "LARGO_BOLA", label: "Largo Bola" },
  { id: "EXTRA_LARGO_FLAT", label: "Extra Largo Flat" },
  { id: "EXTRA_LARGO_BOLA", label: "Extra Largo Bola" },
  { id: "RUPA_CARBURO", label: "Rupa / Carburo" },
]

export default function InventarioEndmills({
  medidas,
  loading,
  onActualizarStock,
}: {
  medidas: EndmillMedida[]
  loading: boolean
  onActualizarStock: (id: string, stock: number) => Promise<void>
}) {
  const [busqueda, setBusqueda] = useState("")
  const [categoria, setCategoria] = useState<CategoriaEndmill | "todas">("todas")
  const [seleccionada, setSeleccionada] = useState<EndmillMedida | null>(null)
  const [stockEditado, setStockEditado] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historial, setHistorial] = useState<{
    medidaId: string
    rows: PartidaPedidoEndmills[]
  } | null>(null)

  useEffect(() => {
    if (!seleccionada) return
    let cancelado = false
    const medidaId = seleccionada.id
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
  }, [seleccionada])

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return medidas.filter((medida) => {
      if (categoria !== "todas" && medida.categoria !== categoria) return false
      if (!q) return true
      return [medida.descripcion, medida.medidaPulgadas, medida.specPropuesta]
        .join(" ")
        .toLowerCase()
        .includes(q)
    })
  }, [medidas, busqueda, categoria])

  function abrirDetalle(medida: EndmillMedida) {
    setSeleccionada(medida)
    setStockEditado(String(medida.stockActual))
    setError(null)
  }

  async function guardarStock() {
    if (!seleccionada) return
    const stock = Number(stockEditado)
    if (!Number.isInteger(stock) || stock < 0) {
      setError("Captura un número entero no negativo.")
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await onActualizarStock(seleccionada.id, stock)
      setSeleccionada(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el stock.")
    } finally {
      setGuardando(false)
    }
  }

  if (loading && medidas.length === 0) {
    return <div className="space-y-2 rounded-xl border bg-white p-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-64 w-full" /></div>
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar medida, descripción o spec..."
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIAS.map((item) => {
            const cantidad = item.id === "todas"
              ? medidas.length
              : medidas.filter((medida) => medida.categoria === item.id).length
            return (
              <button
                key={item.id}
                onClick={() => setCategoria(item.id)}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                  categoria === item.id
                    ? "border-sky-700 bg-sky-700 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-sky-300"
                }`}
              >
                {item.label} · {cantidad}
              </button>
            )
          })}
        </div>
      </div>

      {medidas.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          El catálogo aún no está importado. Ejecuta primero el importador validado en el ambiente autorizado.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Medida</TableHead>
              <TableHead>Descripción / spec</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Precio</TableHead>
              <TableHead className="text-right">Sugerido</TableHead>
              <TableHead className="w-12"><span className="sr-only">Acciones</span></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtradas.map((medida) => {
              const estado = clasificarStockEndmill(medida.stockActual, medida.objetivoPar)
              const sugerido = calcularCantidadSugerida(medida.objetivoPar, medida.stockActual)
              return (
                <TableRow key={medida.id} className={medida.requiereConfirmacion ? "bg-amber-50/70" : ""}>
                  <TableCell className="font-mono font-bold text-slate-900">{medida.medidaPulgadas}&quot;</TableCell>
                  <TableCell className="max-w-md whitespace-normal">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                      {medida.requiereConfirmacion && <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                      {medida.descripcion}
                    </div>
                    <div className="mt-0.5 truncate font-mono text-[10px] text-slate-500">{medida.specPropuesta}</div>
                  </TableCell>
                  <TableCell className="text-right text-base font-black tabular-nums">{medida.stockActual}</TableCell>
                  <TableCell><EstadoBadge estado={estado} /></TableCell>
                  <TableCell className="text-right font-semibold text-emerald-700">{formatPrecio(medida.precioActualUSD, "USD")}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{sugerido === null ? "—" : sugerido}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => abrirDetalle(medida)} aria-label={`Editar ${medida.descripcion}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      {seleccionada && (
        <Dialog open onOpenChange={(open) => !open && setSeleccionada(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{seleccionada.descripcion}</DialogTitle>
              <DialogDescription>{seleccionada.specPropuesta}</DialogDescription>
            </DialogHeader>
            {seleccionada.requiereConfirmacion && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Precio o especificación pendientes de confirmar con China. Esta partida no entra automáticamente en un pedido.
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="stock-endmill">Stock actual</Label>
                <Input id="stock-endmill" type="number" min={0} step={1} value={stockEditado} onChange={(event) => setStockEditado(event.target.value)} />
              </div>
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <div className="text-xs text-slate-500">Precio vigente</div>
                <div className="font-bold text-emerald-700">{formatPrecio(seleccionada.precioActualUSD, "USD")}</div>
                <div className="mt-2 text-xs text-slate-500">Objetivo base</div>
                <div className="font-bold">{seleccionada.objetivoPar ?? "Sin base"}</div>
              </div>
            </div>
            {seleccionada.notas && <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">{seleccionada.notas}</p>}
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-bold"><History className="h-4 w-4" /> Historial</div>
              {historial?.medidaId !== seleccionada.id ? (
                <Skeleton className="h-16 w-full" />
              ) : historial.rows.length === 0 ? (
                <p className="text-xs text-slate-500">Sin pedidos rastreados para esta medida.</p>
              ) : (
                <div className="space-y-1">
                  {historial.rows.map((linea) => (
                    <div key={linea.id} className="flex items-center justify-between rounded border px-3 py-2 text-xs">
                      <span>{linea.fechaPedido} · {linea.cantidadPedida} pzas</span>
                      <span className="font-semibold">{formatPrecio(linea.precioUnitarioUSD, "USD")} c/u</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {error && <p className="text-sm text-rose-700">{error}</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSeleccionada(null)}>Cerrar</Button>
              <Button onClick={() => void guardarStock()} disabled={guardando}>{guardando ? "Guardando..." : "Guardar stock"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </section>
  )
}

function EstadoBadge({ estado }: { estado: "sin_base" | "critico" | "bajo" | "ok" }) {
  const config = {
    sin_base: { label: "Sin base", className: "border-slate-200 bg-slate-100 text-slate-700" },
    critico: { label: "Crítico", className: "border-rose-200 bg-rose-50 text-rose-700" },
    bajo: { label: "Bajo", className: "border-amber-200 bg-amber-50 text-amber-800" },
    ok: { label: "OK", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  }[estado]
  return <Badge variant="outline" className={config.className}>{config.label}</Badge>
}

