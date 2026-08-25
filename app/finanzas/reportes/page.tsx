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

import { toast } from "sonner"
import { generarExcelReporteFinanzas } from "@/lib/finanzas-reportes-export"
import { descargarExcelEnNavegador } from "@/lib/excel-export-base"

type Periodo = "mes" | "anio"

function ReportesFinanzas() {
  const { facturas, estadoSync, loading, error, recargar } = useFinanzasFacturas()
  const [monedaActiva, setMonedaActiva] = useState<string | null>(null)
  const [periodo, setPeriodo] = useState<Periodo>("mes")
  const [exportando, setExportando] = useState(false)

  const monedas = useMemo(() => monedasPresentes(facturas), [facturas])
  const moneda = monedaActiva ?? monedas[0] ?? "MXN"
  const { desde, hasta } = periodoPreset(periodo)

  const facturasPeriodo = useMemo(
    () => filtrarPorRango(filtrarPorMoneda(facturas, moneda), desde, hasta),
    [facturas, moneda, desde, hasta]
  )
  const grupos = useMemo(() => agruparPorCliente(facturasPeriodo), [facturasPeriodo])
  const kpis = useMemo(() => calcularKpisFinanzas(facturasPeriodo), [facturasPeriodo])

  const periodoLabel = periodo === "mes" ? "Mes actual" : "Acumulado del año"
  const generadoEl = new Date().toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

  async function exportarExcel() {
    if (facturasPeriodo.length === 0) {
      toast.info("No hay facturas en este periodo para exportar.")
      return
    }
    try {
      setExportando(true)
      const buffer = await generarExcelReporteFinanzas({
        facturas: facturasPeriodo,
        periodoLabel,
        moneda,
      })
      const nombre = `Finanzas_Facturacion_${periodo === "mes" ? "Mes" : "Anio"}_${moneda}_${new Date().toISOString().slice(0, 10)}.xlsx`
      descargarExcelEnNavegador(buffer, nombre)
      toast.success("Reporte de facturación exportado a Excel")
    } catch (err) {
      console.error("Error exportando finanzas a Excel:", err)
      toast.error("No se pudo exportar el archivo Excel.")
    } finally {
      setExportando(false)
    }
  }

  const handleImprimir = () => {
    const tituloOriginal = document.title
    document.title = `Reporte_Facturacion_${periodo === "mes" ? "Mes" : "Anio"}_${moneda}`
    window.print()
    document.title = tituloOriginal
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
    <div className="reporte-formal-print space-y-4">
      {/* Cabecera formal de impresión (PDF) */}
      <div className="mb-3 hidden print:flex print:items-center print:justify-between print:bg-[#111111] print:px-3 print:py-2.5 print:text-white">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest">SMV Maquinados</p>
          <p className="mt-0.5 text-[8px] tracking-wide print:text-gray-400">S.A. de C.V.</p>
        </div>
        <div className="text-center">
          <p className="text-[12.5px] font-semibold uppercase tracking-wide">Reporte de Facturación a Clientes</p>
          <p className="mt-1 text-[8.5px] print:text-gray-400">{periodoLabel}</p>
        </div>
        <div className="text-right text-[8px] leading-relaxed print:text-gray-400">
          <p>{moneda} · {facturasPeriodo.length} facturas</p>
          <p>Generado el {generadoEl}</p>
        </div>
      </div>

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
            disabled={exportando || facturasPeriodo.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> Excel
          </button>
          <button
            onClick={handleImprimir}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Printer className="h-3.5 w-3.5" /> Guardar PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 print:mb-3 print:gap-2">
        <ModuleSurface className="p-4 print:rounded-none print:border print:border-border/60 print:bg-card print:p-2.5 print:shadow-none">
          <p className="mb-1 text-xs text-muted-foreground print:text-[8px]">Facturación Total</p>
          <p className="text-xl font-bold text-foreground tabular-nums print:text-sm">{formatPrecio(kpis.facturacionTotal, moneda)}</p>
        </ModuleSurface>
        <ModuleSurface className="p-4 print:rounded-none print:border print:border-border/60 print:bg-card print:p-2.5 print:shadow-none">
          <p className="mb-1 text-xs text-muted-foreground print:text-[8px]">Subtotal</p>
          <p className="text-xl font-bold text-foreground tabular-nums print:text-sm">{formatPrecio(kpis.subtotal, moneda)}</p>
        </ModuleSurface>
        <ModuleSurface className="p-4 print:rounded-none print:border print:border-border/60 print:bg-card print:p-2.5 print:shadow-none">
          <p className="mb-1 text-xs text-muted-foreground print:text-[8px]">IVA Trasladado</p>
          <p className="text-xl font-bold text-foreground tabular-nums print:text-sm">{formatPrecio(kpis.impuestos, moneda)}</p>
        </ModuleSurface>
        <ModuleSurface className="p-4 print:rounded-none print:border print:border-border/60 print:bg-card print:p-2.5 print:shadow-none">
          <p className="mb-1 text-xs text-muted-foreground print:text-[8px]">Facturas Emitidas</p>
          <p className="text-xl font-bold text-foreground tabular-nums print:text-sm">{kpis.numFacturas}</p>
        </ModuleSurface>
      </div>

      <ModuleSurface className="p-4 sm:p-6 print:rounded-none print:border-0 print:p-0 print:shadow-none">
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
          <div className="hidden overflow-x-auto md:block print:block print:overflow-visible">
            <Table className="w-full border-collapse text-sm print:text-[9px]">
              <TableHeader className="bg-muted text-muted-foreground font-semibold print:bg-[#111111]">
                <TableRow className="border-b-2 border-border print:border-b-0">
                  <TableHead className="pb-2 pr-3 text-left text-xs font-semibold text-muted-foreground print:px-2 print:py-1.5 print:text-[7.5px] print:font-medium print:uppercase print:tracking-widest print:text-white">Cliente</TableHead>
                  <TableHead className="pb-2 pr-3 text-left text-xs font-semibold text-muted-foreground print:px-2 print:py-1.5 print:text-[7.5px] print:font-medium print:uppercase print:tracking-widest print:text-white">Factura</TableHead>
                  <TableHead className="pb-2 pr-3 text-left text-xs font-semibold text-muted-foreground print:px-2 print:py-1.5 print:text-[7.5px] print:font-medium print:uppercase print:tracking-widest print:text-white">Fecha</TableHead>
                  <TableHead className="pb-2 pr-3 text-right text-xs font-semibold text-muted-foreground print:px-2 print:py-1.5 print:text-[7.5px] print:font-medium print:uppercase print:tracking-widest print:text-white">Subtotal</TableHead>
                  <TableHead className="pb-2 pr-3 text-right text-xs font-semibold text-muted-foreground print:px-2 print:py-1.5 print:text-[7.5px] print:font-medium print:uppercase print:tracking-widest print:text-white">IVA</TableHead>
                  <TableHead className="pb-2 text-right text-xs font-semibold text-muted-foreground print:px-2 print:py-1.5 print:text-[7.5px] print:font-medium print:uppercase print:tracking-widest print:text-white">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {facturasPeriodo.map((f, i) => (
                  <TableRow key={f.id} className={`border-b border-border hover:bg-muted print:hover:bg-transparent ${i % 2 === 1 ? "print:bg-[#fafafa]" : ""}`}>
                    <TableCell className="py-1.5 pr-3 print:px-2 print:py-1 print:text-[8.5px] font-medium text-foreground print:text-black">{f.cliente}</TableCell>
                    <TableCell className="py-1.5 pr-3 font-mono text-xs text-muted-foreground print:px-2 print:py-1 print:font-mono print:text-[8.5px] print:text-gray-700">{f.numeroFactura}</TableCell>
                    <TableCell className="py-1.5 pr-3 text-xs print:px-2 print:py-1 print:font-mono print:text-[8.5px] print:text-gray-700">{formatFecha(f.fechaFactura)}</TableCell>
                    <TableCell className="py-1.5 pr-3 text-right tabular-nums print:px-2 print:py-1 print:font-mono print:text-[8.5px]">{formatPrecio(f.subtotal, moneda)}</TableCell>
                    <TableCell className="py-1.5 pr-3 text-right tabular-nums print:px-2 print:py-1 print:font-mono print:text-[8.5px]">{formatPrecio(f.impuestos, moneda)}</TableCell>
                    <TableCell className="py-1.5 text-right font-medium tabular-nums print:px-2 print:py-1 print:font-mono print:text-[8.5px] print:font-bold">{formatPrecio(f.total, moneda)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          </>
        )}
      </ModuleSurface>

      <div className="mt-3 hidden justify-between border-t border-border pt-2 text-[7.5px] tracking-wide text-muted-foreground print:flex">
        <span>SMV Maquinados, S.A. de C.V.</span>
        <span>Uso interno · Confidencial</span>
      </div>
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
