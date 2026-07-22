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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs font-medium text-slate-400">Ingresos Esperados (AR)</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {formatPrecio(totalIngresosEsperados, moneda)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {resumen.numClientesPendientes} clientes con saldo activo
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs font-medium text-slate-400">Egresos Comprometidos (AP)</div>
          <div className="text-2xl font-bold text-rose-400 mt-1">
            {formatPrecio(totalEgresosComprometidos, moneda)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {resumen.numProveedoresPendientes} proveedores pendientes
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs font-medium text-slate-400">Balance Neto Proyectado</div>
          <div
            className={`text-2xl font-bold mt-1 ${
              balanceNetoProyectado >= 0 ? "text-indigo-400" : "text-amber-400"
            }`}
          >
            {formatPrecio(balanceNetoProyectado, moneda)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Neto diferido por facturación</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="text-xs font-medium text-slate-400">Cobertura de Liquidez</div>
          <div
            className={`text-2xl font-bold mt-1 ${
              coberturaPorcentaje >= 100
                ? "text-emerald-400"
                : coberturaPorcentaje >= 70
                ? "text-amber-400"
                : "text-rose-400"
            }`}
          >
            {coberturaPorcentaje.toFixed(1)}%
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {coberturaPorcentaje >= 100 ? "Liquidez saludable" : "Precaución en caja"}
          </div>
        </div>
      </div>

      {/* Cronograma de Flujo Semanal */}
      <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-semibold text-slate-100">
            Proyección Semanal de Ingresos y Egresos
          </h3>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" /> Ingresos (AR)
            </span>
            <span className="flex items-center gap-1.5 text-rose-400">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" /> Egresos (AP)
            </span>
            <span className="flex items-center gap-1.5 text-indigo-400">
              <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" /> Neto Acumulado
            </span>
          </div>
        </div>

        {puntosSemanales.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            No hay facturas con fechas de vencimiento pendientes en esta moneda.
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            {puntosSemanales.map((p) => {
              const pctIngreso = Math.min(100, (p.ingresosAR / maxValor) * 100)
              const pctEgreso = Math.min(100, (p.egresosAP / maxValor) * 100)

              return (
                <div
                  key={p.semanaKey}
                  className="p-3 rounded-lg bg-slate-800/40 border border-slate-800/80 space-y-2 hover:bg-slate-800/60 transition-colors"
                >
                  <div className="flex justify-between text-xs font-medium text-slate-300">
                    <span>{p.semanaLabel}</span>
                    <span className="font-semibold">
                      Neto:{" "}
                      <span className={p.netoSemanal >= 0 ? "text-emerald-400" : "text-rose-400"}>
                        {formatPrecio(p.netoSemanal, moneda)}
                      </span>{" "}
                      | Acum:{" "}
                      <span className={p.netoAcumulado >= 0 ? "text-indigo-400" : "text-amber-400"}>
                        {formatPrecio(p.netoAcumulado, moneda)}
                      </span>
                    </span>
                  </div>

                  {/* Barras comparativas */}
                  <div className="space-y-1.5">
                    {/* Barra Ingresos */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-16 text-slate-400 text-right font-mono">AR</span>
                      <div className="flex-1 bg-slate-900 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${pctIngreso}%` }}
                        />
                      </div>
                      <span className="w-24 text-right font-mono text-emerald-400">
                        {formatPrecio(p.ingresosAR, moneda)}
                      </span>
                    </div>

                    {/* Barra Egresos */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-16 text-slate-400 text-right font-mono">AP</span>
                      <div className="flex-1 bg-slate-900 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="bg-rose-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${pctEgreso}%` }}
                        />
                      </div>
                      <span className="w-24 text-right font-mono text-rose-400">
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
