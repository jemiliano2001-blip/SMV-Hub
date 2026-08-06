import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

test.describe("Endmills China (smoke de UI)", () => {
  test.skip(
    process.env.E2E_UI_BYPASS !== "true",
    "Este smoke usa el bypass solo para maquetación; la persistencia requiere login real."
  )

  test("renderiza el inventario sin overflow ni violaciones automáticas", async ({ page }) => {
    await page.goto("/endmills")

    await expect(page.getByRole("heading", { name: "Endmills China" })).toBeVisible()
    await expect(page.getByRole("tab", { name: "Inventario" })).toBeVisible()
    await expect(page.getByRole("tab", { name: "Pedidos" })).toBeVisible()
    await expect(page.getByText("USD", { exact: true })).toBeVisible()

    const tieneOverflowHorizontal = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    )
    expect(tieneOverflowHorizontal).toBe(false)

    const resultado = await new AxeBuilder({ page })
      .exclude("[data-sonner-toaster]")
      .analyze()
    expect(resultado.violations).toEqual([])
  })
})
