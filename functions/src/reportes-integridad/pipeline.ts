import { createHash, randomUUID } from "node:crypto"
import type { Firestore } from "firebase-admin/firestore"
import type {
  FacturaProveedorCrudoNormalizado,
  PoCrudoNormalizado,
} from "../odoo-compras-mapeo"
import type { IntegrityErrorCode } from "./contratos"
import { IntegrityDomainError } from "./errores"
import {
  ejecutarMotorIntegridad,
  type OdooBillSnapshot,
} from "./motor"
import {
  filterOdooBillsWindow,
  materializeIntegrityRun,
  readAllWorkflows,
  readIntegrityConfig,
  readLocalOrdersWindow,
  type IntegrityConfig,
} from "./repositorio"

export async function runIntegrityWithoutBlockingMirror<T>(args: {
  run: () => Promise<T>
  fallback: T
  onDomainError?: (error: IntegrityDomainError) => void
}): Promise<{ result: T; errorCode: IntegrityErrorCode | null }> {
  try {
    return { result: await args.run(), errorCode: null }
  } catch (error) {
    if (!(error instanceof IntegrityDomainError)) throw error
    args.onDomainError?.(error)
    return { result: args.fallback, errorCode: error.dto.code }
  }
}

export function validateIntegritySourceSnapshot(args: {
  config: IntegrityConfig
  purchaseOrders: PoCrudoNormalizado[]
  bills: FacturaProveedorCrudoNormalizado[]
}): void {
  if (args.config.mode === "off") return
  if (args.purchaseOrders.length === 0 || args.bills.length === 0) {
    throw new IntegrityDomainError(
      "SOURCE_SNAPSHOT_INVALID",
      "Odoo devolvió una fuente vacía; se conserva la última corrida válida."
    )
  }
}

function toBillSnapshot(
  bill: FacturaProveedorCrudoNormalizado
): OdooBillSnapshot {
  return {
    id: bill.id,
    odooId: bill.odooId,
    invoiceNumber: bill.numeroFactura,
    providerName: bill.proveedorNombre,
    odooPartnerId: bill.odooPartnerId,
    odooCompanyId: bill.odooCompanyId,
    invoiceDate: bill.fechaFactura,
    currency: bill.moneda,
    total: bill.total,
    state: bill.estado,
    type: bill.tipo,
  }
}

export async function runIntegrityPipeline(args: {
  db: Firestore
  config: IntegrityConfig
  purchaseOrders: PoCrudoNormalizado[]
  bills: FacturaProveedorCrudoNormalizado[]
  syncId?: string
  computedAt?: Date
  startedAtMs?: number
}): Promise<{
  mode: IntegrityConfig["mode"]
  runId: string | null
  cases: number
  checksum: string | null
}> {
  if (args.config.mode === "off") {
    return { mode: "off", runId: null, cases: 0, checksum: null }
  }
  validateIntegritySourceSnapshot({
    config: args.config,
    purchaseOrders: args.purchaseOrders,
    bills: args.bills,
  })

  const computedAt = args.computedAt ?? new Date()
  const workflows = await readAllWorkflows(args.db)
  let localWindow
  try {
    localWindow = await readLocalOrdersWindow(args.db, workflows, computedAt)
  } catch (error) {
    console.error("Integridad: consulta local falló", error)
    throw new IntegrityDomainError(
      "SOURCE_SNAPSHOT_INVALID",
      "No fue posible construir el corte local; se conserva la última corrida válida."
    )
  }
  if (localWindow.orders.length === 0) {
    throw new IntegrityDomainError(
      "SOURCE_SNAPSHOT_INVALID",
      "El corte local está vacío; se conserva la última corrida válida."
    )
  }
  const odooWindow = filterOdooBillsWindow(
    args.bills.map(toBillSnapshot),
    workflows,
    localWindow.cutoff
  )
  const previousDetectedAt = Object.fromEntries(
    [...workflows.values()].map((workflow) => [
      workflow.caseId,
      workflow.detectedAt,
    ])
  )
  const previousOpenCaseIds = [...workflows.values()]
    .filter((workflow) =>
      ["abierta", "investigando", "en_correccion", "reabierta"].includes(
        workflow.state
      )
    )
    .map((workflow) => workflow.caseId)
  const manualLinks = [...workflows.values()].flatMap((workflow) =>
    workflow.manualLink ? [workflow.manualLink] : []
  )
  const engine = ejecutarMotorIntegridad({
    localOrders: localWindow.orders,
    odooBills: odooWindow.bills,
    manualLinks,
    previousOpenCaseIds,
    previousDetectedAt,
    tolerancePct: args.config.tolerancePct,
    ruleVersion: args.config.ruleVersion,
    now: computedAt.toISOString(),
    outsideWindowCount: odooWindow.outsideWindowCount,
    hash: (value) => createHash("sha256").update(value).digest("hex"),
  })
  const result = await materializeIntegrityRun({
    db: args.db,
    syncId:
      args.syncId ??
      `sync_${computedAt.toISOString().replace(/\D/g, "").slice(0, 17)}_${randomUUID().slice(0, 8)}`,
    config: args.config,
    engine,
    sourceCounts: {
      localOrders: localWindow.orders.length,
      odooPurchaseOrders: args.purchaseOrders.length,
      odooBills: args.bills.length,
    },
    computedAt,
    durationMs: Date.now() - (args.startedAtMs ?? computedAt.getTime()),
  })
  return {
    mode: args.config.mode,
    runId: result.runId,
    cases: engine.cases.length,
    checksum: result.checksum,
  }
}

export async function loadIntegrityConfig(
  db: Firestore
): Promise<IntegrityConfig> {
  return readIntegrityConfig(db)
}
