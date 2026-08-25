'use client'

import AuthGuard from "@/app/AuthGuard"
import PageHeader from "@/components/layout/PageHeader"
import PageShell from "@/components/layout/PageShell"
import ModuleSurface from "@/components/layout/ModuleSurface"
import { useMemo, useState } from "react"
import { Loader2, AlertCircle, Copy, ExternalLink } from "lucide-react"
import { copiarAlPortapapeles } from "@/lib/portapapeles"
import { useFinanzasFacturas } from "@/lib/hooks/useFinanzasFacturas"
import {
  monedasPresentes,
  filtrarPorMoneda,
  filtrarPorRango,
  agruparPorCliente,
  periodoPreset,
  rangoDeMes,
  mesActualStr,
} from "@/lib/finanzas"
import { formatPrecio } from "@/lib/format"
import FinanzasNav from "@/app/finanzas/FinanzasNav"
import BannerSync from "@/app/finanzas/BannerSync"
import SelectorMes from "@/app/finanzas/SelectorMes"
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
  TableFooter,
} from '@/components/ui/table'

type Periodo = "mes" | "anio"

function FacturacionPorCliente() {
  const { facturas, estadoSync, loading, error, recargar } = useFinanzasFacturas()
  const [monedaActiva, setMonedaActiva] = useState<string | null>(null)
  const [periodo, setPeriodo] = useState<Periodo>("anio")
  const [mesSeleccionado, setMesSeleccionado] = useState(() => mesActualStr())

  const monedas = useMemo(() => monedasPresentes(facturas), [facturas])
  const moneda = monedaActiva ?? monedas[0] ?? "MXN"
  const { desde, hasta } = periodo === "mes" ? rangoDeMes(mesSeleccionado) : periodoPreset("anio")

  const grupos = useMemo(() => {
    const enRango = filtrarPorRango(filtrarPorMoneda(facturas, moneda), desde, hasta)
    return agruparPorCliente(enRango)
  }, [facturas, moneda, desde, hasta])

  const totalGeneral = useMemo(() => grupos.reduce((s, g) => s + g.total, 0), [grupos])
  const totalFacturas = useMemo(() => grupos.reduce((s, g) => s + g.facturas.length, 0), [grupos])

  if (loading && facturas.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Cargando facturación…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <AlertCircle className="h-8 w-8 text-rose-500" />
        <p className="text-sm text-foreground">{error}</p>
        <button onClick={recargar} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BannerSync estadoSync={estadoSync} onSincronizado={recargar} />
        <div className="flex flex-wrap gap-2">
          {monedas.length > 1 && (
            <div className="flex gap-1">
              {monedas.map((m) => (
                <button
                  key={m}
                  onClick={() => setMonedaActiva(m)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    m === moneda
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
          <div className="flex rounded-lg bg-muted p-1">
            {(["mes", "anio"] as Periodo[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                  periodo === p ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
                }`}
              >
                {p === "mes" ? "Por mes" : "Acumulado del año"}
              </button>
            ))}
          </div>
          {periodo === "mes" && <SelectorMes value={mesSeleccionado} onChange={setMesSeleccionado} />}
        </div>
      </div>

      <ModuleSurface className="p-4 sm:p-6">
        {grupos.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No hay facturación en este periodo con los filtros seleccionados.
          </p>
        ) : (
          <>
          <div className="-mx-4 divide-y divide-border sm:-mx-6 md:hidden">
            {grupos.map((g) => (
              <div key={g.cliente} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{g.cliente}</p>
                  <p className="text-xs text-muted-foreground">{g.facturas.length} facturas · {g.pctDelTotal.toFixed(1)}%</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-foreground tabular-nums">{formatPrecio(g.total, moneda)}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">{formatPrecio(g.subtotal, moneda)} subt.</p>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 bg-muted px-4 py-3 sm:px-6">
              <p className="text-xs font-bold uppercase tracking-wide text-foreground">Total General</p>
              <div className="shrink-0 text-right">
                <p className="text-base font-bold text-foreground tabular-nums">{formatPrecio(totalGeneral, moneda)}</p>
                <p className="text-xs text-muted-foreground">{totalFacturas} facturas</p>
              </div>
            </div>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <Table className="w-full border-collapse text-sm">
              <TableHeader>
                <TableRow className="border-b-2 border-border">
                  <TableHead className="pb-2 pr-3 text-left text-xs font-semibold text-muted-foreground">Cliente</TableHead>
                  <TableHead className="pb-2 pr-3 text-right text-xs font-semibold text-muted-foreground">Facturas</TableHead>
                  <TableHead className="pb-2 pr-3 text-right text-xs font-semibold text-muted-foreground">Subtotal</TableHead>
                  <TableHead className="pb-2 pr-3 text-right text-xs font-semibold text-muted-foreground">Total</TableHead>
                  <TableHead className="pb-2 text-right text-xs font-semibold text-muted-foreground">% del total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grupos.map((g) => {
                  const totalStr = formatPrecio(g.total, moneda)
                  const subtotalStr = formatPrecio(g.subtotal, moneda)
                  const pctStr = `${g.pctDelTotal.toFixed(1)}%`

                  return (
                    <ContextMenu key={g.cliente}>
                      <ContextMenuTrigger asChild>
                        <TableRow className="cursor-pointer select-none border-b border-border hover:bg-muted">
                          <TableCell className="py-2 pr-3 font-medium text-foreground">{g.cliente}</TableCell>
                          <TableCell className="py-2 pr-3 text-right tabular-nums">{g.facturas.length}</TableCell>
                          <TableCell className="py-2 pr-3 text-right tabular-nums">{subtotalStr}</TableCell>
                          <TableCell className="py-2 pr-3 text-right font-semibold text-foreground tabular-nums">{totalStr}</TableCell>
                          <TableCell className="py-2 text-right text-muted-foreground tabular-nums">{pctStr}</TableCell>
                        </TableRow>
                      </ContextMenuTrigger>

                      <ContextMenuContent className="w-56">
                        <ContextMenuItem
                          onClick={() => {
                            window.location.href = `/finanzas/cobranza`
                          }}
                        >
                          <ExternalLink className="text-primary" />
                          <span>Ver seguimiento en Cobranza</span>
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
                                void copiarAlPortapapeles(g.cliente, 'Cliente copiado')
                              }}
                            >
                              <span>Cliente ({g.cliente})</span>
                            </ContextMenuItem>
                            <ContextMenuItem
                              onClick={() => {
                                void copiarAlPortapapeles(totalStr, 'Total facturado copiado', totalStr)
                              }}
                            >
                              <span>Total ({totalStr})</span>
                            </ContextMenuItem>
                            <ContextMenuItem
                              onClick={() => {
                                void copiarAlPortapapeles(subtotalStr, 'Subtotal copiado')
                              }}
                            >
                              <span>Subtotal ({subtotalStr})</span>
                            </ContextMenuItem>
                            <ContextMenuItem
                              onClick={() => {
                                void copiarAlPortapapeles(`${g.facturas.length} facturas`, 'Cantidad de facturas copiada')
                              }}
                            >
                              <span>No. Facturas ({g.facturas.length})</span>
                            </ContextMenuItem>
                            <ContextMenuItem
                              onClick={() => {
                                void copiarAlPortapapeles(pctStr, 'Porcentaje copiado')
                              }}
                            >
                              <span>Porcentaje ({pctStr})</span>
                            </ContextMenuItem>
                          </ContextMenuSubContent>
                        </ContextMenuSub>
                      </ContextMenuContent>
                    </ContextMenu>
                  )
                })}
              </TableBody>
              <TableFooter>
                <TableRow className="border-t-2 border-foreground">
                  <TableCell className="py-2.5 pr-3 text-right text-sm font-bold uppercase tracking-wide text-foreground" colSpan={2}>
                    Total General
                  </TableCell>
                  <TableCell colSpan={2} className="py-2.5 pr-3 text-right text-base font-bold text-foreground tabular-nums">
                    {formatPrecio(totalGeneral, moneda)}
                  </TableCell>
                  <TableCell className="py-2.5 text-right text-xs text-muted-foreground tabular-nums">{totalFacturas} facturas</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
          </>
        )}
      </ModuleSurface>
    </div>
  )
}

export default function FacturacionPage() {
  return (
    <AuthGuard>
      <PageShell>
        <PageHeader
          title="Facturación por cliente"
          badge="Odoo"
          description="Total facturado y participación por cliente."
          actions={<FinanzasNav />}
        />
        <FacturacionPorCliente />
      </PageShell>
    </AuthGuard>
  )
}
