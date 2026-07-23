import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const raiz = resolve(import.meta.dirname, "..")

describe("cadena de suministro de despliegue", () => {
  it("no ejecuta acciones Firebase mutables ni entrega GCP_SA_KEY", () => {
    const workflow = readFileSync(resolve(raiz, ".github/workflows/ci.yml"), "utf8")

    expect(workflow).not.toContain("w9jds/firebase-action")
    expect(workflow).not.toContain("GCP_SA_KEY")
    expect(workflow).toContain("GOOGLE_APPLICATION_CREDENTIALS")
    expect(workflow).toContain("npx --yes firebase-tools@15.24.0 deploy")
  })
})
