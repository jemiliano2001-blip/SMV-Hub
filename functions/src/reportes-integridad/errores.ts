import * as functions from "firebase-functions"
import type { IntegrityErrorCode, IntegrityErrorDTO } from "./contratos"

const HTTP_CODE: Record<IntegrityErrorCode, functions.https.FunctionsErrorCode> = {
  SYNC_ALREADY_RUNNING: "already-exists",
  ODOO_UNAVAILABLE: "unavailable",
  SOURCE_SNAPSHOT_INVALID: "failed-precondition",
  MIRROR_WRITE_FAILED: "internal",
  RUN_WRITE_FAILED: "internal",
  RUN_INTEGRITY_FAILED: "data-loss",
  DATA_UNAVAILABLE: "unavailable",
  PERMISSION_DENIED: "permission-denied",
  INVALID_TRANSITION: "failed-precondition",
  REVISION_CONFLICT: "aborted",
  ASSIGNMENT_INVALID: "invalid-argument",
  MANUAL_LINK_CONFLICT: "aborted",
  EVIDENCE_URL_INVALID: "invalid-argument",
  CURSOR_RUN_CHANGED: "aborted",
  INVALID_INPUT: "invalid-argument",
}

export class IntegrityDomainError extends Error {
  readonly dto: IntegrityErrorDTO

  constructor(
    code: IntegrityErrorCode,
    message: string,
    metadata: Pick<IntegrityErrorDTO, "currentRevision" | "refreshRequired"> = {}
  ) {
    super(message)
    this.name = "IntegrityDomainError"
    this.dto = { code, message, ...metadata }
  }
}

export function toHttpsError(error: unknown): functions.https.HttpsError {
  if (error instanceof functions.https.HttpsError) return error
  if (error instanceof IntegrityDomainError) {
    return new functions.https.HttpsError(
      HTTP_CODE[error.dto.code],
      error.dto.message,
      error.dto
    )
  }
  console.error("Integridad: error no controlado", error)
  const dto: IntegrityErrorDTO = {
    code: "DATA_UNAVAILABLE",
    message: "No fue posible completar la operación de Integridad.",
  }
  return new functions.https.HttpsError("internal", dto.message, dto)
}

