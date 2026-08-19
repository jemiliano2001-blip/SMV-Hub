'use client'

import { useState } from "react"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CASE_TYPE_LABELS,
  WORKFLOW_STATE_LABELS,
  type CaseCommandAction,
  type CaseCommandInput,
  type IntegrityCaseDTO,
} from "@/lib/reportes-integridad"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type CommandDraft = Omit<
  CaseCommandInput,
  "caseId" | "expectedRevision" | "commandId"
> & { action: CaseCommandAction }

function money(value: number | null, currency: string): string {
  if (value == null) return "Sin dato"
  try {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: currency || "MXN",
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${value.toLocaleString("es-MX")} ${currency}`
  }
}

function dateTime(value: string): string {
  return new Date(value).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function Evidence({
  detail,
}: {
  detail: IntegrityCaseDTO
}) {
  const local = detail.evidence.local
  const odoo = detail.evidence.odoo
  const currencyMismatch = detail.type === "currency_mismatch"
  const amountMismatch = detail.type === "diferencia_importe"
  return (
    <section className="border-t border-slate-200 pt-4" aria-labelledby="case-evidence-title">
      <h3 id="case-evidence-title" className="text-base font-semibold text-slate-900">
        Evidencia de la corrida
      </h3>
      <div
        className="mt-3 overflow-x-auto border border-slate-200"
        tabIndex={0}
        role="region"
        aria-label="Comparación de evidencia; desplázate horizontalmente si es necesario"
      >
        <Table className="w-full min-w-[520px] text-left text-sm">
          <TableHeader className="bg-slate-50 text-slate-600">
            <TableRow>
              <TableHead scope="col" className="px-3 py-2 font-medium">Campo</TableHead>
              <TableHead scope="col" className="px-3 py-2 font-medium">SMV Hub</TableHead>
              <TableHead scope="col" className="px-3 py-2 font-medium">Odoo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-200">
            <TableRow>
              <TableHead scope="row" className="px-3 py-2 font-medium text-slate-700">Documento</TableHead>
              <TableCell className="px-3 py-2 font-mono">{local?.invoiceNumber ?? "Sin orden"}</TableCell>
              <TableCell className="px-3 py-2 font-mono">{odoo?.invoiceNumber ?? "Sin factura"}</TableCell>
            </TableRow>
            <TableRow>
              <TableHead scope="row" className="px-3 py-2 font-medium text-slate-700">Proveedor</TableHead>
              <TableCell className="px-3 py-2">{local?.providerName ?? "—"}</TableCell>
              <TableCell className="px-3 py-2">{odoo?.providerName ?? "—"}</TableCell>
            </TableRow>
            <TableRow className={currencyMismatch ? "bg-rose-50" : undefined}>
              <TableHead scope="row" className="px-3 py-2 font-medium text-slate-700">Moneda</TableHead>
              <TableCell className="px-3 py-2 font-mono">{local?.currency || "—"}</TableCell>
              <TableCell className="px-3 py-2 font-mono">{odoo?.currency || "—"}</TableCell>
            </TableRow>
            <TableRow className={amountMismatch ? "bg-amber-50" : undefined}>
              <TableHead scope="row" className="px-3 py-2 font-medium text-slate-700">Total</TableHead>
              <TableCell className="px-3 py-2 font-mono">
                {money(local?.total ?? null, local?.currency ?? detail.currency ?? "")}
              </TableCell>
              <TableCell className="px-3 py-2 font-mono">
                {money(odoo?.total ?? null, odoo?.currency ?? detail.currency ?? "")}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <p className="mt-2 text-sm text-slate-600">
        Regla: {detail.ruleLabel} · revisión{" "}
        <span className="font-mono">{detail.sourceRevision}</span>
      </p>
    </section>
  )
}

function CaseActions({
  detail,
  fresh,
  busy,
  onCommand,
}: {
  detail: IntegrityCaseDTO
  fresh: boolean
  busy: boolean
  onCommand: (draft: CommandDraft) => Promise<void>
}) {
  const [note, setNote] = useState("")
  const [evidenceUrl, setEvidenceUrl] = useState("")
  const [reason, setReason] = useState("")
  const [assigneeUid, setAssigneeUid] = useState(
    detail.workflow.assignee?.uid ?? ""
  )
  const [candidateIndex, setCandidateIndex] = useState<number | null>(null)
  const closed =
    detail.workflow.state === "resuelta" || detail.workflow.state === "descartada"
  const canLink =
    detail.type === "coincidencia_ambigua" || detail.type === "duplicado"

  const send = async (draft: CommandDraft) => {
    await onCommand(draft)
    if (draft.action === "comment") {
      setNote("")
      setEvidenceUrl("")
    }
    if (draft.action === "discard") setReason("")
  }

  if (closed) {
    return (
      <div className="border-t border-slate-200 pt-4">
        <p className="inline-flex items-center gap-2 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Este caso está {WORKFLOW_STATE_LABELS[detail.workflow.state].toLowerCase()}.
        </p>
      </div>
    )
  }

  return (
    <section className="border-t border-slate-200 pt-4" aria-labelledby="case-actions-title">
      <h3 id="case-actions-title" className="text-base font-semibold text-slate-900">
        Siguiente acción
      </h3>
      {!fresh && (
        <p id="stale-actions-help" className="mt-2 text-sm font-medium text-amber-900">
          Actualiza la evidencia para resolver, descartar o vincular. Las acciones operativas siguen disponibles.
        </p>
      )}

      <div className="mt-4 grid gap-4">
        <div className="grid gap-2 border-b border-slate-200 pb-4">
          <label htmlFor={`assignee-${detail.caseId}`} className="text-sm font-medium text-slate-700">
            Responsable
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={assigneeUid} onValueChange={setAssigneeUid}>
              <SelectTrigger id={`assignee-${detail.caseId}`} className="h-11 w-full bg-white">
                <SelectValue placeholder="Seleccionar responsable" />
              </SelectTrigger>
              <SelectContent>
                {detail.eligibleAssignees.map((assignee) => (
                  <SelectItem key={assignee.uid} value={assignee.uid}>
                    {assignee.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={busy || !assigneeUid || assigneeUid === detail.workflow.assignee?.uid}
              onClick={() => send({ action: "assign", assigneeUid })}
            >
              Asignar
            </Button>
          </div>
        </div>

        <div className="grid gap-2 border-b border-slate-200 pb-4">
          <label htmlFor={`note-${detail.caseId}`} className="text-sm font-medium text-slate-700">
            Nota o comentario
          </label>
          <textarea
            id={`note-${detail.caseId}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Describe lo revisado y el siguiente paso."
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <label htmlFor={`evidence-${detail.caseId}`} className="text-sm font-medium text-slate-700">
            URL de evidencia (HTTPS, opcional)
          </label>
          <Input
            id={`evidence-${detail.caseId}`}
            type="url"
            value={evidenceUrl}
            onChange={(event) => setEvidenceUrl(event.target.value)}
            placeholder="https://..."
            className="h-11"
          />
          <Button
            type="button"
            variant="outline"
            className="min-h-11 justify-self-start"
            disabled={busy || (!note.trim() && !evidenceUrl.trim())}
            onClick={() =>
              send({
                action: "comment",
                ...(note.trim() ? { note: note.trim() } : {}),
                ...(evidenceUrl.trim() ? { evidenceUrl: evidenceUrl.trim() } : {}),
              })
            }
          >
            Agregar nota
          </Button>
        </div>

        <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={busy || detail.workflow.state === "investigando"}
            onClick={() => send({ action: "start_investigation" })}
          >
            Pasar a investigación
          </Button>
          <Button
            type="button"
            className="min-h-11"
            disabled={busy || detail.workflow.state === "en_correccion"}
            onClick={() => send({ action: "request_correction" })}
          >
            Solicitar corrección
          </Button>
        </div>

        {canLink && (
          <fieldset className="grid gap-3 border-b border-slate-200 pb-4">
            <legend className="text-sm font-semibold text-slate-900">
              Vincular documentos por comparación
            </legend>
            {detail.candidates.map((candidate, index) => (
              <label
                key={`${candidate.localOrderId}-${candidate.odooInvoiceId}-${index}`}
                className="flex cursor-pointer gap-3 border border-slate-200 p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-sky-50"
              >
                <input
                  type="radio"
                  name={`candidate-${detail.caseId}`}
                  checked={candidateIndex === index}
                  onChange={() => setCandidateIndex(index)}
                  className="mt-1 h-4 w-4"
                />
                <span>
                  <span className="block font-medium text-slate-900">
                    {candidate.reference} · {candidate.providerName}
                  </span>
                  <span className="mt-1 block text-slate-600">
                    {candidate.companyLabel} · {candidate.date ?? "sin fecha"} ·{" "}
                    <span className="font-mono">
                      {money(candidate.amount, candidate.currency)}
                    </span>
                  </span>
                </span>
              </label>
            ))}
            <Button
              type="button"
              variant="outline"
              className="min-h-11 justify-self-start"
              disabled={busy || !fresh || candidateIndex == null}
              aria-describedby={!fresh ? "stale-actions-help" : undefined}
              onClick={() => {
                const candidate = candidateIndex == null ? null : detail.candidates[candidateIndex]
                if (
                  !candidate?.localOrderId ||
                  !candidate.odooInvoiceId ||
                  candidate.odooCompanyId == null
                ) return
                void send({
                  action: "manual_link",
                  localOrderId: candidate.localOrderId,
                  odooInvoiceId: candidate.odooInvoiceId,
                  odooCompanyId: candidate.odooCompanyId,
                  sourceRevision: detail.sourceRevision,
                })
              }}
            >
              <Link2 className="h-4 w-4" aria-hidden="true" />
              Confirmar vínculo
            </Button>
          </fieldset>
        )}

        <div className="grid gap-2">
          <Button
            type="button"
            className="min-h-11 justify-self-start bg-emerald-700 hover:bg-emerald-800"
            disabled={busy || !fresh}
            aria-describedby={!fresh ? "stale-actions-help" : undefined}
            onClick={() => send({ action: "resolve" })}
          >
            Resolver
          </Button>
          <label htmlFor={`discard-${detail.caseId}`} className="text-sm font-medium text-slate-700">
            Motivo para descartar
          </label>
          <textarea
            id={`discard-${detail.caseId}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Explica por qué no debe tratarse como excepción."
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button
            type="button"
            variant="destructive"
            className="min-h-11 justify-self-start"
            disabled={busy || !fresh || !reason.trim()}
            aria-describedby={!fresh ? "stale-actions-help" : undefined}
            onClick={() => send({ action: "discard", reason: reason.trim() })}
          >
            Descartar con motivo
          </Button>
        </div>
      </div>
    </section>
  )
}

export function IntegrityInspectorSkeleton() {
  return (
    <div className="grid gap-4 p-4" aria-label="Cargando detalle del caso">
      <Skeleton className="h-7 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-36 w-full" />
    </div>
  )
}

export default function IntegrityInspector({
  detail,
  loading,
  error,
  fresh,
  busy,
  message,
  onRetry,
  onBack,
  onCommand,
  onNext,
}: {
  detail: IntegrityCaseDTO | null
  loading: boolean
  error: string | null
  fresh: boolean
  busy: boolean
  message: string | null
  onRetry: () => void
  onBack?: () => void
  onCommand: (draft: CommandDraft) => Promise<void>
  onNext?: () => void
}) {
  if (loading) return <IntegrityInspectorSkeleton />
  if (error) {
    return (
      <div className="grid place-items-center gap-3 p-8 text-center">
        <AlertCircle className="h-7 w-7 text-rose-700" aria-hidden="true" />
        <p className="text-sm text-slate-700">{error}</p>
        <Button type="button" variant="outline" className="min-h-11" onClick={onRetry}>
          Reintentar
        </Button>
      </div>
    )
  }
  if (!detail) return null

  return (
    <article className="flex min-h-0 flex-col bg-white" aria-labelledby="case-inspector-title">
      <header className="border-b border-slate-200 p-4">
        {onBack && (
          <Button type="button" variant="ghost" className="mb-2 min-h-11 px-2" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver a la cola
          </Button>
        )}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-mono text-xs text-slate-500">{detail.caseId}</p>
            <h2 id="case-inspector-title" className="mt-1 text-xl font-semibold text-slate-950">
              {detail.comparison.explanation}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {detail.providerName} · {CASE_TYPE_LABELS[detail.type]}
            </p>
          </div>
          <div className="flex gap-2">
            <Badge
              variant="outline"
              className={
                detail.severity === "alta"
                  ? "border-rose-300 bg-rose-50 text-rose-800"
                  : "border-amber-300 bg-amber-50 text-amber-900"
              }
            >
              Severidad {detail.severity}
            </Badge>
            <Badge variant="secondary">
              {WORKFLOW_STATE_LABELS[detail.workflow.state]}
            </Badge>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <section aria-label="Workflow actual" className="grid gap-1 text-sm text-slate-700">
          <p>
            Responsable:{" "}
            <strong>{detail.workflow.assignee?.displayName ?? "Sin asignar"}</strong>
          </p>
          <p>
            Revisión <span className="font-mono">{detail.workflow.revision}</span> · actualizado{" "}
            <span className="font-mono">{dateTime(detail.workflow.updatedAt)}</span>
          </p>
          {detail.workflow.lastNote && <p>Última nota: {detail.workflow.lastNote}</p>}
          {detail.workflow.evidenceUrl && (
            <a
              href={detail.workflow.evidenceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1 font-medium text-primary underline underline-offset-4"
            >
              Abrir evidencia
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          )}
        </section>

        <Evidence detail={detail} />

        <CaseActions
          key={`${detail.caseId}-${detail.workflow.assignee?.uid ?? "unassigned"}`}
          detail={detail}
          fresh={fresh}
          busy={busy}
          onCommand={onCommand}
        />

        <section className="border-t border-slate-200 pt-4" aria-labelledby="case-history-title">
          <h3 id="case-history-title" className="text-base font-semibold text-slate-900">
            Historial append-only
          </h3>
          {detail.history.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">Aún no hay actividad humana registrada.</p>
          ) : (
            <ol className="mt-3 grid gap-3">
              {detail.history.map((event) => (
                <li key={event.eventId} className="border-l-2 border-slate-300 pl-3 text-sm">
                  <p className="font-medium text-slate-900">{event.action.replaceAll("_", " ")}</p>
                  <p className="mt-1 text-slate-600">
                    {event.actorLabel} · <span className="font-mono">{dateTime(event.createdAt)}</span>
                  </p>
                  {event.note && <p className="mt-1 text-slate-700">{event.note}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <footer className="sticky bottom-0 flex items-center gap-2 border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {busy && (
          <span className="inline-flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Guardando…
          </span>
        )}
        <p className="text-sm text-slate-700" aria-live="polite">
          {message}
        </p>
        {onNext && (
          <Button type="button" variant="outline" className="ml-auto min-h-11" onClick={onNext}>
            Siguiente caso
          </Button>
        )}
      </footer>
    </article>
  )
}

export type { CommandDraft }
