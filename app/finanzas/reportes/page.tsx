'use client'

import AuthGuard from "@/app/AuthGuard"
import PageHeader from "@/components/layout/PageHeader"
import PageShell from "@/components/layout/PageShell"
import ModuleSurface from "@/components/layout/ModuleSurface"
import { useMemo, useState } from "react"
import { Loader2, AlertCircle, Download, Printer } from "lucide-react"
import { useFinanzasFacturas } from "@/lib/hooks/useFinanzasFacturas"
import {
  monedasPresentes,
  filtrarPorMoneda,
  filtrarPorRango,
  agruparPorCliente,
  calcularKpisFinanzas,
  periodoPreset,
} from "@/lib/finanzas"
import { formatPrecio, formatFecha } from "@/lib/format"
import FinanzasNav from "@/app/finanzas/FinanzasNav"
import BannerSync from "@/app/finanzas/BannerSync"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type Periodo = "mes" | "anio"

function ReportesFinanzas() {
  const { facturas, estadoSync, loading, error, recargar } = useFinanzasFacturas()
  const [monedaActiva, setMonedaActiva] = useState<string | null>(null)
  const [periodo, setPeriodo] = useState<Periodo>("mes")

  const monedas = useMemo(() => monedasPresentes(facturas), [facturas])
  const moneda = monedaActiva ?? monedas[0] ?? "MXN"
  const { desde, hasta } = periodoPreset(periodo)

  const facturasPeriodo = useMemo(
    () => filtrarPorRango(filtrarPorMoneda(facturas, moneda), desde, hasta),
    [facturas, moneda, desde, hasta]
  )
  const grupos = useMemo(() => agruparPorCliente(facturasPeriodo), [facturasPeriodo])
  const kpis = useMemo(() => calcularKpisFinanzas(facturasPeriodo), [facturasPeriodo])

  async function exportarExcel() {
    const XLSX = await import("xlsx")
    const filas = facturasPeriodo.map((f) => ({
      Cliente: f.cliente,
      Factura: f.numeroFactura,
      Tipo: f.tipo === "nota_credito" ? "Nota de crédito" : "Factura",
      Fecha: f.fechaFactura ?? "",
      Vencimiento: f.fechaVencimiento ?? "",
      Moneda: f.moneda,
      Subtotal: f.subtotal,
      IVA: f.impuestos,
      Total: f.total,
      "Saldo pendiente": f.saldoPendiente,
      "Estado de pago": f.estadoPago,
    }))
    const worksheet = XLSX.utils.json_to_sheet(filas)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, "Facturación")
    const nombre = `finanzas_${periodo === "mes" ? "mes" : "anio"}_${moneda}.xlsx`
    XLSX.writeFile(workbook, nombre)
  }

  if (loading && facturas.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Cargando reporte…</span>
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
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
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
                {p === "mes" ? "Mes actual" : "Acumulado del año"}
              </button>
            ))}
          </div>
          <button
            onClick={exportarExcel}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" /> Excel
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <Printer className="h-3.5 w-3.5" /> Imprimir
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <ModuleSurface className="p-4 print:border-0 print:shadow-none">
          <p className="mb-1 text-xs text-muted-foreground">Facturación</p>
          <p className="text-xl font-bold text-foreground tabular-nums">{formatPrecio(kpis.facturacionTotal, moneda)}</p>
        </ModuleSurface>
        <ModuleSurface className="p-4 print:border-0 print:shadow-none">
          <p className="mb-1 text-xs text-muted-foreground">Subtotal</p>
          <p className="text-xl font-bold text-foreground tabular-nums">{formatPrecio(kpis.subtotal, moneda)}</p>
        </ModuleSurface>
        <ModuleSurface className="p-4 print:border-0 print:shadow-none">
          <p className="mb-1 text-xs text-muted-foreground">IVA</p>
          <p className="text-xl font-bold text-foreground tabular-nums">{formatPrecio(kpis.impuestos, moneda)}</p>
        </ModuleSurface>
        <ModuleSurface className="p-4 print:border-0 print:shadow-none">
          <p className="mb-1 text-xs text-muted-foreground">Facturas</p>
          <p className="text-xl font-bold text-foreground tabular-nums">{kpis.numFacturas}</p>
        </ModuleSurface>
      </div>

      <ModuleSurface className="p-4 sm:p-6 print:border-0 print:p-0 print:shadow-none">
        {grupos.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Sin facturación en este periodo.</p>
        ) : (
          <>
          {/* print:hidden — al imprimir siempre se usa la tabla, sin importar el ancho de página. */}
          <div className="-mx-4 divide-y divide-border print:hidden sm:-mx-6 md:hidden">
            {facturasPeriodo.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{f.cliente}</p>
                  <p className="font-mono text-xs text-muted-foreground">{f.numeroFactura} · {formatFecha(f.fechaFactura)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-foreground tabular-nums">{formatPrecio(f.total, moneda)}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {formatPrecio(f.subtotal, moneda)} + {formatPrecio(f.impuestos, moneda)} IVA
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block print:block">
            <Table className="w-full border-collapse text-sm">
              <TableHeader>
                <TableRow className="border-b-2 border-border">
                  <TableHead className="pb-2 pr-3 text-left text-xs font-semibold text-muted-foreground">Cliente</TableHead>
                  <TableHead className="pb-2 pr-3 text-left text-xs font-semibold text-muted-foreground">Factura</TableHead>
                  <TableHead className="pb-2 pr-3 text-left text-xs font-semibold text-muted-foreground">Fecha</TableHead>
                  <TableHead className="pb-2 pr-3 text-right text-xs font-semibold text-muted-foreground">Subtotal</TableHead>
                  <TableHead className="pb-2 pr-3 text-right text-xs font-semibold text-muted-foreground">IVA</TableHead>
                  <TableHead className="pb-2 text-right text-xs font-semibold text-muted-foreground">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {facturasPeriodo.map((f) => (
                  <TableRow key={f.id} className="border-b border-border">
                    <TableCell className="py-1.5 pr-3">{f.cliente}</TableCell>
                    <TableCell className="py-1.5 pr-3 font-mono text-xs text-muted-foreground">{f.numeroFactura}</TableCell>
                    <TableCell className="py-1.5 pr-3 text-xs">{formatFecha(f.fechaFactura)}</TableCell>
                    <TableCell className="py-1.5 pr-3 text-right tabular-nums">{formatPrecio(f.subtotal, moneda)}</TableCell>
                    <TableCell className="py-1.5 pr-3 text-right tabular-nums">{formatPrecio(f.impuestos, moneda)}</TableCell>
                    <TableCell className="py-1.5 text-right font-medium tabular-nums">{formatPrecio(f.total, moneda)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          </>
        )}
      </ModuleSurface>
    </div>
  )
}

export default function ReportesFinanzasPage() {
  return (
    <AuthGuard>
      <PageShell printClassName="print:bg-white">
        <PageHeader
          title="Reportes de finanzas"
          badge="Odoo"
          description="Exporta a Excel o imprime el detalle de facturación."
          className="print:hidden"
          actions={<FinanzasNav />}
        />
        <ReportesFinanzas />
      </PageShell>
    </AuthGuard>
  )
}
