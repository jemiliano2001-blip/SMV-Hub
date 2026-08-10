"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, Boxes, ClipboardList, Clock, PackageCheck, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useEndmills } from "@/lib/hooks/useEndmills"
import { useUsuario } from "@/lib/auth"
import { calcularLeadTimePromedio, clasificarStockEndmill } from "@/lib/endmills-calculos"
import type { EstadoStockEndmill } from "@/lib/schemas"
import InventarioEndmills from "@/app/endmills/InventarioEndmills"
import RevisionPedidoEndmills from "@/app/endmills/RevisionPedidoEndmills"
import HistorialPedidosEndmills from "@/app/endmills/HistorialPedidosEndmills"

export default function EndmillsView() {
  const { usuario } = useUsuario()
  const endmills = useEndmills()
  const [revisionAbierta, setRevisionAbierta] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState<EstadoStockEndmill | "todas" | "confirmar">("todas")

  const resumen = useMemo(() => {
    const estados = endmills.medidas.map((medida) =>
      clasificarStockEndmill(medida.stockActual, medida.objetivoPar)
    )
    return {
      criticas: estados.filter((estado) => estado === "critico").length,
      bajas: estados.filter((estado) => estado === "bajo").length,
      sinBase: estados.filter((estado) => estado === "sin_base").length,
      confirmar: endmills.medidas.filter((medida) => medida.requiereConfirmacion).length,
    }
  }, [endmills.medidas])

  const leadTimePromedio = useMemo(
    () => calcularLeadTimePromedio(endmills.pedidos),
    [endmills.pedidos]
  )

  const actor = {
    uid: usuario?.uid ?? "",
    nombre: usuario?.displayName || usuario?.email || "Usuario SMV",
  }

  function toggleFiltro(nuevo: EstadoStockEndmill | "todas" | "confirmar") {
    setFiltroEstado((actual) => (actual === nuevo ? "todas" : nuevo))
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Boxes className="h-5 w-5 text-sky-700" />
                <h1 className="text-lg font-bold tracking-tight text-slate-950">Endmills China</h1>
                <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                  USD
                </span>
                {leadTimePromedio !== null && (
                  <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    <Clock className="h-3 w-3 text-emerald-600" />
                    Lead time promedio: {leadTimePromedio} días
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Inventario, precios y ciclos con ChangZhou North Alloy Tool Co. · Rita
              </p>
            </div>
            <Button
              onClick={() => setRevisionAbierta(true)}
              disabled={endmills.medidas.length === 0 || !usuario}
              className="bg-sky-700 hover:bg-sky-800"
            >
              <ClipboardList className="h-4 w-4" />
              Preparar pedido
            </Button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Kpi
              label="Medidas"
              valor={endmills.medidas.length}
              tono="slate"
              activo={filtroEstado === "todas"}
              onClick={() => toggleFiltro("todas")}
            />
            <Kpi
              label="Críticas"
              valor={resumen.criticas}
              tono="rose"
              activo={filtroEstado === "critico"}
              onClick={() => toggleFiltro("critico")}
            />
            <Kpi
              label="Bajas"
              valor={resumen.bajas}
              tono="amber"
              activo={filtroEstado === "bajo"}
              onClick={() => toggleFiltro("bajo")}
            />
            <Kpi
              label="Sin base"
              valor={resumen.sinBase}
              tono="slate"
              activo={filtroEstado === "sin_base"}
              onClick={() => toggleFiltro("sin_base")}
            />
            <Kpi
              label="Por confirmar"
              valor={resumen.confirmar}
              tono="sky"
              activo={filtroEstado === "confirmar"}
              onClick={() => toggleFiltro("confirmar")}
            />
          </div>
        </section>

        {(endmills.errorMedidas || endmills.errorPedidos) && (
          <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{endmills.errorMedidas || endmills.errorPedidos}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void Promise.all([endmills.fetchMedidas(), endmills.fetchPedidos()])}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reintentar
            </Button>
          </div>
        )}

        <Tabs defaultValue="inventario" className="gap-3">
          <TabsList>
            <TabsTrigger value="inventario" className="text-slate-700">
              <Boxes /> Inventario
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="text-slate-700">
              <PackageCheck /> Pedidos
            </TabsTrigger>
          </TabsList>
          <TabsContent value="inventario">
            <InventarioEndmills
              medidas={endmills.medidas}
              loading={endmills.loadingMedidas}
              filtroEstadoExterno={filtroEstado}
              onActualizarStock={endmills.actualizarStock}
              onActualizarStockBatch={endmills.actualizarStockBatch}
              onConfirmarMedida={endmills.confirmarMedida}
              onCrearMedida={endmills.crearMedida}
              onReordenarMedidas={endmills.reordenarMedidas}
            />
          </TabsContent>
          <TabsContent value="pedidos">
            <HistorialPedidosEndmills
              pedidos={endmills.pedidos}
              loading={endmills.loadingPedidos}
              onRegistrarRecepcion={endmills.registrarRecepcion}
              onCancelar={endmills.cancelarPedido}
            />
          </TabsContent>
        </Tabs>
      </div>

      {revisionAbierta && (
        <RevisionPedidoEndmills
          medidas={endmills.medidas}
          ultimoPedido={endmills.pedidos.find((pedido) => pedido.estado !== "cancelado") ?? null}
          actor={actor}
          onRegistrar={endmills.registrarPedido}
          onClose={() => setRevisionAbierta(false)}
        />
      )}
    </main>
  )
}

function Kpi({
  label,
  valor,
  tono,
  activo,
  onClick,
}: {
  label: string
  valor: number
  tono: "slate" | "rose" | "amber" | "sky"
  activo?: boolean
  onClick?: () => void
}) {
  const tonos = {
    slate: "border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-400",
    rose: "border-rose-200 bg-rose-50 text-rose-800 hover:border-rose-400",
    amber: "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-400",
    sky: "border-sky-200 bg-sky-50 text-sky-800 hover:border-sky-400",
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={onClick ? Boolean(activo) : undefined}
      className={`rounded-lg border px-3 py-2 text-left transition-all ${tonos[tono]} ${
        activo ? "ring-2 ring-sky-600 ring-offset-1 font-bold" : ""
      }`}
    >
      <div className="text-[10px] font-bold uppercase tracking-wide">{label}</div>
      <div className="text-xl font-black tabular-nums">{valor}</div>
    </button>
  )
}
