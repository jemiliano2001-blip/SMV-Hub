'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Search,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  FileSpreadsheet,
  DollarSign,
  Layers,
  RefreshCw,
  Clock,
  AlertCircle,
  Copy,
  ShoppingCart,
} from 'lucide-react'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
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
import type { RegistroCotizacionOdoo } from '@/lib/schemas'
import { listarCotizacionesOdoo } from '@/lib/compras-odoo-cotizaciones'

function formatMoney(n: number) {
  return n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function HistorialOdooList() {
  const [registros, setRegistros] = useState<RegistroCotizacionOdoo[]>([])
  const [cargando, setCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [expandidoId, setExpandidoId] = useState<string | null>(null)

  const cargarHistorial = useCallback(async () => {
    try {
      setCargando(true)
      setErrorCarga(null)
      const items = await listarCotizacionesOdoo(150)
      setRegistros(items)
    } catch (err) {
      console.error('Error al cargar historial de Odoo:', err)
      setErrorCarga(
        err instanceof Error
          ? err.message
          : 'No se pudo cargar el historial. Intenta de nuevo.'
      )
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    let activo = true
    async function inicializar() {
      try {
        const items = await listarCotizacionesOdoo(150)
        if (activo) {
          setRegistros(items)
          setErrorCarga(null)
          setCargando(false)
        }
      } catch (err) {
        console.error('Error al cargar historial de Odoo:', err)
        if (activo) {
          setErrorCarga(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar el historial. Intenta de nuevo.'
          )
          setCargando(false)
        }
      }
    }
    void inicializar()
    return () => {
      activo = false
    }
  }, [])

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    if (!q) return registros

    return registros.filter(
      (r) =>
        r.odooName.toLowerCase().includes(q) ||
        r.proveedor.toLowerCase().includes(q) ||
        (r.referenciaProveedor && r.referenciaProveedor.toLowerCase().includes(q)) ||
        (r.creadoPorEmail && r.creadoPorEmail.toLowerCase().includes(q))
    )
  }, [registros, busqueda])

  const stats = useMemo(() => {
    const total = filtrados.length
    const totalMxn = filtrados
      .filter((r) => r.moneda === 'MXN')
      .reduce((acc, r) => acc + (r.total || 0), 0)
    const totalUsd = filtrados
      .filter((r) => r.moneda === 'USD')
      .reduce((acc, r) => acc + (r.total || 0), 0)
    return { total, totalMxn, totalUsd }
  }, [filtrados])

  const toggleExpandir = (id: string) => {
    setExpandidoId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="gap-2 py-4 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between px-4 pb-0">
            <CardTitle className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
              Cotizaciones Enviadas
            </CardTitle>
            <Layers className="text-primary size-4" aria-hidden />
          </CardHeader>
          <CardContent className="px-4">
            {cargando ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <p className="font-mono text-xl font-bold tabular-nums">{stats.total}</p>
            )}
          </CardContent>
        </Card>

        <Card className="gap-2 py-4 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between px-4 pb-0">
            <CardTitle className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
              Monto Total MXN
            </CardTitle>
            <DollarSign className="text-emerald-600 size-4" aria-hidden />
          </CardHeader>
          <CardContent className="px-4">
            {cargando ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <p className="font-mono text-xl font-bold tabular-nums text-emerald-950">
                ${formatMoney(stats.totalMxn)}{' '}
                <span className="text-xs font-normal text-emerald-700">MXN</span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="gap-2 py-4 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between px-4 pb-0">
            <CardTitle className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
              Monto Total USD
            </CardTitle>
            <DollarSign className="size-4 text-sky-600" aria-hidden />
          </CardHeader>
          <CardContent className="px-4">
            {cargando ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <p className="font-mono text-xl font-bold tabular-nums text-sky-950">
                ${formatMoney(stats.totalUsd)}{' '}
                <span className="text-xs font-normal text-sky-700">USD</span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {errorCarga && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>No se pudo cargar el historial</AlertTitle>
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>{errorCarga}</span>
            <Button type="button" variant="outline" size="sm" onClick={cargarHistorial}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card className="gap-0 py-0 shadow-sm">
        <CardContent className="flex flex-col items-stretch justify-between gap-3 p-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-80">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" aria-hidden />
            <Input
              type="search"
              placeholder="Buscar por folio (P00XXX), proveedor, ref..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-8 text-xs"
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={cargarHistorial} disabled={cargando}>
            <RefreshCw className={cargando ? 'animate-spin' : undefined} data-icon="inline-start" />
            Actualizar
          </Button>
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden py-0 shadow-sm">
        {cargando ? (
          <div className="flex flex-col gap-3 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
          </div>
        ) : filtrados.length === 0 ? (
          <Empty className="border-0 py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Clock aria-hidden />
              </EmptyMedia>
              <EmptyTitle className="text-sm">No se encontraron cotizaciones</EmptyTitle>
              <EmptyDescription>
                Las cotizaciones que envíes a Odoo desde la pestaña de captura aparecerán aquí.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table className="w-full text-left text-xs">
              <TableHeader className="bg-muted/80 text-[11px] font-bold tracking-wider uppercase">
                <TableRow>
                  <TableHead className="w-8 px-3 py-2.5" />
                  <TableHead className="px-3 py-2.5">Folio Odoo</TableHead>
                  <TableHead className="px-3 py-2.5">Proveedor</TableHead>
                  <TableHead className="px-3 py-2.5">Ref. Cotización</TableHead>
                  <TableHead className="px-3 py-2.5 text-center">Partidas</TableHead>
                  <TableHead className="px-3 py-2.5 text-right">Total</TableHead>
                  <TableHead className="px-3 py-2.5">Creado Por</TableHead>
                  <TableHead className="w-28 px-3 py-2.5 text-center">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((r) => {
                  const estaExpandido = expandidoId === r.id
                  const urlOdoo = `https://system.maquinadosvazquez.com/web#id=${r.odooId}&model=purchase.order&view_type=form`

                  return (
                    <ContextMenu key={r.id}>
                      <ContextMenuTrigger asChild>
                        <TableRow className="hover:bg-muted/40 cursor-pointer select-none">
                          <TableCell colSpan={8} className="p-0">
                            <div className="flex flex-col">
                              <div className="flex w-full items-center px-3 py-2.5">
                                <div className="w-8 shrink-0">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="size-8 p-0 cursor-pointer"
                                    onClick={() => toggleExpandir(r.id)}
                                    aria-expanded={estaExpandido}
                                    aria-label={estaExpandido ? 'Ocultar partidas' : 'Ver partidas'}
                                  >
                                    {estaExpandido ? <ChevronDown /> : <ChevronRight />}
                                  </Button>
                                </div>

                                <div className="grid flex-1 grid-cols-7 items-center gap-2" onClick={() => toggleExpandir(r.id)}>
                                  <div>
                                    <Badge variant="secondary" className="font-mono text-[11px]">
                                      {r.odooName}
                                    </Badge>
                                  </div>
                                  <div className="col-span-2 truncate font-semibold">{r.proveedor}</div>
                                  <div className="text-muted-foreground truncate font-mono text-[11px]">
                                    {r.referenciaProveedor || '—'}
                                  </div>
                                  <div className="text-center">
                                    <Badge variant="outline" className="font-mono text-[11px]">
                                      {r.itemsCount} partidas
                                    </Badge>
                                  </div>
                                  <div className="text-right font-mono font-bold tabular-nums">
                                    ${formatMoney(r.total)}{' '}
                                    <span className="text-muted-foreground text-[10px] font-normal">
                                      {r.moneda}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                                    <span className="text-muted-foreground truncate text-[11px]">
                                      {r.creadoPorEmail?.split('@')[0] || '—'}
                                    </span>
                                    <Button asChild variant="outline" size="sm" className="shrink-0 text-[11px]">
                                      <a
                                        href={urlOdoo}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        <ExternalLink data-icon="inline-start" />
                                        Odoo
                                      </a>
                                    </Button>
                                  </div>
                                </div>
                              </div>

                              {estaExpandido && (
                                <div className="bg-muted/40 flex flex-col gap-2 border-t p-3.5" onClick={(e) => e.stopPropagation()}>
                                  <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase">
                                    <FileSpreadsheet className="text-muted-foreground size-3.5" aria-hidden />
                                    Desglose de Partidas ({r.partidas.length})
                                  </span>
                                  <div className="bg-card overflow-hidden rounded-lg border shadow-sm">
                                    <Table className="w-full text-left text-xs">
                                      <TableHeader className="bg-muted/80 text-[10px] font-bold uppercase">
                                        <TableRow>
                                          <TableHead className="w-8 px-2.5 py-1.5 text-center">#</TableHead>
                                          <TableHead className="w-24 px-2.5 py-1.5">Clave</TableHead>
                                          <TableHead className="px-2.5 py-1.5">Descripción</TableHead>
                                          <TableHead className="w-24 px-2.5 py-1.5">Requisitor</TableHead>
                                          <TableHead className="w-20 px-2.5 py-1.5">Empresa</TableHead>
                                          <TableHead className="w-24 px-2.5 py-1.5">OT / Uso</TableHead>
                                          <TableHead className="w-16 px-2.5 py-1.5 text-right">Cant.</TableHead>
                                          <TableHead className="w-20 px-2.5 py-1.5 text-right">P. Unit.</TableHead>
                                          <TableHead className="w-24 px-2.5 py-1.5 text-right">Subtotal</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody className="text-[11px]">
                                        {r.partidas.map((p, idx) => (
                                          <TableRow key={p.id || idx}>
                                            <TableCell className="text-muted-foreground px-2.5 py-1.5 text-center font-mono">
                                              {p.partida || idx + 1}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground px-2.5 py-1.5 font-mono">
                                              {p.clave || '—'}
                                            </TableCell>
                                            <TableCell className="px-2.5 py-1.5 font-medium">
                                              {p.descripcion}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground px-2.5 py-1.5">
                                              {p.requisitor || '—'}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground px-2.5 py-1.5">
                                              {p.empresa || '—'}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground px-2.5 py-1.5 font-mono text-[10px]">
                                              {p.ordenTrabajo || p.uso || '—'}
                                            </TableCell>
                                            <TableCell className="px-2.5 py-1.5 text-right font-mono font-semibold tabular-nums">
                                              {p.cantidad} {p.udm}
                                            </TableCell>
                                            <TableCell className="px-2.5 py-1.5 text-right font-mono tabular-nums">
                                              ${p.precioUnitario.toFixed(2)}
                                            </TableCell>
                                            <TableCell className="px-2.5 py-1.5 text-right font-mono font-bold tabular-nums">
                                              ${p.subtotal.toFixed(2)}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      </ContextMenuTrigger>

                      <ContextMenuContent className="w-56">
                        <ContextMenuItem onClick={() => toggleExpandir(r.id)}>
                          <FileSpreadsheet className="text-primary" />
                          <span>{estaExpandido ? 'Ocultar partidas' : 'Ver partidas'}</span>
                          <ContextMenuShortcut>↵</ContextMenuShortcut>
                        </ContextMenuItem>

                        <ContextMenuItem
                          onClick={() => {
                            window.open(urlOdoo, '_blank', 'noopener,noreferrer')
                          }}
                        >
                          <ExternalLink className="text-sky-600" />
                          <span>Abrir en Odoo ERP</span>
                        </ContextMenuItem>

                        <ContextMenuItem
                          onClick={() => {
                            window.location.href = `/nueva-compra?proveedor=${encodeURIComponent(r.proveedor)}`
                          }}
                        >
                          <ShoppingCart className="text-emerald-600" />
                          <span>Re-cotizar en Nueva Compra</span>
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
                                void navigator.clipboard.writeText(r.odooName)
                                toast.success('Folio Odoo copiado')
                              }}
                            >
                              <span>Folio ({r.odooName})</span>
                            </ContextMenuItem>
                            <ContextMenuItem
                              onClick={() => {
                                void navigator.clipboard.writeText(r.proveedor)
                                toast.success('Proveedor copiado')
                              }}
                            >
                              <span>Proveedor ({r.proveedor})</span>
                            </ContextMenuItem>
                            {r.referenciaProveedor && (
                              <ContextMenuItem
                                onClick={() => {
                                  void navigator.clipboard.writeText(r.referenciaProveedor || '')
                                  toast.success('Referencia copiada')
                                }}
                              >
                                <span>Ref. Proveedor</span>
                              </ContextMenuItem>
                            )}
                            <ContextMenuItem
                              onClick={() => {
                                const totTxt = `$${formatMoney(r.total)} ${r.moneda}`
                                void navigator.clipboard.writeText(totTxt)
                                toast.success('Total copiado', { description: totTxt })
                              }}
                            >
                              <span>Total ({`$${formatMoney(r.total)} ${r.moneda}`})</span>
                            </ContextMenuItem>
                          </ContextMenuSubContent>
                        </ContextMenuSub>
                      </ContextMenuContent>
                    </ContextMenu>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  )
}
