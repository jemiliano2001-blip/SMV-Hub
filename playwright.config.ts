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
  reporter: process.env.CI ? "github" : "list",
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
        command: "npm.cmd run dev",
        url: "http://localhost:3000/login",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
