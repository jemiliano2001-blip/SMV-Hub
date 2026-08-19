'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Inbox,
  ClipboardList,
  Package,
  Layers,
  ArrowRight,
  ExternalLink,
  AlertTriangle,
  ShoppingCart,
  Loader2,
} from 'lucide-react'
import { useRequisiciones } from '@/lib/hooks/useRequisiciones'
import { usePedidosAlmacen } from '@/lib/hooks/usePedidosAlmacen'
import { useEndmills } from '@/lib/hooks/useEndmills'
import type { Requisicion, PedidoAlmacen, EndmillMedida } from '@/lib/schemas'

interface DrawerPendientesAbastecimientoProps {
  trigger?: React.ReactNode
  onCargarRequisicion?: (req: Requisicion) => void
  onCargarPedido?: (pedido: PedidoAlmacen) => void
}

export default function DrawerPendientesAbastecimiento({
  trigger,
  onCargarRequisicion,
  onCargarPedido,
}: DrawerPendientesAbastecimientoProps) {
  const [abierto, setAbierto] = useState(false)
  const { requisiciones, loading: loadingReqs } = useRequisiciones({ completoInicial: true })
  const { pedidos, loading: loadingPedidos } = usePedidosAlmacen()
  const { medidas, loadingMedidas } = useEndmills()

  // 1. Filtrar Requisiciones pendientes de compra
  const reqsPendientes = useMemo(() => {
    return requisiciones.filter(
      (r) => r.estado === 'en_proceso' || r.estado === 'parcial' || r.estado === 'no_comprado'
    )
  }, [requisiciones])

  // 2. Filtrar Pedidos de almacén no comprados
  const pedidosPendientes = useMemo(() => {
    return pedidos.filter(
      (p) => p.estado !== 'comprado' && !p.ordenIdVinculada && p.estado !== 'cancelado'
    )
  }, [pedidos])

  // 3. Filtrar Endmills en nivel crítico
  const endmillsCriticos = useMemo(() => {
    return medidas.filter(
      (m) => m.stockActual <= (m.objetivoPar ?? 2)
    )
  }, [medidas])

  const totalPendientes =
    reqsPendientes.length + pedidosPendientes.length + endmillsCriticos.length

  return (
    <Sheet open={abierto} onOpenChange={setAbierto}>
      <SheetTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-amber-500/30 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
          >
            <Inbox className="h-4 w-4" />
            <span>Pendientes de Compra</span>
            {totalPendientes > 0 && (
              <Badge variant="secondary" className="bg-amber-500 text-zinc-950 font-bold px-1.5 py-0 text-[10px]">
                {totalPendientes}
              </Badge>
            )}
          </Button>
        )}
      </SheetTrigger>

      <SheetContent
        side="right"
        className="w-full sm:max-w-xl bg-zinc-900 border-zinc-800 text-zinc-100 p-0 flex flex-col"
      >
        <SheetHeader className="p-6 pb-4 border-b border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                  Bandeja de Abastecimiento
                  <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400">
                    {totalPendientes} pendientes
                  </Badge>
                </SheetTitle>
                <SheetDescription className="text-xs text-zinc-400">
                  Requisiciones de taller, pedidos de almacén y herramientas por reordenar.
                </SheetDescription>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6">
          <Tabs defaultValue="requisiciones" className="w-full">
            <TabsList className="w-full bg-zinc-950/70 border border-zinc-800 grid grid-cols-3 p-1">
              <TabsTrigger
                value="requisiciones"
                className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 gap-1.5"
              >
                <ClipboardList className="h-3.5 w-3.5 text-blue-400" />
                <span className="truncate">Requisiciones</span>
                {reqsPendientes.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-500/20 text-blue-300">
                    {reqsPendientes.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="pedidos"
                className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 gap-1.5"
              >
                <Package className="h-3.5 w-3.5 text-amber-400" />
                <span className="truncate">Pedidos Almacén</span>
                {pedidosPendientes.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-300">
                    {pedidosPendientes.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="endmills"
                className="text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 gap-1.5"
              >
                <Layers className="h-3.5 w-3.5 text-rose-400" />
                <span className="truncate">Endmills Reorden</span>
                {endmillsCriticos.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/20 text-rose-300">
                    {endmillsCriticos.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: REQUISICIONES */}
            <TabsContent value="requisiciones" className="mt-4 space-y-3">
              {loadingReqs ? (
                <div className="py-12 flex justify-center items-center text-zinc-500 gap-2 text-xs">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando requisiciones...
                </div>
              ) : reqsPendientes.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs">
                  No hay requisiciones pendientes de compra.
                </div>
              ) : (
                reqsPendientes.map((req) => (
                  <div
                    key={req.id}
                    className="p-3.5 rounded-lg bg-zinc-950/40 border border-zinc-800/80 hover:border-zinc-700/80 transition-colors space-y-2.5"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-zinc-100">
                            {req.folio || 'Requisición'}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 border-blue-500/30 text-blue-400"
                          >
                            {req.estado}
                          </Badge>
                        </div>
                        <p className="text-xs text-zinc-300 mt-1 line-clamp-2">
                          {req.descripcion || req.nota || req.tienda || 'Sin descripción detallada'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11px] text-zinc-400 font-mono">
                          {req.solicitante || 'Taller'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50 text-xs">
                      {req.link ? (
                        <a
                          href={req.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:underline inline-flex items-center gap-1 text-[11px]"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Ver catálogo
                        </a>
                      ) : (
                        <span className="text-zinc-600 text-[11px]">Sin enlace</span>
                      )}

                      {onCargarRequisicion ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            onCargarRequisicion(req)
                            setAbierto(false)
                          }}
                          className="h-7 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-100 gap-1"
                        >
                          Cargar
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      ) : (
                        <Link
                          href={`/nueva-compra?requisicionId=${req.id}&descripcion=${encodeURIComponent(
                            req.descripcion || req.nota || req.tienda || ''
                          )}`}
                          onClick={() => setAbierto(false)}
                        >
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-100 gap-1"
                          >
                            Comprar
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* TAB 2: PEDIDOS ALMACÉN */}
            <TabsContent value="pedidos" className="mt-4 space-y-3">
              {loadingPedidos ? (
                <div className="py-12 flex justify-center items-center text-zinc-500 gap-2 text-xs">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando pedidos de almacén...
                </div>
              ) : pedidosPendientes.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs">
                  No hay pedidos de almacén pendientes de compra.
                </div>
              ) : (
                pedidosPendientes.map((ped) => (
                  <div
                    key={ped.id}
                    className="p-3.5 rounded-lg bg-zinc-950/40 border border-zinc-800/80 hover:border-zinc-700/80 transition-colors space-y-2.5"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-zinc-100">
                            {ped.descripcion}
                          </span>
                          {ped.urgente && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 border-red-500/30 text-red-400 bg-red-500/10"
                            >
                              Urgente
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-1">
                          Solicitado por: <span className="text-zinc-200">{ped.solicitadoPorNombre}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50 text-xs">
                      {ped.imagenUrl ? (
                        <a
                          href={ped.imagenUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-400 hover:underline inline-flex items-center gap-1 text-[11px]"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Ver foto adjunta
                        </a>
                      ) : (
                        <span className="text-zinc-600 text-[11px]">Sin enlace</span>
                      )}

                      {onCargarPedido ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            onCargarPedido(ped)
                            setAbierto(false)
                          }}
                          className="h-7 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 gap-1"
                        >
                          Cargar
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      ) : (
                        <Link
                          href={`/nueva-compra?pedidoId=${ped.id}&descripcion=${encodeURIComponent(
                            ped.descripcion
                          )}`}
                          onClick={() => setAbierto(false)}
                        >
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-7 text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 gap-1"
                          >
                            Comprar
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* TAB 3: ENDMILLS REORDEN */}
            <TabsContent value="endmills" className="mt-4 space-y-3">
              {loadingMedidas ? (
                <div className="py-12 flex justify-center items-center text-zinc-500 gap-2 text-xs">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando endmills...
                </div>
              ) : endmillsCriticos.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs">
                  No hay herramientas por debajo del stock mínimo.
                </div>
              ) : (
                endmillsCriticos.map((medida: EndmillMedida) => (
                  <div
                    key={medida.id}
                    className="p-3.5 rounded-lg bg-zinc-950/40 border border-zinc-800/80 hover:border-zinc-700/80 transition-colors space-y-2"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-zinc-100">
                            {medida.medidaPulgadas}
                          </span>
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 border-rose-500/30 text-rose-400 flex items-center gap-1"
                          >
                            <AlertTriangle className="h-2.5 w-2.5" />
                            Stock: {medida.stockActual} (Objetivo: {medida.objetivoPar ?? 2})
                          </Badge>
                        </div>
                        <p className="text-[11px] text-zinc-400 mt-1">
                          {medida.categoria} • {medida.descripcion || 'Sin descripción'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end pt-2 border-t border-zinc-800/50 text-xs">
                      <Link
                        href={`/nueva-compra?descripcion=${encodeURIComponent(
                          `Endmill ${medida.medidaPulgadas} (${medida.categoria})`
                        )}`}
                        onClick={() => setAbierto(false)}
                      >
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-7 text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 gap-1"
                        >
                          Reordenar
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}
