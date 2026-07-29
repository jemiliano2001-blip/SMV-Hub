import { createHash } from "node:crypto"
import { describe, expect, it } from "vitest"
import {
  ejecutarMotorIntegridad,
  normalizarFactura,
  normalizarProveedor,
  type IntegrityEngineInput,
  type LocalOrderSnapshot,
  type OdooBillSnapshot,
} from "../functions/src/reportes-integridad/motor"

const NOW = "2026-07-29T12:00:00.000Z"
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex")

function local(
  overrides: Partial<LocalOrderSnapshot> = {}
): LocalOrderSnapshot {
  return {
    id: "local-1",
    invoiceNumber: "INV-100",
    providerName: "Acme Supply, LLC",
    providerId: "provider-1",
    effectiveDate: "2026-07-20",
    currency: "USD",
    total: 100,
    updatedAt: "2026-07-20T12:00:00.000Z",
    ...overrides,
  }
}

function bill(overrides: Partial<OdooBillSnapshot> = {}): OdooBillSnapshot {
  return {
    id: "vi_10",
    odooId: 10,
    invoiceNumber: "INV 100",
    providerName: "ACME SUPPLY INC.",
    odooPartnerId: 7,
    odooCompanyId: 1,
    invoiceDate: "2026-07-20",
    currency: "USD",
    total: 100,
    state: "posted",
    type: "factura_proveedor",
    ...overrides,
  }
}

function run(
  overrides: Partial<IntegrityEngineInput> = {}
) {
  return ejecutarMotorIntegridad({
    localOrders: [local()],
    odooBills: [bill()],
    tolerancePct: 2,
    ruleVersion: "integrity-v1",
    now: NOW,
    hash,
    ...overrides,
  })
}

describe("motor determinista de Integridad", () => {
  it("normaliza factura y proveedor sin depender de razón social", () => {
    expect(normalizarFactura(" INV-001 / A ")).toBe("inv001a")
    expect(normalizarProveedor("Ácme Supply, S.A. de C.V.")).toBe("acme")
  })

  it("cuenta una coincidencia exacta en cobertura sin crear caso", () => {
    const result = run()
    expect(result.cases).toEqual([])
    expect(result.coverage).toEqual({
      matched: 1,
      eligible: 1,
      percentage: 100,
    })
    expect(result.summary.exact).toBe(1)
  })

  it("acepta exactamente 2% y abre diferencia solo por encima", () => {
    expect(run({ localOrders: [local({ total: 102 })] }).cases).toHaveLength(0)

    const result = run({ localOrders: [local({ total: 102.01 })] })
    expect(result.cases).toHaveLength(1)
    expect(result.cases[0]).toMatchObject({
      type: "diferencia_importe",
      severity: "media",
    })
    expect(result.cases[0].comparison.percentageDifference).toBeCloseTo(2.01)
  })

  it("clasifica 10% o más como alta", () => {
    const result = run({ localOrders: [local({ total: 110 })] })
    expect(result.cases[0]).toMatchObject({
      type: "diferencia_importe",
      severity: "alta",
      severityRank: 2,
    })
  })

  it("no hace aritmética entre monedas incompatibles", () => {
    const result = run({ localOrders: [local({ currency: "MXN" })] })
    expect(result.cases[0]).toMatchObject({
      type: "currency_mismatch",
      severity: "alta",
      comparison: {
        absoluteDifference: null,
        percentageDifference: null,
      },
    })
  })

  it("no usa fallback por factura si el proveedor no coincide", () => {
    const result = run({
      odooBills: [bill({ providerName: "Otro proveedor" })],
    })
    expect(result.cases.map((item) => item.type).sort()).toEqual([
      "solo_local",
      "solo_odoo",
    ])
  })

  it("distingue documentos ausentes, ambigüedad y duplicado", () => {
    expect(run({ odooBills: [] }).cases[0]).toMatchObject({
      type: "solo_local",
      severity: "media",
    })
    expect(run({ localOrders: [] }).cases[0]).toMatchObject({
      type: "solo_odoo",
      severity: "alta",
    })

    const ambiguous = run({
      odooBills: [bill(), bill({ id: "vi_11", odooId: 11 })],
    })
    expect(ambiguous.cases[0]).toMatchObject({
      type: "coincidencia_ambigua",
      severity: "media",
    })
    expect(ambiguous.cases[0].candidates).toHaveLength(2)

    const duplicate = run({
      localOrders: [local(), local({ id: "local-2" })],
    })
    expect(duplicate.cases[0]).toMatchObject({
      type: "duplicado",
      severity: "alta",
    })
  })

  it("crea datos incompletos y excluye notas de crédito", () => {
    const result = run({
      localOrders: [local({ invoiceNumber: null })],
      odooBills: [
        bill(),
        bill({
          id: "vi_refund",
          odooId: 20,
          type: "nota_credito_proveedor",
        }),
      ],
    })
    expect(result.cases.some((item) => item.type === "datos_incompletos")).toBe(true)
    expect(result.excludedCounts.creditNotes).toBe(1)
    expect(result.cases.some((item) => item.evidence.odoo?.id === "vi_refund")).toBe(false)
  })

  it("aplica un vínculo manual solo mientras su revisión siga vigente", () => {
    const bills = [bill(), bill({ id: "vi_11", odooId: 11, total: 125 })]
    const first = run({ odooBills: bills })
    const ambiguous = first.cases[0]
    const selected = ambiguous.candidates[0]

    const linked = run({
      odooBills: bills,
      manualLinks: [
        {
          localOrderId: selected.localOrderId!,
          odooInvoiceId: selected.odooInvoiceId!,
          odooCompanyId: selected.odooCompanyId!,
          sourceRevision: ambiguous.sourceRevision,
        },
      ],
    })
    expect(linked.summary.exact).toBe(1)
    expect(linked.cases).toHaveLength(1)
    expect(linked.cases[0].type).toBe("solo_odoo")

    const staleLink = run({
      odooBills: bills,
      manualLinks: [
        {
          localOrderId: selected.localOrderId!,
          odooInvoiceId: selected.odooInvoiceId!,
          odooCompanyId: selected.odooCompanyId!,
          sourceRevision: "revision-obsoleta",
        },
      ],
    })
    expect(staleLink.cases[0].type).toBe("coincidencia_ambigua")
  })

  it("mantiene orden canónico y delta estable", () => {
    const result = run({
      localOrders: [
        local({ id: "b", total: 103, updatedAt: NOW }),
        local({
          id: "a",
          invoiceNumber: "INV-200",
          total: 100,
          updatedAt: NOW,
        }),
      ],
      odooBills: [bill({ total: 100 })],
      previousOpenCaseIds: ["caso-corregido"],
    })
    expect(result.cases.map((item) => item.severityRank)).toEqual(
      [...result.cases].map((item) => item.severityRank).sort((a, b) => b - a)
    )
    expect(result.delta.corrected).toBe(1)
  })
})

