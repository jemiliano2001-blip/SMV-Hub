import { describe, expect, it } from "vitest"
import { IntegrityDomainError } from "../functions/src/reportes-integridad/errores"
import {
  assertIntegrityCursorRun,
  decodeIntegrityCursor,
  encodeIntegrityCursor,
  integrityCursorIndex,
} from "../functions/src/reportes-integridad/paginacion"

const cases = [
  {
    caseId: "case-high-old",
    severityRank: 2 as const,
    detectedAt: "2026-07-20T00:00:00.000Z",
  },
  {
    caseId: "case-medium",
    severityRank: 1 as const,
    detectedAt: "2026-07-21T00:00:00.000Z",
  },
]

describe("paginación de Integridad", () => {
  it("codifica el run activo y continúa después del último elemento", () => {
    const encoded = encodeIntegrityCursor("run-a", cases[0])
    const decoded = decodeIntegrityCursor(encoded)

    expect(decoded).toEqual({ activeRunId: "run-a", ...cases[0] })
    expect(integrityCursorIndex(cases, decoded)).toBe(1)
  })

  it("rechaza un cursor de otra corrida antes de mezclar páginas", () => {
    const decoded = decodeIntegrityCursor(
      encodeIntegrityCursor("run-a", cases[0])
    )
    expect(() => assertIntegrityCursorRun(decoded, "run-b")).toThrowError(
      expect.objectContaining({
        dto: expect.objectContaining({
          code: "CURSOR_RUN_CHANGED",
          refreshRequired: true,
        }),
      })
    )
  })

  it("rechaza un elemento que ya no pertenece a la cola inmutable", () => {
    const decoded = decodeIntegrityCursor(
      encodeIntegrityCursor("run-a", {
        caseId: "case-missing",
        severityRank: 2,
        detectedAt: "2026-07-19T00:00:00.000Z",
      })
    )
    expect(() => integrityCursorIndex(cases, decoded)).toThrow(IntegrityDomainError)
  })

  it.each([
    "no-es-base64",
    Buffer.from(JSON.stringify({ activeRunId: "run-a" })).toString("base64url"),
    Buffer.from(
      JSON.stringify({
        activeRunId: "run-a",
        severityRank: 9,
        detectedAt: "2026-07-20T00:00:00.000Z",
        caseId: "case-a",
      })
    ).toString("base64url"),
  ])("rechaza cursor malformado", (cursor) => {
    expect(() => decodeIntegrityCursor(cursor)).toThrowError(
      expect.objectContaining({
        dto: expect.objectContaining({ code: "INVALID_INPUT" }),
      })
    )
  })
})
