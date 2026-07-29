import { createHash } from "node:crypto"
import * as functions from "firebase-functions"
import type { Firestore } from "firebase-admin/firestore"
import {
  getCallablePrincipal,
  principalCanTriggerPurchasingSync,
  principalCanViewFullIntegrity,
  principalCanViewOwnIntegrity,
  type CallablePrincipal,
} from "../auth"
import { getDb } from "../firestore-db"
import {
  CaseCommandInputSchema,
  GetIntegrityCaseInputSchema,
  IntegrityCaseDTOSchema,
  IntegrityFiltersSchema,
  ListIntegrityCasesInputSchema,
  OperationalTaskDTOSchema,
  type IntegrityCaseDTO,
  type IntegrityWorkflowState,
  type OperationalTaskDTO,
  type WorkflowEventDTO,
} from "./contratos"
import { IntegrityDomainError, toHttpsError } from "./errores"
import type { RunCaseEvidence } from "./motor"
import {
  assertIntegrityCursorRun,
  decodeIntegrityCursor,
  encodeIntegrityCursor,
  integrityCursorIndex,
} from "./paginacion"
import {
  buildTrustEnvelope,
  readAllWorkflows,
  readIntegrityConfig,
  readRunCases,
  readWorkflowEvents,
  workflowFromSnapshot,
  workflowToPublic,
  type IntegrityConfig,
  type WorkflowDocument,
} from "./repositorio"
import { executeIntegrityCommand } from "./workflow"

const db = getDb()
const OPEN_STATES = new Set<IntegrityWorkflowState>([
  "abierta",
  "investigando",
  "en_correccion",
  "reabierta",
])

type IntegrityFilters = ReturnType<typeof IntegrityFiltersSchema.parse>

function hashUid(uid: string): string {
  return createHash("sha256").update(uid).digest("hex").slice(0, 12)
}

function logDenied(principal: CallablePrincipal, callable: string, code: string): void {
  console.warn("Integridad: acceso denegado", {
    uidHash: hashUid(principal.uid),
    callable,
    code,
  })
}

function requirePilotAccess(
  principal: CallablePrincipal,
  config: IntegrityConfig,
  callable: string
): void {
  if (
    config.mode === "pilot" &&
    !principal.isBreakGlass &&
    !principal.isSuperAdmin &&
    !config.pilotAllowlistUids.includes(principal.uid)
  ) {
    logDenied(principal, callable, "PILOT_ALLOWLIST")
    throw new IntegrityDomainError(
      "PERMISSION_DENIED",
      "Tu usuario todavía no forma parte del piloto de Integridad."
    )
  }
}

function caseMatchesFilters(
  item: RunCaseEvidence,
  workflow: WorkflowDocument,
  filters: IntegrityFilters
): boolean {
  const states =
    filters.state.length > 0 ? new Set(filters.state) : OPEN_STATES
  return (
    states.has(workflow.state) &&
    (filters.severity.length === 0 ||
      filters.severity.includes(item.severity)) &&
    (filters.type.length === 0 || filters.type.includes(item.type)) &&
    (filters.currency.length === 0 ||
      (item.currency != null && filters.currency.includes(item.currency)))
  )
}

function requestedAction(item: RunCaseEvidence): string {
  switch (item.type) {
    case "solo_local":
      return "Confirmar o corregir la referencia de factura en origen."
    case "solo_odoo":
      return "Identificar la orden de SMV Hub relacionada."
    case "currency_mismatch":
      return "Corregir la moneda del documento en origen."
    case "diferencia_importe":
      return "Revisar el total capturado y solicitar la corrección en origen."
    case "coincidencia_ambigua":
      return "Confirmar cuál documento corresponde."
    case "duplicado":
      return "Revisar el documento repetido en origen."
    case "datos_incompletos":
      return "Completar la referencia o el proveedor faltante."
  }
}

function operationalTask(
  item: RunCaseEvidence,
  workflow: WorkflowDocument,
  activity: WorkflowEventDTO[] = []
): OperationalTaskDTO {
  return OperationalTaskDTOSchema.parse({
    caseId: item.caseId,
    providerName: item.providerName,
    localReference: item.localReference,
    odooReference: item.odooReference,
    type: item.type,
    affectedField: item.comparison.affectedField,
    requestedAction: requestedAction(item),
    state: workflow.state,
    revision: workflow.revision,
    assigneeUid: workflow.assigneeUid,
    updatedAt: workflow.updatedAt.toDate().toISOString(),
    ...(item.type === "currency_mismatch" && item.currency
      ? { currency: item.currency }
      : {}),
    activity: activity.map((event) => ({
      action: event.action,
      actorLabel: event.actorLabel === "Sistema" ? "Sistema" : "Equipo SMV",
      createdAt: event.createdAt,
    })),
  })
}

function caseWithWorkflow(
  item: RunCaseEvidence,
  workflow: WorkflowDocument,
  history: WorkflowEventDTO[] = [],
  eligibleAssignees: IntegrityCaseDTO["eligibleAssignees"] = []
): IntegrityCaseDTO {
  return IntegrityCaseDTOSchema.parse({
    ...item,
    runId: workflow.lastRunId,
    workflow: workflowToPublic(workflow),
    history,
    eligibleAssignees,
  })
}

async function readEligibleAssignees(
  firestore: Firestore
): Promise<IntegrityCaseDTO["eligibleAssignees"]> {
  const snapshot = await firestore.collection("usuarios").where("activo", "==", true).get()
  return snapshot.docs
    .flatMap((doc) => {
      const data = doc.data()
      const modules = Array.isArray(data.modulos)
        ? data.modulos.filter(
            (value: unknown): value is string => typeof value === "string"
          )
        : data.plantilla === "admin" || data.rol === "admin"
          ? ["reportes", "finanzas", "proveedores"]
          : data.plantilla === "compras" || data.rol === "compras"
            ? ["proveedores"]
            : []
      const explicitSuper = typeof data.esSuperAdmin === "boolean"
      const superAdmin =
        data.esSuperAdmin === true ||
        (!explicitSuper &&
          (data.plantilla === "admin" || data.rol === "admin"))
      if (!superAdmin && !modules.includes("proveedores")) return []
      const email =
        typeof data.email === "string" && data.email.includes("@")
          ? data.email
          : `${doc.id}@example.invalid`
      return [
        {
          uid: doc.id,
          displayName:
            String(data.nombre ?? data.displayName ?? data.email ?? "Usuario"),
          email,
          modules,
        },
      ]
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName, "es"))
}

async function listAllCases(
  principal: CallablePrincipal,
  config: IntegrityConfig,
  input: ReturnType<typeof ListIntegrityCasesInputSchema.parse>
) {
  if (!principalCanViewFullIntegrity(principal)) {
    logDenied(principal, "listarCasosIntegridad", "FULL_SCOPE")
    throw new IntegrityDomainError(
      "PERMISSION_DENIED",
      "Se requieren los módulos Reportes y Finanzas."
    )
  }
  const trust = await buildTrustEnvelope(
    db,
    config,
    principalCanTriggerPurchasingSync(principal)
  )
  if (!trust.activeRunId || config.mode === "off") {
    return { scope: "all" as const, trust, items: [], nextCursor: null, total: 0 }
  }
  const cursor = decodeIntegrityCursor(input.cursor)
  assertIntegrityCursorRun(cursor, trust.activeRunId)
  const [cases, workflows] = await Promise.all([
    readRunCases(db, trust.activeRunId),
    readAllWorkflows(db),
  ])
  const joined = cases.flatMap((item) => {
    const workflow = workflows.get(item.caseId)
    if (!workflow) {
      throw new IntegrityDomainError(
        "RUN_INTEGRITY_FAILED",
        "Falta el workflow canónico de un caso."
      )
    }
    return caseMatchesFilters(item, workflow, input.filters)
      ? [{ item, workflow }]
      : []
  })
  const allOpen = cases.flatMap((item) => {
    const workflow = workflows.get(item.caseId)
    return workflow && OPEN_STATES.has(workflow.state) ? [{ item, workflow }] : []
  })
  trust.summary = {
    ...trust.summary,
    open: allOpen.length,
    high: allOpen.filter(({ item }) => item.severity === "alta").length,
    medium: allOpen.filter(({ item }) => item.severity === "media").length,
  }
  const orderedItems = joined.map(({ item }) => item)
  const start = integrityCursorIndex(orderedItems, cursor)
  const page = joined.slice(start, start + input.limit)
  const last = page.at(-1)?.item
  const hasMore = start + page.length < joined.length
  return {
    scope: "all" as const,
    trust,
    items: page.map(({ item, workflow }) =>
      caseWithWorkflow(item, workflow)
    ),
    nextCursor:
      hasMore && last ? encodeIntegrityCursor(trust.activeRunId, last) : null,
    total: joined.length,
  }
}

async function listOwnCases(
  principal: CallablePrincipal,
  config: IntegrityConfig,
  input: ReturnType<typeof ListIntegrityCasesInputSchema.parse>
) {
  if (!principalCanViewOwnIntegrity(principal)) {
    logDenied(principal, "listarCasosIntegridad", "MINE_SCOPE")
    throw new IntegrityDomainError(
      "PERMISSION_DENIED",
      "Se requiere acceso al módulo Proveedores."
    )
  }
  if (config.mode === "off" || config.mode === "shadow") {
    return {
      scope: "mine" as const,
      trust: null,
      items: [],
      nextCursor: null,
      total: 0,
    }
  }
  const trust = await buildTrustEnvelope(db, config, false)
  if (!trust.activeRunId) {
    return {
      scope: "mine" as const,
      trust: null,
      items: [],
      nextCursor: null,
      total: 0,
    }
  }
  const cursor = decodeIntegrityCursor(input.cursor)
  assertIntegrityCursorRun(cursor, trust.activeRunId)
  const workflowSnapshot = await db
    .collection("reportes_integridad_workflows")
    .where("assigneeUid", "==", principal.uid)
    .get()
  const workflows = workflowSnapshot.docs
    .map(workflowFromSnapshot)
    .filter((item): item is WorkflowDocument => item != null)
  const caseRefs = workflows.map((workflow) =>
    db
      .collection("reportes_integridad_run_cases")
      .doc(`${trust.activeRunId}_${workflow.caseId}`)
  )
  const caseSnapshots = caseRefs.length > 0 ? await db.getAll(...caseRefs) : []
  const casesById = new Map(
    caseSnapshots
      .filter((doc) => doc.exists)
      .map((doc) => [doc.data()!.caseId as string, doc.data() as RunCaseEvidence])
  )
  const joined = workflows
    .flatMap((workflow) => {
      const item = casesById.get(workflow.caseId)
      if (!item || !caseMatchesFilters(item, workflow, input.filters)) return []
      return [{ item, workflow }]
    })
    .sort(
      (a, b) =>
        b.item.severityRank - a.item.severityRank ||
        a.item.detectedAt.localeCompare(b.item.detectedAt) ||
        a.item.caseId.localeCompare(b.item.caseId)
    )
  const orderedItems = joined.map(({ item }) => item)
  const start = integrityCursorIndex(orderedItems, cursor)
  const page = joined.slice(start, start + input.limit)
  const last = page.at(-1)?.item
  const hasMore = start + page.length < joined.length
  return {
    scope: "mine" as const,
    trust: null,
    items: page.map(({ item, workflow }) => operationalTask(item, workflow)),
    nextCursor:
      hasMore && last ? encodeIntegrityCursor(trust.activeRunId, last) : null,
    total: joined.length,
  }
}

export const listarCasosIntegridad = functions
  .runWith({ timeoutSeconds: 60, memory: "512MB" })
  .https.onCall(async (raw, context) => {
    try {
      const principal = await getCallablePrincipal(context)
      const parsed = ListIntegrityCasesInputSchema.safeParse(raw)
      if (!parsed.success) {
        throw new IntegrityDomainError(
          "INVALID_INPUT",
          "Los filtros o la paginación no son válidos."
        )
      }
      const config = await readIntegrityConfig(db)
      requirePilotAccess(principal, config, "listarCasosIntegridad")
      return parsed.data.scope === "all"
        ? await listAllCases(principal, config, parsed.data)
        : await listOwnCases(principal, config, parsed.data)
    } catch (error) {
      throw toHttpsError(error)
    }
  })

export const obtenerCasoIntegridad = functions
  .runWith({ timeoutSeconds: 60, memory: "512MB" })
  .https.onCall(async (raw, context) => {
    try {
      const principal = await getCallablePrincipal(context)
      const parsed = GetIntegrityCaseInputSchema.safeParse(raw)
      if (!parsed.success) {
        throw new IntegrityDomainError("INVALID_INPUT", "El caso solicitado no es válido.")
      }
      const config = await readIntegrityConfig(db)
      requirePilotAccess(principal, config, "obtenerCasoIntegridad")
      const trust = await buildTrustEnvelope(
        db,
        config,
        principalCanTriggerPurchasingSync(principal)
      )
      if (
        !trust.activeRunId ||
        (parsed.data.runId && parsed.data.runId !== trust.activeRunId)
      ) {
        throw new IntegrityDomainError(
          "DATA_UNAVAILABLE",
          "El caso ya no pertenece a la corrida vigente.",
          { refreshRequired: true }
        )
      }
      const [caseSnapshot, workflowSnapshot] = await Promise.all([
        db
          .collection("reportes_integridad_run_cases")
          .doc(`${trust.activeRunId}_${parsed.data.caseId}`)
          .get(),
        db
          .collection("reportes_integridad_workflows")
          .doc(parsed.data.caseId)
          .get(),
      ])
      if (!caseSnapshot.exists || !workflowSnapshot.exists) {
        throw new IntegrityDomainError(
          "DATA_UNAVAILABLE",
          "El caso ya no está disponible.",
          { refreshRequired: true }
        )
      }
      const item = caseSnapshot.data() as RunCaseEvidence
      const workflow = workflowFromSnapshot(
        workflowSnapshot
      )
      if (!workflow) {
        throw new IntegrityDomainError(
          "RUN_INTEGRITY_FAILED",
          "El workflow del caso no es válido."
        )
      }
      const canViewFull = principalCanViewFullIntegrity(principal)
      const assigned =
        principalCanViewOwnIntegrity(principal) &&
        workflow.assigneeUid === principal.uid
      if (!canViewFull && !assigned) {
        logDenied(principal, "obtenerCasoIntegridad", "ASSIGNMENT")
        throw new IntegrityDomainError(
          "PERMISSION_DENIED",
          "No tienes permiso para ver este caso."
        )
      }
      const history = await readWorkflowEvents(db, item.caseId)
      if (!canViewFull) return operationalTask(item, workflow, history)
      const eligibleAssignees = await readEligibleAssignees(db)
      return caseWithWorkflow(item, workflow, history, eligibleAssignees)
    } catch (error) {
      throw toHttpsError(error)
    }
  })

export const ejecutarComandoCasoIntegridad = functions
  .runWith({ timeoutSeconds: 60, memory: "512MB" })
  .https.onCall(async (raw, context) => {
    try {
      const principal = await getCallablePrincipal(context)
      const parsed = CaseCommandInputSchema.safeParse(raw)
      if (!parsed.success) {
        const evidenceUrlIssue = parsed.error.issues.some(
          (issue) => issue.path[0] === "evidenceUrl"
        )
        throw new IntegrityDomainError(
          evidenceUrlIssue ? "EVIDENCE_URL_INVALID" : "INVALID_INPUT",
          evidenceUrlIssue
            ? "La URL de evidencia debe ser HTTPS y tener una longitud válida."
            : "La acción enviada no es válida."
        )
      }
      const config = await readIntegrityConfig(db)
      requirePilotAccess(principal, config, "ejecutarComandoCasoIntegridad")
      const canViewFull = principalCanViewFullIntegrity(principal)
      if (!canViewFull && !principalCanViewOwnIntegrity(principal)) {
        logDenied(principal, "ejecutarComandoCasoIntegridad", "MODULE")
        throw new IntegrityDomainError(
          "PERMISSION_DENIED",
          "No tienes permiso para operar casos de Integridad."
        )
      }
      return await executeIntegrityCommand({
        db,
        principal,
        input: parsed.data,
        canViewFull,
      })
    } catch (error) {
      throw toHttpsError(error)
    }
  })
