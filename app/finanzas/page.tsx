"use client"

import AuthGuard from "@/app/AuthGuard"
import PageHeader from "@/components/layout/PageHeader"
import PageShell from "@/components/layout/PageShell"
import ModuleSurface from "@/components/layout/ModuleSurface"
import { useEffect, useMemo, useState } from "react"
import { Loader2, AlertCircle, AlertTriangle, TrendingUp, TrendingDown, DollarSign, Wallet, RefreshCw } from "lucide-react"
import { useFinanzasFacturas } from "@/lib/hooks/useFinanzasFacturas"
import {
  monedasPresentes,
  filtrarPorMoneda,
  filtrarPorRango,
  calcularKpisFinanzas,
  compararKpis,
  serieMensual,
  agruparPorCliente,
  periodoPreset,
  rangoDeMes,
  mesActualStr,
  mesAnteriorStr,
  type DeltaKpi,
} from "@/lib/finanzas"
import { listarFacturasProveedor, calcularKpisAP, agruparPorProveedorAP, type FacturaProveedor } from "@/lib/finanzas-ap"
import { calcularFlujoCaja } from "@/lib/flujo-caja"
import { conciliarComprasConOdoo } from "@/lib/conciliaciones-odoo"
import { TablaCuentasPorPagar } from "@/components/finanzas/TablaCuentasPorPagar"
import { GraficaFlujoCaja } from "@/components/finanzas/GraficaFlujoCaja"
import { TablaConciliacionOdoo } from "@/components/finanzas/TablaConciliacionOdoo"
import type { OrdenCompra } from "@/lib/schemas"
import { collection, getDocs, query, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { makeDateConverter } from "@/lib/firestore-helpers"
import { detectarAnomaliasFinancieras, type AnomaliaFinanciera } from "@/lib/finanzas-anomalias"
import { formatPrecio } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import FinanzasNav from "@/app/finanzas/FinanzasNav"
import BannerSync from "@/app/finanzas/BannerSync"
import SelectorMes from "@/app/finanzas/SelectorMes"
import GraficaTendencia from "@/app/finanzas/GraficaTendencia"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type TabFinanzas = "ar" | "ap" | "flujo" | "conciliacion"

function DeltaBadge({ delta }: { delta: DeltaKpi }) {
  if (delta.porcentaje === null) {
    return <span className="text-xs font-mono text-muted-foreground">— vs. mes anterior</span>
  }
  const positivo = delta.porcentaje >= 0
  const Icono = positivo ? TrendingUp : TrendingDown
  return (
    <Badge
      variant="outline"
      className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold ${
        positivo
          ? "bg-emerald-50 text-emerald-900 border-emerald-300"
          : "bg-rose-50 text-rose-900 border-rose-300"
      }`}
    >
      <Icono className="h-3 w-3" />
      {positivo ? "+" : ""}
      {delta.porcentaje.toFixed(1)}% vs. mes anterior
    </Badge>
  )
}

function KpiCard({
  titulo,
  valor,
  subtitulo,
  delta,
}: {
  titulo: string
  valor: string
  subtitulo?: string
  delta?: DeltaKpi
}) {
  return (
    <ModuleSurface className="space-y-1 p-5 transition-all hover:shadow-xs">
      <p className="mb-1 text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground">{titulo}</p>
      <p className="break-words font-mono text-xl font-black leading-tight text-foreground tabular-nums sm:text-2xl">{valor}</p>
      {delta && <div className="pt-1"><DeltaBadge delta={delta} /></div>}
      {subtitulo && <p className="text-[11px] font-medium text-muted-foreground">{subtitulo}</p>}
    </ModuleSurface>
  )
}

function AlertasFinancieras({ alertas }: { alertas: AnomaliaFinanciera[] }) {
  const visibles = alertas.slice(0, 5)

  return (
    <ModuleSurface className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-foreground">Alertas para revisar</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Reglas de integridad y desviaciones del último mes cerrado
          </p>
        </div>
        <AlertTriangle className={`h-4.5 w-4.5 ${alertas.length > 0 ? "text-amber-500" : "text-emerald-500"}`} />
      </div>

      {visibles.length === 0 ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
          No hay alertas con los datos actuales.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {visibles.map((alerta) => (
            <div key={alerta.id} className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase ${
                  alerta.severidad === "alta"
                    ? "border border-rose-200 bg-rose-100 text-rose-700"
                    : alerta.severidad === "media"
                      ? "border border-amber-200 bg-amber-100 text-amber-800"
                      : "border border-border bg-muted text-foreground"
                }`}>
                  {alerta.severidad}
                </span>
                <p className="font-bold text-foreground">{alerta.titulo}</p>
              </div>
              <p className="mt-1 text-muted-foreground">{alerta.detalle}</p>
              <p className="mt-0.5 font-medium text-muted-foreground">Acción: {alerta.accion}</p>
            </div>
          ))}
          {alertas.length > visibles.length && (
            <p className="pt-1 text-[11px] font-mono text-muted-foreground">
              Hay {alertas.length - visibles.length} alertas adicionales en los datos cargados.
            </p>
          )}
        </div>
      )}
    </ModuleSurface>
  )
}

const ordenCompraConverter = makeDateConverter<OrdenCompra>()

function ResumenFinanzas() {
  const { facturas, estadoSync, loading, error, recargar } = useFinanzasFacturas()
  const [tabActiva, setTabActiva] = useState<TabFinanzas>("ar")
  const [monedaActiva, setMonedaActiva] = useState<string | null>(null)

  const [facturasAP, setFacturasAP] = useState<FacturaProveedor[]>([])
  const [ordenesLocales, setOrdenesLocales] = useState<OrdenCompra[]>([])
  const [cargandoAP, setCargandoAP] = useState(true)

  useEffect(() => {
    async function cargarAPyOrdenes() {
      try {
        const apDocs = await listarFacturasProveedor()
        setFacturasAP(apDocs)

        const ordenesSnap = await getDocs(
          query(collection(db, "ordenes").withConverter(ordenCompraConverter), orderBy("creadoEn", "desc"))
        )
        setOrdenesLocales(ordenesSnap.docs.map((d) => d.data()))
      } catch (e) {
        console.error("Error cargando AP u órdenes:", e)
      } finally {
        setCargandoAP(false)
      }
    }
    cargarAPyOrdenes()
  }, [])

  const monedas = useMemo(() => monedasPresentes(facturas), [facturas])
  const moneda = monedaActiva ?? monedas[0] ?? "MXN"
  const facturasMoneda = useMemo(() => filtrarPorMoneda(facturas, moneda), [facturas, moneda])

  const [mesSeleccionado, setMesSeleccionado] = useState(() => mesActualStr())
  const { desde: desdeMes, hasta: hastaMes } = useMemo(() => rangoDeMes(mesSeleccionado), [mesSeleccionado])
  const { desde: desdeAnio, hasta: hastaAnio } = periodoPreset("anio")

  const kpisMes = useMemo(
    () => calcularKpisFinanzas(filtrarPorRango(facturasMoneda, desdeMes, hastaMes)),
    [facturasMoneda, desdeMes, hastaMes]
  )
  const deltasMes = useMemo(() => {
    const { desde, hasta } = rangoDeMes(mesAnteriorStr(mesSeleccionado))
    const kpisAnteriores = calcularKpisFinanzas(filtrarPorRango(facturasMoneda, desde, hasta))
    return compararKpis(kpisMes, kpisAnteriores)
  }, [facturasMoneda, kpisMes, mesSeleccionado])
  const kpisAnio = useMemo(
    () => calcularKpisFinanzas(filtrarPorRango(facturasMoneda, desdeAnio, hastaAnio)),
    [facturasMoneda, desdeAnio, hastaAnio]
  )
  const serie12Meses = useMemo(
    () => serieMensual(facturasMoneda, 12, rangoDeMes(mesSeleccionado).hasta),
    [facturasMoneda, mesSeleccionado]
  )
  const alertas = useMemo(
    () => detectarAnomaliasFinancieras(facturasMoneda),
    [facturasMoneda]
  )
  const topClientes = useMemo(
    () => agruparPorCliente(filtrarPorRango(facturasMoneda, desdeAnio, hastaAnio)).slice(0, 5),
    [facturasMoneda, desdeAnio, hastaAnio]
  )

  const facturasAPMoneda = useMemo(
    () => facturasAP.filter((f) => f.moneda === moneda),
    [facturasAP, moneda]
  )
  const kpisAP = useMemo(() => calcularKpisAP(facturasAPMoneda), [facturasAPMoneda])
  const topProveedoresAP = useMemo(
    () => agruparPorProveedorAP(facturasAPMoneda).slice(0, 5),
    [facturasAPMoneda]
  )

  const resumenFlujo = useMemo(
    () => calcularFlujoCaja(facturas, facturasAP, moneda),
    [facturas, facturasAP, moneda]
  )

  const resumenConciliacion = useMemo(
    () => conciliarComprasConOdoo(ordenesLocales, facturasAP),
    [ordenesLocales, facturasAP]
  )

  if (loading && facturas.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
        <span className="text-xs font-mono text-muted-foreground">Cargando facturación…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <AlertCircle className="h-7 w-7 text-rose-500" />
        <p className="text-xs font-mono text-foreground">{error}</p>
        <button onClick={recargar} className="rounded-md bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:bg-primary/90">
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Banner & Selector de Moneda */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BannerSync estadoSync={estadoSync} onSincronizado={recargar} />
        {monedas.length > 1 && (
          <div className="flex gap-1">
            {monedas.map((m) => (
              <button
                key={m}
                onClick={() => setMonedaActiva(m)}
                className={`rounded-md border px-2.5 py-1 text-xs font-mono font-bold ${
                  m === moneda
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabs Principales de Finanzas 360° */}
      <div className="-mx-4 flex gap-2 overflow-x-auto border-b border-border px-4 pb-2 sm:mx-0 sm:px-0">
        <button
          onClick={() => setTabActiva("ar")}
          className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold transition-colors ${
            tabActiva === "ar"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "border border-border bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          <DollarSign className="h-4 w-4" />
          Cuentas por Cobrar (AR)
        </button>

        <button
          onClick={() => setTabActiva("ap")}
          className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold transition-colors ${
            tabActiva === "ap"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "border border-border bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          <Wallet className="h-4 w-4" />
          Cuentas por Pagar (AP)
        </button>

        <button
          onClick={() => setTabActiva("flujo")}
          className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold transition-colors ${
            tabActiva === "flujo"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "border border-border bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Flujo de Caja Proyectado
        </button>

        <button
          onClick={() => setTabActiva("conciliacion")}
          className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold transition-colors ${
            tabActiva === "conciliacion"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "border border-border bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          <RefreshCw className="h-4 w-4" />
          Conciliación Compras
        </button>
      </div>

      {/* Contenido según la pestaña activa */}
      {tabActiva === "ar" && (
        <div className="space-y-4">
          <div>
            <div className="mb-2.5 flex items-center justify-between">
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">Facturación del mes</h2>
              <SelectorMes value={mesSeleccionado} onChange={setMesSeleccionado} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard titulo="Facturación" valor={formatPrecio(kpisMes.facturacionTotal, moneda)} subtitulo="Neto de notas de crédito" delta={deltasMes.facturacionTotal} />
              <KpiCard titulo="Subtotal" valor={formatPrecio(kpisMes.subtotal, moneda)} delta={deltasMes.subtotal} />
              <KpiCard titulo="IVA" valor={formatPrecio(kpisMes.impuestos, moneda)} delta={deltasMes.impuestos} />
              <KpiCard titulo="Facturas" valor={String(kpisMes.numFacturas)} subtitulo={`${kpisMes.numNotasCredito} notas de crédito`} delta={deltasMes.numFacturas} />
            </div>
          </div>

          <AlertasFinancieras alertas={alertas} />

          <ModuleSurface className="p-4 sm:p-5">
            <h2 className="mb-3 text-xs font-mono font-bold uppercase tracking-wider text-foreground">
              Tendencia de facturación — últimos 12 meses ({moneda})
            </h2>
            <GraficaTendencia serie={serie12Meses} moneda={moneda} />
          </ModuleSurface>

          <div>
            <h2 className="mb-2.5 text-xs font-mono font-bold uppercase tracking-wider text-foreground">Acumulado del año</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KpiCard titulo="Facturación" valor={formatPrecio(kpisAnio.facturacionTotal, moneda)} subtitulo="Neto de notas de crédito" />
              <KpiCard titulo="Subtotal" valor={formatPrecio(kpisAnio.subtotal, moneda)} />
              <KpiCard titulo="IVA" valor={formatPrecio(kpisAnio.impuestos, moneda)} />
              <KpiCard titulo="Clientes" valor={String(kpisAnio.numClientes)} />
            </div>
          </div>

          <ModuleSurface className="p-4 sm:p-5">
            <h2 className="mb-3 text-xs font-mono font-bold uppercase tracking-wider text-foreground">Top clientes del año</h2>
            {topClientes.length === 0 ? (
              <p className="py-4 text-center text-xs font-mono text-muted-foreground">Sin facturación registrada este año.</p>
            ) : (
              <Table className="w-full text-xs">
                <TableBody>
                  {topClientes.map((g) => (
                    <TableRow key={g.cliente} className="border-b border-border last:border-0 hover:bg-muted">
                      <TableCell className="py-2 pr-3 font-semibold text-foreground">{g.cliente}</TableCell>
                      <TableCell className="py-2 pr-3 text-right font-mono font-bold text-foreground tabular-nums">{formatPrecio(g.total, moneda)}</TableCell>
                      <TableCell className="w-20 py-2 text-right font-mono text-muted-foreground tabular-nums">{g.pctDelTotal.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ModuleSurface>
        </div>
      )}

      {tabActiva === "ap" && (
        <div className="space-y-4">
          {cargandoAP ? (
            <ModuleSurface className="flex items-center justify-center p-4 py-12 sm:p-5">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
              <span className="text-xs font-mono text-muted-foreground">Cargando facturas de proveedor…</span>
            </ModuleSurface>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <KpiCard titulo="Total por Pagar" valor={formatPrecio(kpisAP.totalPorPagar, moneda)} />
                <KpiCard titulo="Facturas Pendientes" valor={String(kpisAP.numFacturasPendientes)} />
                <KpiCard titulo="Proveedores con Saldo" valor={String(kpisAP.numProveedoresConSaldo)} />
                <KpiCard
                  titulo="Vencido +90 días"
                  valor={formatPrecio(kpisAP.aging.mas90Dias, moneda)}
                  subtitulo={`Al día: ${formatPrecio(kpisAP.aging.alDia, moneda)}`}
                />
              </div>

              {topProveedoresAP.length > 0 && (
                <ModuleSurface className="p-4 sm:p-5">
                  <h2 className="mb-3 text-xs font-mono font-bold uppercase tracking-wider text-foreground">
                    Top Proveedores por Saldo Pendiente
                  </h2>
                  <div className="overflow-x-auto">
                    <Table className="w-full text-left text-xs">
                      <TableHeader className="border-b border-border text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
                        <TableRow>
                          <TableHead className="py-2 pr-3">Proveedor</TableHead>
                          <TableHead className="py-2 pr-3 text-right">Facturas Pendientes</TableHead>
                          <TableHead className="py-2 pr-3 text-right">Total por Pagar</TableHead>
                          <TableHead className="py-2 pr-3 text-right">% del Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-border">
                        {topProveedoresAP.map((g) => (
                          <TableRow key={g.proveedor}>
                            <TableCell className="py-2 pr-3 font-medium text-foreground">{g.proveedor}</TableCell>
                            <TableCell className="py-2 pr-3 text-right font-mono">{g.facturasPendientes}</TableCell>
                            <TableCell className="py-2 pr-3 text-right font-mono font-bold text-foreground tabular-nums">
                              {formatPrecio(g.totalPorPagar, moneda)}
                            </TableCell>
                            <TableCell className="py-2 pr-3 text-right font-mono text-muted-foreground">{g.pctDelTotal.toFixed(1)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </ModuleSurface>
              )}

              <ModuleSurface className="p-4 sm:p-5">
                <h2 className="mb-3 text-xs font-mono font-bold uppercase tracking-wider text-foreground">
                  Cuentas por Pagar a Proveedores (AP - Odoo) — {moneda}
                </h2>
                <TablaCuentasPorPagar facturas={facturasAPMoneda} />
              </ModuleSurface>
            </>
          )}
        </div>
      )}

      {tabActiva === "flujo" && (
        <div className="space-y-4">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
            Proyección de Flujo de Caja (AR vs AP)
          </h2>
          {cargandoAP ? (
            <ModuleSurface className="flex items-center justify-center py-12">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
              <span className="text-xs font-mono text-muted-foreground">Calculando proyección de liquidez…</span>
            </ModuleSurface>
          ) : (
            <GraficaFlujoCaja resumen={resumenFlujo} moneda={moneda} />
          )}
        </div>
      )}

      {tabActiva === "conciliacion" && (
        <div className="space-y-4">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
            Conciliación Automática: Compras SMV Hub vs Odoo
          </h2>
          {cargandoAP ? (
            <ModuleSurface className="flex items-center justify-center py-12">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
              <span className="text-xs font-mono text-muted-foreground">Analizando discrepancias y emparejamiento…</span>
            </ModuleSurface>
          ) : (
            <TablaConciliacionOdoo resumen={resumenConciliacion} />
          )}
        </div>
      )}
    </div>
  )
}

export default function FinanzasPage() {
  return (
    <AuthGuard>
      <PageShell>
        <PageHeader
          title="Finanzas y cobranza"
          badge="Odoo"
          description="Cuentas por cobrar, cuentas por pagar, flujo de caja y conciliación de compras."
          actions={<FinanzasNav />}
        />
        <ResumenFinanzas />
      </PageShell>
    </AuthGuard>
  )
}
