"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, BarChart3, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import ModuleEmptyState from "@/components/layout/ModuleEmptyState"
import ModuleSurface from "@/components/layout/ModuleSurface"
import { listarPartidasCatalogadasEndmills } from "@/lib/endmills"
import {
  agregarRankingComprasEndmills,
  type RankingCompraEndmill,
} from "@/lib/endmills-calculos"
import { formatPrecio } from "@/lib/format"
import type { PedidoEndmills } from "@/lib/schemas"

function formatearFechaCorta(fechaISO: string): string {
  const [anio, mes, dia] = fechaISO.split("-").map(Number)
  if (!anio || !mes || !dia) return fechaISO
  return new Date(anio, mes - 1, dia).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export default function AnalisisComprasEndmills({
  pedidos,
}: {
  pedidos: PedidoEndmills[]
}) {
  const [ranking, setRanking] = useState<RankingCompraEndmill[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const cargaInicialHecha = useRef(false)

  const canceladosKey = useMemo(
    () =>
      pedidos
        .filter((pedido) => pedido.estado === "cancelado")
        .map((pedido) => pedido.id)
        .sort()
        .join("|"),
    [pedidos]
  )

  const pedidosCancelados = useMemo(
    () => new Set(canceladosKey.length > 0 ? canceladosKey.split("|") : []),
    [canceladosKey]
  )

  // Cadena de promesa en lugar de async/await: el efecto sólo dispara la carga
  // y todo setState ocurre en callbacks cuando responde Firestore
  // (react-hooks/set-state-in-effect trata el cuerpo async como síncrono).
  const cargar = useCallback(() => {
    const esCargaInicial = !cargaInicialHecha.current
    return listarPartidasCatalogadasEndmills()
      .then((partidas) => {
        setRanking(agregarRankingComprasEndmills(partidas, pedidosCancelados))
        setError(null)
        cargaInicialHecha.current = true
      })
      .catch((err: unknown) => {
        console.error("Error cargando ranking de compras endmills:", err)
        setError("No se pudo cargar el ranking de compras. Intenta de nuevo.")
        if (esCargaInicial) setRanking([])
      })
      .finally(() => {
        if (esCargaInicial) setLoading(false)
      })
  }, [pedidosCancelados])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const reintentar = () => {
    setError(null)
    if (!cargaInicialHecha.current) setLoading(true)
    void cargar()
  }

  const kpis = useMemo(() => {
    const totalPiezas = ranking.reduce((acc, fila) => acc + fila.piezasPedidas, 0)
    const totalUSD = ranking.reduce((acc, fila) => acc + fila.totalUSD, 0)
    const top = ranking[0] ?? null
    return { totalPiezas, totalUSD, top }
  }, [ranking])

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={reintentar}>
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Reintentar
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <ModuleSurface className="p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Más comprada
          </div>
          <div className="mt-1 text-sm font-bold text-foreground">
            {kpis.top
              ? `${kpis.top.medidaPulgadas}" ${kpis.top.descripcion}`
              : "—"}
          </div>
          {kpis.top ? (
            <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
              {kpis.top.piezasPedidas} pcs · {formatPrecio(kpis.top.totalUSD, "USD")}
            </div>
          ) : null}
        </ModuleSurface>
        <ModuleSurface className="p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Piezas pedidas
          </div>
          <div className="mt-1 text-xl font-black tabular-nums text-foreground">
            {kpis.totalPiezas.toLocaleString("es-MX")}
          </div>
        </ModuleSurface>
        <ModuleSurface className="p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Total USD (ítems)
          </div>
          <div className="mt-1 text-xl font-black tabular-nums text-foreground">
            {formatPrecio(kpis.totalUSD, "USD")}
          </div>
        </ModuleSurface>
      </div>

      {ranking.length === 0 && !error ? (
        <ModuleEmptyState
          icon={BarChart3}
          title="Sin compras para rankear"
          description="Cuando confirmes pedidos con partidas del catálogo, aquí verás cuáles se compran más."
        />
      ) : ranking.length > 0 ? (
        <ModuleSurface className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Medida</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead className="text-right">Piezas pedidas</TableHead>
                  <TableHead className="text-right">Piezas recibidas</TableHead>
                  <TableHead className="text-right">USD total</TableHead>
                  <TableHead className="text-right"># Pedidos</TableHead>
                  <TableHead className="text-right">Última compra</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ranking.map((fila, index) => (
                  <TableRow key={fila.medidaId}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-foreground">
                        {fila.medidaPulgadas}&quot; {fila.descripcion}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {fila.categoria ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold tabular-nums">
                      {fila.piezasPedidas}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                      {fila.piezasRecibidas}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold tabular-nums">
                      {formatPrecio(fila.totalUSD, "USD")}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {fila.numeroPedidos}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatearFechaCorta(fila.ultimaCompra)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ModuleSurface>
      ) : null}
    </div>
  )
}
