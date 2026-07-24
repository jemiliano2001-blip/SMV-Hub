import { defineConfig } from "@playwright/test"

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL
const storageState = process.env.PLAYWRIGHT_STORAGE_STATE

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // "github" solo anota fallas en el PR; el reporte HTML es lo que se sube como
  // artifact para poder ver el detalle de un run (ver ci.yml "Upload Playwright report").
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: externalBaseUrl ?? "http://localhost:3000",
    channel: "chrome",
    storageState: storageState || undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chrome",
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile-chrome",
      use: { viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: externalBaseUrl
    ? undefined
    : {
        // CI ya corrió `npm run build` en el mismo job (paso "Build Next.js App") —
        // servir ese build real (`next start`, webpack) en vez de reconstruir con
        // `next dev`/Turbopack, que usa un bundler distinto al de producción.
        // En local, sin build previo, `next dev` sigue siendo lo cómodo.
        command: process.env.CI
          ? "npm run start"
          : process.platform === "win32"
            ? "npm.cmd run dev"
            : "npm run dev",
        url: "http://localhost:3000/login",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
