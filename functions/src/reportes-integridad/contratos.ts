import { z } from "zod"

const nullAsUndefined = (value: unknown): unknown =>
  value === null ? undefined : value

export const IntegritySeveritySchema = z.enum(["alta", "media"])
export type IntegritySeverity = z.infer<typeof IntegritySeveritySchema>

export const IntegrityCaseTypeSchema = z.enum([
  "diferencia_importe",
  "currency_mismatch",
  "solo_local",
  "solo_odoo",
  "coincidencia_ambigua",
  "duplicado",
  "datos_incompletos",
])
export type IntegrityCaseType = z.infer<typeof IntegrityCaseTypeSchema>

export const IntegrityWorkflowStateSchema = z.enum([
  "abierta",
  "investigando",
  "en_correccion",
  "resuelta",
  "descartada",
  "reabierta",
])
export type IntegrityWorkflowState = z.infer<typeof IntegrityWorkflowStateSchema>

export const IntegrityModeSchema = z.enum(["off", "shadow", "pilot", "on"])
export type IntegrityMode = z.infer<typeof IntegrityModeSchema>

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
export type IntegrityErrorCode = z.infer<typeof IntegrityErrorCodeSchema>

export const IntegrityErrorDTOSchema = z.object({
  code: IntegrityErrorCodeSchema,
  message: z.string().min(1).max(300),
  currentRevision: z.number().int().positive().optional(),
  refreshRequired: z.boolean().optional(),
})
export type IntegrityErrorDTO = z.infer<typeof IntegrityErrorDTOSchema>

export const LocalEvidenceSchema = z.object({
  id: z.string().min(1),
  invoiceNumber: z.string().nullable(),
  providerName: z.string(),
  providerId: z.string().nullable(),
  effectiveDate: z.string().nullable(),
  currency: z.string(),
  total: z.number().nullable(),
  updatedAt: z.string(),
})
export type LocalEvidence = z.infer<typeof LocalEvidenceSchema>

export const OdooEvidenceSchema = z.object({
  id: z.string().min(1),
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
export type OdooEvidence = z.infer<typeof OdooEvidenceSchema>

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

export const IntegrityComparisonSchema = z.object({
  affectedField: z.enum(["total", "currency", "document", "identity"]),
  localValue: z.string().nullable(),
  odooValue: z.string().nullable(),
  absoluteDifference: z.number().nullable(),
  percentageDifference: z.number().nullable(),
  tolerancePct: z.number().nonnegative(),
  explanation: z.string(),
})

export const WorkflowAssigneeSchema = z.object({
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
export type WorkflowEventDTO = z.infer<typeof WorkflowEventSchema>

export const ManualLinkSchema = z.object({
  localOrderId: z.string(),
  odooInvoiceId: z.string(),
  odooCompanyId: z.number().int(),
  sourceRevision: z.string(),
  linkedAt: z.string(),
  linkedByUid: z.string(),
})

export const WorkflowSchema = z.object({
  state: IntegrityWorkflowStateSchema,
  revision: z.number().int().positive(),
  assignee: WorkflowAssigneeSchema.nullable(),
  lastNote: z.string().nullable(),
  evidenceUrl: z.string().nullable(),
  manualLink: ManualLinkSchema.nullable(),
  updatedAt: z.string(),
  updatedBy: z.string(),
})

export const EligibleAssigneeSchema = WorkflowAssigneeSchema.extend({
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
  history: z.array(WorkflowEventSchema),
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
  })).optional().default([]),
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
  severity: z.preprocess(
    nullAsUndefined,
    z.array(IntegritySeveritySchema).max(2).optional().default([])
  ),
  type: z.preprocess(
    nullAsUndefined,
    z.array(IntegrityCaseTypeSchema).max(7).optional().default([])
  ),
  currency: z.preprocess(
    nullAsUndefined,
    z.array(z.string().min(1).max(10)).max(5).optional().default([])
  ),
  state: z.preprocess(
    nullAsUndefined,
    z.array(IntegrityWorkflowStateSchema).max(6).optional().default([])
  ),
})

export const ListIntegrityCasesInputSchema = z.object({
  scope: z.enum(["all", "mine"]),
  filters: z.preprocess(
    nullAsUndefined,
    IntegrityFiltersSchema.optional().default({
      severity: [],
      type: [],
      currency: [],
      state: [],
    })
  ),
  cursor: z.preprocess(
    nullAsUndefined,
    z.string().max(2000).optional()
  ),
  limit: z.preprocess(
    nullAsUndefined,
    z.number().int().min(1).max(50).optional().default(25)
  ),
})
export type ListIntegrityCasesInput = z.infer<typeof ListIntegrityCasesInputSchema>

export const GetIntegrityCaseInputSchema = z.object({
  caseId: z.string().min(1).max(200),
  runId: z.preprocess(
    nullAsUndefined,
    z.string().min(1).max(200).optional()
  ),
})

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

export const CaseCommandInputSchema = z.object({
  caseId: z.string().min(1).max(200),
  expectedRevision: z.number().int().positive(),
  sourceRevision: z.preprocess(
    nullAsUndefined,
    z.string().min(1).max(200).optional()
  ),
  commandId: z.string().min(8).max(200),
  action: CaseCommandActionSchema,
  assigneeUid: z.preprocess(
    nullAsUndefined,
    z.string().min(1).max(200).optional()
  ),
  reason: z.preprocess(
    nullAsUndefined,
    z.string().trim().min(1).max(1000).optional()
  ),
  note: z.preprocess(
    nullAsUndefined,
    z.string().trim().min(1).max(2000).optional()
  ),
  evidenceUrl: z.preprocess(
    nullAsUndefined,
    z.string().url().max(2000).optional()
  ),
  localOrderId: z.preprocess(
    nullAsUndefined,
    z.string().min(1).max(200).optional()
  ),
  odooInvoiceId: z.preprocess(
    nullAsUndefined,
    z.string().min(1).max(200).optional()
  ),
  odooCompanyId: z.preprocess(
    nullAsUndefined,
    z.number().int().optional()
  ),
}).superRefine((value, ctx) => {
  if (value.evidenceUrl && !value.evidenceUrl.startsWith("https://")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["evidenceUrl"],
      message: "La URL de evidencia debe usar HTTPS.",
    })
  }
  if (value.action === "assign" && !value.assigneeUid) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["assigneeUid"],
      message: "Selecciona un responsable.",
    })
  }
  if (value.action === "comment" && !value.note && !value.evidenceUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["note"],
      message: "El comentario requiere nota o URL de evidencia.",
    })
  }
  if (value.action === "discard" && !value.reason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reason"],
      message: "Descartar requiere un motivo.",
    })
  }
  if (value.action === "manual_link") {
    for (const field of ["sourceRevision", "localOrderId", "odooInvoiceId", "odooCompanyId"] as const) {
      if (value[field] == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: "La vinculación requiere seleccionar un par vigente.",
        })
      }
    }
  }
})
export type CaseCommandInput = z.infer<typeof CaseCommandInputSchema>

export const ListIntegrityCasesResponseSchema = z.discriminatedUnion("scope", [
  z.object({
    scope: z.literal("all"),
    trust: TrustEnvelopeDTOSchema,
    items: z.array(IntegrityCaseDTOSchema.omit({
      history: true,
      eligibleAssignees: true,
    })),
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

export const CommandResultSchema = z.object({
  caseId: z.string(),
  revision: z.number().int().positive(),
  state: IntegrityWorkflowStateSchema,
  idempotent: z.boolean(),
  message: z.string(),
})
export type CommandResult = z.infer<typeof CommandResultSchema>
