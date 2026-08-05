// E2E del camino del dinero: nueva compra → la orden existe → el reporte
// cuadra → el filtro de moneda no mezcla montos → el cierre contable respeta
// la moneda activa. Es el spec que justifica todo el trabajo de cablear
// Playwright en CI (ver
// docs/superpowers/plans/2026-07-24-lazo-retroalimentacion-produccion.md,
// Task 3): si `aplanarLineas`/`calcularKpis` (lib/reportes.ts) alguna vez deja
// de sumar el envío, o si `handleGuardarLote` (ReporteContableView.tsx)
// vuelve a archivar todas las monedas en vez de solo la activa, este spec
// falla.
//
// Corre contra smv-brain-dev (nunca producción). La llamada a Gemini se
// stubea vía page.route — no se prueba la IA, se prueba qué hace la app con
// su respuesta. Requiere el usuario de prueba creado con
// scripts/crear-usuario-e2e.mjs y E2E_TEST_USER_PASSWORD en el entorno.
// (Verificado en CI real el 2026-07-25 tras cablear los secrets E2E_FIREBASE_*.)
//
// Login real dentro de cada test (no un storageState de otro proyecto):
// Firebase Auth persiste la sesión en IndexedDB, que
// `page.context().storageState()` no serializa — un proyecto "setup" +
// storageState separado se queda con la sesión vacía al cruzar de contexto
// (confirmado corriendo el spec: el storageState resultante no traía nada de
// localhost, solo el origin de google.com del reCAPTCHA).
import { test, expect, type Page } from "@playwright/test"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"

const E2E_TEST_USER_EMAIL = "admin@smv-hub-e2e.local"
const password = process.env.E2E_TEST_USER_PASSWORD

test.skip(
  !password,
  "Falta E2E_TEST_USER_PASSWORD — ver Task 3 en docs/superpowers/plans/2026-07-24-lazo-retroalimentacion-produccion.md."
)

const FIXTURE_FACTURA = path.join(__dirname, "fixtures", "factura-e2e.png")

async function bloquearAppCheck(page: Page): Promise<void> {
  // App Check ya está desactivado a nivel de reglas (appCheckValido() → true
  // desde 2026-07-13, ver firestore.rules), pero el SDK cliente igual intenta
  // canjear NEXT_PUBLIC_APP_CHECK_DEBUG_TOKEN contra smv-brain-dev (nunca
  // configurado ahí) y reintenta agresivamente contra un 403 sostenido — eso
  // satura el hilo del navegador y cuelga cualquier comando de Playwright
  // (confirmado: page.route() nunca resolvía). No afecta la seguridad real.
  await page.route("https://content-firebaseappcheck.googleapis.com/**", (route) =>
    route.abort()
  )
}

async function login(page: Page): Promise<void> {
  await page.goto("/login")
  await page.getByRole("textbox", { name: "Correo electrónico" }).fill(E2E_TEST_USER_EMAIL)
  await page.getByLabel("Contraseña").fill(password as string)
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 })
}

/** Extrae el valor numérico de un texto formateado como moneda (cualquier símbolo/locale). */
function parsearMonto(texto: string): number {
  const limpio = texto.replace(/[^\d.,-]/g, "").replace(/,/g, "")
  return Number.parseFloat(limpio)
}

function crearStub(opts: {
  proveedor: string
  numeroFactura: string
  moneda: string
  subtotal: number
  envio: number
  total: number
}) {
  const hoy = new Date().toISOString().slice(0, 10)
  return {
    proveedor: opts.proveedor,
    numeroFactura: opts.numeroFactura,
    fechaFactura: hoy,
    moneda: opts.moneda,
    subtotal: opts.subtotal,
    envio: opts.envio,
    impuestos: 0,
    total: opts.total,
    items: [
      {
        descripcion: "Tornillo E2E",
        cantidad: 10,
        precioUnitario: opts.subtotal / 10,
        total: opts.subtotal,
        claveProdServ: null,
        satPendiente: true,
        empresa: "SMV",
        cuentaCargo: "Stock",
        requisitor: "E2E Bot",
        ordenTrabajo: "",
      },
    ],
  }
}

/** Captura → /nueva-compra con la respuesta de Gemini stubeada → guarda. */
async function crearOrdenViaStub(page: Page, stub: ReturnType<typeof crearStub>): Promise<void> {
  await page.unroute("**/api/extraer")
  await page.route("**/api/extraer", (route) => route.fulfill({ json: stub }))

  await page.goto("/nueva-compra")
  await page.locator('input[type="file"]').setInputFiles(FIXTURE_FACTURA)

  const proveedorInput = page.getByPlaceholder("Nombre del proveedor")
  await expect(proveedorInput).toHaveValue(stub.proveedor, { timeout: 15_000 })

  await page.getByRole("checkbox", { name: "Notificar por WhatsApp al guardar" }).uncheck()

  const guardarBtn = page.getByRole("button", { name: "Guardar compra" })
  await expect(guardarBtn).toBeEnabled({ timeout: 10_000 })
  await guardarBtn.click()

  await expect(page).toHaveURL(/\/ordenes$/, { timeout: 15_000 })
}

/** Selecciona una moneda en el <select> visible (ReporteView o ReporteContableView comparten el patrón). */
async function seleccionarMoneda(page: Page, moneda: string): Promise<void> {
  const selector = page
    .locator("select")
    .filter({ has: page.getByRole("option", { name: moneda, exact: true }) })
  await selector.selectOption(moneda)
}

async function prepararReporteGerencial(page: Page): Promise<void> {
  await page.goto("/reportes")
  const btnGerencial = page.getByRole("button", { name: "Reporte gerencial" })
  if ((await btnGerencial.count()) > 0) {
    await btnGerencial.click()
  }
  await page.getByRole("button", { name: "Este mes" }).click()

  // El selector de moneda solo existe en el DOM si el periodo tiene más de una
  // moneda — cuando no está, `monedaActiva` ya resuelve sola a la única moneda
  // presente (ver lib/reportes.ts / ReporteView.tsx).
  const selectorMoneda = page
    .locator("select")
    .filter({ has: page.getByRole("option", { name: "USD", exact: true }) })
  if ((await selectorMoneda.count()) > 0) {
    await selectorMoneda.selectOption("USD")
  }
}

async function leerTotalComprado(page: Page): Promise<number> {
  // FranjaKpis (y "Total comprado") solo se renderiza si el periodo tiene al
  // menos una línea (ver `{lineas.length > 0 && <FranjaKpis .../>}` en
  // ReporteView.tsx) — en smv-brain-dev, antes de crear la primera orden de
  // este spec, el periodo está vacío y solo existe el mensaje de tabla vacía.
  const titulo = page.getByText("Total comprado", { exact: true })
  const vacio = page.getByText("No hay compras en este periodo con los filtros seleccionados.")
  await expect(titulo.or(vacio).first()).toBeVisible()
  if ((await titulo.count()) === 0) return 0

  const valor = titulo.locator("xpath=following-sibling::p[1]")
  const texto = await valor.textContent()
  return parsearMonto(texto ?? "")
}

async function limpiarOrdenCreada(page: Page, numeroFactura: string): Promise<void> {
  await page.goto("/ordenes")
  await page.getByPlaceholder(/Buscar por proveedor, factura/).fill(numeroFactura)

  const filas = page.locator("tbody tr")
  if ((await filas.count()) === 0) return // nunca se llegó a crear — nada que limpiar

  await page.locator("thead input[type=checkbox]").check()
  await page.getByRole("button", { name: /Eliminar \d+ seleccionadas/ }).click()
  await page.getByRole("button", { name: "Eliminar órdenes" }).click()
  await expect(page.locator("tbody tr")).toHaveCount(0)
}

/**
 * `reportes_contables` tiene `allow update, delete: if false` en firestore.rules
 * (un lote cerrado es inmutable por diseño) — ni un super-admin puede borrarlo
 * desde el cliente. La única forma de limpiar el lote que crea el paso 5 es
 * Admin SDK, mismo patrón de credenciales que scripts/crear-usuario-e2e.mjs.
 * Best-effort: si no hay credenciales (p. ej. CI sin GOOGLE_APPLICATION_CREDENTIALS),
 * el lote queda huérfano en smv-brain-dev, pero no se falla el test por esto —
 * las aserciones funcionales ya corrieron para entonces.
 */
async function borrarLoteContable(loteId: string): Promise<void> {
  try {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const adcCli = path.join(
        homedir(),
        "AppData",
        "Roaming",
        "firebase",
        "jemiliano2001_gmail_com_application_default_credentials.json"
      )
      if (existsSync(adcCli)) process.env.GOOGLE_APPLICATION_CREDENTIALS = adcCli
    }
    const { initializeApp } = await import("firebase-admin/app")
    const { getFirestore } = await import("firebase-admin/firestore")
    initializeApp({ projectId: "smv-brain-dev" })
    const db = getFirestore("compras-americanas")
    await db.collection("reportes_contables").doc(loteId).delete()
  } catch (err) {
    console.warn(`No se pudo borrar el lote contable ${loteId} de smv-brain-dev:`, err)
  }
}

test.describe("camino del dinero", () => {
  // Ambos tests escriben/leen Firestore real (smv-brain-dev) sobre el mismo
  // periodo ("Este mes") — nunca en paralelo entre sí, y si el primero falla
  // el segundo se salta solo (comportamiento por defecto de "serial") en vez
  // de correr con datos a medio crear.
  test.describe.configure({ mode: "serial" })

  test.beforeEach(async ({ page }) => {
    await bloquearAppCheck(page)
    await login(page)
  })

  test("captura → orden → reporte cuadra con envío incluido", async ({ page }) => {
    const numeroFactura = `E2E-${Date.now()}`
    const proveedor = "E2E Test Proveedor"
    const stub = crearStub({
      proveedor,
      numeroFactura,
      moneda: "USD",
      subtotal: 100,
      envio: 25,
      total: 125,
    })

    try {
      const totalAntes = await test.step("baseline: leer KPI antes de crear la orden", async () => {
        await prepararReporteGerencial(page)
        return leerTotalComprado(page)
      })

      await test.step("paso 1 — captura en /nueva-compra", () => crearOrdenViaStub(page, stub))

      await test.step("paso 2 — la orden existe en /ordenes", async () => {
        await page.getByPlaceholder(/Buscar por proveedor, factura/).fill(numeroFactura)

        const fila = page.locator("tr", { hasText: numeroFactura })
        await expect(fila).toHaveCount(1)
        await fila.getByRole("button", { name: "Ver detalles" }).click()

        await expect(
          page.getByRole("heading", { name: "Detalles de Orden de Compra" })
        ).toBeVisible()
        // No usar getByText(proveedor): "E2E Test Proveedor" también matchea un
        // <option> oculto del autocompletado y la <td title=...> de la fila en
        // /ordenes que sigue en el DOM debajo del modal. El único <div
        // title=...> es el resumen del modal (ver OrdenDetallesModal.tsx,
        // tarjeta "Proveedor y Estado").
        await expect(page.locator(`div[title="${proveedor}"]`)).toBeVisible()

        const totalEnModal = await page.getByText("Total:").last()
          .locator("xpath=following-sibling::span")
          .textContent()
        expect(parsearMonto(totalEnModal ?? "")).toBeCloseTo(125, 1)
      })

      await test.step("paso 3 — el reporte cuadra (incluye el envío)", async () => {
        await prepararReporteGerencial(page)
        const totalDespues = await leerTotalComprado(page)
        expect(totalDespues - totalAntes).toBeCloseTo(125, 1)
      })
    } finally {
      await limpiarOrdenCreada(page, numeroFactura)
    }
  })

  test("filtro de moneda no mezcla montos y el cierre contable respeta la moneda activa", async ({
    page,
  }) => {
    const numeroFacturaUSD = `E2E-USD-${Date.now()}`
    const numeroFacturaMXN = `E2E-MXN-${Date.now()}`
    const proveedorUSD = "E2E Test Proveedor USD"
    const proveedorMXN = "E2E Test Proveedor MXN"
    const stubUSD = crearStub({
      proveedor: proveedorUSD,
      numeroFactura: numeroFacturaUSD,
      moneda: "USD",
      subtotal: 100,
      envio: 0,
      total: 100,
    })
    const stubMXN = crearStub({
      proveedor: proveedorMXN,
      numeroFactura: numeroFacturaMXN,
      moneda: "MXN",
      subtotal: 500,
      envio: 0,
      total: 500,
    })

    let loteId: string | null = null

    try {
      await test.step("crear orden en USD", () => crearOrdenViaStub(page, stubUSD))
      await test.step("crear orden en MXN", () => crearOrdenViaStub(page, stubMXN))

      await test.step("paso 4 — el filtro de moneda cambia las cifras, no solo el <select>", async () => {
        await page.goto("/reportes")
        const btnGerencial = page.getByRole("button", { name: "Reporte gerencial" })
        if ((await btnGerencial.count()) > 0) {
          await btnGerencial.click()
        }
        await page.getByRole("button", { name: "Este mes" }).click()

        // Con dos monedas presentes, el selector debe existir (a diferencia
        // de prepararReporteGerencial(), que lo trata como opcional).
        await seleccionarMoneda(page, "USD")
        expect(await leerTotalComprado(page)).toBeCloseTo(100, 1)

        await seleccionarMoneda(page, "MXN")
        expect(await leerTotalComprado(page)).toBeCloseTo(500, 1)
      })

      await test.step("paso 5 — cierre contable solo archiva la moneda activa", async () => {
        await page.goto("/reportes/contable")
        await seleccionarMoneda(page, "USD")

        await page.getByRole("button", { name: "Cerrar Reporte", exact: true }).click()

        // El diálogo debe avisar de la moneda que se queda pendiente — el bug
        // original (P1, ver design doc) era archivar TODAS las monedas de un
        // jalón sin avisar.
        const dialogo = page.getByRole("alertdialog")
        await expect(dialogo).toBeVisible()
        await expect(dialogo).toContainText("MXN")
        await expect(dialogo).toContainText("seguirán pendientes")

        await page.getByRole("button", { name: "Cerrar reporte", exact: true }).click()
        await expect(dialogo).toBeHidden()

        // USD ya se archivó: desaparece de "Nuevos (Pendientes por Enviar)".
        await expect(page.locator("tbody tr", { hasText: proveedorUSD })).toHaveCount(0)
        // MXN sigue pendiente — esta es la aserción que atrapa el bug real.
        await expect(page.locator("tbody tr", { hasText: proveedorMXN })).toHaveCount(1)

        // Capturar el loteId recién creado para poder borrarlo en la limpieza.
        await page.getByRole("button", { name: /Historial de Reportes/ }).click()
        const loteTexto = await page.getByText(/^LOTE-\d{8}-[A-Z0-9]{4}$/).first().textContent()
        loteId = loteTexto?.trim() ?? null
      })
    } finally {
      await limpiarOrdenCreada(page, numeroFacturaUSD)
      await limpiarOrdenCreada(page, numeroFacturaMXN)
      if (loteId) await borrarLoteContable(loteId)
    }
  })
})
