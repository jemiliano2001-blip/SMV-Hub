import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST
const describeWithEmulator = emulatorHost ? describe : describe.skip
const projectId = "smv-hub-reportes-integridad-rules"
let environment: RulesTestEnvironment

function userDb(uid: string) {
  return environment.authenticatedContext(uid, {
    email: `${uid}@example.com`,
    email_verified: true,
  }).firestore()
}

async function seed(): Promise<void> {
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await Promise.all([
      db.doc("usuarios/finance-user").set({
        activo: true,
        email: "finance-user@example.com",
        modulos: ["reportes", "finanzas"],
      }),
      db.doc("usuarios/provider-user").set({
        activo: true,
        email: "provider-user@example.com",
        modulos: ["proveedores"],
      }),
      db.doc("usuarios/report-user").set({
        activo: true,
        email: "report-user@example.com",
        modulos: ["reportes"],
      }),
      db.doc("compras_odoo_po/po-1").set({ name: "PO-1" }),
      db.doc("compras_odoo_facturas/bill-1").set({ name: "BILL-1" }),
      db.doc("compras_odoo_items/item-1").set({
        total: 100,
        categoriaId: null,
        tipoInsumo: null,
        tipoMetal: null,
        medida: null,
        clasificadoPorIa: false,
        actualizadoEn: null,
      }),
      db.doc("compras_odoo_sync_state/current").set({ status: "ready" }),
      db.doc("reportes_integridad_state/config").set({ mode: "shadow" }),
      db.doc("reportes_integridad_runs/run-1").set({ status: "ready" }),
      db.doc("reportes_integridad_run_cases/run-1_case-1").set({ caseId: "case-1" }),
      db.doc("reportes_integridad_workflows/case-1").set({ state: "abierta" }),
      db.doc("reportes_integridad_workflows/case-1/events/event-1").set({
        action: "comment",
      }),
    ])
  })
}

describeWithEmulator("reglas Firestore de Integridad", () => {
  beforeAll(async () => {
    const [host, portText] = emulatorHost!.split(":")
    environment = await initializeTestEnvironment({
      projectId,
      firestore: {
        host,
        port: Number(portText),
        rules: readFileSync(resolve(import.meta.dirname, "..", "firestore.rules"), "utf8"),
      },
    })
  })

  beforeEach(async () => {
    await environment.clearFirestore()
    await seed()
  })

  afterAll(async () => {
    await environment?.cleanup()
  })

  it.each([
    "reportes_integridad_state/config",
    "reportes_integridad_runs/run-1",
    "reportes_integridad_run_cases/run-1_case-1",
    "reportes_integridad_workflows/case-1",
    "reportes_integridad_workflows/case-1/events/event-1",
  ])("niega lectura y escritura directa de %s", async (path) => {
    const db = userDb("finance-user")
    await assertFails(db.doc(path).get())
    await assertFails(db.doc(path).set({ touched: true }, { merge: true }))
  })

  it("restringe el espejo Odoo a Proveedores, Finanzas o superadmin", async () => {
    await assertSucceeds(userDb("provider-user").doc("compras_odoo_po/po-1").get())
    await assertSucceeds(userDb("finance-user").doc("compras_odoo_facturas/bill-1").get())
    await assertFails(userDb("report-user").doc("compras_odoo_po/po-1").get())
    await assertFails(
      environment.unauthenticatedContext().firestore().doc("compras_odoo_po/po-1").get()
    )
  })

  it("solo permite clasificar campos aprobados de items Odoo", async () => {
    const item = userDb("provider-user").doc("compras_odoo_items/item-1")
    await assertSucceeds(
      item.update({
        categoriaId: "herramientas",
        clasificadoPorIa: true,
        actualizadoEn: new Date(),
      })
    )
    await assertFails(item.update({ total: 999 }))
    await assertFails(
      userDb("finance-user").doc("compras_odoo_items/item-1").update({
        categoriaId: "finanzas-no-clasifica",
      })
    )
    await assertFails(
      userDb("provider-user").doc("compras_odoo_items/item-2").set({ total: 10 })
    )
  })

  it("mantiene el estado de sincronización en solo lectura autorizada", async () => {
    const provider = userDb("provider-user").doc("compras_odoo_sync_state/current")
    await assertSucceeds(provider.get())
    await assertFails(provider.update({ status: "tampered" }))
    await assertFails(userDb("report-user").doc("compras_odoo_sync_state/current").get())
  })

  it("el harness realmente ejecutó contra el emulador", () => {
    expect(emulatorHost).toMatch(/:\d+$/)
  })
})
