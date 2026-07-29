import { z } from "zod"

export function compactCallablePayload<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => compactCallablePayload(item)) as T
  }
  if (value === null || typeof value !== "object") return value
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, nested]) => nested !== undefined)
      .map(([key, nested]) => [key, compactCallablePayload(nested)])
  ) as T
}

export const IntegritySeveritySchema = z.enum(["alta", "media"])
export const IntegrityCaseTypeSchema = z.enum([
  "diferencia_importe",
  "currency_mismatch",
  "solo_local",
  "solo_odoo",
  "coincidencia_ambigua",
  "duplicado",
  "datos_incompletos",
])
export const IntegrityWorkflowStateSchema = z.enum([
  "abierta",
  "investigando",
  "en_correccion",
  "resuelta",
  "descartada",
  "reabierta",
])
export const IntegrityModeSchema = z.enum(["off", "shadow", "pilot", "on"])
export const SourceStatusSchema = z.enum(["current", "stale", "failed", "unavailable"])
export const CalculationStateSchema = z.enum(["ready", "stale", "failed", "off", "unavailable"])
export const IntegrityErrorCodeSchema = z.enum([
  "SYNC_ALREADY_RUNNING",
  "ODOO_UNAVAILABLE",
  "SOURCE_SNAPSHOT_INVALID",
  "MIRROR_WRITE_FAILED",
  "RUN_WRITE_FAILED",
  "RUN_INTEGRITY_FAILED",
  "DATA_UNAVAILABLE",
  "PERMISSION_DENIED",
  "INVALID_TRANSITION",
  "REVISION_CONFLICT",
  "ASSIGNMENT_INVALID",
  "MANUAL_LINK_CONFLICT",
  "EVIDENCE_URL_INVALID",
  "CURSOR_RUN_CHANGED",
  "INVALID_INPUT",
])

export const IntegrityErrorDTOSchema = z.object({
  code: IntegrityErrorCodeSchema,
  message: z.string(),
  currentRevision: z.number().int().positive().optional(),
  refreshRequired: z.boolean().optional(),
})
export type IntegrityErrorDTO = z.infer<typeof IntegrityErrorDTOSchema>

const LocalEvidenceSchema = z.object({
  id: z.string(),
  invoiceNumber: z.string().nullable(),
  providerName: z.string(),
  providerId: z.string().nullable(),
  effectiveDate: z.string().nullable(),
  currency: z.string(),
  total: z.number().nullable(),
  updatedAt: z.string(),
})

const OdooEvidenceSchema = z.object({
  id: z.string(),
  odooId: z.number().int(),
  invoiceNumber: z.string(),
  providerName: z.string(),
  odooPartnerId: z.number().int(),
  odooCompanyId: z.number().int(),
  invoiceDate: z.string().nullable(),
  currency: z.string(),
  total: z.number(),
  sourceRevision: z.string(),
})

export const IntegrityCandidateSchema = z.object({
  localOrderId: z.string().nullable(),
  odooInvoiceId: z.string().nullable(),
  odooCompanyId: z.number().int().nullable(),
  reference: z.string(),
  providerName: z.string(),
  companyLabel: z.string(),
  date: z.string().nullable(),
  currency: z.string(),
  amount: z.number().nullable(),
  sourceRevision: z.string(),
})
export type IntegrityCandidate = z.infer<typeof IntegrityCandidateSchema>

const IntegrityComparisonSchema = z.object({
  affectedField: z.enum(["total", "currency", "document", "identity"]),
  localValue: z.string().nullable(),
  odooValue: z.string().nullable(),
  absoluteDifference: z.number().nullable(),
  percentageDifference: z.number().nullable(),
  tolerancePct: z.number(),
  explanation: z.string(),
})

const WorkflowAssigneeSchema = z.object({
  uid: z.string(),
  displayName: z.string(),
  email: z.string().email(),
})

export const WorkflowEventSchema = z.object({
  eventId: z.string(),
  action: z.string(),
  actorLabel: z.string(),
  previousRevision: z.number().int().nonnegative(),
  newRevision: z.number().int().positive(),
  note: z.string().nullable(),
  evidenceUrl: z.string().nullable(),
  createdAt: z.string(),
})

const ManualLinkSchema = z.object({
  localOrderId: z.string(),
  odooInvoiceId: z.string(),
  odooCompanyId: z.number().int(),
  sourceRevision: z.string(),
  linkedAt: z.string(),
  linkedByUid: z.string(),
})

const WorkflowSchema = z.object({
  state: IntegrityWorkflowStateSchema,
  revision: z.number().int().positive(),
  assignee: WorkflowAssigneeSchema.nullable(),
  lastNote: z.string().nullable(),
  evidenceUrl: z.string().nullable(),
  manualLink: ManualLinkSchema.nullable(),
  updatedAt: z.string(),
  updatedBy: z.string(),
})

const EligibleAssigneeSchema = WorkflowAssigneeSchema.extend({
  modules: z.array(z.string()),
})

export const IntegrityCaseDTOSchema = z.object({
  caseId: z.string(),
  runId: z.string(),
  type: IntegrityCaseTypeSchema,
  severity: IntegritySeveritySchema,
  severityRank: z.number().int().min(1).max(2),
  detectedAt: z.string(),
  providerName: z.string(),
  currency: z.string().nullable(),
  localReference: z.string().nullable(),
  odooReference: z.string().nullable(),
  sourceRevision: z.string(),
  ruleVersion: z.string(),
  ruleLabel: z.string(),
  evidence: z.object({
    local: LocalEvidenceSchema.nullable(),
    odoo: OdooEvidenceSchema.nullable(),
  }),
  comparison: IntegrityComparisonSchema,
  candidates: z.array(IntegrityCandidateSchema),
  workflow: WorkflowSchema,
  history: z.array(WorkflowEventSchema).default([]),
  eligibleAssignees: z.array(EligibleAssigneeSchema).default([]),
})
export type IntegrityCaseDTO = z.infer<typeof IntegrityCaseDTOSchema>

export const OperationalTaskDTOSchema = z.object({
  caseId: z.string(),
  providerName: z.string(),
  localReference: z.string().nullable(),
  odooReference: z.string().nullable(),
  type: IntegrityCaseTypeSchema,
  affectedField: z.string(),
  requestedAction: z.string(),
  state: IntegrityWorkflowStateSchema,
  revision: z.number().int().positive(),
  assigneeUid: z.string(),
  updatedAt: z.string(),
  currency: z.string().optional(),
  activity: z.array(z.object({
    action: z.string(),
    actorLabel: z.string(),
    createdAt: z.string(),
  })).default([]),
})
export type OperationalTaskDTO = z.infer<typeof OperationalTaskDTOSchema>

export const TrustEnvelopeDTOSchema = z.object({
  activeRunId: z.string().nullable(),
  syncId: z.string().nullable(),
  ruleVersion: z.string(),
  mode: IntegrityModeSchema,
  sourceStatus: SourceStatusSchema,
  computedAt: z.string().nullable(),
  staleAfter: z.string().nullable(),
  calculationState: CalculationStateSchema,
  coverage: z.object({
    matched: z.number().int().nonnegative(),
    eligible: z.number().int().nonnegative(),
    percentage: z.number().min(0).max(100),
  }),
  currencyScopes: z.array(z.string()),
  excludedCounts: z.object({
    creditNotes: z.number().int().nonnegative(),
    outsideWindow: z.number().int().nonnegative(),
  }),
  summary: z.object({
    open: z.number().int().nonnegative(),
    high: z.number().int().nonnegative(),
    medium: z.number().int().nonnegative(),
    exact: z.number().int().nonnegative(),
  }),
  delta: z.object({
    new: z.number().int().nonnegative(),
    corrected: z.number().int().nonnegative(),
    reopened: z.number().int().nonnegative(),
  }),
  lastAttemptAt: z.string().nullable(),
  safeErrorCode: IntegrityErrorCodeSchema.nullable(),
  capabilities: z.object({
    canTriggerSync: z.boolean(),
  }),
})
export type TrustEnvelopeDTO = z.infer<typeof TrustEnvelopeDTOSchema>

export const IntegrityFiltersSchema = z.object({
  severity: z.array(IntegritySeveritySchema).max(2).default([]),
  type: z.array(IntegrityCaseTypeSchema).max(7).default([]),
  currency: z.array(z.string().min(1).max(10)).max(5).default([]),
  state: z.array(IntegrityWorkflowStateSchema).max(6).default([]),
})
export type IntegrityFilters = z.infer<typeof IntegrityFiltersSchema>
export type IntegrityCaseType = z.infer<typeof IntegrityCaseTypeSchema>
export type IntegritySeverity = z.infer<typeof IntegritySeveritySchema>
export type IntegrityWorkflowState = z.infer<typeof IntegrityWorkflowStateSchema>

export const ListIntegrityCasesResponseSchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("all"),
    trust: TrustEnvelopeDTOSchema,
    items: z.array(IntegrityCaseDTOSchema),
    nextCursor: z.string().nullable(),
    total: z.number().int().nonnegative(),
  }),
  z.object({
    scope: z.literal("mine"),
    trust: TrustEnvelopeDTOSchema.nullable(),
    items: z.array(OperationalTaskDTOSchema),
    nextCursor: z.string().nullable(),
    total: z.number().int().nonnegative(),
  }),
])
export type ListIntegrityCasesResponse = z.infer<typeof ListIntegrityCasesResponseSchema>

export const CaseCommandActionSchema = z.enum([
  "assign",
  "comment",
  "start_investigation",
  "request_correction",
  "resolve",
  "discard",
  "manual_link",
])
export type CaseCommandAction = z.infer<typeof CaseCommandActionSchema>

export type CaseCommandInput = {
  caseId: string
  expectedRevision: number
  sourceRevision?: string
  commandId: string
  action: CaseCommandAction
  assigneeUid?: string
  reason?: string
  note?: string
  evidenceUrl?: string
  localOrderId?: string
  odooInvoiceId?: string
  odooCompanyId?: number
}

export const CommandResultSchema = z.object({
  caseId: z.string(),
  revision: z.number().int().positive(),
  state: IntegrityWorkflowStateSchema,
  idempotent: z.boolean(),
  message: z.string(),
})
export type CommandResult = z.infer<typeof CommandResultSchema>

export const CASE_TYPE_LABELS: Record<IntegrityCaseType, string> = {
  diferencia_importe: "Diferencia de importe",
  currency_mismatch: "Moneda incompatible",
  solo_local: "Sin factura Odoo",
  solo_odoo: "Sin orden SMV Hub",
  coincidencia_ambigua: "Coincidencia ambigua",
  duplicado: "Documento duplicado",
  datos_incompletos: "Datos incompletos",
}

export const WORKFLOW_STATE_LABELS: Record<IntegrityWorkflowState, string> = {
  abierta: "Abierta",
  investigando: "En investigación",
  en_correccion: "Corrección solicitada",
  resuelta: "Resuelta",
  descartada: "Descartada",
  reabierta: "Reabierta",
}
