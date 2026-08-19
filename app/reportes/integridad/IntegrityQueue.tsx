'use client'

import { AlertTriangle, ArrowRight, Clock3 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
    <div className="space-y-2 border border-slate-200 bg-white p-3" aria-label="Cargando cola de Integridad">
      {Array.from({ length: 8 }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
    </div>
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
      <div className="border border-slate-200 bg-white px-6 py-14 text-center">
        <h3 className="text-lg font-semibold text-slate-900">
          Sin excepciones con este corte
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          La cobertura y fecha de cálculo permanecen arriba para confirmar que sí hubo una revisión.
        </p>
      </div>
    )
  }

  return (
    <section aria-labelledby="integrity-queue-title">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="integrity-queue-title" className="text-base font-semibold text-slate-900">
          Cola priorizada
        </h2>
        <span className="font-mono text-sm text-slate-600">
          {items.length} de {total}
        </span>
      </div>

      <div className="hidden overflow-hidden border border-slate-200 bg-white md:block">
        <Table>
          <caption className="sr-only">
            Casos de Integridad ordenados por severidad, antigüedad e identificador.
          </caption>
          <TableHeader>
            <TableRow className="bg-slate-50">
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
                className="data-[selected=true]:bg-sky-50 motion-reduce:transition-none"
              >
                <TableCell className="align-top">
                  <Severity item={item} />
                  <p className="mt-2 max-w-40 break-all font-mono text-xs text-slate-600">
                    {item.caseId}
                  </p>
                </TableCell>
                <TableCell className="max-w-64 align-top">
                  <p className="line-clamp-2 font-medium text-slate-900">{item.providerName}</p>
                  <p className="mt-1 line-clamp-2 font-mono text-xs text-slate-600">
                    {item.localReference ?? "sin orden"} ↔ {item.odooReference ?? "sin factura"}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {CASE_TYPE_LABELS[item.type]}
                  </p>
                </TableCell>
                <TableCell className="hidden max-w-64 align-top text-sm text-slate-700 xl:table-cell">
                  {item.comparison.explanation}
                </TableCell>
                <TableCell className="align-top">
                  <p className="text-sm text-slate-700">
                    {item.workflow.assignee?.displayName ?? "Sin asignar"}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-600">
                    {WORKFLOW_STATE_LABELS[item.workflow.state]}
                  </p>
                </TableCell>
                <TableCell className="hidden align-top font-mono text-sm text-slate-600 lg:table-cell">
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
      </div>

      <div className="grid gap-2 md:hidden">
        {items.map((item) => (
          <article
            key={item.caseId}
            className={`border bg-white p-4 ${
              selectedId === item.caseId ? "border-primary" : "border-slate-200"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <Severity item={item} />
              <span className="font-mono text-sm text-slate-600">{ageLabel(item.detectedAt)}</span>
            </div>
            <p className="mt-3 line-clamp-2 font-semibold text-slate-900">{item.providerName}</p>
            <p className="mt-1 text-sm text-slate-700">{CASE_TYPE_LABELS[item.type]}</p>
            <p className="mt-1 text-sm text-slate-600">
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
