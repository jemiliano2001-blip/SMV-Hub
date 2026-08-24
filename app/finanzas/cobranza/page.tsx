'use client'

import AuthGuard from "@/app/AuthGuard"
import PageHeader from "@/components/layout/PageHeader"
import PageShell from "@/components/layout/PageShell"
import ModuleSurface from "@/components/layout/ModuleSurface"
import { Fragment, useMemo, useState } from "react"
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Flag,
  Loader2,
  Copy,
  Mail,
  Edit3,
} from "lucide-react"
import { toast } from "sonner"
import { useUsuario } from "@/lib/auth"
import { useFinanzasFacturas } from "@/lib/hooks/useFinanzasFacturas"
import { useSeguimientoCobranza } from "@/lib/hooks/useSeguimientoCobranza"
import type { FacturaCliente, SeguimientoCobranza, SeguimientoCobranzaInput } from "@/lib/schemas"
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
} from "@/components/ui/context-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type FilaCobranza = {
  factura: FacturaCliente
  estado: EstadoCobranza
  atraso: number
  bucket: BucketAging
}

type FacturaCobranzaCardProps = {
  fila: FilaCobranza
  moneda: string
  prioritaria: boolean
  seguimiento: SeguimientoCobranza | undefined
  expandida: boolean
  onToggleExpand: (id: string) => void
  loadingSeguimiento: boolean
  usuarioEmail: string | null | undefined
  onGuardar: (entrada: SeguimientoCobranzaInput) => Promise<void>
  onEliminar: (facturaId: string) => Promise<void>
}

// Tarjeta para < md: mismos datos que la fila de tabla, con el editor de seguimiento
// desplegándose dentro de la tarjeta en vez de en una fila hermana.
function FacturaCobranzaCard({
  fila: { factura, estado, atraso, bucket },
  moneda,
  prioritaria,
  seguimiento,
  expandida,
  onToggleExpand,
  loadingSeguimiento,
  usuarioEmail,
  onGuardar,
  onEliminar,
}: FacturaCobranzaCardProps) {
  return (
    <div className={`p-4 space-y-2.5 ${prioritaria ? "bg-amber-50/70" : ""}`}>
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{factura.cliente}</p>
          <p className="text-xs text-muted-foreground font-mono">{factura.numeroFactura} · vence {formatFecha(factura.fechaVencimiento)}</p>
        </div>
        {seguimiento?.enDisputa ? (
          <span className="shrink-0 rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">En disputa</span>
        ) : (
          <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${ETIQUETA_ESTADO[estado].clase}`}>
            {ETIQUETA_ESTADO[estado].label}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="min-w-0">
          <span className="text-muted-foreground block">Total</span>
          <span className="text-foreground tabular-nums block">{formatPrecio(factura.total, moneda)}</span>
        </div>
        <div className="min-w-0">
          <span className="text-muted-foreground block">Saldo</span>
          <span className="text-foreground tabular-nums font-medium block">
            {formatPrecio(factura.saldoPendiente, moneda)}
            {prioritaria && (
              <span className="ml-1.5 inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800">
                Prioridad
              </span>
            )}
          </span>
        </div>
        <div className="min-w-0">
          <span className="text-muted-foreground block">Días atraso</span>
          <span className="text-foreground tabular-nums block">{atraso > 0 ? atraso : "—"}</span>
        </div>
        <div className="min-w-0">
          <span className="text-muted-foreground block">Antigüedad</span>
          {factura.saldoPendiente > 0 && atraso > 0 ? (
            <span
              className="inline-flex items-center gap-1 font-medium"
              style={{ color: INFO_BUCKET[bucket].color }}
              title={INFO_BUCKET[bucket].accion}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: INFO_BUCKET[bucket].color }} />
              {INFO_BUCKET[bucket].label}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      </div>

      <div className="pt-2 border-t border-border">
        <button
          type="button"
          onClick={() => onToggleExpand(factura.id)}
          disabled={loadingSeguimiento}
          aria-expanded={expandida}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          {seguimiento ? "Editar seguimiento" : "Agregar seguimiento"}
          {expandida ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {expandida && (
          <div className="mt-3">
            {usuarioEmail ? (
              <SeguimientoCobranzaEditor
                facturaId={factura.id}
                seguimiento={seguimiento}
                actualizadoPor={usuarioEmail}
                onGuardar={onGuardar}
                onEliminar={onEliminar}
              />
            ) : (
              <p className="text-sm text-amber-700">No se pudo identificar la sesión para registrar la trazabilidad.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

type Filtro = "todas" | EstadoCobranza | "disputa"
type PeriodoCobranza = "todas" | "mes"
const COLUMNAS_TABLA = 9

const ETIQUETA_ESTADO: Record<EstadoCobranza, { label: string; clase: string }> = {
  pagada: { label: "Pagada", clase: "bg-emerald-50 text-emerald-700" },
  pendiente: { label: "Pendiente", clase: "bg-amber-50 text-amber-700" },
  vencida: { label: "Vencida", clase: "bg-rose-50 text-rose-700" },
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
        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground">Cargando cobranza…</span>
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
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-muted p-1 rounded-lg gap-1">
            {(["todas", "mes"] as PeriodoCobranza[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodoTipo(p)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  periodoTipo === p ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
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
                    m === moneda ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border"
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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <ModuleSurface className="p-4">
          <p className="mb-1 text-xs text-muted-foreground">Total por cobrar</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">{formatPrecio(totalPorCobrar, moneda)}</p>
        </ModuleSurface>
        <ModuleSurface className="p-4">
          <p className="mb-1 text-xs text-muted-foreground">Pendientes</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">{numPendientes}</p>
        </ModuleSurface>
        <ModuleSurface className="p-4">
          <p className="mb-1 text-xs text-muted-foreground">Vencidas</p>
          <p className="text-2xl font-bold text-rose-600 tabular-nums">{numVencidas}</p>
        </ModuleSurface>
        <ModuleSurface className="p-4">
          <p className="mb-1 text-xs text-muted-foreground">DSO</p>
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {dso === null ? "—" : `${Math.round(dso)} días`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Días promedio en cobrar</p>
        </ModuleSurface>
        <ModuleSurface className="p-4">
          <p className="mb-1 text-xs text-muted-foreground">CEI del mes</p>
          <p
            className={`text-2xl font-bold tabular-nums ${
              cei === null ? "text-foreground" : cei >= 80 ? "text-emerald-600" : cei >= 70 ? "text-amber-600" : "text-rose-600"
            }`}
          >
            {cei === null ? "—" : `${cei.toFixed(0)}%`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Efectividad de cobro (aprox.)</p>
        </ModuleSurface>
        <ModuleSurface className="p-4">
          <p className="mb-1 text-xs text-muted-foreground">Saldo en 90+ días</p>
          <p className={`text-2xl font-bold tabular-nums ${alerta90 ? "text-rose-600" : "text-foreground"}`}>
            {pct90.toFixed(1)}%
          </p>
          <p className={`mt-1 text-xs ${alerta90 ? "font-medium text-rose-500" : "text-muted-foreground"}`}>
            {alerta90 ? "Arriba del 5% — atención" : "Sano si es menor al 5%"}
          </p>
        </ModuleSurface>
      </div>

      {aging.totalPorCobrar > 0 && (
        <ModuleSurface className="p-4 sm:p-6">
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Antigüedad del saldo por cobrar ({moneda})
          </h2>
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-muted">
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
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
            {BUCKETS_AGING.map((b) => (
              <div key={b} className="flex items-start gap-1.5">
                <span
                  className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: INFO_BUCKET[b].color }}
                />
                <div>
                  <p className="font-medium text-foreground">
                    {INFO_BUCKET[b].label}
                    <span className="font-normal text-muted-foreground"> · {aging.buckets[b].cantidad}</span>
                  </p>
                  <p className="text-muted-foreground tabular-nums">
                    {formatPrecio(aging.buckets[b].total, moneda)} ({aging.buckets[b].pct.toFixed(1)}%)
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ModuleSurface>
      )}

      {clientesVencidos.length > 0 && (
        <ModuleSurface className="p-4 sm:p-6">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Top clientes con saldo vencido ({moneda})
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Excluye facturas marcadas en disputa
              </p>
            </div>
            <Flag className="h-5 w-5 text-rose-500" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {clientesVencidos.map((cliente, indice) => (
              <div
                key={cliente.cliente}
                className="rounded-lg border border-rose-100 bg-rose-50/40 p-3"
              >
                <p className="truncate text-xs font-semibold text-foreground" title={cliente.cliente}>
                  {indice + 1}. {cliente.cliente}
                </p>
                <p className="mt-1 text-lg font-bold text-rose-700 tabular-nums">
                  {formatPrecio(cliente.saldoVencido, moneda)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {cliente.cantidadFacturas} factura
                  {cliente.cantidadFacturas === 1 ? "" : "s"} · más antigua{" "}
                  {cliente.facturaMasAntigua}
                </p>
                <p className="text-xs font-medium text-rose-600">
                  {cliente.diasMaximosAtraso} días de atraso
                </p>
              </div>
            ))}
          </div>
        </ModuleSurface>
      )}

      <div className="flex w-fit gap-1 rounded-lg bg-muted p-1">
        {(["todas", "pendiente", "vencida", "pagada", "disputa"] as Filtro[]).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-all ${
              filtro === f ? "bg-card text-primary shadow-sm" : "text-muted-foreground"
            }`}
          >
            {f === "disputa" ? "En disputa" : f}
          </button>
        ))}
      </div>

      <ModuleSurface className="p-4 sm:p-6">
        {filasFiltradas.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No hay facturas para este filtro.</p>
        ) : (
          <>
            <div className="md:hidden divide-y divide-border -mx-4 sm:-mx-6">
              {filasFiltradas.map((fila) => (
                <FacturaCobranzaCard
                  key={fila.factura.id}
                  fila={fila}
                  moneda={moneda}
                  prioritaria={idsPrioritarias.has(fila.factura.id)}
                  seguimiento={seguimientos.get(fila.factura.id)}
                  expandida={facturaExpandida === fila.factura.id}
                  onToggleExpand={(id) => setFacturaExpandida((actual) => (actual === id ? null : id))}
                  loadingSeguimiento={loadingSeguimiento}
                  usuarioEmail={usuario?.email}
                  onGuardar={guardarSeguimiento}
                  onEliminar={eliminarSeguimiento}
                />
              ))}
            </div>
            <div className="hidden md:block overflow-x-auto">
            <Table className="w-full text-sm border-collapse">
              <TableHeader>
                <TableRow className="border-b-2 border-border">
                  <TableHead className="pb-2 pr-3 text-left text-xs font-semibold text-muted-foreground">Cliente</TableHead>
                  <TableHead className="pb-2 pr-3 text-left text-xs font-semibold text-muted-foreground">Factura</TableHead>
                  <TableHead className="pb-2 pr-3 text-left text-xs font-semibold text-muted-foreground">Vencimiento</TableHead>
                  <TableHead className="pb-2 pr-3 text-right text-xs font-semibold text-muted-foreground">Total</TableHead>
                  <TableHead className="pb-2 pr-3 text-right text-xs font-semibold text-muted-foreground">Saldo</TableHead>
                  <TableHead className="pb-2 pr-3 text-right text-xs font-semibold text-muted-foreground">Días atraso</TableHead>
                  <TableHead className="pb-2 pr-3 text-left text-xs font-semibold text-muted-foreground">Antigüedad</TableHead>
                  <TableHead className="pb-2 pr-3 text-left text-xs font-semibold text-muted-foreground">Estado</TableHead>
                  <TableHead className="pb-2 text-right text-xs font-semibold text-muted-foreground">Seguimiento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filasFiltradas.map(({ factura, estado, atraso, bucket }) => {
                  const seguimiento = seguimientos.get(factura.id)
                  const expandida = facturaExpandida === factura.id
                  const prioritaria = idsPrioritarias.has(factura.id)
                  return (
                    <Fragment key={factura.id}>
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                          <TableRow
                            className={`border-b border-border hover:bg-muted cursor-pointer ${
                              prioritaria ? "bg-amber-50/70" : ""
                            }`}
                            onDoubleClick={() =>
                              setFacturaExpandida((actual) =>
                                actual === factura.id ? null : factura.id
                              )
                            }
                          >
                            <TableCell className="py-2 pr-3">{factura.cliente}</TableCell>
                            <TableCell className="py-2 pr-3 font-mono text-xs text-muted-foreground">{factura.numeroFactura}</TableCell>
                            <TableCell className="py-2 pr-3">{formatFecha(factura.fechaVencimiento)}</TableCell>
                            <TableCell className="py-2 pr-3 text-right tabular-nums">{formatPrecio(factura.total, moneda)}</TableCell>
                            <TableCell className="py-2 pr-3 text-right tabular-nums font-medium">
                              {formatPrecio(factura.saldoPendiente, moneda)}
                              {prioritaria && (
                                <span className="ml-2 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                                  Prioridad
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="py-2 pr-3 text-right tabular-nums text-muted-foreground">{atraso > 0 ? atraso : "—"}</TableCell>
                            <TableCell className="py-2 pr-3">
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
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="py-2 pr-3">
                              {seguimiento?.enDisputa ? (
                                <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                                  En disputa
                                </span>
                              ) : (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ETIQUETA_ESTADO[estado].clase}`}>
                                  {ETIQUETA_ESTADO[estado].label}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="py-2 text-right" onClick={(e) => e.stopPropagation()}>
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
                                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
                              >
                                {seguimiento ? "Editar" : "Agregar"}
                                {expandida ? (
                                  <ChevronUp className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </TableCell>
                          </TableRow>
                        </ContextMenuTrigger>

                        <ContextMenuContent className="w-60">
                          <ContextMenuItem
                            onClick={() =>
                              setFacturaExpandida((actual) =>
                                actual === factura.id ? null : factura.id
                              )
                            }
                          >
                            <Edit3 className="text-primary" />
                            <span>{seguimiento ? "Editar seguimiento" : "Agregar seguimiento"}</span>
                            <ContextMenuShortcut>↵</ContextMenuShortcut>
                          </ContextMenuItem>

                          <ContextMenuSeparator />

                          <ContextMenuSub>
                            <ContextMenuSubTrigger>
                              <Copy className="text-muted-foreground" />
                              <span>Copiar información</span>
                            </ContextMenuSubTrigger>
                            <ContextMenuSubContent className="w-52">
                              <ContextMenuItem
                                onClick={() => {
                                  void navigator.clipboard.writeText(factura.cliente)
                                  toast.success('Cliente copiado')
                                }}
                              >
                                <span>Cliente ({factura.cliente})</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                onClick={() => {
                                  void navigator.clipboard.writeText(factura.numeroFactura)
                                  toast.success('Factura copiada')
                                }}
                              >
                                <span>No. Factura ({factura.numeroFactura})</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                onClick={() => {
                                  const saldoTxt = formatPrecio(factura.saldoPendiente, moneda)
                                  void navigator.clipboard.writeText(saldoTxt)
                                  toast.success('Saldo pendiente copiado', { description: saldoTxt })
                                }}
                              >
                                <span>Saldo ({formatPrecio(factura.saldoPendiente, moneda)})</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                onClick={() => {
                                  const totalTxt = formatPrecio(factura.total, moneda)
                                  void navigator.clipboard.writeText(totalTxt)
                                  toast.success('Total copiado', { description: totalTxt })
                                }}
                              >
                                <span>Total ({formatPrecio(factura.total, moneda)})</span>
                              </ContextMenuItem>
                            </ContextMenuSubContent>
                          </ContextMenuSub>

                          <ContextMenuItem
                            onClick={() => {
                              const plantilla = `Estimado cliente ${factura.cliente},\n\nLe enviamos un cordial recordatorio sobre el saldo pendiente de ${formatPrecio(factura.saldoPendiente, moneda)} correspondiente a la factura ${factura.numeroFactura} con fecha de vencimiento ${formatFecha(factura.fechaVencimiento)}.\n\nAgradecemos su apoyo con el comprobante de pago o fecha estimada de liquidación.\n\nSaludos cordiales,\nDepartamento de Cobranza - SMV`
                              void navigator.clipboard.writeText(plantilla)
                              toast.success('Plantilla de cobranza copiada al portapapeles')
                            }}
                          >
                            <Mail className="text-sky-600" />
                            <span>Copiar texto de recordatorio</span>
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                      {expandida && (
                        <TableRow
                          id={`seguimiento-${factura.id}`}
                          className="border-b border-border"
                        >
                          <TableCell colSpan={COLUMNAS_TABLA} className="px-2 py-3">
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
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
            </div>
          </>
        )}
      </ModuleSurface>
    </div>
  )
}

export default function CobranzaPage() {
  return (
    <AuthGuard>
      <PageShell>
        <PageHeader
          title="Cobranza"
          badge="Odoo"
          description="Facturas pagadas, pendientes y vencidas."
          actions={<FinanzasNav />}
        />
        <Cobranza />
      </PageShell>
    </AuthGuard>
  )
}
