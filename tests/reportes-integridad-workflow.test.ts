import { describe, expect, it } from "vitest"
import { CaseCommandInputSchema } from "../functions/src/reportes-integridad/contratos"
import { IntegrityDomainError } from "../functions/src/reportes-integridad/errores"
import { nextIntegrityState } from "../functions/src/reportes-integridad/workflow"

describe("workflow de Integridad", () => {
  it("aplica las transiciones humanas permitidas", () => {
    expect(nextIntegrityState("abierta", "start_investigation")).toBe("investigando")
    expect(nextIntegrityState("investigando", "request_correction")).toBe("en_correccion")
    expect(nextIntegrityState("en_correccion", "resolve")).toBe("resuelta")
    expect(nextIntegrityState("reabierta", "discard")).toBe("descartada")
  })

  it("mantiene el estado en acciones que no son transición", () => {
    expect(nextIntegrityState("investigando", "assign")).toBe("investigando")
    expect(nextIntegrityState("investigando", "comment")).toBe("investigando")
    expect(nextIntegrityState("investigando", "manual_link")).toBe("investigando")
  })

  it.each(["resuelta", "descartada"] as const)(
    "rechaza mutaciones humanas sobre un caso %s",
    (state) => {
      for (const action of [
        "assign",
        "comment",
        "start_investigation",
        "request_correction",
        "resolve",
        "discard",
        "manual_link",
      ] as const) {
        expect(() => nextIntegrityState(state, action)).toThrow(IntegrityDomainError)
      }
    }
  )

  it("exige campos condicionales y URL HTTPS en los comandos", () => {
    const base = {
      caseId: "ic_1",
      expectedRevision: 2,
      commandId: "command-123",
    }

    expect(CaseCommandInputSchema.safeParse({ ...base, action: "assign" }).success).toBe(false)
    expect(CaseCommandInputSchema.safeParse({ ...base, action: "comment" }).success).toBe(false)
    expect(CaseCommandInputSchema.safeParse({ ...base, action: "discard" }).success).toBe(false)
    expect(
      CaseCommandInputSchema.safeParse({
        ...base,
        action: "comment",
        evidenceUrl: "http://example.com/evidence",
      }).success
    ).toBe(false)
    expect(
      CaseCommandInputSchema.safeParse({
        ...base,
        action: "manual_link",
        sourceRevision: "rev-1",
        localOrderId: "local-1",
        odooInvoiceId: "odoo-1",
        odooCompanyId: 1,
      }).success
    ).toBe(true)
  })
})
