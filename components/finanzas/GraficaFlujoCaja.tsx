"use client"

import type { ResumenFlujoCaja } from "@/lib/flujo-caja"
import { formatPrecio } from "@/lib/format"
import ModuleSurface from "@/components/layout/ModuleSurface"

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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ModuleSurface className="space-y-1 p-4">
          <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Ingresos Esperados (AR)</p>
          <p className="font-mono text-xl font-bold text-emerald-600 tabular-nums sm:text-2xl">
            {formatPrecio(totalIngresosEsperados, moneda)}
          </p>
          <p className="text-[11px] font-medium text-muted-foreground">
            {resumen.numClientesPendientes} clientes con saldo activo
          </p>
        </ModuleSurface>

        <ModuleSurface className="space-y-1 p-4">
          <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Egresos Comprometidos (AP)</p>
          <p className="font-mono text-xl font-bold text-rose-600 tabular-nums sm:text-2xl">
            {formatPrecio(totalEgresosComprometidos, moneda)}
          </p>
          <p className="text-[11px] font-medium text-muted-foreground">
            {resumen.numProveedoresPendientes} proveedores pendientes
          </p>
        </ModuleSurface>

        <ModuleSurface className="space-y-1 p-4">
          <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Balance Neto Proyectado</p>
          <p
            className={`font-mono text-xl font-bold tabular-nums sm:text-2xl ${
              balanceNetoProyectado >= 0 ? "text-primary" : "text-amber-700"
            }`}
          >
            {formatPrecio(balanceNetoProyectado, moneda)}
          </p>
          <p className="text-[11px] font-medium text-muted-foreground">Neto diferido por facturación</p>
        </ModuleSurface>

        <ModuleSurface className="space-y-1 p-4">
          <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground">Cobertura de Liquidez</p>
          <p
            className={`font-mono text-xl font-bold tabular-nums sm:text-2xl ${
              coberturaPorcentaje >= 100
                ? "text-emerald-600"
                : coberturaPorcentaje >= 70
                ? "text-amber-700"
                : "text-rose-600"
            }`}
          >
            {coberturaPorcentaje.toFixed(1)}%
          </p>
          <p className="text-[11px] font-medium text-muted-foreground">
            {coberturaPorcentaje >= 100 ? "Liquidez saludable" : "Precaución en caja"}
          </p>
        </ModuleSurface>
      </div>

      {/* Cronograma de Flujo Semanal */}
      <ModuleSurface className="space-y-4 p-5">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
            Proyección Semanal de Ingresos y Egresos
          </h3>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 font-medium text-emerald-700">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" /> Ingresos (AR)
            </span>
            <span className="flex items-center gap-1.5 font-medium text-rose-700">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500" /> Egresos (AP)
            </span>
            <span className="flex items-center gap-1.5 font-medium text-primary">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" /> Neto Acumulado
            </span>
          </div>
        </div>

        {puntosSemanales.length === 0 ? (
          <div className="py-10 text-center font-mono text-xs text-muted-foreground">
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
                  className="space-y-2 rounded-lg border border-border bg-muted/50 p-3.5 transition-colors hover:bg-muted"
                >
                  <div className="flex justify-between text-xs font-medium text-foreground">
                    <span className="font-semibold text-foreground">{p.semanaLabel}</span>
                    <span className="font-mono text-muted-foreground">
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
                      <span className="w-10 text-right font-mono text-[11px] text-muted-foreground">AR</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${pctIngreso}%` }}
                        />
                      </div>
                      <span className="w-24 text-right font-mono font-bold text-emerald-700 tabular-nums">
                        {formatPrecio(p.ingresosAR, moneda)}
                      </span>
                    </div>

                    {/* Barra Egresos */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="w-10 text-right font-mono text-[11px] text-muted-foreground">AP</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-rose-500 transition-all duration-500"
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
      </ModuleSurface>
    </div>
  )
}
