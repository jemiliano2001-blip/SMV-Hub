import { createHash, randomUUID } from "node:crypto"
import {
  FieldValue,
  Timestamp,
  type DocumentData,
  type DocumentSnapshot,
  type Firestore,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore"
import type {
  IntegrityErrorCode,
  IntegrityMode,
  IntegrityWorkflowState,
  TrustEnvelopeDTO,
  WorkflowEventDTO,
} from "./contratos"
import type {
  IntegrityEngineResult,
  LocalOrderSnapshot,
  OdooBillSnapshot,
  PersistedManualLink,
  RunCaseEvidence,
} from "./motor"
import { IntegrityDomainError } from "./errores"

export const INTEGRITY_CONFIG_DEFAULTS = {
  mode: "off" as IntegrityMode,
  pilotAllowlistUids: [] as string[],
  executiveOwner: "",
  financeOwner: "",
  purchasingOwner: "",
  ruleVersion: "integrity-v1",
  tolerancePct: 2,
  scheduleIntervalMinutes: 120,
}

export type IntegrityConfig = typeof INTEGRITY_CONFIG_DEFAULTS

export type WorkflowDocument = {
  caseId: string
  state: IntegrityWorkflowState
  revision: number
  assigneeUid: string | null
  assigneeDisplayName: string | null
  assigneeEmail: string | null
  lastNote: string | null
  evidenceUrl: string | null
  manualLink: (PersistedManualLink & {
    linkedAt: string
    linkedByUid: string
  }) | null
  lastSourceRevision: string
  lastRunId: string
  lastLocalOrderId: string | null
  lastOdooInvoiceId: string | null
  detectedAt: string
  updatedAt: Timestamp
  updatedBy: string
  lastCommandId: string | null
}

export type ActiveStateDocument = {
  activeRunId?: string | null
  lastValidSyncId?: string | null
  lastAttemptAt?: Timestamp | null
  lastSuccessAt?: Timestamp | null
  health?: "current" | "failed" | "unavailable"
  safeErrorCode?: IntegrityErrorCode | null
}

export type IntegrityRunDocument = {
  runId: string
  status: "staging" | "ready" | "failed"
  syncId: string
  ruleVersion: string
  computedAt: Timestamp
  staleAfter: Timestamp
  sourceCounts: {
    localOrders: number
    odooPurchaseOrders: number
    odooBills: number
  }
  caseCount: number
  coverage: IntegrityEngineResult["coverage"]
  currencyScopes: string[]
  excludedCounts: IntegrityEngineResult["excludedCounts"]
  summary: IntegrityEngineResult["summary"]
  delta: IntegrityEngineResult["delta"]
  checksum: string
  commits: number
  durationMs: number
  expireAt: Timestamp
  failureCode?: IntegrityErrorCode
}

export type IntegrityLease = {
  ownerInvocationId: string
  kind: "manual" | "scheduled"
  acquiredAt: Timestamp
  heartbeatAt: Timestamp
  expiresAt: Timestamp
}

function asDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate()
  if (value instanceof Date) return value
  if (typeof value === "string") {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

function asIso(value: unknown, fallback = new Date(0)): string {
  return (asDate(value) ?? fallback).toISOString()
}

function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

export function workflowFromSnapshot(
  doc: DocumentSnapshot<DocumentData>
): WorkflowDocument | null {
  if (!doc.exists) return null
  const data = doc.data()!
  const state = data.state
  if (
    ![
      "abierta",
      "investigando",
      "en_correccion",
      "resuelta",
      "descartada",
      "reabierta",
    ].includes(state)
  ) {
    return null
  }
  return {
    caseId: doc.id,
    state,
    revision:
      typeof data.revision === "number" && data.revision > 0
        ? Math.trunc(data.revision)
        : 1,
    assigneeUid: typeof data.assigneeUid === "string" ? data.assigneeUid : null,
    assigneeDisplayName:
      typeof data.assigneeDisplayName === "string" ? data.assigneeDisplayName : null,
    assigneeEmail:
      typeof data.assigneeEmail === "string" ? data.assigneeEmail : null,
    lastNote: typeof data.lastNote === "string" ? data.lastNote : null,
    evidenceUrl: typeof data.evidenceUrl === "string" ? data.evidenceUrl : null,
    manualLink:
      data.manualLink &&
      typeof data.manualLink.localOrderId === "string" &&
      typeof data.manualLink.odooInvoiceId === "string"
        ? {
            localOrderId: data.manualLink.localOrderId,
            odooInvoiceId: data.manualLink.odooInvoiceId,
            odooCompanyId: Number(data.manualLink.odooCompanyId),
            sourceRevision: String(data.manualLink.sourceRevision ?? ""),
            linkedAt: String(data.manualLink.linkedAt ?? ""),
            linkedByUid: String(data.manualLink.linkedByUid ?? ""),
          }
        : null,
    lastSourceRevision: String(data.lastSourceRevision ?? ""),
    lastRunId: String(data.lastRunId ?? ""),
    lastLocalOrderId:
      typeof data.lastLocalOrderId === "string" ? data.lastLocalOrderId : null,
    lastOdooInvoiceId:
      typeof data.lastOdooInvoiceId === "string" ? data.lastOdooInvoiceId : null,
    detectedAt:
      typeof data.detectedAt === "string"
        ? data.detectedAt
        : asIso(data.updatedAt, new Date()),
    updatedAt:
      data.updatedAt instanceof Timestamp ? data.updatedAt : Timestamp.fromDate(new Date()),
    updatedBy: String(data.updatedBy ?? "system"),
    lastCommandId:
      typeof data.lastCommandId === "string" ? data.lastCommandId : null,
  }
}

export async function readIntegrityConfig(db: Firestore): Promise<IntegrityConfig> {
  const snapshot = await db.collection("reportes_integridad_state").doc("config").get()
  if (!snapshot.exists) return { ...INTEGRITY_CONFIG_DEFAULTS }
  const data = snapshot.data() ?? {}
  const parsedMode = ["off", "shadow", "pilot", "on"].includes(data.mode)
    ? (data.mode as IntegrityMode)
    : INTEGRITY_CONFIG_DEFAULTS.mode
  return {
    mode: parsedMode,
    pilotAllowlistUids: Array.isArray(data.pilotAllowlistUids)
      ? data.pilotAllowlistUids.filter(
          (value: unknown): value is string => typeof value === "string"
        )
      : [],
    executiveOwner:
      typeof data.executiveOwner === "string" ? data.executiveOwner : "",
    financeOwner: typeof data.financeOwner === "string" ? data.financeOwner : "",
    purchasingOwner:
      typeof data.purchasingOwner === "string" ? data.purchasingOwner : "",
    ruleVersion:
      typeof data.ruleVersion === "string" && data.ruleVersion
        ? data.ruleVersion
        : INTEGRITY_CONFIG_DEFAULTS.ruleVersion,
    tolerancePct:
      typeof data.tolerancePct === "number" && data.tolerancePct >= 0
        ? data.tolerancePct
        : INTEGRITY_CONFIG_DEFAULTS.tolerancePct,
    scheduleIntervalMinutes:
      typeof data.scheduleIntervalMinutes === "number" &&
      data.scheduleIntervalMinutes > 0
        ? data.scheduleIntervalMinutes
        : INTEGRITY_CONFIG_DEFAULTS.scheduleIntervalMinutes,
  }
}

export async function acquireIntegrityLease(
  db: Firestore,
  kind: IntegrityLease["kind"],
  now = new Date(),
  ownerInvocationId: string = randomUUID()
): Promise<IntegrityLease> {
  const ref = db.collection("reportes_integridad_state").doc("lease")
  const lease = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    const current = snapshot.data()
    const expiresAt = asDate(current?.expiresAt)
    if (
      current?.ownerInvocationId &&
      expiresAt &&
      expiresAt.getTime() > now.getTime()
    ) {
      throw new IntegrityDomainError(
        "SYNC_ALREADY_RUNNING",
        "Ya hay una sincronización en curso."
      )
    }
    const next: IntegrityLease = {
      ownerInvocationId,
      kind,
      acquiredAt: Timestamp.fromDate(now),
      heartbeatAt: Timestamp.fromDate(now),
      expiresAt: Timestamp.fromMillis(now.getTime() + 11 * 60_000),
    }
    transaction.set(ref, next)
    return next
  })
  return lease
}

export async function heartbeatIntegrityLease(
  db: Firestore,
  ownerInvocationId: string,
  now = new Date()
): Promise<void> {
  const ref = db.collection("reportes_integridad_state").doc("lease")
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (snapshot.data()?.ownerInvocationId !== ownerInvocationId) {
      throw new IntegrityDomainError(
        "SYNC_ALREADY_RUNNING",
        "La sincronización perdió su lease operativo."
      )
    }
    transaction.update(ref, {
      heartbeatAt: Timestamp.fromDate(now),
      expiresAt: Timestamp.fromMillis(now.getTime() + 11 * 60_000),
    })
  })
}

export async function releaseIntegrityLease(
  db: Firestore,
  ownerInvocationId: string,
  now = new Date()
): Promise<void> {
  const ref = db.collection("reportes_integridad_state").doc("lease")
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref)
    if (snapshot.data()?.ownerInvocationId !== ownerInvocationId) return
    transaction.set(
      ref,
      {
        heartbeatAt: Timestamp.fromDate(now),
        expiresAt: Timestamp.fromDate(now),
        releasedAt: Timestamp.fromDate(now),
      },
      { merge: true }
    )
  })
}

export async function markIntegrityAttempt(
  db: Firestore,
  data: {
    at: Date
    health: "current" | "failed" | "unavailable"
    safeErrorCode: IntegrityErrorCode | null
  }
): Promise<void> {
  await db.collection("reportes_integridad_state").doc("active").set(
    {
      lastAttemptAt: Timestamp.fromDate(data.at),
      health: data.health,
      safeErrorCode: data.safeErrorCode,
    },
    { merge: true }
  )
}

export async function readAllWorkflows(
  db: Firestore
): Promise<Map<string, WorkflowDocument>> {
  const snapshot = await db.collection("reportes_integridad_workflows").get()
  const workflows = new Map<string, WorkflowDocument>()
  for (const doc of snapshot.docs) {
    const workflow = workflowFromSnapshot(doc)
    if (workflow) workflows.set(workflow.caseId, workflow)
  }
  return workflows
}

export async function readLocalOrdersWindow(
  db: Firestore,
  workflows: Map<string, WorkflowDocument>,
  now = new Date()
): Promise<{ orders: LocalOrderSnapshot[]; cutoff: string }> {
  const start = new Date(now)
  start.setUTCFullYear(start.getUTCFullYear() - 1)
  const cutoff = start.toISOString().slice(0, 10)
  const ordenes = db.collection("ordenes")
  const [byCreated, byInvoiceDate] = await Promise.all([
    ordenes.where("creadoEn", ">=", Timestamp.fromDate(start)).get(),
    ordenes.where("fechaFactura", ">=", cutoff).get(),
  ])
  const docs = new Map<string, QueryDocumentSnapshot<DocumentData>>()
  for (const doc of [...byCreated.docs, ...byInvoiceDate.docs]) docs.set(doc.id, doc)

  const openStates = new Set<IntegrityWorkflowState>([
    "abierta",
    "investigando",
    "en_correccion",
    "reabierta",
  ])
  const directIds = new Set<string>()
  for (const workflow of workflows.values()) {
    if (!openStates.has(workflow.state)) continue
    if (workflow.lastLocalOrderId) directIds.add(workflow.lastLocalOrderId)
    if (workflow.manualLink?.localOrderId) directIds.add(workflow.manualLink.localOrderId)
  }
  const refs = [...directIds]
    .filter((id) => !docs.has(id))
    .map((id) => ordenes.doc(id))
  if (refs.length > 0) {
    const direct = await db.getAll(...refs)
    for (const doc of direct) {
      if (doc.exists) {
        docs.set(doc.id, doc as QueryDocumentSnapshot<DocumentData>)
      }
    }
  }

  const orders = [...docs.values()].map((doc) => {
    const data = doc.data()
    const createdAt = asDate(data.creadoEn) ?? now
    const updatedAt = asDate(data.actualizadoEn) ?? createdAt
    const invoiceDate =
      typeof data.fechaFactura === "string" && data.fechaFactura
        ? data.fechaFactura.slice(0, 10)
        : null
    return {
      id: doc.id,
      invoiceNumber:
        typeof data.numeroFactura === "string" && data.numeroFactura.trim()
          ? data.numeroFactura
          : null,
      providerName: typeof data.proveedor === "string" ? data.proveedor : "",
      providerId:
        typeof data.proveedorId === "string" && data.proveedorId
          ? data.proveedorId
          : null,
      effectiveDate: invoiceDate ?? createdAt.toISOString().slice(0, 10),
      currency: typeof data.moneda === "string" ? data.moneda : "",
      total: safeNumber(data.total),
      updatedAt: updatedAt.toISOString(),
    }
  })
  return { orders, cutoff }
}

export function filterOdooBillsWindow(
  bills: OdooBillSnapshot[],
  workflows: Map<string, WorkflowDocument>,
  cutoff: string
): { bills: OdooBillSnapshot[]; outsideWindowCount: number } {
  const referenced = new Set<string>()
  for (const workflow of workflows.values()) {
    if (workflow.lastOdooInvoiceId) referenced.add(workflow.lastOdooInvoiceId)
    if (workflow.manualLink?.odooInvoiceId) {
      referenced.add(workflow.manualLink.odooInvoiceId)
    }
  }
  let outsideWindowCount = 0
  const filtered = bills.filter((bill) => {
    if (!bill.invoiceDate || bill.invoiceDate >= cutoff || referenced.has(bill.id)) {
      return true
    }
    outsideWindowCount++
    return false
  })
  return { bills: filtered, outsideWindowCount }
}

function runCaseDocument(
  runId: string,
  item: RunCaseEvidence,
  expireAt: Timestamp
): Record<string, unknown> {
  return {
    ...item,
    runId,
    expireAt,
  }
}

function eventData(args: {
  eventId: string
  action: string
  actorLabel: string
  previousRevision: number
  newRevision: number
  note?: string | null
  evidenceUrl?: string | null
  createdAt: Timestamp
}): Record<string, unknown> {
  return {
    eventId: args.eventId,
    action: args.action,
    actorLabel: args.actorLabel,
    previousRevision: args.previousRevision,
    newRevision: args.newRevision,
    note: args.note ?? null,
    evidenceUrl: args.evidenceUrl ?? null,
    createdAt: args.createdAt,
  }
}

function evidenceIds(item: RunCaseEvidence): {
  localOrderId: string | null
  odooInvoiceId: string | null
} {
  return {
    localOrderId: item.evidence.local?.id ?? item.candidates[0]?.localOrderId ?? null,
    odooInvoiceId: item.evidence.odoo?.id ?? item.candidates[0]?.odooInvoiceId ?? null,
  }
}

async function materializeWorkflows(
  db: Firestore,
  runId: string,
  cases: RunCaseEvidence[],
  previousCaseIds: Set<string>,
  now: Timestamp
): Promise<number> {
  const currentIds = new Set(cases.map((item) => item.caseId))
  let reopened = 0

  for (let index = 0; index < cases.length; index += 10) {
    const results = await Promise.all(
      cases.slice(index, index + 10).map(async (item) => {
        const ref = db
          .collection("reportes_integridad_workflows")
          .doc(item.caseId)
        const ids = evidenceIds(item)
        return db.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(ref)
          const prior = workflowFromSnapshot(snapshot)
          if (!prior) {
            const revision = 1
            const eventId = `system-${runId}-detected`
            transaction.set(ref, {
              caseId: item.caseId,
              state: "abierta",
              revision,
              assigneeUid: null,
              assigneeDisplayName: null,
              assigneeEmail: null,
              lastNote: null,
              evidenceUrl: null,
              manualLink: null,
              lastSourceRevision: item.sourceRevision,
              lastRunId: runId,
              lastLocalOrderId: ids.localOrderId,
              lastOdooInvoiceId: ids.odooInvoiceId,
              detectedAt: item.detectedAt,
              updatedAt: now,
              updatedBy: "system",
              lastCommandId: null,
            })
            transaction.set(
              ref.collection("events").doc(eventId),
              eventData({
                eventId,
                action: "detected",
                actorLabel: "Sistema",
                previousRevision: 0,
                newRevision: revision,
                createdAt: now,
              })
            )
            return false
          }

          const sourceChanged =
            prior.lastSourceRevision !== item.sourceRevision
          const mustReopen =
            sourceChanged &&
            (prior.state === "resuelta" || prior.state === "descartada")
          const nextRevision = sourceChanged
            ? prior.revision + 1
            : prior.revision
          const data: Record<string, unknown> = {
            lastRunId: runId,
            lastSourceRevision: item.sourceRevision,
            lastLocalOrderId: ids.localOrderId,
            lastOdooInvoiceId: ids.odooInvoiceId,
            detectedAt: prior.detectedAt || item.detectedAt,
          }
          if (sourceChanged) {
            Object.assign(data, {
              state: mustReopen ? "reabierta" : prior.state,
              revision: nextRevision,
              updatedAt: now,
              updatedBy: "system",
              lastCommandId: null,
            })
          }
          transaction.set(ref, data, { merge: true })
          if (sourceChanged) {
            const eventId = `system-${runId}-${mustReopen ? "reopened" : "source-changed"}`
            transaction.set(
              ref.collection("events").doc(eventId),
              eventData({
                eventId,
                action: mustReopen ? "reopened" : "source_changed",
                actorLabel: "Sistema",
                previousRevision: prior.revision,
                newRevision: nextRevision,
                createdAt: now,
              })
            )
          }
          return mustReopen
        })
      })
    )
    reopened += results.filter(Boolean).length
  }

  const corrected = [...previousCaseIds].filter(
    (caseId) => !currentIds.has(caseId)
  )
  for (let index = 0; index < corrected.length; index += 10) {
    await Promise.all(
      corrected.slice(index, index + 10).map(async (caseId) => {
        const ref = db
          .collection("reportes_integridad_workflows")
          .doc(caseId)
        await db.runTransaction(async (transaction) => {
          const snapshot = await transaction.get(ref)
          const prior = workflowFromSnapshot(snapshot)
          if (
            !prior ||
            prior.state === "resuelta" ||
            prior.state === "descartada"
          ) {
            return
          }
          const nextRevision = prior.revision + 1
          const eventId = `system-${runId}-verified-resolution`
          transaction.set(
            ref,
            {
              state: "resuelta",
              revision: nextRevision,
              lastRunId: runId,
              updatedAt: now,
              updatedBy: "system",
              lastCommandId: null,
            },
            { merge: true }
          )
          transaction.set(
            ref.collection("events").doc(eventId),
            eventData({
              eventId,
              action: "verified_resolution",
              actorLabel: "Sistema",
              previousRevision: prior.revision,
              newRevision: nextRevision,
              note: "La corrida vigente ya no reproduce la excepción.",
              createdAt: now,
            })
          )
        })
      })
    )
  }
  return reopened
}

export async function readRunCases(
  db: Firestore,
  runId: string
): Promise<RunCaseEvidence[]> {
  const snapshot = await db
    .collection("reportes_integridad_run_cases")
    .where("runId", "==", runId)
    .orderBy("severityRank", "desc")
    .orderBy("detectedAt", "asc")
    .orderBy("caseId", "asc")
    .get()
  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      caseId: String(data.caseId),
      type: data.type,
      severity: data.severity,
      severityRank: data.severityRank,
      detectedAt: String(data.detectedAt),
      providerName: String(data.providerName ?? ""),
      currency: typeof data.currency === "string" ? data.currency : null,
      localReference:
        typeof data.localReference === "string" ? data.localReference : null,
      odooReference:
        typeof data.odooReference === "string" ? data.odooReference : null,
      sourceRevision: String(data.sourceRevision),
      ruleVersion: String(data.ruleVersion),
      ruleLabel: String(data.ruleLabel),
      evidence: data.evidence,
      comparison: data.comparison,
      candidates: Array.isArray(data.candidates) ? data.candidates : [],
    } as RunCaseEvidence
  })
}

export async function materializeIntegrityRun(args: {
  db: Firestore
  syncId: string
  config: IntegrityConfig
  engine: IntegrityEngineResult
  sourceCounts: IntegrityRunDocument["sourceCounts"]
  computedAt: Date
  durationMs: number
}): Promise<{ runId: string; reopened: number; checksum: string }> {
  const runId = `run_${args.computedAt.toISOString().replace(/\D/g, "").slice(0, 17)}_${randomUUID().slice(0, 8)}`
  const runRef = args.db.collection("reportes_integridad_runs").doc(runId)
  const computedAt = Timestamp.fromDate(args.computedAt)
  const staleMinutes = Math.max(
    180,
    Math.ceil(args.config.scheduleIntervalMinutes * 1.5)
  )
  const staleAfter = Timestamp.fromMillis(
    args.computedAt.getTime() + staleMinutes * 60_000
  )
  const expireAt = Timestamp.fromMillis(
    args.computedAt.getTime() + 90 * 24 * 60 * 60_000
  )
  const checksum = createHash("sha256")
    .update(
      args.engine.cases
        .map((item) => `${item.caseId}:${item.sourceRevision}`)
        .sort()
        .join("|")
    )
    .digest("hex")

  const activeRef = args.db.collection("reportes_integridad_state").doc("active")
  const activeSnapshot = await activeRef.get()
  const previousRunId =
    typeof activeSnapshot.data()?.activeRunId === "string"
      ? activeSnapshot.data()!.activeRunId
      : null
  const previousCases = previousRunId
    ? await readRunCases(args.db, previousRunId)
    : []
  const previousIds = new Set(previousCases.map((item) => item.caseId))
  const delta = {
    ...args.engine.delta,
    new: args.engine.cases.filter((item) => !previousIds.has(item.caseId)).length,
    corrected: previousCases.filter(
      (item) => !args.engine.cases.some((next) => next.caseId === item.caseId)
    ).length,
  }

  const runBase: IntegrityRunDocument = {
    runId,
    status: "staging",
    syncId: args.syncId,
    ruleVersion: args.config.ruleVersion,
    computedAt,
    staleAfter,
    sourceCounts: args.sourceCounts,
    caseCount: args.engine.cases.length,
    coverage: args.engine.coverage,
    currencyScopes: args.engine.currencyScopes,
    excludedCounts: args.engine.excludedCounts,
    summary: args.engine.summary,
    delta,
    checksum,
    commits: Math.ceil(args.engine.cases.length / 350),
    durationMs: args.durationMs,
    expireAt,
  }
  await runRef.set(runBase)

  try {
    for (let index = 0; index < args.engine.cases.length; index += 350) {
      const batch = args.db.batch()
      for (const item of args.engine.cases.slice(index, index + 350)) {
        batch.set(
          args.db
            .collection("reportes_integridad_run_cases")
            .doc(`${runId}_${item.caseId}`),
          runCaseDocument(runId, item, expireAt)
        )
      }
      await batch.commit()
    }

    const countSnapshot = await args.db
      .collection("reportes_integridad_run_cases")
      .where("runId", "==", runId)
      .count()
      .get()
    if (countSnapshot.data().count !== args.engine.cases.length) {
      throw new IntegrityDomainError(
        "RUN_INTEGRITY_FAILED",
        "La corrida no superó la verificación de conteo."
      )
    }

    const reopened = await materializeWorkflows(
      args.db,
      runId,
      args.engine.cases,
      previousIds,
      computedAt
    )
    const finalDelta = { ...delta, reopened }

    await args.db.runTransaction(async (transaction) => {
      const current = await transaction.get(activeRef)
      const lastSuccess = asDate(current.data()?.lastSuccessAt)
      if (lastSuccess && lastSuccess.getTime() > args.computedAt.getTime()) {
        throw new IntegrityDomainError(
          "RUN_INTEGRITY_FAILED",
          "Una corrida más reciente ya fue publicada."
        )
      }
      transaction.update(runRef, {
        status: "ready",
        delta: finalDelta,
        readyAt: computedAt,
      })
      transaction.set(
        activeRef,
        {
          activeRunId: runId,
          lastValidSyncId: args.syncId,
          lastAttemptAt: computedAt,
          lastSuccessAt: computedAt,
          health: "current",
          safeErrorCode: null,
        },
        { merge: true }
      )
    })
    return { runId, reopened, checksum }
  } catch (error) {
    await runRef.set(
      {
        status: "failed",
        failureCode:
          error instanceof IntegrityDomainError
            ? error.dto.code
            : "RUN_WRITE_FAILED",
        failedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    )
    throw error instanceof IntegrityDomainError
      ? error
      : new IntegrityDomainError(
          "RUN_WRITE_FAILED",
          "No fue posible materializar la corrida de Integridad."
        )
  }
}

function emptyTrust(
  config: IntegrityConfig,
  active: ActiveStateDocument,
  canTriggerSync: boolean
): TrustEnvelopeDTO {
  const failed = active.health === "failed"
  return {
    activeRunId: null,
    syncId: null,
    ruleVersion: config.ruleVersion,
    mode: config.mode,
    sourceStatus: failed ? "failed" : "unavailable",
    computedAt: null,
    staleAfter: null,
    calculationState:
      config.mode === "off" ? "off" : failed ? "failed" : "unavailable",
    coverage: { matched: 0, eligible: 0, percentage: 0 },
    currencyScopes: [],
    excludedCounts: { creditNotes: 0, outsideWindow: 0 },
    summary: { open: 0, high: 0, medium: 0, exact: 0 },
    delta: { new: 0, corrected: 0, reopened: 0 },
    lastAttemptAt: active.lastAttemptAt
      ? active.lastAttemptAt.toDate().toISOString()
      : null,
    safeErrorCode: active.safeErrorCode ?? null,
    capabilities: { canTriggerSync },
  }
}

export async function buildTrustEnvelope(
  db: Firestore,
  config: IntegrityConfig,
  canTriggerSync: boolean,
  now = new Date()
): Promise<TrustEnvelopeDTO> {
  const activeSnapshot = await db
    .collection("reportes_integridad_state")
    .doc("active")
    .get()
  const active = (activeSnapshot.data() ?? {}) as ActiveStateDocument
  if (!active.activeRunId) return emptyTrust(config, active, canTriggerSync)
  const runSnapshot = await db
    .collection("reportes_integridad_runs")
    .doc(active.activeRunId)
    .get()
  if (!runSnapshot.exists || runSnapshot.data()?.status !== "ready") {
    return emptyTrust(config, active, canTriggerSync)
  }
  const run = runSnapshot.data() as IntegrityRunDocument
  const stale = now.getTime() > run.staleAfter.toMillis()
  const failed = active.health === "failed"
  return {
    activeRunId: run.runId,
    syncId: run.syncId,
    ruleVersion: run.ruleVersion,
    mode: config.mode,
    sourceStatus: failed ? "failed" : stale ? "stale" : "current",
    computedAt: run.computedAt.toDate().toISOString(),
    staleAfter: run.staleAfter.toDate().toISOString(),
    calculationState: failed || stale ? "stale" : "ready",
    coverage: run.coverage,
    currencyScopes: run.currencyScopes,
    excludedCounts: run.excludedCounts,
    summary: run.summary,
    delta: run.delta,
    lastAttemptAt: active.lastAttemptAt
      ? active.lastAttemptAt.toDate().toISOString()
      : null,
    safeErrorCode: active.safeErrorCode ?? null,
    capabilities: { canTriggerSync },
  }
}

export async function readWorkflowEvents(
  db: Firestore,
  caseId: string,
  limit = 50
): Promise<WorkflowEventDTO[]> {
  const snapshot = await db
    .collection("reportes_integridad_workflows")
    .doc(caseId)
    .collection("events")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get()
  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      eventId: doc.id,
      action: String(data.action ?? ""),
      actorLabel: String(data.actorLabel ?? "Sistema"),
      previousRevision: Number(data.previousRevision ?? 0),
      newRevision: Number(data.newRevision ?? 1),
      note: typeof data.note === "string" ? data.note : null,
      evidenceUrl:
        typeof data.evidenceUrl === "string" ? data.evidenceUrl : null,
      createdAt: asIso(data.createdAt, new Date()),
    }
  })
}

export function workflowToPublic(workflow: WorkflowDocument) {
  return {
    state: workflow.state,
    revision: workflow.revision,
    assignee: workflow.assigneeUid
      ? {
          uid: workflow.assigneeUid,
          displayName: workflow.assigneeDisplayName ?? "Usuario asignado",
          email: workflow.assigneeEmail ?? "sin-correo@example.invalid",
        }
      : null,
    lastNote: workflow.lastNote,
    evidenceUrl: workflow.evidenceUrl,
    manualLink: workflow.manualLink,
    updatedAt: workflow.updatedAt.toDate().toISOString(),
    updatedBy: workflow.updatedBy,
  }
}
