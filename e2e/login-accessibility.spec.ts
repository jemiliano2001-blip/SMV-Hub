import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

test("login es utilizable y no tiene violaciones automáticas", async ({ page }) => {
  await page.goto("/login")

  await expect(page.getByRole("heading", { name: "SMV Hub" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Ingresar con Google" })).toBeVisible()
  await expect(page.getByRole("textbox", { name: "Correo electrónico" })).toBeVisible()
  await expect(page.getByLabel("Contraseña")).toBeVisible()

  const resultado = await new AxeBuilder({ page }).analyze()
  expect(resultado.violations).toEqual([])
})

test("una ruta eliminada no expone contenido sin sesión", async ({ page }) => {
  await page.goto("/importar")

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole("heading", { name: "SMV Hub" })).toBeVisible()
})
