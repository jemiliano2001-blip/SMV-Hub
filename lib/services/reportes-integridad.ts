import { FirebaseError } from "firebase/app"
import { getFunctions, httpsCallable } from "firebase/functions"
import { firebaseApp } from "@/lib/firebase"
import {
  compactCallablePayload,
  CommandResultSchema,
  IntegrityCaseDTOSchema,
  IntegrityErrorDTOSchema,
  ListIntegrityCasesResponseSchema,
  OperationalTaskDTOSchema,
  type CaseCommandInput,
  type CommandResult,
  type IntegrityCaseDTO,
  type IntegrityFilters,
  type ListIntegrityCasesResponse,
  type OperationalTaskDTO,
} from "@/lib/reportes-integridad"

const functions = () => getFunctions(firebaseApp)

export class IntegrityServiceError extends Error {
  constructor(
    message: string,
    readonly details: ReturnType<typeof IntegrityErrorDTOSchema.parse> | null
  ) {
    super(message)
    this.name = "IntegrityServiceError"
  }
}

function adaptError(error: unknown): never {
  if (error instanceof FirebaseError) {
    const callableError = error as FirebaseError & { details?: unknown }
    const details = IntegrityErrorDTOSchema.safeParse(
      callableError.details ?? error.customData?.details
    )
    throw new IntegrityServiceError(
      details.success ? details.data.message : error.message,
      details.success ? details.data : null
    )
  }
  throw new IntegrityServiceError(
    error instanceof Error ? error.message : "No fue posible completar la operación.",
    null
  )
}

export async function listIntegrityCases(input: {
  scope: "all" | "mine"
  filters?: Partial<IntegrityFilters>
  cursor?: string
  limit?: number
}): Promise<ListIntegrityCasesResponse> {
  try {
    const callable = httpsCallable<typeof input, unknown>(
      functions(),
      "listarCasosIntegridad"
    )
    const response = await callable(compactCallablePayload(input))
    return ListIntegrityCasesResponseSchema.parse(response.data)
  } catch (error) {
    adaptError(error)
  }
}

export async function getIntegrityCase(input: {
  caseId: string
  runId?: string
}): Promise<IntegrityCaseDTO | OperationalTaskDTO> {
  try {
    const callable = httpsCallable<typeof input, unknown>(
      functions(),
      "obtenerCasoIntegridad"
    )
    const response = await callable(compactCallablePayload(input))
    const full = IntegrityCaseDTOSchema.safeParse(response.data)
    if (full.success) return full.data
    return OperationalTaskDTOSchema.parse(response.data)
  } catch (error) {
    adaptError(error)
  }
}

export async function executeIntegrityCaseCommand(
  input: Omit<CaseCommandInput, "commandId"> & { commandId?: string }
): Promise<CommandResult> {
  try {
    const payload: CaseCommandInput = {
      ...input,
      commandId: input.commandId ?? crypto.randomUUID(),
    }
    const callable = httpsCallable<CaseCommandInput, unknown>(
      functions(),
      "ejecutarComandoCasoIntegridad"
    )
    const response = await callable(compactCallablePayload(payload))
    return CommandResultSchema.parse(response.data)
  } catch (error) {
    adaptError(error)
  }
}
