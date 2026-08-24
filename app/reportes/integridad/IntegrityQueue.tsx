'use client'

import { AlertTriangle, ArrowRight, Clock3, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import ModuleEmptyState from "@/components/layout/ModuleEmptyState"
import ModuleSurface from "@/components/layout/ModuleSurface"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  CASE_TYPE_LABELS,
  WORKFLOW_STATE_LABELS,
  type IntegrityCaseDTO,
} from "@/lib/reportes-integridad"

function ageLabel(detectedAt: string): string {
  const hours = Math.max(
    0,
    Math.floor((Date.now() - new Date(detectedAt).getTime()) / 3_600_000)
  )
  if (hours < 24) return `${hours} h`
  return `${Math.floor(hours / 24)} d`
}

function Severity({ item }: { item: IntegrityCaseDTO }) {
  const high = item.severity === "alta"
  return (
    <Badge
      variant="outline"
      className={
        high
          ? "gap-1 border-rose-300 bg-rose-50 text-rose-800"
          : "gap-1 border-amber-300 bg-amber-50 text-amber-900"
      }
    >
      <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
      {high ? "Alta" : "Media"}
    </Badge>
  )
}

export function IntegrityQueueSkeleton() {
  return (
    <ModuleSurface className="space-y-2 p-3">
      <div aria-label="Cargando cola de Integridad" className="space-y-2">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full" />
        ))}
      </div>
    </ModuleSurface>
  )
}

export default function IntegrityQueue({
  items,
  selectedId,
  total,
  nextCursor,
  loadingMore,
  onOpen,
  onLoadMore,
}: {
  items: IntegrityCaseDTO[]
  selectedId: string | null
  total: number
  nextCursor: string | null
  loadingMore: boolean
  onOpen: (caseId: string, trigger: HTMLButtonElement) => void
  onLoadMore: () => void
}) {
  if (items.length === 0) {
    return (
      <ModuleEmptyState
        icon={ShieldCheck}
        title="Sin excepciones con este corte"
        description="La cobertura y fecha de cálculo permanecen arriba para confirmar que sí hubo una revisión."
      />
    )
  }

  return (
    <section aria-labelledby="integrity-queue-title">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="integrity-queue-title" className="text-base font-semibold text-foreground">
          Cola priorizada
        </h2>
        <span className="font-mono text-sm text-muted-foreground">
          {items.length} de {total}
        </span>
      </div>

      <ModuleSurface className="hidden md:block">
        <Table>
          <caption className="sr-only">
            Casos de Integridad ordenados por severidad, antigüedad e identificador.
          </caption>
          <TableHeader>
            <TableRow className="bg-muted">
              <TableHead scope="col">Severidad / caso</TableHead>
              <TableHead scope="col">Proveedor / referencias</TableHead>
              <TableHead scope="col" className="hidden xl:table-cell">Diferencia</TableHead>
              <TableHead scope="col">Responsable / estado</TableHead>
              <TableHead scope="col" className="hidden lg:table-cell">Antigüedad</TableHead>
              <TableHead scope="col" className="text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow
                key={item.caseId}
                data-selected={selectedId === item.caseId ? "true" : undefined}
                className="data-[selected=true]:bg-muted motion-reduce:transition-none"
              >
                <TableCell className="align-top">
                  <Severity item={item} />
                  <p className="mt-2 max-w-40 break-all font-mono text-xs text-muted-foreground">
                    {item.caseId}
                  </p>
                </TableCell>
                <TableCell className="max-w-64 align-top">
                  <p className="line-clamp-2 font-medium text-foreground">{item.providerName}</p>
                  <p className="mt-1 line-clamp-2 font-mono text-xs text-muted-foreground">
                    {item.localReference ?? "sin orden"} ↔ {item.odooReference ?? "sin factura"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {CASE_TYPE_LABELS[item.type]}
                  </p>
                </TableCell>
                <TableCell className="hidden max-w-64 align-top text-sm text-foreground xl:table-cell">
                  {item.comparison.explanation}
                </TableCell>
                <TableCell className="align-top">
                  <p className="text-sm text-foreground">
                    {item.workflow.assignee?.displayName ?? "Sin asignar"}
                  </p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    {WORKFLOW_STATE_LABELS[item.workflow.state]}
                  </p>
                </TableCell>
                <TableCell className="hidden align-top font-mono text-sm text-muted-foreground lg:table-cell">
                  <span className="inline-flex items-center gap-1">
                    <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                    {ageLabel(item.detectedAt)}
                  </span>
                </TableCell>
                <TableCell className="align-top text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-11"
                    aria-label={`Abrir caso ${item.caseId} de ${item.providerName}`}
                    onClick={(event) => onOpen(item.caseId, event.currentTarget)}
                  >
                    Abrir caso
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ModuleSurface>

      <div className="grid gap-2 md:hidden">
        {items.map((item) => (
          <article
            key={item.caseId}
            className={`rounded-xl border bg-card p-4 shadow-xs ${
              selectedId === item.caseId ? "border-primary" : "border-border"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <Severity item={item} />
              <span className="font-mono text-sm text-muted-foreground">{ageLabel(item.detectedAt)}</span>
            </div>
            <p className="mt-3 line-clamp-2 font-semibold text-foreground">{item.providerName}</p>
            <p className="mt-1 text-sm text-foreground">{CASE_TYPE_LABELS[item.type]}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {WORKFLOW_STATE_LABELS[item.workflow.state]} ·{" "}
              {item.workflow.assignee?.displayName ?? "Sin asignar"}
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 min-h-11 w-full"
              aria-label={`Abrir caso ${item.caseId} de ${item.providerName}`}
              onClick={(event) => onOpen(item.caseId, event.currentTarget)}
            >
              Abrir caso
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </article>
        ))}
      </div>

      {nextCursor && (
        <Button
          type="button"
          variant="outline"
          className="mt-3 min-h-11 w-full"
          disabled={loadingMore}
          onClick={onLoadMore}
        >
          {loadingMore ? "Cargando…" : "Cargar más casos"}
        </Button>
      )}
    </section>
  )
}
