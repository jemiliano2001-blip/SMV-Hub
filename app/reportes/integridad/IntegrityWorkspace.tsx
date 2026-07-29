'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { AlertCircle, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import type {
  CaseCommandInput,
  IntegrityCaseDTO,
  TrustEnvelopeDTO,
} from "@/lib/reportes-integridad"
import {
  executeIntegrityCaseCommand,
  getIntegrityCase,
  IntegrityServiceError,
  listIntegrityCases,
} from "@/lib/services/reportes-integridad"
import {
  integritySyncResultMessage,
  integrityUnavailableCopy,
} from "@/lib/reportes-integridad-copy"
import { sincronizarComprasOdoo } from "@/lib/services/compras-odoo-sync"
import IntegrityFilters, {
  DEFAULT_FILTERS,
  type FilterSelection,
} from "./IntegrityFilters"
import IntegrityInspector, {
  type CommandDraft,
} from "./IntegrityInspector"
import IntegrityQueue, {
  IntegrityQueueSkeleton,
} from "./IntegrityQueue"
import { TrustLedger } from "./TrustLedger"

type Viewport = "mobile" | "tablet" | "desktop"

function currentViewport(): Viewport {
  if (typeof window === "undefined") return "desktop"
  if (window.innerWidth < 768) return "mobile"
  if (window.innerWidth < 1280) return "tablet"
  return "desktop"
}

function subscribeViewport(onStoreChange: () => void): () => void {
  window.addEventListener("resize", onStoreChange)
  return () => window.removeEventListener("resize", onStoreChange)
}

function filtersPayload(filters: FilterSelection) {
  return {
    state: filters.state === "all" ? [] : [filters.state],
    severity: filters.severity === "all" ? [] : [filters.severity],
    type: filters.type === "all" ? [] : [filters.type],
    currency: filters.currency === "all" ? [] : [filters.currency],
  }
}

function safeMessage(error: unknown): string {
  if (error instanceof IntegrityServiceError) return error.message
  return error instanceof Error
    ? error.message
    : "No fue posible completar la operación."
}

export default function IntegrityWorkspace() {
  const viewport = useSyncExternalStore<Viewport | null>(
    subscribeViewport,
    currentViewport,
    () => null
  )
  const [filters, setFilters] = useState<FilterSelection>(DEFAULT_FILTERS)
  const [items, setItems] = useState<IntegrityCaseDTO[]>([])
  const [trust, setTrust] = useState<TrustEnvelopeDTO | null>(null)
  const [total, setTotal] = useState(0)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<IntegrityCaseDTO | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const loadDetail = useCallback(async (caseId: string, runId?: string) => {
    setDetailLoading(true)
    setDetailError(null)
    try {
      const response = await getIntegrityCase({ caseId, runId })
      if (!("evidence" in response)) {
        throw new Error("El servidor devolvió un detalle redactado inesperado.")
      }
      setDetail(response)
    } catch (loadError) {
      setDetail(null)
      setDetailError(safeMessage(loadError))
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const loadList = useCallback(
    async (reset = true, explicitCursor?: string) => {
      if (reset) {
        setLoading(true)
        setError(null)
      } else {
        setLoadingMore(true)
      }
      try {
        const response = await listIntegrityCases({
          scope: "all",
          filters: filtersPayload(filters),
          cursor: explicitCursor,
          limit: 25,
        })
        if (response.scope !== "all") throw new Error("Respuesta de alcance inesperada.")
        setTrust(response.trust)
        setTotal(response.total)
        setNextCursor(response.nextCursor)
        setItems((previous) => (reset ? response.items : [...previous, ...response.items]))

        if (reset) {
          const previousStillExists =
            selectedId != null &&
            response.items.some((item) => item.caseId === selectedId)
          const nextId = previousStillExists ? selectedId : null
          setSelectedId(nextId)
          if (nextId) {
            void loadDetail(nextId, response.trust.activeRunId ?? undefined)
          } else {
            setDetail(null)
            setDetailError(null)
          }
        }
      } catch (loadError) {
        if (reset) {
          setItems([])
          setTrust(null)
          setError(safeMessage(loadError))
        }
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [filters, loadDetail, selectedId]
  )

  useEffect(() => {
    void Promise.resolve().then(() => loadList(true))
  }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (
      viewport !== "desktop" ||
      loading ||
      selectedId != null ||
      items.length === 0
    ) {
      return
    }
    const first = items[0]
    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return
      setSelectedId(first.caseId)
      void loadDetail(first.caseId, trust?.activeRunId ?? undefined)
    })
    return () => {
      cancelled = true
    }
  }, [items, loadDetail, loading, selectedId, trust?.activeRunId, viewport])

  const openCase = (caseId: string, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger
    setSelectedId(caseId)
    setMessage(null)
    void loadDetail(caseId, trust?.activeRunId ?? undefined)
  }

  const closeResponsiveDetail = () => {
    setSelectedId(null)
    setDetail(null)
    setDetailError(null)
    window.setTimeout(() => triggerRef.current?.focus(), 0)
  }

  const runCommand = async (draft: CommandDraft) => {
    if (!detail) return
    setBusy(true)
    setMessage(null)
    try {
      const input: Omit<CaseCommandInput, "commandId"> = {
        ...draft,
        caseId: detail.caseId,
        expectedRevision: detail.workflow.revision,
      }
      const result = await executeIntegrityCaseCommand(input)
      setMessage(result.message)
      await Promise.all([
        loadDetail(detail.caseId, trust?.activeRunId ?? undefined),
        loadList(true),
      ])
    } catch (commandError) {
      setMessage(safeMessage(commandError))
      if (
        commandError instanceof IntegrityServiceError &&
        commandError.details?.refreshRequired
      ) {
        await loadDetail(detail.caseId, trust?.activeRunId ?? undefined)
      }
    } finally {
      setBusy(false)
    }
  }

  const nextCase = () => {
    if (!selectedId) return
    const index = items.findIndex((item) => item.caseId === selectedId)
    const next = items[index + 1] ?? items[0]
    if (!next || next.caseId === selectedId) return
    setSelectedId(next.caseId)
    setMessage(null)
    void loadDetail(next.caseId, trust?.activeRunId ?? undefined)
  }

  const sync = async () => {
    setSyncing(true)
    setMessage(null)
    try {
      const result = await sincronizarComprasOdoo()
      setMessage(integritySyncResultMessage(result.integrityErrorCode))
      await loadList(true)
    } catch (syncError) {
      const text = safeMessage(syncError)
      setMessage(
        /already-exists|en curso/i.test(text)
          ? "Sincronización en curso. El último corte válido permanece visible."
          : text
      )
    } finally {
      setSyncing(false)
    }
  }

  if (loading && !trust) {
    return (
      <div className="space-y-4">
        <div className="space-y-2 border-y border-slate-200 bg-white p-4">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-4 w-full max-w-3xl" />
        </div>
        <IntegrityQueueSkeleton />
      </div>
    )
  }

  if (error && !trust) {
    return (
      <div className="grid min-h-80 place-items-center border border-rose-200 bg-white p-8 text-center">
        <div>
          <AlertCircle className="mx-auto h-8 w-8 text-rose-700" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-semibold text-slate-900">
            No se pudo cargar Integridad
          </h2>
          <p className="mt-2 max-w-xl text-sm text-slate-700">{error}</p>
          <Button type="button" className="mt-4 min-h-11" onClick={() => void loadList(true)}>
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  if (!trust) return null
  const unavailable = integrityUnavailableCopy(trust)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <ShieldCheck className="h-5 w-5 text-[#0369A1]" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-semibold text-slate-950">Integridad del gasto</h1>
          <p className="text-sm text-slate-600">
            Excepciones entre órdenes de SMV Hub y facturas posted de Odoo.
          </p>
        </div>
      </div>

      <TrustLedger trust={trust} syncing={syncing} onSync={() => void sync()} />
      {message && (
        <p
          className="border-y border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-950"
          role="status"
          aria-live="polite"
        >
          {message}
        </p>
      )}

      <IntegrityFilters
        filters={filters}
        currencies={trust.currencyScopes}
        onChange={setFilters}
      />

      {!trust.activeRunId ? (
        <div className="border border-slate-200 bg-white px-6 py-14 text-center">
          <h2 className="text-lg font-semibold text-slate-900">
            {unavailable.title}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {unavailable.description}
          </p>
        </div>
      ) : (
        <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,58fr)_minmax(480px,42fr)]">
          <IntegrityQueue
            items={items}
            selectedId={selectedId}
            total={total}
            nextCursor={nextCursor}
            loadingMore={loadingMore}
            onOpen={openCase}
            onLoadMore={() => void loadList(false, nextCursor ?? undefined)}
          />

          {viewport === "desktop" && items.length > 0 && (
            <aside className="sticky top-20 max-h-[calc(100vh-6rem)] min-h-[560px] overflow-hidden border border-slate-200 bg-white">
              <IntegrityInspector
                detail={detail}
                loading={detailLoading}
                error={detailError}
                fresh={trust.sourceStatus === "current"}
                busy={busy}
                message={message}
                onRetry={() => selectedId && void loadDetail(selectedId, trust.activeRunId ?? undefined)}
                onCommand={runCommand}
                onNext={items.length > 1 ? nextCase : undefined}
              />
            </aside>
          )}
        </div>
      )}

      {viewport === "tablet" && (
        <Sheet open={selectedId != null} onOpenChange={(open) => !open && closeResponsiveDetail()}>
          <SheetContent
            side="right"
            className="w-[90vw] max-w-[560px] gap-0 overflow-hidden p-0 motion-reduce:duration-0"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Detalle del caso de Integridad</SheetTitle>
              <SheetDescription>
                Evidencia y acciones del workflow seleccionado.
              </SheetDescription>
            </SheetHeader>
            <IntegrityInspector
              detail={detail}
              loading={detailLoading}
              error={detailError}
              fresh={trust.sourceStatus === "current"}
              busy={busy}
              message={message}
              onRetry={() => selectedId && void loadDetail(selectedId, trust.activeRunId ?? undefined)}
              onCommand={runCommand}
              onNext={items.length > 1 ? nextCase : undefined}
            />
          </SheetContent>
        </Sheet>
      )}

      {viewport === "mobile" && selectedId && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-white">
          <IntegrityInspector
            detail={detail}
            loading={detailLoading}
            error={detailError}
            fresh={trust.sourceStatus === "current"}
            busy={busy}
            message={message}
            onRetry={() => void loadDetail(selectedId, trust.activeRunId ?? undefined)}
            onBack={closeResponsiveDetail}
            onCommand={runCommand}
            onNext={items.length > 1 ? nextCase : undefined}
          />
        </div>
      )}
    </div>
  )
}
