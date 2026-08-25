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
  QrCode,
} from 'lucide-react'
import { copiarAlPortapapeles } from '@/lib/portapapeles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import ModuleSurface from '@/components/layout/ModuleSurface'
import { LectorQR } from '@/components/LectorQR'
import { vibrarExito, vibrarTap } from '@/lib/haptics'
import { toast } from 'sonner'
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
import { authBypassActivo, useUsuario } from '@/lib/auth'
import { usePermisos } from '@/lib/hooks/useRol'
import { tieneModulo } from '@/lib/roles'
import { listarOrdenesRecientes } from '@/lib/ordenes'
import type { OrdenCompra } from '@/lib/schemas'
import { formatPrecio } from '@/lib/format'
import ModalRecibirOrdenAlmacen from '@/components/abastecimiento/ModalRecibirOrdenAlmacen'

export default function OrdenesPorRecibir({
  onOrdenRecibida,
}: {
  onOrdenRecibida?: () => void
}) {
  const { usuario } = useUsuario()
  const { modulos, esSuperAdmin } = usePermisos(authBypassActivo() ? null : usuario)
  // Almacén no ve dinero: montos y comprobantes son de compras/admin. La
  // plantilla `almacen` no trae ninguno de estos módulos; la de compras sí.
  const puedeVerMontos =
    esSuperAdmin ||
    authBypassActivo() ||
    tieneModulo(modulos, 'nueva-compra') ||
    tieneModulo(modulos, 'ordenes') ||
    tieneModulo(modulos, 'reportes')

  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<OrdenCompra | null>(null)
  const [isLectorAbierto, setIsLectorAbierto] = useState(false)

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

  function handleScanGuia(valor: string) {
    const limpio = valor.trim().toLowerCase()
    vibrarExito()

    // Intentar buscar orden exacta por factura, tracking o requisición
    const coincidencia = ordenesPorRecibir.find((o) => {
      const fac = (o.numeroFactura || '').toLowerCase()
      const req = (o.requisicionId || '').toLowerCase()
      const link = (o.linkProveedor || '').toLowerCase()
      return (fac && limpio.includes(fac)) || (req && limpio.includes(req)) || (link && link.includes(limpio))
    })

    if (coincidencia) {
      setOrdenSeleccionada(coincidencia)
      toast.success(`Orden encontrada: ${coincidencia.proveedor}`, {
        description: `Factura #${coincidencia.numeroFactura || 'S/N'}`,
      })
    } else {
      setBusqueda(valor.trim())
      toast.info(`Búsqueda aplicada: "${valor.trim()}"`)
    }
  }

  function handleRecepcionExitosa() {
    vibrarExito()
    setOrdenSeleccionada(null)
    void cargarOrdenes()
    onOrdenRecibida?.()
  }

  return (
    <div className="space-y-4">
      {/* Barra de búsqueda y Escáner Móvil */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar proveedor, factura, material…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-8 text-xs h-9 bg-card border-border rounded-xl"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              vibrarTap()
              setIsLectorAbierto(true)
            }}
            className="h-9 px-3 gap-1.5 rounded-xl border-border bg-card text-xs font-bold shrink-0 cursor-pointer shadow-2xs hover:bg-muted"
            title="Escanear código de barras o guía de paquetería"
          >
            <QrCode className="size-3.5 text-primary" />
            <span className="hidden sm:inline">Escanear Guía</span>
          </Button>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Truck className="h-4 w-4 text-amber-500" />
          <span>
            <strong className="text-foreground font-bold">{ordenesPorRecibir.length}</strong> compras por recibir
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => void cargarOrdenes()} className="h-7 text-xs">
            Reintentar
          </Button>
        </div>
      )}

      {/* Modal Lector de Guía / Factura */}
      <LectorQR
        isOpen={isLectorAbierto}
        onClose={() => setIsLectorAbierto(false)}
        onScan={handleScanGuia}
        titulo="Escanear Código de Guía o Factura"
        subtitulo="Apunta la cámara al código de barras de la caja (UPS, FedEx, DHL, McMaster)"
      />

      <ModuleSurface className="p-0 overflow-hidden">
        {cargando ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground text-xs">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span>Consultando compras en tránsito…</span>
          </div>
        ) : ordenesFiltradas.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <div className="inline-flex p-3 rounded-full bg-muted text-muted-foreground">
              <PackageCheck className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-foreground">
              {busqueda ? 'No se encontraron órdenes con ese criterio' : 'Almacén al día'}
            </p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {busqueda
                ? 'Intenta con otro término o limpia la búsqueda.'
                : 'No hay compras pendientes de recepción en este momento.'}
            </p>
          </div>
        ) : (
          <>
            {/* ── Vista Móvil Táctil (Feed de Tarjetas para Celulares) ── */}
            <div className="divide-y divide-border sm:hidden">
              {ordenesFiltradas.map((orden) => {
                const primerItem = orden.items?.[0]
                const cantItems = orden.items?.length || 0

                return (
                  <div key={orden.id} className="p-3.5 space-y-2.5 bg-card">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm text-foreground">{orden.proveedor}</span>
                          {orden.numeroFactura && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-foreground font-mono">
                              #{orden.numeroFactura}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {orden.fechaFactura ? `Fecha: ${orden.fechaFactura}` : 'Sin fecha'}
                          {orden.requisicionId ? ' · Requisición' : ' · Compra directa'}
                        </p>
                      </div>

                      {puedeVerMontos && (
                        <span className="font-mono text-xs font-bold text-foreground shrink-0">
                          {formatPrecio(orden.total, orden.moneda || 'USD')}
                        </span>
                      )}
                    </div>

                    {/* Resumen de Materiales */}
                    <div className="rounded-lg border border-border/80 bg-muted/40 p-2 text-xs">
                      {primerItem ? (
                        <p className="text-foreground font-medium line-clamp-2">
                          <span className="font-bold text-primary mr-1">{primerItem.cantidad}x</span>
                          {primerItem.descripcion}
                          {cantItems > 1 && (
                            <span className="text-muted-foreground font-normal ml-1">
                              (+{cantItems - 1} más)
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="text-muted-foreground italic">Sin partidas detalladas</p>
                      )}
                    </div>

                    {/* Botón de Acción Táctil Grande */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <Button
                        size="sm"
                        onClick={() => {
                          vibrarTap()
                          setOrdenSeleccionada(orden)
                        }}
                        className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 shadow-xs active:scale-98 cursor-pointer"
                      >
                        <PackageCheck className="size-4" />
                        <span>Recibir Material</span>
                      </Button>

                      {orden.linkProveedor && (
                        <a
                          href={orden.linkProveedor}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-10 px-3 flex items-center justify-center rounded-xl border border-border bg-card text-foreground hover:bg-muted text-xs shadow-2xs"
                          title="Ver tracking / enlace"
                        >
                          <ExternalLink className="size-4 text-primary" />
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Vista de Tabla para Pantallas Grandes ── */}
            <div className="hidden sm:block overflow-x-auto">
              <Table className="text-xs">
                <TableHeader className="bg-muted text-muted-foreground border-b border-border">
                  <TableRow>
                    <TableHead className="font-semibold px-4 py-2.5">Proveedor & Factura</TableHead>
                    <TableHead className="font-semibold px-4 py-2.5">Material / Partidas</TableHead>
                    <TableHead className="font-semibold px-4 py-2.5">Origen</TableHead>
                    <TableHead className="font-semibold px-4 py-2.5">Fecha Factura</TableHead>
                    {puedeVerMontos && (
                      <TableHead className="font-semibold px-4 py-2.5 text-right">Total</TableHead>
                    )}
                    <TableHead className="font-semibold px-4 py-2.5 text-center">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border">
                  {ordenesFiltradas.map((orden) => {
                    const primerItem = orden.items?.[0]
                    const cantItems = orden.items?.length || 0

                    return (
                      <ContextMenu key={orden.id}>
                        <ContextMenuTrigger asChild>
                          <TableRow className="hover:bg-muted/50 transition-colors cursor-pointer select-none" onDoubleClick={() => setOrdenSeleccionada(orden)}>
                            <TableCell className="font-medium px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">{orden.proveedor}</span>
                                {orden.numeroFactura && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-border text-foreground font-mono">
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
                                  className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
                                >
                                  <ExternalLink className="size-3" />
                                  Ver tracking
                                </a>
                              )}
                            </TableCell>

                            <TableCell className="px-4 py-2.5 max-w-xs text-foreground">
                              {primerItem ? (
                                <div>
                                  <span className="font-medium line-clamp-1">
                                    <strong className="text-primary font-mono mr-1">{primerItem.cantidad}x</strong>
                                    {primerItem.descripcion}
                                  </span>
                                  {cantItems > 1 && (
                                    <span className="text-[11px] text-muted-foreground">
                                      +{cantItems - 1} {cantItems - 1 === 1 ? 'partida más' : 'partidas más'}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground italic">Sin partidas detalladas</span>
                              )}
                            </TableCell>

                            <TableCell className="px-4 py-2.5">
                              {orden.requisicionId ? (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
                                  Requisición
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground">
                                  Compra directa
                                </Badge>
                              )}
                            </TableCell>

                            <TableCell className="px-4 py-2.5 text-muted-foreground">
                              {orden.fechaFactura || 'Sin fecha'}
                            </TableCell>

                            {puedeVerMontos && (
                              <TableCell className="px-4 py-2.5 font-mono text-right font-semibold text-foreground">
                                {formatPrecio(orden.total, orden.moneda || 'USD')}
                              </TableCell>
                            )}

                            <TableCell className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="sm"
                                onClick={() => {
                                  vibrarTap()
                                  setOrdenSeleccionada(orden)
                                }}
                                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-2xs cursor-pointer font-bold"
                              >
                                <PackageCheck className="size-3.5" />
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
                              <Copy className="text-muted-foreground" />
                              <span>Copiar información</span>
                            </ContextMenuSubTrigger>
                            <ContextMenuSubContent className="w-48">
                              <ContextMenuItem
                                onClick={() => {
                                  void copiarAlPortapapeles(orden.proveedor || '', 'Proveedor copiado')
                                }}
                              >
                                <span>Proveedor ({orden.proveedor})</span>
                              </ContextMenuItem>
                              {orden.numeroFactura && (
                                <ContextMenuItem
                                  onClick={() => {
                                    void copiarAlPortapapeles(orden.numeroFactura || '', 'Factura copiada')
                                  }}
                                >
                                  <span>No. Factura ({orden.numeroFactura})</span>
                                </ContextMenuItem>
                              )}
                              {orden.requisicionId && (
                                <ContextMenuItem
                                  onClick={() => {
                                    void copiarAlPortapapeles(orden.requisicionId || '', 'ID de requisición copiado')
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
                              <ExternalLink className="text-primary" />
                              <span>Abrir tracking / link</span>
                            </ContextMenuItem>
                          )}

                          {puedeVerMontos && orden.imagenUrl && (
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
          </>
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
