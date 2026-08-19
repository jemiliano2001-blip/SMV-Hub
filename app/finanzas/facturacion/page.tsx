'use client'

import AuthGuard from "@/app/AuthGuard"
import PageHeader from "@/components/layout/PageHeader"
import PageShell from "@/components/layout/PageShell"
import { useMemo, useState } from "react"
import { Loader2, AlertCircle } from "lucide-react"
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
        <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
        <span className="text-sm text-gray-600">Cargando facturación…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="text-sm text-gray-700">{error}</p>
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
                  className={`px-3 py-1 text-xs font-medium rounded-full border ${
                    m === moneda ? "bg-primary text-white border-primary" : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
          <div className="flex bg-gray-200/50 p-1 rounded-lg">
            {(["mes", "anio"] as Periodo[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  periodo === p ? "bg-white text-primary shadow-sm" : "text-gray-500"
                }`}
              >
                {p === "mes" ? "Por mes" : "Acumulado del año"}
              </button>
            ))}
          </div>
          {periodo === "mes" && <SelectorMes value={mesSeleccionado} onChange={setMesSeleccionado} />}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        {grupos.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">
            No hay facturación en este periodo con los filtros seleccionados.
          </p>
        ) : (
          <>
          <div className="md:hidden divide-y divide-gray-100 -mx-4 sm:-mx-6">
            {grupos.map((g) => (
              <div key={g.cliente} className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{g.cliente}</p>
                  <p className="text-xs text-gray-500">{g.facturas.length} facturas · {g.pctDelTotal.toFixed(1)}%</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-gray-900 tabular-nums">{formatPrecio(g.total, moneda)}</p>
                  <p className="text-xs text-gray-400 tabular-nums">{formatPrecio(g.subtotal, moneda)} subt.</p>
                </div>
              </div>
            ))}
            <div className="px-4 sm:px-6 py-3 flex items-center justify-between gap-3 bg-gray-50">
              <p className="text-xs font-bold text-gray-900 uppercase tracking-wide">Total General</p>
              <div className="text-right shrink-0">
                <p className="text-base font-bold text-gray-900 tabular-nums">{formatPrecio(totalGeneral, moneda)}</p>
                <p className="text-xs text-gray-500">{totalFacturas} facturas</p>
              </div>
            </div>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <Table className="w-full text-sm border-collapse">
              <TableHeader>
                <TableRow className="border-b-2 border-gray-300">
                  <TableHead className="pb-2 pr-3 text-left text-xs font-semibold text-gray-600">Cliente</TableHead>
                  <TableHead className="pb-2 pr-3 text-right text-xs font-semibold text-gray-600">Facturas</TableHead>
                  <TableHead className="pb-2 pr-3 text-right text-xs font-semibold text-gray-600">Subtotal</TableHead>
                  <TableHead className="pb-2 pr-3 text-right text-xs font-semibold text-gray-600">Total</TableHead>
                  <TableHead className="pb-2 text-right text-xs font-semibold text-gray-600">% del total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grupos.map((g) => (
                  <TableRow key={g.cliente} className="border-b border-gray-100 hover:bg-gray-50">
                    <TableCell className="py-2 pr-3">{g.cliente}</TableCell>
                    <TableCell className="py-2 pr-3 text-right tabular-nums">{g.facturas.length}</TableCell>
                    <TableCell className="py-2 pr-3 text-right tabular-nums">{formatPrecio(g.subtotal, moneda)}</TableCell>
                    <TableCell className="py-2 pr-3 text-right tabular-nums font-medium">{formatPrecio(g.total, moneda)}</TableCell>
                    <TableCell className="py-2 text-right tabular-nums text-gray-500">{g.pctDelTotal.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="border-t-2 border-gray-900">
                  <TableCell className="py-2.5 pr-3 text-right text-sm font-bold text-gray-900 uppercase tracking-wide" colSpan={2}>
                    Total General
                  </TableCell>
                  <TableCell colSpan={2} className="py-2.5 pr-3 text-right tabular-nums text-base font-bold text-gray-900">
                    {formatPrecio(totalGeneral, moneda)}
                  </TableCell>
                  <TableCell className="py-2.5 text-right text-xs text-gray-500 tabular-nums">{totalFacturas} facturas</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
          </>
        )}
      </div>
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
