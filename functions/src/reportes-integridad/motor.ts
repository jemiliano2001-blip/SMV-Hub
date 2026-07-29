import type {
  IntegrityCandidate,
  IntegrityCaseType,
  IntegritySeverity,
  LocalEvidence,
  OdooEvidence,
} from "./contratos"

export type LocalOrderSnapshot = {
  id: string
  invoiceNumber: string | null
  providerName: string
  providerId: string | null
  effectiveDate: string | null
  currency: string
  total: number | null
  updatedAt: string
}

export type OdooBillSnapshot = {
  id: string
  odooId: number
  invoiceNumber: string
  providerName: string
  odooPartnerId: number
  odooCompanyId: number
  invoiceDate: string | null
  currency: string
  total: number
  state: string
  type: "factura_proveedor" | "nota_credito_proveedor"
}

export type PersistedManualLink = {
  localOrderId: string
  odooInvoiceId: string
  odooCompanyId: number
  sourceRevision: string
}

export type RunCaseEvidence = {
  caseId: string
  type: IntegrityCaseType
  severity: IntegritySeverity
  severityRank: 1 | 2
  detectedAt: string
  providerName: string
  currency: string | null
  localReference: string | null
  odooReference: string | null
  sourceRevision: string
  ruleVersion: string
  ruleLabel: string
  evidence: {
    local: LocalEvidence | null
    odoo: OdooEvidence | null
  }
  comparison: {
    affectedField: "total" | "currency" | "document" | "identity"
    localValue: string | null
    odooValue: string | null
    absoluteDifference: number | null
    percentageDifference: number | null
    tolerancePct: number
    explanation: string
  }
  candidates: IntegrityCandidate[]
}

export type IntegrityEngineResult = {
  cases: RunCaseEvidence[]
  coverage: {
    matched: number
    eligible: number
    percentage: number
  }
  currencyScopes: string[]
  excludedCounts: {
    creditNotes: number
    outsideWindow: number
  }
  summary: {
    open: number
    high: number
    medium: number
    exact: number
  }
  delta: {
    new: number
    corrected: number
    reopened: number
  }
}

export type IntegrityEngineInput = {
  localOrders: LocalOrderSnapshot[]
  odooBills: OdooBillSnapshot[]
  manualLinks?: PersistedManualLink[]
  previousOpenCaseIds?: string[]
  previousDetectedAt?: Record<string, string>
  tolerancePct: number
  ruleVersion: string
  now: string
  outsideWindowCount?: number
  hash: (value: string) => string
}

function normalizarTexto(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("es-MX")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

export function normalizarFactura(value: string | null | undefined): string {
  return normalizarTexto(value ?? "").replace(/[^a-z0-9]/g, "")
}

export function normalizarProveedor(value: string | null | undefined): string {
  return normalizarTexto(value ?? "")
    .replace(
      /\b(sociedad anonima de capital variable|s\.?\s*a\.?\s*de\s*c\.?\s*v\.?|s\.?\s*a\.?|c\.?\s*v\.?|llc|incorporated|inc|company|co|corporation|corp|supply)\b/g,
      ""
    )
    .replace(/[^a-z0-9]/g, "")
}

function claveDocumento(invoiceNumber: string | null, providerName: string): string | null {
  const invoice = normalizarFactura(invoiceNumber)
  const provider = normalizarProveedor(providerName)
  return invoice && provider ? `${invoice}|${provider}` : null
}

function recortarHash(value: string, hash: (input: string) => string): string {
  return hash(value).replace(/[^a-zA-Z0-9]/g, "").slice(0, 32)
}

function serializarRevision(
  local: LocalOrderSnapshot | null,
  odoo: OdooBillSnapshot | null,
  candidates: Array<{ localOrderId: string | null; odooInvoiceId: string | null }>,
  hash: (input: string) => string
): string {
  return recortarHash(
    JSON.stringify({
      local: local
        ? [
            local.id,
            local.invoiceNumber,
            local.providerName,
            local.currency,
            local.total,
            local.updatedAt,
          ]
        : null,
      odoo: odoo
        ? [
            odoo.id,
            odoo.odooId,
            odoo.invoiceNumber,
            odoo.providerName,
            odoo.odooCompanyId,
            odoo.currency,
            odoo.total,
          ]
        : null,
      candidates: candidates
        .map((candidate) => [candidate.localOrderId, candidate.odooInvoiceId])
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    }),
    hash
  )
}

function evidenciaLocal(local: LocalOrderSnapshot | null): LocalEvidence | null {
  if (!local) return null
  return {
    id: local.id,
    invoiceNumber: local.invoiceNumber,
    providerName: local.providerName,
    providerId: local.providerId,
    effectiveDate: local.effectiveDate,
    currency: local.currency,
    total: local.total,
    updatedAt: local.updatedAt,
  }
}

function revisionOdoo(odoo: OdooBillSnapshot, hash: (input: string) => string): string {
  return recortarHash(
    JSON.stringify([
      odoo.id,
      odoo.odooId,
      odoo.invoiceNumber,
      odoo.providerName,
      odoo.odooCompanyId,
      odoo.currency,
      odoo.total,
      odoo.state,
      odoo.type,
    ]),
    hash
  )
}

function evidenciaOdoo(
  odoo: OdooBillSnapshot | null,
  hash: (input: string) => string
): OdooEvidence | null {
  if (!odoo) return null
  return {
    id: odoo.id,
    odooId: odoo.odooId,
    invoiceNumber: odoo.invoiceNumber,
    providerName: odoo.providerName,
    odooPartnerId: odoo.odooPartnerId,
    odooCompanyId: odoo.odooCompanyId,
    invoiceDate: odoo.invoiceDate,
    currency: odoo.currency,
    total: odoo.total,
    sourceRevision: revisionOdoo(odoo, hash),
  }
}

function candidato(
  local: LocalOrderSnapshot | null,
  odoo: OdooBillSnapshot | null,
  sourceRevision: string
): IntegrityCandidate {
  return {
    localOrderId: local?.id ?? null,
    odooInvoiceId: odoo?.id ?? null,
    odooCompanyId: odoo?.odooCompanyId ?? null,
    reference: local?.invoiceNumber || odoo?.invoiceNumber || "Sin referencia",
    providerName: local?.providerName || odoo?.providerName || "Proveedor sin identificar",
    companyLabel: odoo ? `Compañía Odoo ${odoo.odooCompanyId}` : "SMV Hub",
    date: local?.effectiveDate ?? odoo?.invoiceDate ?? null,
    currency: local?.currency || odoo?.currency || "",
    amount: local?.total ?? odoo?.total ?? null,
    sourceRevision,
  }
}

function identidadCaso(
  type: IntegrityCaseType,
  locals: LocalOrderSnapshot[],
  bills: OdooBillSnapshot[],
  currency: string | null,
  hash: (input: string) => string
): string {
  let identity: unknown
  if (
    (type === "diferencia_importe" || type === "currency_mismatch") &&
    locals[0] &&
    bills[0]
  ) {
    identity = [
      type,
      locals[0].id,
      bills[0].odooCompanyId,
      bills[0].id,
      currency,
    ]
  } else if (type === "solo_local" || (type === "datos_incompletos" && locals[0])) {
    identity = [type, locals[0]?.id]
  } else if (type === "solo_odoo" || (type === "datos_incompletos" && bills[0])) {
    identity = [type, bills[0]?.odooCompanyId, bills[0]?.id]
  } else {
    identity = [
      type,
      locals.map((item) => item.id).sort(),
      bills.map((item) => `${item.odooCompanyId}:${item.id}`).sort(),
    ]
  }
  return `ic_${recortarHash(JSON.stringify(identity), hash)}`
}

function severityRank(severity: IntegritySeverity): 1 | 2 {
  return severity === "alta" ? 2 : 1
}

function crearCaso(
  args: {
    type: IntegrityCaseType
    severity: IntegritySeverity
    locals: LocalOrderSnapshot[]
    bills: OdooBillSnapshot[]
    tolerancePct: number
    ruleVersion: string
    now: string
    previousDetectedAt: Record<string, string>
    hash: (input: string) => string
    explanation: string
    affectedField: "total" | "currency" | "document" | "identity"
    absoluteDifference?: number | null
    percentageDifference?: number | null
    localValue?: string | null
    odooValue?: string | null
  }
): RunCaseEvidence {
  const locals = [...args.locals].sort((a, b) => a.id.localeCompare(b.id))
  const bills = [...args.bills].sort(
    (a, b) => a.odooCompanyId - b.odooCompanyId || a.id.localeCompare(b.id)
  )
  const local = locals[0] ?? null
  const odoo = bills[0] ?? null
  const candidatePairs =
    locals.length > 0 && bills.length > 0
      ? locals.flatMap((localItem) =>
          bills.map((billItem) => ({
            localOrderId: localItem.id,
            odooInvoiceId: billItem.id,
          }))
        )
      : locals.length > 0
        ? locals.map((localItem) => ({
            localOrderId: localItem.id,
            odooInvoiceId: null,
          }))
        : bills.map((billItem) => ({
            localOrderId: null,
            odooInvoiceId: billItem.id,
          }))
  const sourceRevision = serializarRevision(local, odoo, candidatePairs, args.hash)
  const candidates =
    locals.length > 0 && bills.length > 0
      ? locals.flatMap((localItem) =>
          bills.map((billItem) => candidato(localItem, billItem, sourceRevision))
        )
      : locals.length > 0
        ? locals.map((localItem) => candidato(localItem, null, sourceRevision))
        : bills.map((billItem) => candidato(null, billItem, sourceRevision))
  const currency =
    local && odoo && local.currency === odoo.currency
      ? local.currency
      : local?.currency || odoo?.currency || null
  const caseId = identidadCaso(
    args.type,
    locals,
    bills,
    currency,
    args.hash
  )
  return {
    caseId,
    type: args.type,
    severity: args.severity,
    severityRank: severityRank(args.severity),
    detectedAt: args.previousDetectedAt[caseId] ?? args.now,
    providerName: local?.providerName || odoo?.providerName || "Proveedor sin identificar",
    currency,
    localReference: local?.invoiceNumber ?? null,
    odooReference: odoo?.invoiceNumber ?? null,
    sourceRevision,
    ruleVersion: args.ruleVersion,
    ruleLabel:
      args.type === "diferencia_importe"
        ? `Tolerancia de importe > ${args.tolerancePct}%`
        : "Coincidencia determinista factura + proveedor",
    evidence: {
      local: evidenciaLocal(local),
      odoo: evidenciaOdoo(odoo, args.hash),
    },
    comparison: {
      affectedField: args.affectedField,
      localValue: args.localValue ?? null,
      odooValue: args.odooValue ?? null,
      absoluteDifference: args.absoluteDifference ?? null,
      percentageDifference: args.percentageDifference ?? null,
      tolerancePct: args.tolerancePct,
      explanation: args.explanation,
    },
    candidates,
  }
}

function agruparPorClave<T>(
  items: T[],
  getKey: (item: T) => string | null
): { groups: Map<string, T[]>; incomplete: T[] } {
  const groups = new Map<string, T[]>()
  const incomplete: T[] = []
  for (const item of items) {
    const key = getKey(item)
    if (!key) {
      incomplete.push(item)
      continue
    }
    const current = groups.get(key) ?? []
    current.push(item)
    groups.set(key, current)
  }
  return { groups, incomplete }
}

function compararUnico(
  local: LocalOrderSnapshot,
  bill: OdooBillSnapshot,
  input: IntegrityEngineInput
): { caseData: RunCaseEvidence | null; matched: boolean; exact: boolean } {
  if (local.total == null || !Number.isFinite(local.total)) {
    return {
      matched: false,
      exact: false,
      caseData: crearCaso({
        type: "datos_incompletos",
        severity: "media",
        locals: [local],
        bills: [bill],
        tolerancePct: input.tolerancePct,
        ruleVersion: input.ruleVersion,
        now: input.now,
        previousDetectedAt: input.previousDetectedAt ?? {},
        hash: input.hash,
        affectedField: "total",
        localValue: local.total == null ? null : String(local.total),
        odooValue: String(bill.total),
        explanation: "La orden local no tiene un total válido para comparar.",
      }),
    }
  }
  if (local.currency !== bill.currency) {
    return {
      matched: true,
      exact: false,
      caseData: crearCaso({
        type: "currency_mismatch",
        severity: "alta",
        locals: [local],
        bills: [bill],
        tolerancePct: input.tolerancePct,
        ruleVersion: input.ruleVersion,
        now: input.now,
        previousDetectedAt: input.previousDetectedAt ?? {},
        hash: input.hash,
        affectedField: "currency",
        localValue: local.currency,
        odooValue: bill.currency,
        explanation: `Moneda incompatible: ${local.currency || "sin moneda"} ↔ ${bill.currency || "sin moneda"}.`,
      }),
    }
  }
  const absoluteDifference = local.total - bill.total
  const divisor = Math.max(Math.abs(bill.total), 0.01)
  const percentageDifference = (absoluteDifference / divisor) * 100
  if (Math.abs(percentageDifference) <= input.tolerancePct) {
    return { caseData: null, matched: true, exact: true }
  }
  const severity: IntegritySeverity =
    Math.abs(percentageDifference) >= 10 ? "alta" : "media"
  return {
    matched: true,
    exact: false,
    caseData: crearCaso({
      type: "diferencia_importe",
      severity,
      locals: [local],
      bills: [bill],
      tolerancePct: input.tolerancePct,
      ruleVersion: input.ruleVersion,
      now: input.now,
      previousDetectedAt: input.previousDetectedAt ?? {},
      hash: input.hash,
      affectedField: "total",
      localValue: String(local.total),
      odooValue: String(bill.total),
      absoluteDifference,
      percentageDifference,
      explanation: `${local.currency} ${Math.abs(absoluteDifference).toFixed(2)} fuera de tolerancia (${percentageDifference >= 0 ? "+" : ""}${percentageDifference.toFixed(1)}%).`,
    }),
  }
}

function ordenarCasos(a: RunCaseEvidence, b: RunCaseEvidence): number {
  return (
    b.severityRank - a.severityRank ||
    a.detectedAt.localeCompare(b.detectedAt) ||
    a.caseId.localeCompare(b.caseId)
  )
}

function currentManualLinkRevision(
  link: PersistedManualLink,
  local: LocalOrderSnapshot,
  bill: OdooBillSnapshot,
  input: IntegrityEngineInput,
  allBills: OdooBillSnapshot[]
): string | null {
  const localKey = claveDocumento(local.invoiceNumber, local.providerName)
  const billKey = claveDocumento(bill.invoiceNumber, bill.providerName)
  if (!localKey || localKey !== billKey) return null
  const locals = input.localOrders.filter(
    (item) => claveDocumento(item.invoiceNumber, item.providerName) === localKey
  )
  const bills = allBills.filter(
    (item) => claveDocumento(item.invoiceNumber, item.providerName) === localKey
  )
  if (locals.length > 1 || bills.length > 1) {
    return crearCaso({
      type: locals.length > 1 ? "duplicado" : "coincidencia_ambigua",
      severity: locals.length > 1 ? "alta" : "media",
      locals,
      bills,
      tolerancePct: input.tolerancePct,
      ruleVersion: input.ruleVersion,
      now: input.now,
      previousDetectedAt: input.previousDetectedAt ?? {},
      hash: input.hash,
      affectedField: locals.length > 1 ? "document" : "identity",
      explanation: "Validación de vínculo manual.",
    }).sourceRevision
  }
  return serializarRevision(
    local,
    bill,
    [{ localOrderId: local.id, odooInvoiceId: bill.id }],
    input.hash
  )
}

export function ejecutarMotorIntegridad(
  input: IntegrityEngineInput
): IntegrityEngineResult {
  if (!Number.isFinite(input.tolerancePct) || input.tolerancePct < 0) {
    throw new Error("tolerancePct inválida")
  }
  const previousDetectedAt = input.previousDetectedAt ?? {}
  const posted = input.odooBills.filter((bill) => bill.state === "posted")
  const creditNotes = posted.filter(
    (bill) => bill.type === "nota_credito_proveedor"
  )
  const bills = posted.filter((bill) => bill.type === "factura_proveedor")
  const localById = new Map(input.localOrders.map((item) => [item.id, item]))
  const billById = new Map(bills.map((item) => [item.id, item]))
  const consumedLocal = new Set<string>()
  const consumedBill = new Set<string>()
  const cases: RunCaseEvidence[] = []
  let matched = 0
  let exact = 0

  for (const link of input.manualLinks ?? []) {
    const local = localById.get(link.localOrderId)
    const bill = billById.get(link.odooInvoiceId)
    if (!local || !bill || bill.odooCompanyId !== link.odooCompanyId) continue
    if (
      currentManualLinkRevision(link, local, bill, input, bills) !==
      link.sourceRevision
    ) {
      continue
    }
    const comparison = compararUnico(local, bill, {
      ...input,
      previousDetectedAt,
    })
    consumedLocal.add(local.id)
    consumedBill.add(bill.id)
    matched += comparison.matched ? 1 : 0
    exact += comparison.exact ? 1 : 0
    if (comparison.caseData) cases.push(comparison.caseData)
  }

  const remainingLocal = input.localOrders.filter(
    (item) => !consumedLocal.has(item.id)
  )
  const remainingBills = bills.filter((item) => !consumedBill.has(item.id))
  const localGroups = agruparPorClave(remainingLocal, (item) =>
    claveDocumento(item.invoiceNumber, item.providerName)
  )
  const billGroups = agruparPorClave(remainingBills, (item) =>
    claveDocumento(item.invoiceNumber, item.providerName)
  )

  for (const local of localGroups.incomplete) {
    cases.push(
      crearCaso({
        type: "datos_incompletos",
        severity: "media",
        locals: [local],
        bills: [],
        tolerancePct: input.tolerancePct,
        ruleVersion: input.ruleVersion,
        now: input.now,
        previousDetectedAt,
        hash: input.hash,
        affectedField: "identity",
        localValue: local.invoiceNumber,
        explanation: "La orden local no tiene factura o proveedor suficiente para formar la clave de conciliación.",
      })
    )
  }
  for (const bill of billGroups.incomplete) {
    cases.push(
      crearCaso({
        type: "datos_incompletos",
        severity: "media",
        locals: [],
        bills: [bill],
        tolerancePct: input.tolerancePct,
        ruleVersion: input.ruleVersion,
        now: input.now,
        previousDetectedAt,
        hash: input.hash,
        affectedField: "identity",
        odooValue: bill.invoiceNumber,
        explanation: "La factura Odoo no tiene factura o proveedor suficiente para formar la clave de conciliación.",
      })
    )
  }

  const keys = new Set([...localGroups.groups.keys(), ...billGroups.groups.keys()])
  for (const key of [...keys].sort()) {
    const locals = localGroups.groups.get(key) ?? []
    const groupBills = billGroups.groups.get(key) ?? []
    if (locals.length > 1) {
      cases.push(
        crearCaso({
          type: "duplicado",
          severity: "alta",
          locals,
          bills: groupBills,
          tolerancePct: input.tolerancePct,
          ruleVersion: input.ruleVersion,
          now: input.now,
          previousDetectedAt,
          hash: input.hash,
          affectedField: "document",
          localValue: `${locals.length} órdenes`,
          odooValue: groupBills.length > 0 ? `${groupBills.length} facturas` : null,
          explanation: `${locals.length} órdenes locales repiten la misma factura y proveedor.`,
        })
      )
      continue
    }
    if (groupBills.length > 1) {
      cases.push(
        crearCaso({
          type: "coincidencia_ambigua",
          severity: "media",
          locals,
          bills: groupBills,
          tolerancePct: input.tolerancePct,
          ruleVersion: input.ruleVersion,
          now: input.now,
          previousDetectedAt,
          hash: input.hash,
          affectedField: "identity",
          localValue: locals[0]?.invoiceNumber ?? null,
          odooValue: `${groupBills.length} candidatas`,
          explanation: `${groupBills.length} facturas candidatas; se requiere vínculo manual.`,
        })
      )
      continue
    }
    if (locals[0] && groupBills[0]) {
      const comparison = compararUnico(locals[0], groupBills[0], {
        ...input,
        previousDetectedAt,
      })
      matched += comparison.matched ? 1 : 0
      exact += comparison.exact ? 1 : 0
      if (comparison.caseData) cases.push(comparison.caseData)
      continue
    }
    if (locals[0]) {
      cases.push(
        crearCaso({
          type: "solo_local",
          severity: "media",
          locals,
          bills: [],
          tolerancePct: input.tolerancePct,
          ruleVersion: input.ruleVersion,
          now: input.now,
          previousDetectedAt,
          hash: input.hash,
          affectedField: "document",
          localValue: locals[0].invoiceNumber,
          explanation: "Sin factura Odoo contabilizada para esta orden de SMV Hub.",
        })
      )
      continue
    }
    if (groupBills[0]) {
      cases.push(
        crearCaso({
          type: "solo_odoo",
          severity: "alta",
          locals: [],
          bills: groupBills,
          tolerancePct: input.tolerancePct,
          ruleVersion: input.ruleVersion,
          now: input.now,
          previousDetectedAt,
          hash: input.hash,
          affectedField: "document",
          odooValue: groupBills[0].invoiceNumber,
          explanation: "Sin orden SMV Hub para esta factura Odoo contabilizada.",
        })
      )
    }
  }

  const currentCaseIds = new Set(cases.map((item) => item.caseId))
  const previousCaseIds = new Set(input.previousOpenCaseIds ?? [])
  const eligible = input.localOrders.filter(
    (item) => claveDocumento(item.invoiceNumber, item.providerName) != null
  ).length
  const percentage = eligible === 0 ? 0 : (matched / eligible) * 100

  return {
    cases: cases.sort(ordenarCasos),
    coverage: {
      matched,
      eligible,
      percentage: Math.round(percentage * 10) / 10,
    },
    currencyScopes: [
      ...new Set(
        [...input.localOrders.map((item) => item.currency), ...bills.map((item) => item.currency)]
          .map((item) => item.trim())
          .filter(Boolean)
      ),
    ].sort(),
    excludedCounts: {
      creditNotes: creditNotes.length,
      outsideWindow: input.outsideWindowCount ?? 0,
    },
    summary: {
      open: cases.length,
      high: cases.filter((item) => item.severity === "alta").length,
      medium: cases.filter((item) => item.severity === "media").length,
      exact,
    },
    delta: {
      new: cases.filter((item) => !previousCaseIds.has(item.caseId)).length,
      corrected: [...previousCaseIds].filter((caseId) => !currentCaseIds.has(caseId)).length,
      reopened: 0,
    },
  }
}

export function ordenarCasosIntegridad(
  cases: RunCaseEvidence[]
): RunCaseEvidence[] {
  return [...cases].sort(ordenarCasos)
}
