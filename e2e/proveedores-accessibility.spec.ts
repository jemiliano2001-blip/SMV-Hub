import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

test.describe("Proveedores autenticado", () => {
  test.skip(
    !process.env.PLAYWRIGHT_STORAGE_STATE,
    "Requiere un storageState obtenido mediante Google Sign-In real."
  )

  test("directorio funciona en el viewport y pasa axe", async ({ page }) => {
    await page.goto("/proveedores")

    await expect(
      page.getByRole("heading", { name: "Inteligencia de Compras & Proveedores" })
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "Nuevo Proveedor" })).toBeVisible()
    await expect(page.getByPlaceholder(/Buscar por nombre/)).toBeVisible()

    const resultado = await new AxeBuilder({ page })
      .exclude("[data-sonner-toaster]")
      .analyze()
    expect(resultado.violations).toEqual([])
  })

  test("la ruta retirada responde con una página no encontrada", async ({ page }) => {
    await page.goto("/importar")

    await expect(page.getByRole("heading", { name: "Esta página no existe" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Volver al inicio" })).toBeVisible()
  })
})
