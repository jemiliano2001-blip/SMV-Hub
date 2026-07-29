import { describe, expect, it } from "vitest"
import fixture from "./fixtures/reportes-integridad-contracts.json"
import {
  CaseCommandInputSchema,
  GetIntegrityCaseInputSchema,
  IntegrityCaseDTOSchema as FunctionCaseSchema,
  IntegrityErrorDTOSchema as FunctionErrorSchema,
  ListIntegrityCasesInputSchema,
  OperationalTaskDTOSchema as FunctionTaskSchema,
  TrustEnvelopeDTOSchema as FunctionTrustSchema,
} from "../functions/src/reportes-integridad/contratos"
import {
  compactCallablePayload,
  IntegrityCaseDTOSchema as ClientCaseSchema,
  IntegrityErrorDTOSchema as ClientErrorSchema,
  OperationalTaskDTOSchema as ClientTaskSchema,
  TrustEnvelopeDTOSchema as ClientTrustSchema,
} from "@/lib/reportes-integridad"

describe("fixtures compartidos de contratos de Integridad", () => {
  it.each([
    ["trust", FunctionTrustSchema, ClientTrustSchema],
    ["case", FunctionCaseSchema, ClientCaseSchema],
    ["task", FunctionTaskSchema, ClientTaskSchema],
    ["error", FunctionErrorSchema, ClientErrorSchema],
  ] as const)("valida %s en Functions y Next.js", (key, functionsSchema, clientSchema) => {
    expect(functionsSchema.parse(fixture[key])).toEqual(
      clientSchema.parse(fixture[key])
    )
  })

  it("el DTO operativo no contiene campos financieros", () => {
    const task = FunctionTaskSchema.parse(fixture.task)
    const keys = new Set<string>()
    const collectKeys = (value: unknown) => {
      if (!value || typeof value !== "object") return
      for (const [key, nested] of Object.entries(value)) {
        keys.add(key.toLowerCase())
        collectKeys(nested)
      }
    }
    collectKeys(task)
    for (const forbidden of [
      "amount",
      "importe",
      "precio",
      "percentage",
      "porcentaje",
      "total",
      "kpi",
      "variation",
      "variacion",
    ]) {
      expect(keys).not.toContain(forbidden)
    }
  })
})

describe("serialización de inputs callable de Integridad", () => {
  it("elimina propiedades undefined antes de usar el serializador de Firebase", () => {
    expect(
      compactCallablePayload({
        scope: "all",
        cursor: undefined,
        filters: {
          severity: undefined,
          type: [],
          currency: [],
          state: [],
        },
      })
    ).toEqual({
      scope: "all",
      filters: {
        type: [],
        currency: [],
        state: [],
      },
    })
  })

  it("trata null como ausencia en cursor y filtros opcionales", () => {
    expect(
      ListIntegrityCasesInputSchema.parse({
        scope: "all",
        filters: {
          severity: null,
          type: null,
          currency: null,
          state: null,
        },
        cursor: null,
        limit: 25,
      })
    ).toEqual({
      scope: "all",
      filters: {
        severity: [],
        type: [],
        currency: [],
        state: [],
      },
      cursor: undefined,
      limit: 25,
    })
  })

  it("trata runId null como ausente al solicitar detalle", () => {
    expect(
      GetIntegrityCaseInputSchema.parse({
        caseId: "case-1",
        runId: null,
      })
    ).toEqual({
      caseId: "case-1",
      runId: undefined,
    })
  })

  it("normaliza opcionales null antes de validar un comando", () => {
    expect(
      CaseCommandInputSchema.parse({
        caseId: "case-1",
        expectedRevision: 1,
        commandId: "command-1",
        action: "start_investigation",
        sourceRevision: null,
        assigneeUid: null,
        reason: null,
        note: null,
        evidenceUrl: null,
        localOrderId: null,
        odooInvoiceId: null,
        odooCompanyId: null,
      })
    ).toMatchObject({
      caseId: "case-1",
      action: "start_investigation",
      sourceRevision: undefined,
      note: undefined,
    })
  })
})
