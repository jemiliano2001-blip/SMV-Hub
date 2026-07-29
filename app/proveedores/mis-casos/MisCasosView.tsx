'use client'

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CASE_TYPE_LABELS,
  WORKFLOW_STATE_LABELS,
  type OperationalTaskDTO,
} from "@/lib/reportes-integridad"
import {
  executeIntegrityCaseCommand,
  getIntegrityCase,
  IntegrityServiceError,
  listIntegrityCases,
} from "@/lib/services/reportes-integridad"
import { MIS_CASOS_UPDATED_EVENT } from "./MisCasosBadge"

function message(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "No fue posible completar la operación."
}

function TaskDetail({
  task,
  busy,
  status,
  onBack,
  onChanged,
}: {
  task: OperationalTaskDTO
  busy: boolean
  status: string | null
  onBack: () => void
  onChanged: (task: OperationalTaskDTO) => void
}) {
  const [note, setNote] = useState("")
  const [evidenceUrl, setEvidenceUrl] = useState("")
  const [working, setWorking] = useState(false)
  const [localStatus, setLocalStatus] = useState<string | null>(null)

  const execute = async (
    action: "comment" | "start_investigation" | "request_correction"
  ) => {
    setWorking(true)
    setLocalStatus(null)
    try {
      const result = await executeIntegrityCaseCommand({
        caseId: task.caseId,
        expectedRevision: task.revision,
        action,
        ...(action === "comment" && note.trim() ? { note: note.trim() } : {}),
        ...(action === "comment" && evidenceUrl.trim()
          ? { evidenceUrl: evidenceUrl.trim() }
          : {}),
      })
      const refreshed = await getIntegrityCase({ caseId: task.caseId })
      if ("requestedAction" in refreshed) onChanged(refreshed)
      setLocalStatus(result.message)
      if (action === "comment") {
        setNote("")
        setEvidenceUrl("")
      }
    } catch (actionError) {
      setLocalStatus(message(actionError))
    } finally {
      setWorking(false)
    }
  }

  return (
    <article className="border border-slate-200 bg-white" aria-labelledby="own-case-title">
      <header className="border-b border-slate-200 p-4">
        <Button type="button" variant="ghost" className="mb-2 min-h-11 px-2 md:hidden" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a mis casos
        </Button>
        <p className="font-mono text-xs text-slate-500">{task.caseId}</p>
        <h2 id="own-case-title" className="mt-1 text-xl font-semibold text-slate-950">
          {task.requestedAction}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {task.providerName} · {CASE_TYPE_LABELS[task.type]}
        </p>
      </header>

      <div className="space-y-5 p-4">
        <section className="grid gap-2 text-sm text-slate-700" aria-label="Datos de la tarea">
          <p>
            Estado: <strong>{WORKFLOW_STATE_LABELS[task.state]}</strong>
          </p>
          <p>
            Referencia SMV Hub:{" "}
            <span className="font-mono">{task.localReference ?? "Sin referencia"}</span>
          </p>
          <p>
            Referencia Odoo:{" "}
            <span className="font-mono">{task.odooReference ?? "Sin referencia"}</span>
          </p>
          <p>Campo a revisar: {task.affectedField}</p>
          {task.currency && <p>Moneda a revisar: {task.currency}</p>}
        </section>

        <section className="border-t border-slate-200 pt-4" aria-labelledby="own-case-actions">
          <h3 id="own-case-actions" className="text-base font-semibold text-slate-900">
            Actualizar tarea
          </h3>
          <div className="mt-3 grid gap-3">
            <label htmlFor={`own-note-${task.caseId}`} className="text-sm font-medium text-slate-700">
              Comentario
            </label>
            <textarea
              id={`own-note-${task.caseId}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Describe qué revisaste o qué debe corregirse."
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#0369A1]"
            />
            <label htmlFor={`own-url-${task.caseId}`} className="text-sm font-medium text-slate-700">
              URL de evidencia (HTTPS, opcional)
            </label>
            <Input
              id={`own-url-${task.caseId}`}
              type="url"
              value={evidenceUrl}
              onChange={(event) => setEvidenceUrl(event.target.value)}
              placeholder="https://..."
              className="h-11"
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={busy || working || (!note.trim() && !evidenceUrl.trim())}
                onClick={() => void execute("comment")}
              >
                Agregar comentario
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={busy || working || task.state === "investigando"}
                onClick={() => void execute("start_investigation")}
              >
                Marcar en investigación
              </Button>
              <Button
                type="button"
                className="min-h-11"
                disabled={busy || working || task.state === "en_correccion"}
                onClick={() => void execute("request_correction")}
              >
                Solicitar corrección en origen
              </Button>
            </div>
          </div>
        </section>

        <section className="border-t border-slate-200 pt-4" aria-labelledby="own-case-activity">
          <h3 id="own-case-activity" className="text-base font-semibold text-slate-900">
            Actividad
          </h3>
          {task.activity.length === 0 ? (
            <p className="mt-2 text-sm text-slate-600">Aún no hay actividad visible para esta tarea.</p>
          ) : (
            <ol className="mt-3 grid gap-2">
              {task.activity.map((item, index) => (
                <li key={`${item.createdAt}-${index}`} className="border-l-2 border-slate-300 pl-3 text-sm text-slate-700">
                  {item.action.replaceAll("_", " ")} · {item.actorLabel} ·{" "}
                  <span className="font-mono">
                    {new Date(item.createdAt).toLocaleString("es-MX")}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <footer className="flex min-h-14 items-center gap-2 border-t border-slate-200 px-4 py-2">
        {(busy || working) && (
          <span className="inline-flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Guardando…
          </span>
        )}
        <p className="text-sm text-slate-700" aria-live="polite">{localStatus ?? status}</p>
      </footer>
    </article>
  )
}

export default function MisCasosView() {
  const [items, setItems] = useState<OperationalTaskDTO[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<OperationalTaskDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await listIntegrityCases({ scope: "mine", limit: 50 })
      if (response.scope !== "mine") throw new Error("Respuesta de alcance inesperada.")
      setItems(response.items)
      window.dispatchEvent(new Event(MIS_CASOS_UPDATED_EVENT))
    } catch (loadError) {
      setError(message(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  const open = async (caseId: string) => {
    setSelectedId(caseId)
    setDetailLoading(true)
    setError(null)
    try {
      const response = await getIntegrityCase({ caseId })
      if (!("requestedAction" in response)) {
        throw new Error("El servidor devolvió un detalle no redactado.")
      }
      setDetail(response)
    } catch (loadError) {
      if (
        loadError instanceof IntegrityServiceError &&
        loadError.details?.code === "PERMISSION_DENIED"
      ) {
        setItems((current) => current.filter((item) => item.caseId !== caseId))
        setSelectedId(null)
        setDetail(null)
        setStatus("El caso fue reasignado y ya no forma parte de tus tareas.")
      } else {
        setError(message(loadError))
      }
    } finally {
      setDetailLoading(false)
    }
  }

  const changed = async (next: OperationalTaskDTO) => {
    setBusy(true)
    try {
      setDetail(next)
      setItems((current) =>
        current.map((item) => (item.caseId === next.caseId ? next : item))
      )
      setStatus("La actualización quedó registrada para que Finanzas continúe.")
      window.dispatchEvent(new Event(MIS_CASOS_UPDATED_EVENT))
      await load()
    } catch (changeError) {
      setStatus(message(changeError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-[1200px] px-4 py-6">
      <Link
        href="/proveedores"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[#0369A1] underline underline-offset-4"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Volver a Proveedores
      </Link>
      <div className="mt-3 flex items-start gap-3">
        <ClipboardCheck className="mt-1 h-6 w-6 text-[#0369A1]" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Mis casos asignados</h1>
          <p className="mt-1 text-sm text-slate-600">
            Tareas concretas para revisar y corregir datos en origen. Esta vista solo muestra la información necesaria para actuar.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 grid gap-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="mt-6 grid place-items-center border border-rose-200 bg-white p-8 text-center">
          <AlertCircle className="h-7 w-7 text-rose-700" aria-hidden="true" />
          <p className="mt-3 text-sm text-slate-700">{error}</p>
          <Button type="button" className="mt-4 min-h-11" onClick={() => void load()}>
            Reintentar
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 border border-slate-200 bg-white px-6 py-14 text-center">
          <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-700" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-semibold text-slate-900">
            No tienes casos asignados
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Cuando Finanzas asigne una corrección, aparecerá aquí.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,42fr)_minmax(420px,58fr)]">
          <section className={selectedId ? "hidden md:block" : "block"} aria-labelledby="own-cases-list">
            <h2 id="own-cases-list" className="mb-2 text-base font-semibold text-slate-900">
              {items.length} {items.length === 1 ? "tarea" : "tareas"}
            </h2>
            <div className="grid gap-2">
              {items.map((task) => (
                <article key={task.caseId} className="border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{WORKFLOW_STATE_LABELS[task.state]}</Badge>
                    <span className="font-mono text-xs text-slate-500">{task.caseId}</span>
                  </div>
                  <h3 className="mt-2 font-semibold text-slate-900">{task.providerName}</h3>
                  <p className="mt-1 text-sm text-slate-700">{task.requestedAction}</p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 min-h-11 w-full"
                    onClick={() => void open(task.caseId)}
                  >
                    Abrir tarea
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </article>
              ))}
            </div>
          </section>

          <section className={selectedId ? "block" : "hidden md:block"} aria-label="Detalle de tarea">
            {detailLoading ? (
              <div className="grid gap-3 border border-slate-200 bg-white p-4">
                <Skeleton className="h-7 w-3/4" />
                <Skeleton className="h-40 w-full" />
              </div>
            ) : detail ? (
              <TaskDetail
                task={detail}
                busy={busy}
                status={status}
                onBack={() => {
                  setSelectedId(null)
                  setDetail(null)
                }}
                onChanged={(next) => void changed(next)}
              />
            ) : (
              <div className="hidden min-h-64 place-items-center border border-slate-200 bg-white p-8 text-center text-sm text-slate-600 md:grid">
                Selecciona una tarea para ver qué revisar.
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  )
}
