import { createRequire } from "node:module"
import { resolve } from "node:path"
import type { App } from "firebase-admin/app"
import type { Firestore } from "firebase-admin/firestore"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import type { CallablePrincipal } from "../functions/src/auth"
import { IntegrityCaseDTOSchema } from "../functions/src/reportes-integridad/contratos"
import { IntegrityDomainError } from "../functions/src/reportes-integridad/errores"
import type {
  IntegrityEngineResult,
  RunCaseEvidence,
} from "../functions/src/reportes-integridad/motor"
import {
  acquireIntegrityLease,
  heartbeatIntegrityLease,
  INTEGRITY_CONFIG_DEFAULTS,
  materializeIntegrityRun,
  releaseIntegrityLease,
} from "../functions/src/reportes-integridad/repositorio"
import { executeIntegrityCommand } from "../functions/src/reportes-integridad/workflow"
import fixture from "./fixtures/reportes-integridad-contracts.json"

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST
const describeWithEmulator = emulatorHost ? describe : describe.skip
const projectId = "smv-hub-reportes-integridad-rules"
const databaseId = "compras-americanas"
const functionsRequire = createRequire(
  resolve(import.meta.dirname, "..", "functions", "package.json")
)
const adminApp = functionsRequire("firebase-admin/app") as typeof import("firebase-admin/app")
const adminFirestore = functionsRequire(
  "firebase-admin/firestore"
) as typeof import("firebase-admin/firestore")

let app: App
let db: Firestore

const financePrincipal: CallablePrincipal = {
  uid: "finance-user",
  email: "finance-user@example.com",
  modules: ["reportes", "finanzas"],
  isSuperAdmin: false,
  isBreakGlass: false,
  active: true,
  template: null,
}

const providerPrincipal: CallablePrincipal = {
  uid: "provider-user",
  email: "provider-user@example.com",
  modules: ["proveedores"],
  isSuperAdmin: false,
  isBreakGlass: false,
  active: true,
  template: null,
}

function caseEvidence(): RunCaseEvidence {
  const parsed = IntegrityCaseDTOSchema.parse(fixture.case)
  return {
    caseId: parsed.caseId,
    type: parsed.type,
    severity: parsed.severity,
    severityRank: parsed.severityRank === 2 ? 2 : 1,
    detectedAt: parsed.detectedAt,
    providerName: parsed.providerName,
    currency: parsed.currency,
    localReference: parsed.localReference,
    odooReference: parsed.odooReference,
    sourceRevision: parsed.sourceRevision,
    ruleVersion: parsed.ruleVersion,
    ruleLabel: parsed.ruleLabel,
    evidence: parsed.evidence,
    comparison: parsed.comparison,
    candidates: parsed.candidates,
  }
}

async function clearNamedDatabase(): Promise<void> {
  const collections = await db.listCollections()
  for (const collection of collections) {
    await db.recursiveDelete(collection)
  }
}

async function seedActiveCase(args: {
  now: Date
  assigneeUid?: string
  stale?: boolean
}): Promise<RunCaseEvidence> {
  const evidence = caseEvidence()
  const timestamp = adminFirestore.Timestamp.fromDate(args.now)
  const staleAfter = adminFirestore.Timestamp.fromMillis(
    args.now.getTime() + (args.stale ? -60_000 : 3 * 60 * 60_000)
  )
  await Promise.all([
    db.collection("reportes_integridad_state").doc("config").set({
      ...INTEGRITY_CONFIG_DEFAULTS,
      mode: "pilot",
      pilotAllowlistUids: [financePrincipal.uid, providerPrincipal.uid],
    }),
    db.collection("reportes_integridad_state").doc("active").set({
      activeRunId: "run-emulator",
      lastValidSyncId: "sync-emulator",
      lastAttemptAt: timestamp,
      lastSuccessAt: timestamp,
      health: "current",
      safeErrorCode: null,
    }),
    db.collection("reportes_integridad_runs").doc("run-emulator").set({
      runId: "run-emulator",
      status: "ready",
      syncId: "sync-emulator",
      ruleVersion: evidence.ruleVersion,
      computedAt: timestamp,
      staleAfter,
      sourceCounts: { localOrders: 1, odooPurchaseOrders: 1, odooBills: 1 },
      caseCount: 1,
      coverage: { matched: 1, eligible: 1, percentage: 100 },
      currencyScopes: ["USD"],
      excludedCounts: { creditNotes: 0, outsideWindow: 0 },
      summary: { open: 1, high: 1, medium: 0, exact: 0 },
      delta: { new: 1, corrected: 0, reopened: 0 },
      checksum: "checksum-emulator",
      commits: 1,
      durationMs: 50,
      expireAt: adminFirestore.Timestamp.fromMillis(
        args.now.getTime() + 90 * 24 * 60 * 60_000
      ),
    }),
    db
      .collection("reportes_integridad_run_cases")
      .doc(`run-emulator_${evidence.caseId}`)
      .set({ ...evidence, runId: "run-emulator" }),
    db.collection("reportes_integridad_workflows").doc(evidence.caseId).set({
      caseId: evidence.caseId,
      state: "abierta",
      revision: 1,
      assigneeUid: args.assigneeUid ?? providerPrincipal.uid,
      assigneeDisplayName: "Usuario Proveedor",
      assigneeEmail: providerPrincipal.email,
      lastNote: null,
      evidenceUrl: null,
      manualLink: null,
      lastSourceRevision: evidence.sourceRevision,
      lastRunId: "run-emulator",
      lastLocalOrderId: evidence.evidence.local?.id ?? null,
      lastOdooInvoiceId: evidence.evidence.odoo?.id ?? null,
      detectedAt: evidence.detectedAt,
      updatedAt: timestamp,
      updatedBy: "system",
      lastCommandId: null,
    }),
  ])
  return evidence
}

async function expectDomainCode(
  promise: Promise<unknown>,
  code: IntegrityDomainError["dto"]["code"]
): Promise<void> {
  await expect(promise).rejects.toBeInstanceOf(IntegrityDomainError)
  await expect(promise).rejects.toMatchObject({ dto: { code } })
}

const emptyEngine: IntegrityEngineResult = {
  cases: [],
  coverage: { matched: 0, eligible: 0, percentage: 0 },
  currencyScopes: [],
  excludedCounts: { creditNotes: 0, outsideWindow: 0 },
  summary: { open: 0, high: 0, medium: 0, exact: 0 },
  delta: { new: 0, corrected: 0, reopened: 0 },
}

describeWithEmulator("Integridad transaccional en Firestore Emulator", () => {
  beforeAll(() => {
    app = adminApp.initializeApp(
      { projectId },
      `integrity-emulator-${process.pid}`
    )
    db = adminFirestore.getFirestore(app, databaseId)
  })

  beforeEach(async () => {
    await clearNamedDatabase()
  })

  afterAll(async () => {
    if (app) await adminApp.deleteApp(app)
  })

  it("hace el comando idempotente, detecta revisión y valida candidatos vigentes", async () => {
    const now = new Date("2026-07-29T12:00:00.000Z")
    const evidence = await seedActiveCase({ now })
    const comment = {
      caseId: evidence.caseId,
      expectedRevision: 1,
      commandId: "command-idempotent-1",
      action: "comment" as const,
      note: "Revisado en el emulador.",
    }

    const first = await executeIntegrityCommand({
      db,
      principal: financePrincipal,
      input: comment,
      canViewFull: true,
      now: new Date("2026-07-29T12:01:00.000Z"),
    })
    expect(first).toMatchObject({ revision: 2, idempotent: false })

    const replay = await executeIntegrityCommand({
      db,
      principal: financePrincipal,
      input: comment,
      canViewFull: true,
      now: new Date("2026-07-29T12:02:00.000Z"),
    })
    expect(replay).toMatchObject({ revision: 2, idempotent: true })

    await expectDomainCode(
      executeIntegrityCommand({
        db,
        principal: financePrincipal,
        input: {
          ...comment,
          commandId: "command-revision-conflict",
        },
        canViewFull: true,
        now: new Date("2026-07-29T12:03:00.000Z"),
      }),
      "REVISION_CONFLICT"
    )

    await expectDomainCode(
      executeIntegrityCommand({
        db,
        principal: financePrincipal,
        input: {
          caseId: evidence.caseId,
          expectedRevision: 2,
          commandId: "command-manual-wrong",
          action: "manual_link",
          sourceRevision: evidence.sourceRevision,
          localOrderId: "id-libre-no-candidato",
          odooInvoiceId: evidence.candidates[0].odooInvoiceId!,
          odooCompanyId: evidence.candidates[0].odooCompanyId!,
        },
        canViewFull: true,
        now: new Date("2026-07-29T12:04:00.000Z"),
      }),
      "MANUAL_LINK_CONFLICT"
    )

    const candidate = evidence.candidates[0]
    const linked = await executeIntegrityCommand({
      db,
      principal: financePrincipal,
      input: {
        caseId: evidence.caseId,
        expectedRevision: 2,
        commandId: "command-manual-valid",
        action: "manual_link",
        sourceRevision: evidence.sourceRevision,
        localOrderId: candidate.localOrderId!,
        odooInvoiceId: candidate.odooInvoiceId!,
        odooCompanyId: candidate.odooCompanyId!,
      },
      canViewFull: true,
      now: new Date("2026-07-29T12:05:00.000Z"),
    })
    expect(linked).toMatchObject({ revision: 3, idempotent: false })

    const events = await db
      .collection("reportes_integridad_workflows")
      .doc(evidence.caseId)
      .collection("events")
      .get()
    expect(events.size).toBe(2)
  })

  it("permite operación asignada, bloquea cierre ajeno y acciones frescas en stale", async () => {
    const now = new Date("2026-07-29T12:00:00.000Z")
    const evidence = await seedActiveCase({ now, stale: true })

    await expectDomainCode(
      executeIntegrityCommand({
        db,
        principal: providerPrincipal,
        input: {
          caseId: evidence.caseId,
          expectedRevision: 1,
          commandId: "command-provider-resolve",
          action: "resolve",
        },
        canViewFull: false,
        now: new Date("2026-07-29T12:01:00.000Z"),
      }),
      "INVALID_TRANSITION"
    )

    const operational = await executeIntegrityCommand({
      db,
      principal: providerPrincipal,
      input: {
        caseId: evidence.caseId,
        expectedRevision: 1,
        commandId: "command-provider-investigate",
        action: "start_investigation",
      },
      canViewFull: false,
      now: new Date("2026-07-29T12:02:00.000Z"),
    })
    expect(operational.state).toBe("investigando")

    await expectDomainCode(
      executeIntegrityCommand({
        db,
        principal: { ...providerPrincipal, uid: "other-provider" },
        input: {
          caseId: evidence.caseId,
          expectedRevision: 2,
          commandId: "command-other-comment",
          action: "comment",
          note: "No asignado.",
        },
        canViewFull: false,
        now: new Date("2026-07-29T12:03:00.000Z"),
      }),
      "PERMISSION_DENIED"
    )
  })

  it("serializa el lease, exige propietario y permite takeover tras release", async () => {
    const start = new Date("2026-07-29T12:00:00.000Z")
    const first = await acquireIntegrityLease(db, "manual", start, "owner-a")
    expect(first.ownerInvocationId).toBe("owner-a")

    await expectDomainCode(
      acquireIntegrityLease(
        db,
        "scheduled",
        new Date("2026-07-29T12:01:00.000Z"),
        "owner-b"
      ),
      "SYNC_ALREADY_RUNNING"
    )
    await expectDomainCode(
      heartbeatIntegrityLease(
        db,
        "owner-b",
        new Date("2026-07-29T12:02:00.000Z")
      ),
      "SYNC_ALREADY_RUNNING"
    )

    await releaseIntegrityLease(
      db,
      "owner-a",
      new Date("2026-07-29T12:03:00.000Z")
    )
    const takeover = await acquireIntegrityLease(
      db,
      "scheduled",
      new Date("2026-07-29T12:03:01.000Z"),
      "owner-b"
    )
    expect(takeover.ownerInvocationId).toBe("owner-b")
  })

  it("impide que una corrida más vieja reemplace el puntero activo", async () => {
    const config = {
      ...INTEGRITY_CONFIG_DEFAULTS,
      mode: "shadow" as const,
    }
    const newerAt = new Date("2026-07-29T13:00:00.000Z")
    const newer = await materializeIntegrityRun({
      db,
      syncId: "sync-newer",
      config,
      engine: emptyEngine,
      sourceCounts: { localOrders: 1, odooPurchaseOrders: 1, odooBills: 1 },
      computedAt: newerAt,
      durationMs: 100,
    })

    await expectDomainCode(
      materializeIntegrityRun({
        db,
        syncId: "sync-older",
        config,
        engine: emptyEngine,
        sourceCounts: { localOrders: 1, odooPurchaseOrders: 1, odooBills: 1 },
        computedAt: new Date("2026-07-29T12:00:00.000Z"),
        durationMs: 100,
      }),
      "RUN_INTEGRITY_FAILED"
    )

    const active = await db
      .collection("reportes_integridad_state")
      .doc("active")
      .get()
    expect(active.data()?.activeRunId).toBe(newer.runId)

    const failedRuns = await db
      .collection("reportes_integridad_runs")
      .where("syncId", "==", "sync-older")
      .get()
    expect(failedRuns.docs[0].data()).toMatchObject({
      status: "failed",
      failureCode: "RUN_INTEGRITY_FAILED",
    })
  })

  it("preserva edición humana, auto-resuelve y reabre al cambiar la evidencia", async () => {
    const initialAt = new Date("2026-07-29T12:00:00.000Z")
    const evidence = await seedActiveCase({ now: initialAt })
    await executeIntegrityCommand({
      db,
      principal: financePrincipal,
      input: {
        caseId: evidence.caseId,
        expectedRevision: 1,
        commandId: "command-before-next-run",
        action: "comment",
        note: "Conservar esta investigación entre corridas.",
      },
      canViewFull: true,
      now: new Date("2026-07-29T12:01:00.000Z"),
    })

    const config = {
      ...INTEGRITY_CONFIG_DEFAULTS,
      mode: "shadow" as const,
    }
    const withCase: IntegrityEngineResult = {
      ...emptyEngine,
      cases: [evidence],
      coverage: { matched: 1, eligible: 1, percentage: 100 },
      currencyScopes: ["USD"],
      summary: { open: 1, high: 1, medium: 0, exact: 0 },
    }
    await materializeIntegrityRun({
      db,
      syncId: "sync-same-evidence",
      config,
      engine: withCase,
      sourceCounts: { localOrders: 1, odooPurchaseOrders: 1, odooBills: 1 },
      computedAt: new Date("2026-07-29T13:00:00.000Z"),
      durationMs: 100,
    })

    const afterSameEvidence = await db
      .collection("reportes_integridad_workflows")
      .doc(evidence.caseId)
      .get()
    expect(afterSameEvidence.data()).toMatchObject({
      state: "abierta",
      revision: 2,
      lastNote: "Conservar esta investigación entre corridas.",
      assigneeUid: providerPrincipal.uid,
    })

    await materializeIntegrityRun({
      db,
      syncId: "sync-resolved",
      config,
      engine: emptyEngine,
      sourceCounts: { localOrders: 1, odooPurchaseOrders: 1, odooBills: 1 },
      computedAt: new Date("2026-07-29T14:00:00.000Z"),
      durationMs: 100,
    })
    const afterResolution = await db
      .collection("reportes_integridad_workflows")
      .doc(evidence.caseId)
      .get()
    expect(afterResolution.data()).toMatchObject({
      state: "resuelta",
      revision: 3,
      lastNote: "Conservar esta investigación entre corridas.",
      assigneeUid: providerPrincipal.uid,
    })

    const changedEvidence: RunCaseEvidence = {
      ...evidence,
      sourceRevision: `${evidence.sourceRevision}-changed`,
    }
    const reopened = await materializeIntegrityRun({
      db,
      syncId: "sync-reopened",
      config,
      engine: {
        ...withCase,
        cases: [changedEvidence],
        delta: { new: 0, corrected: 0, reopened: 0 },
      },
      sourceCounts: { localOrders: 1, odooPurchaseOrders: 1, odooBills: 1 },
      computedAt: new Date("2026-07-29T15:00:00.000Z"),
      durationMs: 100,
    })
    expect(reopened.reopened).toBe(1)

    const afterReopen = await db
      .collection("reportes_integridad_workflows")
      .doc(evidence.caseId)
      .get()
    expect(afterReopen.data()).toMatchObject({
      state: "reabierta",
      revision: 4,
      lastSourceRevision: changedEvidence.sourceRevision,
      lastNote: "Conservar esta investigación entre corridas.",
      assigneeUid: providerPrincipal.uid,
    })
  })
})
