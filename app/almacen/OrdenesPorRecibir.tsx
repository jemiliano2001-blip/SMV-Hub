'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  PackageCheck,
  Search,
  Loader2,
  AlertCircle,
  Truck,
  ExternalLink,
  Copy,
  FileText,
  MessageCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import ModuleSurface from '@/components/layout/ModuleSurface'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { listarOrdenesRecientes } from '@/lib/ordenes'
import type { OrdenCompra } from '@/lib/schemas'
import { formatPrecio } from '@/lib/format'
import ModalRecibirOrdenAlmacen from '@/components/abastecimiento/ModalRecibirOrdenAlmacen'

export default function OrdenesPorRecibir({
  onOrdenRecibida,
}: {
  onOrdenRecibida?: () => void
}) {
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<OrdenCompra | null>(null)

  const cargarOrdenes = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const recientes = await listarOrdenesRecientes(150)
      setOrdenes(recientes)
    } catch (err: unknown) {
      console.error('Error cargando órdenes para recepción en almacén:', err)
      setError('No se pudieron cargar las órdenes de compra por recibir.')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarOrdenes()
  }, [cargarOrdenes])

  // Filtrar órdenes aprobadas que aún no han sido recibidas
  const ordenesPorRecibir = useMemo(() => {
    return ordenes.filter(
      (o) => o.estado === 'aprobada' && o.estadoRecepcion !== 'recibida'
    )
  }, [ordenes])

  const ordenesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return ordenesPorRecibir

    return ordenesPorRecibir.filter((o) => {
      const prov = (o.proveedor || '').toLowerCase()
      const fac = (o.numeroFactura || '').toLowerCase()
      const items = (o.items || []).map((it) => it.descripcion).join(' ').toLowerCase()
      const req = (o.requisicionId || '').toLowerCase()
      return prov.includes(q) || fac.includes(q) || items.includes(q) || req.includes(q)
    })
  }, [ordenesPorRecibir, busqueda])

  function handleRecepcionExitosa() {
    setOrdenSeleccionada(null)
    void cargarOrdenes()
    onOrdenRecibida?.()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Buscar por proveedor, factura o material..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-8 text-xs h-9 bg-zinc-950/50 border-zinc-800"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <Truck className="h-4 w-4 text-amber-400" />
          <span>
            <strong className="text-zinc-100 font-semibold">{ordenesPorRecibir.length}</strong> compras aprobadas esperando llegada
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => void cargarOrdenes()} className="h-7 text-xs">
            Reintentar
          </Button>
        </div>
      )}

      <ModuleSurface>
        {cargando ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2 text-zinc-400 text-xs">
            <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
            <span>Consultando órdenes en tránsito...</span>
          </div>
        ) : ordenesFiltradas.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <div className="inline-flex p-3 rounded-full bg-zinc-900 text-zinc-400">
              <PackageCheck className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-zinc-300">
              {busqueda ? 'No se encontraron órdenes con ese criterio' : 'Almacén al día'}
            </p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              {busqueda
                ? 'Intenta con otro término de búsqueda.'
                : 'No hay compras pendientes de recepción en este momento.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-semibold">Proveedor & Factura</TableHead>
                  <TableHead className="text-xs font-semibold">Material / Partidas</TableHead>
                  <TableHead className="text-xs font-semibold">Origen</TableHead>
                  <TableHead className="text-xs font-semibold">Fecha Factura</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Total</TableHead>
                  <TableHead className="text-xs font-semibold text-center">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordenesFiltradas.map((orden) => {
                  const primerItem = orden.items?.[0]
                  const cantItems = orden.items?.length || 0

                  return (
                    <ContextMenu key={orden.id}>
                      <ContextMenuTrigger asChild>
                        <TableRow className="hover:bg-zinc-900/40 transition-colors cursor-pointer" onDoubleClick={() => setOrdenSeleccionada(orden)}>
                          <TableCell className="font-medium text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-zinc-100">{orden.proveedor}</span>
                              {orden.numeroFactura && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-zinc-700 text-zinc-300">
                                  #{orden.numeroFactura}
                                </Badge>
                              )}
                            </div>
                            {orden.linkProveedor && (
                              <a
                                href={orden.linkProveedor}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[11px] text-blue-400 hover:underline inline-flex items-center gap-1 mt-0.5"
                              >
                                <ExternalLink className="h-2.5 w-2.5" />
                                Ver tracking / enlace
                              </a>
                            )}
                          </TableCell>

                          <TableCell className="text-xs text-zinc-300 max-w-xs">
                            {primerItem ? (
                              <div>
                                <span className="font-medium text-zinc-200 line-clamp-1">
                                  {primerItem.cantidad}x {primerItem.descripcion}
                                </span>
                                {cantItems > 1 && (
                                  <span className="text-[11px] text-zinc-500">
                                    + {cantItems - 1} {cantItems - 1 === 1 ? 'partida más' : 'partidas más'}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-zinc-500 italic">Sin partidas detalladas</span>
                            )}
                          </TableCell>

                          <TableCell className="text-xs">
                            {orden.requisicionId ? (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-300 border-blue-500/20">
                                Requisición
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-zinc-800 text-zinc-400">
                                Compra directa
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell className="text-xs text-zinc-400">
                            {orden.fechaFactura || 'Sin fecha'}
                          </TableCell>

                          <TableCell className="text-xs font-mono text-right font-semibold text-zinc-200">
                            {formatPrecio(orden.total, orden.moneda || 'USD')}
                          </TableCell>

                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              onClick={() => setOrdenSeleccionada(orden)}
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-sm cursor-pointer"
                            >
                              <PackageCheck className="h-3.5 w-3.5" />
                              Recibir Material
                            </Button>
                          </TableCell>
                        </TableRow>
                      </ContextMenuTrigger>

                      <ContextMenuContent className="w-56">
                        <ContextMenuItem onClick={() => setOrdenSeleccionada(orden)}>
                          <PackageCheck className="text-emerald-600" />
                          <span>Recibir material / Conteo</span>
                          <ContextMenuShortcut>↵</ContextMenuShortcut>
                        </ContextMenuItem>

                        <ContextMenuSeparator />

                        <ContextMenuSub>
                          <ContextMenuSubTrigger>
                            <Copy className="text-slate-500" />
                            <span>Copiar información</span>
                          </ContextMenuSubTrigger>
                          <ContextMenuSubContent className="w-48">
                            <ContextMenuItem
                              onClick={() => {
                                void navigator.clipboard.writeText(orden.proveedor || '')
                                toast.success('Proveedor copiado')
                              }}
                            >
                              <span>Proveedor ({orden.proveedor})</span>
                            </ContextMenuItem>
                            {orden.numeroFactura && (
                              <ContextMenuItem
                                onClick={() => {
                                  void navigator.clipboard.writeText(orden.numeroFactura || '')
                                  toast.success('Factura copiada')
                                }}
                              >
                                <span>No. Factura ({orden.numeroFactura})</span>
                              </ContextMenuItem>
                            )}
                            {orden.requisicionId && (
                              <ContextMenuItem
                                onClick={() => {
                                  void navigator.clipboard.writeText(orden.requisicionId || '')
                                  toast.success('ID de requisición copiado')
                                }}
                              >
                                <span>ID Requisición</span>
                              </ContextMenuItem>
                            )}
                          </ContextMenuSubContent>
                        </ContextMenuSub>

                        {orden.linkProveedor && (
                          <ContextMenuItem
                            onClick={() => {
                              if (orden.linkProveedor) window.open(orden.linkProveedor, '_blank', 'noopener,noreferrer')
                            }}
                          >
                            <ExternalLink className="text-sky-600" />
                            <span>Abrir tracking / link</span>
                          </ContextMenuItem>
                        )}

                        {orden.imagenUrl && (
                          <ContextMenuItem
                            onClick={() => {
                              if (orden.imagenUrl) window.open(orden.imagenUrl, '_blank', 'noopener,noreferrer')
                            }}
                          >
                            <FileText className="text-amber-600" />
                            <span>Ver comprobante / factura</span>
                          </ContextMenuItem>
                        )}
                      </ContextMenuContent>
                    </ContextMenu>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </ModuleSurface>

      {/* MODAL DE RECEPCIÓN */}
      <ModalRecibirOrdenAlmacen
        orden={ordenSeleccionada}
        abierto={Boolean(ordenSeleccionada)}
        onCerrar={() => setOrdenSeleccionada(null)}
        onExito={handleRecepcionExitosa}
      />
    </div>
  )
}
