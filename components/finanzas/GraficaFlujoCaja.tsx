"use client"

import type { ResumenFlujoCaja } from "@/lib/flujo-caja"
import { formatPrecio } from "@/lib/format"

interface GraficaFlujoCajaProps {
  resumen: ResumenFlujoCaja
  moneda: string
}

export function GraficaFlujoCaja({ resumen, moneda }: GraficaFlujoCajaProps) {
  const {
    totalIngresosEsperados,
    totalEgresosComprometidos,
    balanceNetoProyectado,
    coberturaPorcentaje,
    puntosSemanales,
  } = resumen

  // Calcular el valor máximo para escalar las barras visuales
  const maxValor = Math.max(
    ...puntosSemanales.flatMap((p) => [p.ingresosAR, p.egresosAP]),
    1000
  )

  return (
    <div className="space-y-6">
      {/* Cards de Métricas Clave */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-1">
          <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">Ingresos Esperados (AR)</p>
          <p className="text-xl sm:text-2xl font-bold font-mono text-emerald-600 tabular-nums">
            {formatPrecio(totalIngresosEsperados, moneda)}
          </p>
          <p className="text-[11px] text-slate-500 font-medium">
            {resumen.numClientesPendientes} clientes con saldo activo
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-1">
          <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">Egresos Comprometidos (AP)</p>
          <p className="text-xl sm:text-2xl font-bold font-mono text-rose-600 tabular-nums">
            {formatPrecio(totalEgresosComprometidos, moneda)}
          </p>
          <p className="text-[11px] text-slate-500 font-medium">
            {resumen.numProveedoresPendientes} proveedores pendientes
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-1">
          <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">Balance Neto Proyectado</p>
          <p
            className={`text-xl sm:text-2xl font-bold font-mono tabular-nums ${
              balanceNetoProyectado >= 0 ? "text-primary" : "text-amber-700"
            }`}
          >
            {formatPrecio(balanceNetoProyectado, moneda)}
          </p>
          <p className="text-[11px] text-slate-500 font-medium">Neto diferido por facturación</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-1">
          <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">Cobertura de Liquidez</p>
          <p
            className={`text-xl sm:text-2xl font-bold font-mono tabular-nums ${
              coberturaPorcentaje >= 100
                ? "text-emerald-600"
                : coberturaPorcentaje >= 70
                ? "text-amber-700"
                : "text-rose-600"
            }`}
          >
            {coberturaPorcentaje.toFixed(1)}%
          </p>
          <p className="text-[11px] text-slate-500 font-medium">
            {coberturaPorcentaje >= 100 ? "Liquidez saludable" : "Precaución en caja"}
          </p>
        </div>
      </div>

      {/* Cronograma de Flujo Semanal */}
      <div className="p-5 rounded-xl bg-white border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-700">
            Proyección Semanal de Ingresos y Egresos
          </h3>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Ingresos (AR)
            </span>
            <span className="flex items-center gap-1.5 text-rose-700 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Egresos (AP)
            </span>
            <span className="flex items-center gap-1.5 text-primary font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" /> Neto Acumulado
            </span>
          </div>
        </div>

        {puntosSemanales.length === 0 ? (
          <div className="py-10 text-center text-slate-500 font-mono text-xs">
            No hay facturas con fechas de vencimiento pendientes en esta moneda.
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {puntosSemanales.map((p) => {
              const pctIngreso = Math.min(100, (p.ingresosAR / maxValor) * 100)
              const pctEgreso = Math.min(100, (p.egresosAP / maxValor) * 100)

              return (
                <div
                  key={p.semanaKey}
                  className="p-3.5 rounded-lg bg-slate-50/70 border border-slate-200/80 space-y-2 hover:bg-slate-100/60 transition-colors"
                >
                  <div className="flex justify-between text-xs font-medium text-slate-700">
                    <span className="font-semibold text-slate-900">{p.semanaLabel}</span>
                    <span className="font-mono text-slate-600">
                      Neto:{" "}
                      <span className={`font-bold ${p.netoSemanal >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                        {formatPrecio(p.netoSemanal, moneda)}
                      </span>{" "}
                      | Acum:{" "}
                      <span className={`font-bold ${p.netoAcumulado >= 0 ? "text-primary" : "text-amber-700"}`}>
                        {formatPrecio(p.netoAcumulado, moneda)}
                      </span>
                    </span>
                  </div>

                  {/* Barras comparativas */}
                  <div className="space-y-1.5">
                    {/* Barra Ingresos */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-10 text-slate-500 text-right font-mono text-[11px]">AR</span>
                      <div className="flex-1 bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${pctIngreso}%` }}
                        />
                      </div>
                      <span className="w-24 text-right font-mono font-bold text-emerald-700 tabular-nums">
                        {formatPrecio(p.ingresosAR, moneda)}
                      </span>
                    </div>

                    {/* Barra Egresos */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-10 text-slate-500 text-right font-mono text-[11px]">AP</span>
                      <div className="flex-1 bg-slate-200 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-rose-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${pctEgreso}%` }}
                        />
                      </div>
                      <span className="w-24 text-right font-mono font-bold text-rose-700 tabular-nums">
                        {formatPrecio(p.egresosAP, moneda)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

