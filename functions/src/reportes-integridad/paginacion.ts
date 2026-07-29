import { IntegrityDomainError } from "./errores"

export type IntegrityCursorPayload = {
  activeRunId: string
  severityRank: 1 | 2
  detectedAt: string
  caseId: string
}

type CursorItem = Pick<
  IntegrityCursorPayload,
  "severityRank" | "detectedAt" | "caseId"
>

export function encodeIntegrityCursor(
  activeRunId: string,
  item: CursorItem
): string {
  const payload: IntegrityCursorPayload = {
    activeRunId,
    severityRank: item.severityRank,
    detectedAt: item.detectedAt,
    caseId: item.caseId,
  }
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")
}

export function decodeIntegrityCursor(
  cursor: string | undefined
): IntegrityCursorPayload | null {
  if (!cursor) return null
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    ) as Partial<IntegrityCursorPayload>
    if (
      typeof parsed.activeRunId !== "string" ||
      (parsed.severityRank !== 1 && parsed.severityRank !== 2) ||
      typeof parsed.detectedAt !== "string" ||
      typeof parsed.caseId !== "string"
    ) {
      throw new Error("cursor incompleto")
    }
    return parsed as IntegrityCursorPayload
  } catch {
    throw new IntegrityDomainError(
      "INVALID_INPUT",
      "El cursor de paginación no es válido."
    )
  }
}

export function assertIntegrityCursorRun(
  cursor: IntegrityCursorPayload | null,
  activeRunId: string
): void {
  if (cursor && cursor.activeRunId !== activeRunId) {
    throw new IntegrityDomainError(
      "CURSOR_RUN_CHANGED",
      "La corrida cambió durante la paginación; actualiza la lista.",
      { refreshRequired: true }
    )
  }
}

export function integrityCursorIndex(
  items: CursorItem[],
  cursor: IntegrityCursorPayload | null
): number {
  if (!cursor) return 0
  const index = items.findIndex(
    (item) =>
      item.severityRank === cursor.severityRank &&
      item.detectedAt === cursor.detectedAt &&
      item.caseId === cursor.caseId
  )
  if (index < 0) {
    throw new IntegrityDomainError(
      "CURSOR_RUN_CHANGED",
      "La cola cambió durante la paginación; actualiza la lista.",
      { refreshRequired: true }
    )
  }
  return index + 1
}
