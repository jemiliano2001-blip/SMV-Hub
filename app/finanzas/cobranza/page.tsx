'use client'

import AuthGuard from "@/app/AuthGuard"
import { Fragment, useMemo, useState } from "react"
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Flag,
  Loader2,
} from "lucide-react"
import { useUsuario } from "@/lib/auth"
import { useFinanzasFacturas } from "@/lib/hooks/useFinanzasFacturas"
import { useSeguimientoCobranza } from "@/lib/hooks/useSeguimientoCobranza"
import {
  facturasValidas,
  monedasPresentes,
  filtrarPorMoneda,
  filtrarPorRango,
  clasificarCobranza,
  diasAtraso,
  bucketAging,
  distribucionAging,
  calcularDso,
  calcularCei,
  idsFacturasPrioritarias,
  topClientesVencidos,
  periodoPreset,
  rangoDeMes,
  mesActualStr,
  BUCKETS_AGING,
  type EstadoCobranza,
  type BucketAging,
} from "@/lib/finanzas"
import { formatPrecio, formatFecha } from "@/lib/format"
import FinanzasNav from "@/app/finanzas/FinanzasNav"
import BannerSync from "@/app/finanzas/BannerSync"
import SelectorMes from "@/app/finanzas/SelectorMes"
import SeguimientoCobranzaEditor from "@/app/finanzas/cobranza/SeguimientoCobranzaEditor"

type Filtro = "todas" | EstadoCobranza | "disputa"
type PeriodoCobranza = "todas" | "mes"
const COLUMNAS_TABLA = 9

const ETIQUETA_ESTADO: Record<EstadoCobranza, { label: string; clase: string }> = {
  pagada: { label: "Pagada", clase: "bg-emerald-50 text-emerald-700" },
  pendiente: { label: "Pendiente", clase: "bg-amber-50 text-amber-700" },
  vencida: { label: "Vencida", clase: "bg-red-50 text-red-700" },
}

// Etiqueta, acción sugerida por bucket (playbook estándar de cobranza para
// PyMEs: el aging es una lista de acciones, no una foto) y color de la barra.
const INFO_BUCKET: Record<BucketAging, { label: string; accion: string; color: string }> = {
  corriente: { label: "Corriente", accion: "Sin vencer — solo monitorear", color: "#10B981" },
  b1_30: { label: "1–30 días", accion: "Enviar recordatorio de pago", color: "#F59E0B" },
  b31_60: { label: "31–60 días", accion: "Contactar y comprometer fecha de pago", color: "#F97316" },
  b61_90: { label: "61–90 días", accion: "Llamada directa al decisor", color: "#EF4444" },
  b90: { label: "90+ días", accion: "Carta formal / detener trabajo nuevo / decisión legal", color: "#991B1B" },
}

function Cobranza() {
  const { facturas, estadoSync, loading, error, recargar } = useFinanzasFacturas()
  const { usuario } = useUsuario()
  const {
    porFactura: seguimientos,
    loading: loadingSeguimiento,
    error: errorSeguimiento,
    recargar: recargarSeguimiento,
    guardar: guardarSeguimiento,
    eliminar: eliminarSeguimiento,
  } = useSeguimientoCobranza()
  const [monedaActiva, setMonedaActiva] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>("todas")
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoCobranza>("todas")
  const [mesSeleccionado, setMesSeleccionado] = useState(() => mesActualStr())
  const [facturaExpandida, setFacturaExpandida] = useState<string | null>(null)

  const monedas = useMemo(() => monedasPresentes(facturas), [facturas])
  const moneda = monedaActiva ?? monedas[0] ?? "MXN"
  const facturasMoneda = useMemo(() => filtrarPorMoneda(facturas, moneda), [facturas, moneda])

  const filas = useMemo(() => {
    const hoy = new Date()
    let base = facturasValidas(facturasMoneda).filter((f) => f.tipo === "factura")
    if (periodoTipo === "mes") {
      const { desde, hasta } = rangoDeMes(mesSeleccionado)
      base = filtrarPorRango(base, desde, hasta)
    }
    return base
      .map((f) => ({
        factura: f,
        estado: clasificarCobranza(f, hoy),
        atraso: diasAtraso(f, hoy),
        bucket: bucketAging(f, hoy),
      }))
      .sort((a, b) => b.atraso - a.atraso)
  }, [facturasMoneda, periodoTipo, mesSeleccionado])

  const filasFiltradas = filas.filter(({ factura, estado }) => {
    const enDisputa = seguimientos.get(factura.id)?.enDisputa === true
    if (filtro === "disputa") return enDisputa
    if (enDisputa) return false
    return filtro === "todas" || estado === filtro
  })

  const totalPorCobrar = useMemo(
    () => filas.filter((f) => f.estado !== "pagada").reduce((s, f) => s + f.factura.saldoPendiente, 0),
    [filas]
  )
  const numVencidas = filas.filter((f) => f.estado === "vencida").length
  const numPendientes = filas.filter((f) => f.estado === "pendiente").length

  // KPIs de cobranza sobre el conjunto de la moneda activa (independientes del
  // filtro de mes de la tabla): el aging y el DSO se leen sobre el saldo vivo.
  const { aging, dso, cei } = useMemo(() => {
    const hoy = new Date()
    const { desde, hasta } = periodoPreset("mes")
    return {
      aging: distribucionAging(facturasMoneda, hoy),
      dso: calcularDso(facturasMoneda, desde, hasta),
      cei: calcularCei(facturasMoneda, desde, hasta, hoy),
    }
  }, [facturasMoneda])

  const pct90 = aging.buckets.b90.pct
  const alerta90 = pct90 > 5
  const facturasSinDisputa = useMemo(
    () => facturasMoneda.filter((factura) => !seguimientos.get(factura.id)?.enDisputa),
    [facturasMoneda, seguimientos]
  )
  const clientesVencidos = useMemo(
    () => topClientesVencidos(facturasSinDisputa, new Date(), 5),
    [facturasSinDisputa]
  )
  const idsPrioritarias = useMemo(
    () => new Set(idsFacturasPrioritarias(facturasSinDisputa)),
    [facturasSinDisputa]
  )

  if (loading && facturas.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-blue-500 mr-2" />
        <span className="text-sm text-gray-600">Cargando cobranza…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="text-sm text-gray-700">{error}</p>
        <button onClick={recargar} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BannerSync estadoSync={estadoSync} onSincronizado={recargar} />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-gray-200/50 p-1 rounded-lg gap-1">
            {(["todas", "mes"] as PeriodoCobranza[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodoTipo(p)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  periodoTipo === p ? "bg-white text-[#0369A1] shadow-sm" : "text-gray-500"
                }`}
              >
                {p === "todas" ? "Todas" : "Por mes"}
              </button>
            ))}
          </div>
          {periodoTipo === "mes" && <SelectorMes value={mesSeleccionado} onChange={setMesSeleccionado} />}
          {monedas.length > 1 && (
            <div className="flex gap-1">
              {monedas.map((m) => (
                <button
                  key={m}
                  onClick={() => setMonedaActiva(m)}
                  className={`px-3 py-1 text-xs font-medium rounded-full border ${
                    m === moneda ? "bg-[#0369A1] text-white border-[#0369A1]" : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {errorSeguimiento && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="inline-flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {errorSeguimiento} Las facturas siguen disponibles en modo consulta.
          </span>
          <button
            type="button"
            onClick={() => void recargarSeguimiento()}
            className="text-xs font-semibold underline"
          >
            Reintentar
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Total por cobrar</p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{formatPrecio(totalPorCobrar, moneda)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Pendientes</p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">{numPendientes}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Vencidas</p>
          <p className="text-2xl font-bold text-red-600 tabular-nums">{numVencidas}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">DSO</p>
          <p className="text-2xl font-bold text-gray-900 tabular-nums">
            {dso === null ? "—" : `${Math.round(dso)} días`}
          </p>
          <p className="text-xs text-gray-400 mt-1">Días promedio en cobrar</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">CEI del mes</p>
          <p
            className={`text-2xl font-bold tabular-nums ${
              cei === null ? "text-gray-900" : cei >= 80 ? "text-emerald-600" : cei >= 70 ? "text-amber-600" : "text-red-600"
            }`}
          >
            {cei === null ? "—" : `${cei.toFixed(0)}%`}
          </p>
          <p className="text-xs text-gray-400 mt-1">Efectividad de cobro (aprox.)</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500 mb-1">Saldo en 90+ días</p>
          <p className={`text-2xl font-bold tabular-nums ${alerta90 ? "text-red-600" : "text-gray-900"}`}>
            {pct90.toFixed(1)}%
          </p>
          <p className={`text-xs mt-1 ${alerta90 ? "text-red-500 font-medium" : "text-gray-400"}`}>
            {alerta90 ? "Arriba del 5% — atención" : "Sano si es menor al 5%"}
          </p>
        </div>
      </div>

      {aging.totalPorCobrar > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Antigüedad del saldo por cobrar ({moneda})
          </h2>
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-gray-100">
            {BUCKETS_AGING.map((b) =>
              aging.buckets[b].pct > 0 ? (
                <div
                  key={b}
                  className="h-full"
                  style={{ width: `${aging.buckets[b].pct}%`, backgroundColor: INFO_BUCKET[b].color }}
                  title={`${INFO_BUCKET[b].label}: ${formatPrecio(aging.buckets[b].total, moneda)} (${aging.buckets[b].pct.toFixed(1)}%)`}
                />
              ) : null
            )}
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            {BUCKETS_AGING.map((b) => (
              <div key={b} className="flex items-start gap-1.5">
                <span
                  className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: INFO_BUCKET[b].color }}
                />
                <div>
                  <p className="font-medium text-gray-700">
                    {INFO_BUCKET[b].label}
                    <span className="text-gray-400 font-normal"> · {aging.buckets[b].cantidad}</span>
                  </p>
                  <p className="tabular-nums text-gray-500">
                    {formatPrecio(aging.buckets[b].total, moneda)} ({aging.buckets[b].pct.toFixed(1)}%)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {clientesVencidos.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">
                Top clientes con saldo vencido ({moneda})
              </h2>
              <p className="mt-0.5 text-xs text-gray-400">
                Excluye facturas marcadas en disputa
              </p>
            </div>
            <Flag className="h-5 w-5 text-red-500" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {clientesVencidos.map((cliente, indice) => (
              <div
                key={cliente.cliente}
                className="rounded-lg border border-red-100 bg-red-50/40 p-3"
              >
                <p className="truncate text-xs font-semibold text-gray-800" title={cliente.cliente}>
                  {indice + 1}. {cliente.cliente}
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums text-red-700">
                  {formatPrecio(cliente.saldoVencido, moneda)}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {cliente.cantidadFacturas} factura
                  {cliente.cantidadFacturas === 1 ? "" : "s"} · más antigua{" "}
                  {cliente.facturaMasAntigua}
                </p>
                <p className="text-xs font-medium text-red-600">
                  {cliente.diasMaximosAtraso} días de atraso
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex bg-gray-200/50 p-1 rounded-lg w-fit gap-1">
        {(["todas", "pendiente", "vencida", "pagada", "disputa"] as Filtro[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all capitalize ${
              filtro === f ? "bg-white text-[#0369A1] shadow-sm" : "text-gray-500"
            }`}
          >
            {f === "disputa" ? "En disputa" : f}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
        {filasFiltradas.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">No hay facturas para este filtro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-600">Cliente</th>
                  <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-600">Factura</th>
                  <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-600">Vencimiento</th>
                  <th className="pb-2 pr-3 text-right text-xs font-semibold text-gray-600">Total</th>
                  <th className="pb-2 pr-3 text-right text-xs font-semibold text-gray-600">Saldo</th>
                  <th className="pb-2 pr-3 text-right text-xs font-semibold text-gray-600">Días atraso</th>
                  <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-600">Antigüedad</th>
                  <th className="pb-2 pr-3 text-left text-xs font-semibold text-gray-600">Estado</th>
                  <th className="pb-2 text-right text-xs font-semibold text-gray-600">Seguimiento</th>
                </tr>
              </thead>
              <tbody>
                {filasFiltradas.map(({ factura, estado, atraso, bucket }) => {
                  const seguimiento = seguimientos.get(factura.id)
                  const expandida = facturaExpandida === factura.id
                  const prioritaria = idsPrioritarias.has(factura.id)
                  return (
                    <Fragment key={factura.id}>
                      <tr
                        className={`border-b border-gray-100 hover:bg-gray-50 ${
                          prioritaria ? "bg-amber-50/70" : ""
                        }`}
                      >
                        <td className="py-2 pr-3">{factura.cliente}</td>
                        <td className="py-2 pr-3 font-mono text-xs text-gray-500">{factura.numeroFactura}</td>
                        <td className="py-2 pr-3">{formatFecha(factura.fechaVencimiento)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{formatPrecio(factura.total, moneda)}</td>
                        <td className="py-2 pr-3 text-right tabular-nums font-medium">
                          {formatPrecio(factura.saldoPendiente, moneda)}
                          {prioritaria && (
                            <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                              Prioridad
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-gray-500">{atraso > 0 ? atraso : "—"}</td>
                        <td className="py-2 pr-3">
                          {factura.saldoPendiente > 0 && atraso > 0 ? (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-medium"
                              style={{ color: INFO_BUCKET[bucket].color }}
                              title={INFO_BUCKET[bucket].accion}
                            >
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: INFO_BUCKET[bucket].color }}
                              />
                              {INFO_BUCKET[bucket].label}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {seguimiento?.enDisputa ? (
                            <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                              En disputa
                            </span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ETIQUETA_ESTADO[estado].clase}`}>
                              {ETIQUETA_ESTADO[estado].label}
                            </span>
                          )}
                        </td>
                        <td className="py-2 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setFacturaExpandida((actual) =>
                                actual === factura.id ? null : factura.id
                              )
                            }
                            disabled={loadingSeguimiento}
                            aria-expanded={expandida}
                            aria-controls={`seguimiento-${factura.id}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                          >
                            {seguimiento ? "Editar" : "Agregar"}
                            {expandida ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>
                      {expandida && (
                        <tr
                          id={`seguimiento-${factura.id}`}
                          className="border-b border-gray-100"
                        >
                          <td colSpan={COLUMNAS_TABLA} className="px-2 py-3">
                            {usuario?.email ? (
                              <SeguimientoCobranzaEditor
                                facturaId={factura.id}
                                seguimiento={seguimiento}
                                actualizadoPor={usuario.email}
                                onGuardar={guardarSeguimiento}
                                onEliminar={eliminarSeguimiento}
                              />
                            ) : (
                              <p className="text-sm text-amber-700">
                                No se pudo identificar la sesión para registrar la trazabilidad.
                              </p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function CobranzaPage() {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-gray-50 flex flex-col">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1">
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Cobranza</h1>
              <p className="text-sm text-gray-500 mt-1">Facturas pagadas, pendientes y vencidas</p>
            </div>
            <FinanzasNav />
          </div>

          <Cobranza />
        </div>
      </main>
    </AuthGuard>
  )
}
