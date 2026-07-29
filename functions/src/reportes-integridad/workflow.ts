import { Timestamp, type Firestore } from "firebase-admin/firestore"
import type { CallablePrincipal } from "../auth"
import {
  type CaseCommandInput,
  type CommandResult,
  type IntegrityWorkflowState,
} from "./contratos"
import { IntegrityDomainError } from "./errores"
import {
  buildTrustEnvelope,
  readIntegrityConfig,
  type WorkflowDocument,
} from "./repositorio"
import type { RunCaseEvidence } from "./motor"

const OPERATIONAL_ACTIONS = new Set<CaseCommandInput["action"]>([
  "comment",
  "start_investigation",
  "request_correction",
])

const FRESH_ONLY_ACTIONS = new Set<CaseCommandInput["action"]>([
  "resolve",
  "discard",
  "manual_link",
])

function modulesFromUserData(data: FirebaseFirestore.DocumentData): string[] {
  if (Array.isArray(data.modulos)) {
    return data.modulos.filter((item): item is string => typeof item === "string")
  }
  const template =
    typeof data.plantilla === "string" ? data.plantilla : data.rol
  if (template === "admin") return ["reportes", "finanzas", "proveedores"]
  if (template === "compras") return ["proveedores"]
  return []
}

function assigneeIsEligible(data: FirebaseFirestore.DocumentData | undefined): boolean {
  if (!data || data.activo !== true) return false
  const modules = modulesFromUserData(data)
  const explicitSuperAdmin = typeof data.esSuperAdmin === "boolean"
  const isSuperAdmin =
    data.esSuperAdmin === true ||
    (!explicitSuperAdmin &&
      (data.rol === "admin" || data.plantilla === "admin"))
  return isSuperAdmin || modules.includes("proveedores")
}

export function nextIntegrityState(
  current: IntegrityWorkflowState,
  action: CaseCommandInput["action"]
): IntegrityWorkflowState {
  if (current === "resuelta" || current === "descartada") {
    throw new IntegrityDomainError(
      "INVALID_TRANSITION",
      "El caso ya está cerrado; espera una nueva evidencia para reabrirlo."
    )
  }
  if (action === "assign" || action === "comment" || action === "manual_link") {
    return current
  }
  if (action === "start_investigation") return "investigando"
  if (action === "request_correction") return "en_correccion"
  if (action === "resolve") return "resuelta"
  if (action === "discard") return "descartada"
  return current
}

function candidateMatches(
  evidence: RunCaseEvidence,
  input: CaseCommandInput
): boolean {
  return evidence.candidates.some(
    (candidate) =>
      candidate.localOrderId === input.localOrderId &&
      candidate.odooInvoiceId === input.odooInvoiceId &&
      candidate.odooCompanyId === input.odooCompanyId &&
      candidate.sourceRevision === input.sourceRevision
  )
}

export async function executeIntegrityCommand(args: {
  db: Firestore
  principal: CallablePrincipal
  input: CaseCommandInput
  canViewFull: boolean
  now?: Date
}): Promise<CommandResult> {
  const now = args.now ?? new Date()
  const config = await readIntegrityConfig(args.db)
  if (config.mode === "off" || config.mode === "shadow") {
    throw new IntegrityDomainError(
      "INVALID_TRANSITION",
      config.mode === "off"
        ? "Integridad todavía no está habilitada."
        : "El cálculo está en modo shadow; el workflow humano permanece bloqueado."
    )
  }
  const trust = await buildTrustEnvelope(args.db, config, false, now)
  if (!trust.activeRunId) {
    throw new IntegrityDomainError(
      "DATA_UNAVAILABLE",
      "Aún no hay una corrida válida de Integridad."
    )
  }
  if (FRESH_ONLY_ACTIONS.has(args.input.action) && trust.sourceStatus !== "current") {
    throw new IntegrityDomainError(
      "INVALID_TRANSITION",
      "Actualiza la evidencia antes de resolver, descartar o vincular."
    )
  }

  const workflowRef = args.db
    .collection("reportes_integridad_workflows")
    .doc(args.input.caseId)
  const commandRef = workflowRef.collection("events").doc(args.input.commandId)

  return args.db.runTransaction(async (transaction) => {
    const activeRef = args.db
      .collection("reportes_integridad_state")
      .doc("active")
    const activeSnapshot = await transaction.get(activeRef)
    const activeRunId = activeSnapshot.data()?.activeRunId
    if (activeRunId !== trust.activeRunId) {
      throw new IntegrityDomainError(
        "MANUAL_LINK_CONFLICT",
        "La corrida cambió; revisa nuevamente la evidencia.",
        { refreshRequired: true }
      )
    }

    const caseRef = args.db
      .collection("reportes_integridad_run_cases")
      .doc(`${activeRunId}_${args.input.caseId}`)
    const [caseSnapshot, workflowSnapshot, commandSnapshot] = await Promise.all([
      transaction.get(caseRef),
      transaction.get(workflowRef),
      transaction.get(commandRef),
    ])
    if (commandSnapshot.exists) {
      const event = commandSnapshot.data()!
      return {
        caseId: args.input.caseId,
        revision: Number(event.newRevision),
        state: event.resultingState as IntegrityWorkflowState,
        idempotent: true,
        message: "La acción ya había sido registrada.",
      }
    }
    if (!caseSnapshot.exists || !workflowSnapshot.exists) {
      throw new IntegrityDomainError(
        "DATA_UNAVAILABLE",
        "El caso ya no pertenece a la corrida vigente.",
        { refreshRequired: true }
      )
    }
    const evidence = caseSnapshot.data() as RunCaseEvidence
    const workflow = workflowSnapshot.data() as WorkflowDocument
    if (workflow.revision !== args.input.expectedRevision) {
      throw new IntegrityDomainError(
        "REVISION_CONFLICT",
        "El caso cambió mientras lo revisabas.",
        { currentRevision: workflow.revision, refreshRequired: true }
      )
    }

    const assignedToPrincipal = workflow.assigneeUid === args.principal.uid
    if (
      !args.canViewFull &&
      (!assignedToPrincipal || !OPERATIONAL_ACTIONS.has(args.input.action))
    ) {
      throw new IntegrityDomainError(
        "PERMISSION_DENIED",
        "No tienes permiso para ejecutar esta acción."
      )
    }
    if (
      !args.canViewFull &&
      (workflow.state === "resuelta" || workflow.state === "descartada")
    ) {
      throw new IntegrityDomainError(
        "INVALID_TRANSITION",
        "El caso ya no requiere una tarea operativa."
      )
    }

    let assignee:
      | {
          uid: string
          displayName: string
          email: string
        }
      | null = null
    if (args.input.action === "assign") {
      const userRef = args.db.collection("usuarios").doc(args.input.assigneeUid!)
      const userSnapshot = await transaction.get(userRef)
      const userData = userSnapshot.data()
      if (!assigneeIsEligible(userData)) {
        throw new IntegrityDomainError(
          "ASSIGNMENT_INVALID",
          "El responsable seleccionado no está activo o no tiene acceso a Proveedores."
        )
      }
      assignee = {
        uid: userSnapshot.id,
        displayName:
          typeof userData!.nombre === "string" && userData!.nombre
            ? userData!.nombre
            : typeof userData!.displayName === "string" && userData!.displayName
              ? userData!.displayName
              : String(userData!.email ?? "Usuario"),
        email:
          typeof userData!.email === "string" && userData!.email.includes("@")
            ? userData!.email
            : `${userSnapshot.id}@example.invalid`,
      }
    }

    if (args.input.action === "manual_link") {
      if (
        args.input.sourceRevision !== evidence.sourceRevision ||
        !candidateMatches(evidence, args.input)
      ) {
        throw new IntegrityDomainError(
          "MANUAL_LINK_CONFLICT",
          "Los candidatos cambiaron; vuelve a confirmar el vínculo.",
          { refreshRequired: true }
        )
      }
    }

    const state = nextIntegrityState(workflow.state, args.input.action)
    const revision = workflow.revision + 1
    const timestamp = Timestamp.fromDate(now)
    const note = args.input.note ?? args.input.reason ?? null
    const update: Record<string, unknown> = {
      state,
      revision,
      updatedAt: timestamp,
      updatedBy: args.principal.email,
      lastCommandId: args.input.commandId,
    }
    if (assignee) {
      Object.assign(update, {
        assigneeUid: assignee.uid,
        assigneeDisplayName: assignee.displayName,
        assigneeEmail: assignee.email,
      })
    }
    if (note) update.lastNote = note
    if (args.input.evidenceUrl) update.evidenceUrl = args.input.evidenceUrl
    if (args.input.action === "manual_link") {
      update.manualLink = {
        localOrderId: args.input.localOrderId,
        odooInvoiceId: args.input.odooInvoiceId,
        odooCompanyId: args.input.odooCompanyId,
        sourceRevision: args.input.sourceRevision,
        linkedAt: now.toISOString(),
        linkedByUid: args.principal.uid,
      }
    }

    transaction.update(workflowRef, update)
    transaction.set(commandRef, {
      eventId: args.input.commandId,
      action: args.input.action,
      actorUid: args.principal.uid,
      actorLabel: args.principal.email,
      previousRevision: workflow.revision,
      newRevision: revision,
      resultingState: state,
      note,
      evidenceUrl: args.input.evidenceUrl ?? null,
      createdAt: timestamp,
      metadata:
        args.input.action === "manual_link"
          ? {
              localOrderId: args.input.localOrderId,
              odooInvoiceId: args.input.odooInvoiceId,
              odooCompanyId: args.input.odooCompanyId,
            }
          : {},
    })
    return {
      caseId: args.input.caseId,
      revision,
      state,
      idempotent: false,
      message: "Acción registrada en el historial del caso.",
    }
  })
}
