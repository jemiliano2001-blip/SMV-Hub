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
          // -H 0.0.0.0: en runners de GitHub Actions, `next start` sin host
          // explícito puede quedar escuchando solo en IPv6 (::1) mientras
          // Chromium resuelve "localhost" a IPv4 primero — la navegación
          // falla con "This page couldn't load" aunque el server esté vivo.
          ? "npx next start -H 0.0.0.0"
          : process.platform === "win32"
            ? "npm.cmd run dev"
            : "npm run dev",
        url: "http://localhost:3000/login",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        // En CI, mostrar el log real del server (host/puerto/errores) en vez de
        // silenciarlo — si el fix de -H 0.0.0.0 no basta, la próxima vez hay
        // evidencia directa en el log en lugar de tener que inferir de capturas.
        stdout: process.env.CI ? "pipe" : "ignore",
        stderr: process.env.CI ? "pipe" : "ignore",
      },
})
