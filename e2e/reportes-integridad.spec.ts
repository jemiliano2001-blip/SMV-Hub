import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page, type Route } from "@playwright/test"
import fixture from "../tests/fixtures/reportes-integridad-contracts.json"
import {
  IntegrityCaseDTOSchema,
  OperationalTaskDTOSchema,
  TrustEnvelopeDTOSchema,
  type IntegrityCaseDTO,
  type TrustEnvelopeDTO,
} from "../lib/reportes-integridad"

const email = "admin@smv-hub-e2e.local"
const password = process.env.E2E_TEST_USER_PASSWORD
const uiBypass = process.env.E2E_UI_BYPASS === "true"

test.skip(
  !password && !uiBypass,
  "Requiere E2E_TEST_USER_PASSWORD o E2E_UI_BYPASS=true para una prueba local solo de UI."
)
test.describe.configure({ mode: "serial" })

type MockOptions = {
  stale?: boolean
  ambiguous?: boolean
  firstListFails?: boolean
  commandConflict?: boolean
  listDelayMs?: number
}

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers":
    "authorization,content-type,x-client-version,x-firebase-appcheck,x-firebase-gmpid",
  "access-control-allow-methods": "POST,OPTIONS",
}

function cloneCase(options: MockOptions = {}): IntegrityCaseDTO {
  const item = structuredClone(IntegrityCaseDTOSchema.parse(fixture.case))
  item.workflow.state = "abierta"
  if (options.ambiguous) {
    item.type = "coincidencia_ambigua"
    item.comparison.affectedField = "identity"
    item.comparison.explanation = "Dos facturas Odoo requieren confirmación."
    item.ruleLabel = "Coincidencia por proveedor y referencia"
  }
  return item
}

function cloneTrust(options: MockOptions = {}): TrustEnvelopeDTO {
  const trust = structuredClone(TrustEnvelopeDTOSchema.parse(fixture.trust))
  if (options.stale) {
    trust.sourceStatus = "stale"
    trust.calculationState = "stale"
    trust.staleAfter = "2026-07-29T11:00:00.000Z"
  }
  return trust
}

async function callableResponse(route: Route, data: unknown): Promise<void> {
  if (route.request().method() === "OPTIONS") {
    await route.fulfill({ status: 204, headers: CORS_HEADERS })
    return
  }
  await route.fulfill({
    status: 200,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
    body: JSON.stringify({ data }),
  })
}

async function callableError(
  route: Route,
  status: "ABORTED" | "UNAVAILABLE",
  details: unknown
): Promise<void> {
  if (route.request().method() === "OPTIONS") {
    await route.fulfill({ status: 204, headers: CORS_HEADERS })
    return
  }
  await route.fulfill({
    status: status === "ABORTED" ? 409 : 503,
    headers: { ...CORS_HEADERS, "content-type": "application/json" },
    body: JSON.stringify({
      error: {
        status,
        message:
          status === "ABORTED"
            ? "El caso cambió mientras lo revisabas."
            : "No fue posible cargar el corte de Integridad.",
        details,
      },
    }),
  })
}

async function mockIntegrity(page: Page, options: MockOptions = {}): Promise<void> {
  const trust = cloneTrust(options)
  const detail = cloneCase(options)
  const task = OperationalTaskDTOSchema.parse(fixture.task)
  let listCalls = 0
  let detailRevision = detail.workflow.revision

  await page.route("**/listarCasosIntegridad", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await callableResponse(route, null)
      return
    }
    const input = route.request().postDataJSON()?.data as { scope?: string } | undefined
    if (input?.scope === "all") {
      listCalls += 1
      if (options.listDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, options.listDelayMs))
      }
      if (options.firstListFails && listCalls === 1) {
        await callableError(route, "UNAVAILABLE", {
          code: "DATA_UNAVAILABLE",
          message: "No fue posible cargar el corte de Integridad.",
        })
        return
      }
    }

    if (input?.scope === "mine") {
      await callableResponse(route, {
        scope: "mine",
        trust: null,
        items: [task],
        nextCursor: null,
        total: 1,
      })
      return
    }
    await callableResponse(route, {
      scope: "all",
      trust,
      items: [detail],
      nextCursor: null,
      total: 1,
    })
  })

  await page.route("**/obtenerCasoIntegridad", async (route) => {
    const input = route.request().postDataJSON()?.data as { caseId?: string } | undefined
    if (input?.caseId === task.caseId && page.url().includes("/proveedores/mis-casos")) {
      await callableResponse(route, task)
      return
    }
    const response = structuredClone(detail)
    response.workflow.revision = detailRevision
    await callableResponse(route, response)
  })

  await page.route("**/ejecutarComandoCasoIntegridad", async (route) => {
    if (options.commandConflict) {
      detailRevision = detail.workflow.revision + 1
      await callableError(route, "ABORTED", {
        ...fixture.error,
        currentRevision: detailRevision,
      })
      return
    }
    const input = route.request().postDataJSON()?.data as
      | { caseId?: string; action?: string }
      | undefined
    await callableResponse(route, {
      caseId: input?.caseId ?? detail.caseId,
      revision: detail.workflow.revision + 1,
      state: input?.action === "request_correction" ? "en_correccion" : "investigando",
      idempotent: false,
      message: "Acción registrada en el historial del caso.",
    })
  })
}

async function blockAppCheck(page: Page): Promise<void> {
  await page.route("https://content-firebaseappcheck.googleapis.com/**", (route) =>
    route.abort()
  )
}

async function login(page: Page): Promise<void> {
  if (uiBypass) {
    await page.goto("/")
    await expect(page).toHaveURL(/\/$/)
    return
  }
  await page.goto("/login")
  await page.getByRole("textbox", { name: "Correo electrónico" }).fill(email)
  await page.getByLabel("Contraseña").fill(password as string)
  await page.getByRole("button", { name: "Ingresar", exact: true }).click()
  await expect(page).toHaveURL(/\/$/, { timeout: 20_000 })
}

async function openVisibleCase(page: Page): Promise<void> {
  const button = page.getByRole("button", {
    name: /Abrir caso ic_fixture de Proveedor Fixture/,
  })
  await button.focus()
  await expect(button).toBeFocused()
  await button.press("Enter")
  await expect(page.getByRole("heading", { name: /USD 10\.00 fuera de tolerancia/ })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await blockAppCheck(page)
  await login(page)
})

test("cola e inspector responden por viewport, teclado, axe, zoom y reduced motion", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await mockIntegrity(page, { listDelayMs: 2_000 })
  const navigation = page.goto("/reportes")
  await expect(page.getByLabel("Cargando cola de Integridad")).toBeVisible({
    timeout: 15_000,
  })
  await navigation
  await expect(page.getByRole("heading", { name: "Integridad del gasto" })).toBeVisible()
  await expect(page.getByRole("heading", { name: /Vigente/ })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Cola priorizada" })).toBeVisible()

  if (testInfo.project.name === "integrity-desktop") {
    await expect(
      page.getByRole("heading", { name: /USD 10\.00 fuera de tolerancia/ })
    ).toBeVisible()
  } else {
    await openVisibleCase(page)
    if (testInfo.project.name === "integrity-tablet") {
      await expect(page.getByRole("dialog")).toBeVisible()
    } else {
      await expect(page.getByRole("button", { name: "Volver a la cola" })).toBeVisible()
    }
  }

  const axe = await new AxeBuilder({ page })
    .exclude("[data-sonner-toaster]")
    .analyze()
  expect(axe.violations).toEqual([])

  const cdp = await page.context().newCDPSession(page)
  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 })
  await expect(
    page.getByRole("heading", { name: /USD 10\.00 fuera de tolerancia/ })
  ).toBeVisible()
  await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 })
})

test("stale conserva evidencia y bloquea solo cerrar o vincular", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "integrity-desktop")
  await mockIntegrity(page, { stale: true, ambiguous: true })
  await page.goto("/reportes")

  await expect(page.getByRole("heading", { name: "Desactualizado" })).toBeVisible()
  await expect(page.getByText(/Se conserva el último corte válido/).first()).toBeVisible()
  await expect(page.getByRole("button", { name: "Solicitar corrección" })).toBeEnabled()
  await expect(page.getByRole("button", { name: "Resolver" })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Descartar con motivo" })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Confirmar vínculo" })).toBeDisabled()
  await expect(page.getByRole("radio")).toHaveCount(1)
  await expect(
    page.getByRole("textbox", { name: /ID de orden|ID de factura|Odoo ID/i })
  ).toHaveCount(0)
})

test("error recuperable y conflicto de revisión refrescan sin perder el corte", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "integrity-desktop")
  await mockIntegrity(page, { firstListFails: true, commandConflict: true })
  await page.goto("/reportes")

  await expect(page.getByRole("heading", { name: "No se pudo cargar Integridad" })).toBeVisible()
  await page.getByRole("button", { name: "Reintentar" }).click()
  await expect(page.getByRole("heading", { name: "Cola priorizada" })).toBeVisible()
  await page.getByRole("button", { name: "Solicitar corrección" }).click()
  await expect(page.getByText("El caso cambió mientras lo revisabas.").last()).toBeVisible()
  await expect(page.getByText(/Revisión 4/)).toBeVisible()
  await expect(page.getByRole("heading", { name: "Cola priorizada" })).toBeVisible()
})

test("Mis casos usa exclusivamente la tarea redactada y acciones operativas", async ({
  page,
}) => {
  await mockIntegrity(page)
  await page.goto("/proveedores/mis-casos")

  await expect(page.getByRole("heading", { name: "Mis casos asignados" })).toBeVisible()
  await page.getByRole("button", { name: "Abrir tarea" }).click()
  await expect(
    page.getByRole("heading", {
      name: "Revisar el total capturado y solicitar la corrección en origen.",
    })
  ).toBeVisible()
  await expect(page.getByRole("button", { name: "Agregar comentario" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Marcar en investigación" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Solicitar corrección en origen" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Resolver" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: /Descartar|Asignar|Vincular/ })).toHaveCount(0)

  const text = await page.locator("main").textContent()
  expect(text).not.toMatch(/\$|%|\b110\b|\b100\b|Total comprado|Cobertura|KPI/i)
})
