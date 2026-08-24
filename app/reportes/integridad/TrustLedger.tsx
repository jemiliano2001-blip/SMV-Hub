'use client'

import Link from "next/link"
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldAlert,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import ModuleSurface from "@/components/layout/ModuleSurface"
import type { TrustEnvelopeDTO } from "@/lib/reportes-integridad"
import { integrityUnavailableCopy } from "@/lib/reportes-integridad-copy"

function hora(value: string | null): string {
  if (!value) return "sin cálculo"
  return new Date(value).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function health(trust: TrustEnvelopeDTO) {
  if (!trust.activeRunId) {
    const unavailable = integrityUnavailableCopy(trust)
    return {
      label: unavailable.title,
      Icon: ShieldAlert,
      className: "text-muted-foreground",
    }
  }
  if (trust.sourceStatus === "current") {
    return {
      label: "Vigente",
      Icon: CheckCircle2,
      className: "text-emerald-700",
    }
  }
  if (trust.sourceStatus === "failed") {
    return {
      label: "Último intento fallido",
      Icon: AlertTriangle,
      className: "text-destructive",
    }
  }
  return {
    label: "Desactualizado",
    Icon: Clock3,
    className: "text-amber-800",
  }
}

export function TrustLedger({
  trust,
  syncing = false,
  onSync,
  compact = false,
}: {
  trust: TrustEnvelopeDTO
  syncing?: boolean
  onSync?: () => void
  compact?: boolean
}) {
  const state = health(trust)
  const unavailable = integrityUnavailableCopy(trust)
  const StateIcon = state.Icon

  if (compact) {
    return (
      <div
        className="mb-4 flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 border-y border-border bg-card px-3 py-2 text-sm text-foreground no-print"
        aria-label="Confianza del corte de Integridad"
      >
        <span className={`inline-flex items-center gap-1.5 font-semibold ${state.className}`}>
          <StateIcon className="h-4 w-4" aria-hidden="true" />
          {state.label}
        </span>
        {trust.activeRunId ? (
          <>
            <span className="font-mono text-muted-foreground">
              calculado {hora(trust.computedAt)}
            </span>
            <span className="text-muted-foreground">
              cobertura {trust.coverage.matched}/{trust.coverage.eligible}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">{unavailable.description}</span>
        )}
        <Link
          href="/reportes"
          className="ml-auto min-h-11 content-center font-semibold text-primary underline underline-offset-4"
        >
          Ver Integridad
        </Link>
      </div>
    )
  }

  return (
    <ModuleSurface className="px-4 py-3">
      <section aria-labelledby="integrity-trust-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="integrity-trust-title"
              className={`flex items-center gap-2 text-base font-semibold ${state.className}`}
            >
              <StateIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {state.label}
              {trust.activeRunId && (
                <span className="font-normal text-foreground">
                  · {trust.summary.open} casos abiertos
                </span>
              )}
            </h2>
            {trust.activeRunId ? (
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                <span className="font-mono">
                  {trust.coverage.matched} de {trust.coverage.eligible} vínculos ({trust.coverage.percentage}%)
                </span>
                {" · "}+{trust.delta.new} nuevos
                {" · "}{trust.delta.corrected} corregidos
                {" · "}{trust.delta.reopened} reabiertos
                {trust.currencyScopes.length > 0 && ` · ${trust.currencyScopes.join("/")}`}
                {" · "}{trust.excludedCounts.creditNotes} notas de crédito excluidas
                {" · "}calculado <span className="font-mono">{hora(trust.computedAt)}</span>
              </p>
            ) : (
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {unavailable.description}
                {trust.lastAttemptAt && ` Último intento: ${hora(trust.lastAttemptAt)}.`}
              </p>
            )}
            {trust.activeRunId && trust.sourceStatus !== "current" && (
              <p className="mt-1 text-sm font-medium text-amber-900">
                Se conserva el último corte válido. Resolver, descartar y vincular están bloqueados hasta actualizar la evidencia.
              </p>
            )}
          </div>

          {trust.capabilities.canTriggerSync && onSync && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSync}
              disabled={syncing}
              className="min-h-11 shrink-0"
            >
              <RefreshCw
                className={`h-4 w-4 ${syncing ? "animate-spin motion-reduce:animate-none" : ""}`}
                aria-hidden="true"
              />
              {syncing ? "Sincronizando…" : "Sincronizar y verificar"}
            </Button>
          )}
        </div>
      </section>
    </ModuleSurface>
  )
}
