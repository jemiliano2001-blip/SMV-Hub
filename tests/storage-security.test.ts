import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const raiz = resolve(import.meta.dirname, "..")

describe("reglas de comprobantes de caja chica", () => {
  it("exigen el módulo caja-chica para leer y escribir", () => {
    const reglas = readFileSync(resolve(raiz, "storage.rules"), "utf8")
    const bloque = reglas.match(/match \/caja-chica\/\{archivo=\*\*\} \{([\s\S]*?)\n    \}/)?.[1]

    expect(bloque).toBeTruthy()
    expect(bloque).toMatch(/allow read: if esUsuarioAutorizado\(\) && tieneModulo\('caja-chica'\)/)
    expect(bloque).toMatch(/allow write: if esUsuarioAutorizado\(\)[\s\S]*tieneModulo\('caja-chica'\)/)
  })
})
