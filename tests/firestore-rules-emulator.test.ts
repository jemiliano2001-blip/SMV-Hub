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
      db.doc("usuarios/notifications-user").set({
        activo: true,
        email: "notifications-user@example.com",
        modulos: ["notificaciones"],
      }),
      db.doc("usuarios/other-notifications-user").set({
        activo: true,
        email: "other-notifications-user@example.com",
        modulos: ["notificaciones"],
      }),
      db.doc("usuarios/endmills-user").set({
        activo: true,
        email: "endmills-user@example.com",
        modulos: ["endmills"],
      }),
      db.doc("usuarios/super-gafetes").set({
        activo: true,
        email: "super-gafetes@example.com",
        esSuperAdmin: true,
        modulos: [],
      }),
      db.doc("usuarios/normal-gafetes").set({
        activo: true,
        email: "normal-gafetes@example.com",
        modulos: ["operadores"],
      }),
      db.doc("operadores/operador-gafete").set({
        nombre: "Trabajador Gafete",
        area: "taller",
        activo: true,
        creadoEn: new Date(),
        actualizadoEn: new Date(),
      }),
      db.doc("endmills-medidas/endmill-001").set({
        orden: 1,
        categoria: "FLAT",
        medidaPulgadas: "1/8",
        descripcion: "FLAT 4 FILOS 1/8",
        stockActual: 9,
        stockActualizadoEn: new Date(),
        precioActualUSD: 3.82,
        cotizacionFecha: "2026-08-06",
        specPropuesta: "D1/8*FL1/2",
        requiereConfirmacion: false,
        notas: null,
        objetivoPar: null,
        ultimoPedidoId: null,
        creadoEn: new Date(),
        actualizadoEn: new Date(),
      }),
      // Medida con la spec/precio de China aún por confirmar (caso de las
      // medidas 2 y 38 del catálogo real).
      db.doc("endmills-medidas/endmill-002").set({
        orden: 2,
        categoria: "FLAT",
        medidaPulgadas: "3/16",
        descripcion: "FLAT 4 FILOS 3/16",
        stockActual: 5,
        stockActualizadoEn: new Date(),
        precioActualUSD: 4.1,
        cotizacionFecha: "2026-08-06",
        specPropuesta: "D3/16*FL5/8",
        requiereConfirmacion: true,
        notas: null,
        objetivoPar: null,
        ultimoPedidoId: null,
        creadoEn: new Date(),
        actualizadoEn: new Date(),
      }),
      // Pedido creado antes de agregar tipoCambioUSD / fechaRecepcionCompleta /
      // diasLeadTime: no trae esas llaves a propósito.
      db.doc("endmills-pedidos/pedido-legacy").set({
        fecha: "2026-08-06",
        numeroProveedor: null,
        estado: "confirmado",
        proveedor: {
          nombre: "ChangZhou North Alloy Tool Co.,Ltd",
          contacto: "Rita",
          email: "bfl9@bfltool.com",
          origen: "China",
        },
        moneda: "USD",
        costoItemsUSD: 38.2,
        aliCostUSD: 0,
        shippingUSD: 0,
        totalUSD: 38.2,
        costosAdicionalesConfirmados: false,
        numeroPartidas: 1,
        numeroPiezas: 10,
        origen: "manual",
        motivoCancelacion: null,
        creadoPorUid: "endmills-user",
        creadoPorNombre: "Compras",
        creadoEn: new Date(),
        actualizadoEn: new Date(),
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

  it("solo permite leer y escribir gafetes a super-admin", async () => {
    const ahora = new Date()
    const payload = {
      operadorId: "operador-gafete",
      cargo: "Asistencia",
      domicilio: "Domicilio de prueba",
      responsableNombre: "Responsable",
      responsablePuesto: "Gerencia",
      responsableTelefono: "8681001683",
      fechaIngreso: "2026-02-06",
      nss: "0905-88-7715-1",
      rfc: "CACE8809015K6",
      fotoPath: "gafetes/operador-gafete/foto.jpg",
      fotoAjuste: { rotacion: 0, zoom: 1, desplazamientoX: 0, desplazamientoY: 0 },
      creadoEn: ahora,
      actualizadoEn: ahora,
    }
    const superGafete = userDb("super-gafetes").doc("gafetes/operador-gafete")
    await assertSucceeds(superGafete.set(payload))
    await assertSucceeds(superGafete.get())
    await assertFails(userDb("normal-gafetes").doc("gafetes/operador-gafete").get())
    await assertFails(userDb("normal-gafetes").doc("gafetes/operador-gafete").set(payload))
    await assertFails(superGafete.update({ operadorId: "otro-operador", actualizadoEn: new Date() }))
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

  it("persiste y permite leer únicamente los marcadores de notificaciones propios", async () => {
    const ruta = "usuarios/notifications-user/notificaciones_leidas/notif-1"
    const marcador = userDb("notifications-user").doc(ruta)

    await assertSucceeds(marcador.set({ leidoEn: new Date() }))
    await assertSucceeds(marcador.get())
    await assertFails(userDb("other-notifications-user").doc(ruta).get())
    await assertFails(marcador.set({ leidoEn: new Date(), campoNoPermitido: true }))
  })

  it("protege el catálogo endmills con el módulo explícito", async () => {
    const permitido = userDb("endmills-user").doc("endmills-medidas/endmill-001")
    await assertSucceeds(permitido.get())
    await assertFails(userDb("report-user").doc("endmills-medidas/endmill-001").get())
    await assertSucceeds(permitido.update({
      stockActual: 8,
      stockActualizadoEn: new Date(),
      actualizadoEn: new Date(),
    }))
    await assertFails(permitido.update({ precioActualUSD: 0.01 }))
    await assertFails(permitido.delete())
  })

  it("crea medidas nuevas de endmills con el módulo, sin campo id en el payload", async () => {
    const nueva = {
      orden: 3,
      categoria: "BALL",
      medidaPulgadas: "1/4",
      descripcion: "BALL 2 FILOS 1/4",
      stockActual: 0,
      stockActualizadoEn: new Date(),
      precioActualUSD: 5.5,
      cotizacionFecha: "2026-08-06",
      specPropuesta: "D1/4*FL3/4",
      requiereConfirmacion: false,
      notas: null,
      objetivoPar: null,
      ultimoPedidoId: null,
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    }
    await assertSucceeds(
      userDb("endmills-user").doc("endmills-medidas/endmill-nueva").set(nueva)
    )
    await assertFails(
      userDb("report-user").doc("endmills-medidas/endmill-otra").set(nueva)
    )
  })

  it("acepta pedidos Endmills USD revisados y rechaza moneda o acceso inválidos", async () => {
    const pedido = {
      fecha: "2026-08-06",
      numeroProveedor: null,
      estado: "confirmado",
      proveedor: {
        nombre: "ChangZhou North Alloy Tool Co.,Ltd",
        contacto: "Rita",
        email: "bfl9@bfltool.com",
        origen: "China",
      },
      moneda: "USD",
      costoItemsUSD: 38.2,
      aliCostUSD: 0,
      shippingUSD: 0,
      totalUSD: 38.2,
      costosAdicionalesConfirmados: false,
      numeroPartidas: 1,
      numeroPiezas: 10,
      origen: "manual",
      motivoCancelacion: null,
      creadoPorUid: "endmills-user",
      creadoPorNombre: "Compras",
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    }
    const permitido = userDb("endmills-user").doc("endmills-pedidos/pedido-reglas-1")
    await assertSucceeds(permitido.set(pedido))
    await assertFails(
      userDb("endmills-user").doc("endmills-pedidos/pedido-reglas-mxn").set({
        ...pedido,
        moneda: "MXN",
      })
    )
    await assertFails(
      userDb("report-user").doc("endmills-pedidos/pedido-reglas-2").set({
        ...pedido,
        creadoPorUid: "report-user",
      })
    )
  })

  it("valida partidas Endmills y no permite borrarlas", async () => {
    const db = userDb("endmills-user")
    const pedidoId = "pedido-partida-1"
    await assertSucceeds(db.doc(`endmills-pedidos/${pedidoId}`).set({
      fecha: "2026-08-06",
      numeroProveedor: null,
      estado: "confirmado",
      proveedor: {
        nombre: "ChangZhou North Alloy Tool Co.,Ltd",
        contacto: "Rita",
        email: "bfl9@bfltool.com",
        origen: "China",
      },
      moneda: "USD",
      costoItemsUSD: 38.2,
      aliCostUSD: 0,
      shippingUSD: 0,
      totalUSD: 38.2,
      costosAdicionalesConfirmados: false,
      numeroPartidas: 1,
      numeroPiezas: 10,
      origen: "manual",
      motivoCancelacion: null,
      creadoPorUid: "endmills-user",
      creadoPorNombre: "Compras",
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    }))
    const partida = db.doc(`endmills-pedido-partidas/${pedidoId}_endmill-001`)
    const payload = {
      pedidoId,
      fechaPedido: "2026-08-06",
      tipo: "catalogada",
      medidaId: "endmill-001",
      categoria: "FLAT",
      medidaPulgadas: "1/8",
      descripcion: "FLAT 4 FILOS 1/8",
      spec: "D1/8*FL1/2",
      stockAntesPedido: 9,
      cantidadPedida: 10,
      cantidadRecibida: 0,
      precioUnitarioUSD: 3.82,
      subtotalUSD: 38.2,
      objetivoPar: 19,
      requiereConfirmacionAlCrear: false,
      confirmacionResuelta: true,
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    }
    await assertSucceeds(partida.set(payload))
    await assertFails(
      db.doc(`endmills-pedido-partidas/${pedidoId}_otra-medida`).set(payload)
    )
    await assertFails(partida.set({ ...payload, cantidadPedida: -1 }))
    await assertFails(partida.delete())
  })

  it("permite resolver requiereConfirmacion pero no volver a marcarla", async () => {
    const porConfirmar = userDb("endmills-user").doc("endmills-medidas/endmill-002")
    await assertSucceeds(porConfirmar.update({
      requiereConfirmacion: false,
      actualizadoEn: new Date(),
    }))
    // Una vez resuelta, el cliente no puede volver a marcarla como pendiente.
    await assertFails(porConfirmar.update({
      requiereConfirmacion: true,
      actualizadoEn: new Date(),
    }))
    await assertFails(userDb("report-user").doc("endmills-medidas/endmill-002").update({
      requiereConfirmacion: false,
      actualizadoEn: new Date(),
    }))
  })

  it("permite recibir un pedido anterior a los campos de lead time", async () => {
    const legacy = userDb("endmills-user").doc("endmills-pedidos/pedido-legacy")
    await assertSucceeds(legacy.update({
      estado: "recibido",
      fechaRecepcionCompleta: "2026-08-20",
      diasLeadTime: 14,
      actualizadoEn: new Date(),
    }))
  })

  it("valida las notificaciones de endmills por módulo y forma", async () => {
    const base = {
      tipo: "endmills_stock_critico",
      titulo: "Stock crítico: FLAT 4 FILOS 1/8",
      cuerpo: "Quedan 1 pzas.",
      origenModulo: "endmills",
      origenId: "endmill-001",
      audiencia: "endmills",
      destinatarioUid: null,
      href: "/endmills",
      creadoPorUid: "endmills-user",
      creadoPorNombre: "Compras",
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    }
    const permitida = userDb("endmills-user").doc("notificaciones/endmills-notif-1")
    await assertSucceeds(permitida.set(base))
    await assertSucceeds(permitida.get())

    // Sin el módulo endmills no se puede crear ni leer.
    await assertFails(
      userDb("report-user").doc("notificaciones/endmills-notif-2").set({
        ...base,
        creadoPorUid: "report-user",
      })
    )
    await assertFails(userDb("report-user").doc("notificaciones/endmills-notif-1").get())

    // El origen debe apuntar a una medida real del catálogo.
    await assertFails(
      userDb("endmills-user").doc("notificaciones/endmills-notif-3").set({
        ...base,
        origenId: "medida-inexistente",
      })
    )
    // Combinación tipo/origen/audiencia incoherente.
    await assertFails(
      userDb("endmills-user").doc("notificaciones/endmills-notif-4").set({
        ...base,
        audiencia: "requisiciones",
      })
    )
    // Sin el bloque duplicado permisivo, las notificaciones son inmutables.
    await assertFails(permitida.update({ titulo: "editado" }))
    await assertFails(permitida.delete())
  })

  it("el harness realmente ejecutó contra el emulador", () => {
    expect(emulatorHost).toMatch(/:\d+$/)
  })
})
