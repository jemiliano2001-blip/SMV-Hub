import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const raiz = resolve(import.meta.dirname, "..")

describe("alcance del bundle de Functions", () => {
  it("exporta las integraciones operativas del Hub", () => {
    const indice = readFileSync(resolve(raiz, "functions/src/index.ts"), "utf8")

    expect(indice).not.toMatch(/autoPurchase|recommendProvider|exportToGoogleSheets|importFromGoogleSheets|exportToExcel/)
    expect(indice).toContain("syncOdooFacturasScheduled")
    expect(indice).toContain("syncOdooComprasScheduled")
    expect(indice).toContain("syncBusquedaIndiceScheduled")
  })
})
