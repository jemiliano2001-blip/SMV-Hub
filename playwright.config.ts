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
      testMatch: /.*-accessibility\.spec\.ts/,
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile-chrome",
      testMatch: /.*-accessibility\.spec\.ts/,
      use: { viewport: { width: 390, height: 844 } },
    },
    {
      name: "integrity-desktop",
      testMatch: /reportes-integridad\.spec\.ts/,
      timeout: 120_000,
      use: { viewport: { width: 1440, height: 900 } },
    },
    {
      name: "integrity-tablet",
      testMatch: /reportes-integridad\.spec\.ts/,
      timeout: 120_000,
      use: { viewport: { width: 1024, height: 768 } },
    },
    {
      name: "integrity-mobile",
      testMatch: /reportes-integridad\.spec\.ts/,
      timeout: 120_000,
      use: { viewport: { width: 390, height: 844 } },
    },
    {
      // Escribe/lee Firestore real (smv-brain-dev) — un solo proyecto, sin
      // paralelismo entre viewports ni reintentos: un retry dejaría la orden
      // de la corrida anterior a medias y el segundo intento chocaría con la
      // verificación de factura duplicada en vez de repetir el fallo original.
      // Login real dentro del propio spec (ver e2e/camino-dinero.spec.ts) —
      // sin storageState: la sesión de Firebase Auth vive en IndexedDB, que
      // Playwright no serializa al cruzar de contexto/proyecto.
      name: "money-path",
      testMatch: /camino-dinero\.spec\.ts/,
      retries: 0,
      // 4 rutas distintas (login, reportes, nueva-compra, ordenes) navegadas
      // en una sola corrida — en dev cada una compila on-demand la primera
      // vez, y el timeout global de 60s pensado para specs de una sola página
      // se queda corto.
      timeout: 180_000,
      use: {
        viewport: { width: 1440, height: 900 },
      },
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
