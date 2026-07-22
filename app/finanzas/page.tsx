"use client"

import AuthGuard from "@/app/AuthGuard"
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
import { listarFacturasProveedor, type FacturaProveedor } from "@/lib/finanzas-ap"
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

type TabFinanzas = "ar" | "ap" | "flujo" | "conciliacion"

function DeltaBadge({ delta }: { delta: DeltaKpi }) {
  if (delta.porcentaje === null) {
    return <span className="text-xs font-mono text-slate-400">— vs. mes anterior</span>
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
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs hover:shadow-xs transition-all space-y-1">
      <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 mb-1">{titulo}</p>
      <p className="text-xl sm:text-2xl font-black font-mono text-slate-900 tabular-nums leading-tight break-words">{valor}</p>
      {delta && <div className="pt-1"><DeltaBadge delta={delta} /></div>}
      {subtitulo && <p className="text-[11px] text-slate-400 font-medium">{subtitulo}</p>}
    </div>
  )
}

function AlertasFinancieras({ alertas }: { alertas: AnomaliaFinanciera[] }) {
  const visibles = alertas.slice(0, 5)

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-700">Alertas para revisar</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Reglas de integridad y desviaciones del último mes cerrado
          </p>
        </div>
        <AlertTriangle className={`h-4.5 w-4.5 ${alertas.length > 0 ? "text-amber-500" : "text-emerald-500"}`} />
      </div>

      {visibles.length === 0 ? (
        <p className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs font-medium text-emerald-700">
          No hay alertas con los datos actuales.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {visibles.map((alerta) => (
            <div key={alerta.id} className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-1.5 py-0.2 text-[9px] font-mono font-bold uppercase ${
                  alerta.severidad === "alta"
                    ? "bg-rose-100 text-rose-700 border border-rose-200"
                    : alerta.severidad === "media"
                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                      : "bg-slate-100 text-slate-700 border border-slate-200"
                }`}>
                  {alerta.severidad}
                </span>
                <p className="font-bold text-slate-800">{alerta.titulo}</p>
              </div>
              <p className="mt-1 text-slate-600">{alerta.detalle}</p>
              <p className="mt-0.5 font-medium text-slate-500">Acción: {alerta.accion}</p>
            </div>
          ))}
          {alertas.length > visibles.length && (
            <p className="pt-1 text-[11px] font-mono text-slate-500">
              Hay {alertas.length - visibles.length} alertas adicionales en los datos cargados.
            </p>
          )}
        </div>
      )}
    </section>
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
        <Loader2 className="h-5 w-5 animate-spin text-[#0369A1] mr-2" />
        <span className="text-xs font-mono text-slate-600">Cargando facturación…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <AlertCircle className="h-7 w-7 text-rose-500" />
        <p className="text-xs text-slate-700 font-mono">{error}</p>
        <button onClick={recargar} className="rounded-md bg-[#0369A1] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#0284C7]">
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
                className={`px-2.5 py-1 text-xs font-mono font-bold rounded-md border ${
                  m === moneda ? "bg-[#0369A1] text-white border-[#0369A1]" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabs Principales de Finanzas 360° */}
      <div className="flex gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setTabActiva("ar")}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors ${
            tabActiva === "ar"
              ? "bg-[#0369A1] text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Cuentas por Cobrar (AR)
        </button>

        <button
          onClick={() => setTabActiva("ap")}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors ${
            tabActiva === "ap"
              ? "bg-[#0369A1] text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Wallet className="w-4 h-4" />
          Cuentas por Pagar (AP)
        </button>

        <button
          onClick={() => setTabActiva("flujo")}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors ${
            tabActiva === "flujo"
              ? "bg-[#0369A1] text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Flujo de Caja Proyectado
        </button>

        <button
          onClick={() => setTabActiva("conciliacion")}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-colors ${
            tabActiva === "conciliacion"
              ? "bg-[#0369A1] text-white shadow-xs"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          Conciliación Compras
        </button>
      </div>

      {/* Contenido según la pestaña activa */}
      {tabActiva === "ar" && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">Facturación del mes</h2>
              <SelectorMes value={mesSeleccionado} onChange={setMesSeleccionado} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard titulo="Facturación" valor={formatPrecio(kpisMes.facturacionTotal, moneda)} subtitulo="Neto de notas de crédito" delta={deltasMes.facturacionTotal} />
              <KpiCard titulo="Subtotal" valor={formatPrecio(kpisMes.subtotal, moneda)} delta={deltasMes.subtotal} />
              <KpiCard titulo="IVA" valor={formatPrecio(kpisMes.impuestos, moneda)} delta={deltasMes.impuestos} />
              <KpiCard titulo="Facturas" valor={String(kpisMes.numFacturas)} subtitulo={`${kpisMes.numNotasCredito} notas de crédito`} delta={deltasMes.numFacturas} />
            </div>
          </div>

          <AlertasFinancieras alertas={alertas} />

          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 sm:p-5">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 mb-3">
              Tendencia de facturación — últimos 12 meses ({moneda})
            </h2>
            <GraficaTendencia serie={serie12Meses} moneda={moneda} />
          </div>

          <div>
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 mb-2.5">Acumulado del año</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard titulo="Facturación" valor={formatPrecio(kpisAnio.facturacionTotal, moneda)} subtitulo="Neto de notas de crédito" />
              <KpiCard titulo="Subtotal" valor={formatPrecio(kpisAnio.subtotal, moneda)} />
              <KpiCard titulo="IVA" valor={formatPrecio(kpisAnio.impuestos, moneda)} />
              <KpiCard titulo="Clientes" valor={String(kpisAnio.numClientes)} />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 sm:p-5">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 mb-3">Top clientes del año</h2>
            {topClientes.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center font-mono">Sin facturación registrada este año.</p>
            ) : (
              <table className="w-full text-xs">
                <tbody>
                  {topClientes.map((g) => (
                    <tr key={g.cliente} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="py-2 pr-3 font-semibold text-slate-800">{g.cliente}</td>
                      <td className="py-2 pr-3 text-right font-mono font-bold text-slate-900 tabular-nums">{formatPrecio(g.total, moneda)}</td>
                      <td className="py-2 text-right font-mono text-slate-500 w-20 tabular-nums">{g.pctDelTotal.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tabActiva === "ap" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 sm:p-5">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 mb-3">
              Cuentas por Pagar a Proveedores (AP - Odoo)
            </h2>
            {cargandoAP ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-[#0369A1] mr-2" />
                <span className="text-xs font-mono text-slate-600">Cargando facturas de proveedor…</span>
              </div>
            ) : (
              <TablaCuentasPorPagar facturas={facturasAP} />
            )}
          </div>
        </div>
      )}

      {tabActiva === "flujo" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 sm:p-5">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 mb-3">
              Proyección de Flujo de Caja (AR vs AP)
            </h2>
            {cargandoAP ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-[#0369A1] mr-2" />
                <span className="text-xs font-mono text-slate-600">Calculando proyección de liquidez…</span>
              </div>
            ) : (
              <GraficaFlujoCaja resumen={resumenFlujo} moneda={moneda} />
            )}
          </div>
        </div>
      )}

      {tabActiva === "conciliacion" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 sm:p-5">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700 mb-3">
              Conciliación Automática: Compras SMV Hub vs Odoo
            </h2>
            {cargandoAP ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-[#0369A1] mr-2" />
                <span className="text-xs font-mono text-slate-600">Analizando discrepancias y emparejamiento…</span>
              </div>
            ) : (
              <TablaConciliacionOdoo resumen={resumenConciliacion} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function FinanzasPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 tracking-tight">Finanzas y Cobranza 360°</h1>
                <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded">
                  Odoo Mirror
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Cuentas por cobrar (AR), Cuentas por pagar (AP), Flujo de caja y Conciliación de compras.
              </p>
            </div>
            <FinanzasNav />
          </div>

          <ResumenFinanzas />
        </div>
      </main>
    </AuthGuard>
  )
}
