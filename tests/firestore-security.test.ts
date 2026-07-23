import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const raiz = resolve(import.meta.dirname, "..")

describe("reglas de firestore para configuraciones", () => {
  it("permite lectura y escritura de configuraciones a usuarios autorizados", () => {
    const reglas = readFileSync(resolve(raiz, "firestore.rules"), "utf8")
    const bloque = reglas.match(/match \/configuraciones\/\{configId\} \{([\s\S]*?)\n    \}/)?.[1]

    expect(bloque).toBeTruthy()
    expect(bloque).toMatch(/allow read, create, update: if esUsuarioAutorizado\(\);/)
  })
})
