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

describe("reglas de firestore para horas extra", () => {
  it("la lectura es abierta pero la escritura exige puedeEditarHorasExtra", () => {
    const reglas = readFileSync(resolve(raiz, "firestore.rules"), "utf8")
    const bloque = reglas.match(/match \/horas-extra\/\{horaId\} \{([\s\S]*?)\n    \}/)?.[1]

    expect(bloque).toBeTruthy()
    expect(bloque).toMatch(/allow read: if esUsuarioAutorizado\(\);/)
    expect(bloque).toMatch(/allow create: if puedeEditarHorasExtra\(\)/)
    expect(bloque).toMatch(/allow update: if puedeEditarHorasExtra\(\)/)
    expect(bloque).toMatch(/allow delete: if puedeEditarHorasExtra\(\);/)
    expect(bloque).not.toMatch(/allow create: if esUsuarioAutorizado\(\)/)
  })

  it("puedeEditarHorasExtra cubre admin/compras, super-admin y el flag por usuario", () => {
    const reglas = readFileSync(resolve(raiz, "firestore.rules"), "utf8")
    const fn = reglas.match(/function puedeEditarHorasExtra\(\) \{([\s\S]*?)\n    \}/)?.[1]

    expect(fn).toBeTruthy()
    expect(fn).toMatch(/esSuperAdminDoc\(\)/)
    expect(fn).toMatch(/docUsuario\(\)\.rol in \['admin', 'compras'\]/)
    expect(fn).toMatch(/docUsuario\(\)\.plantilla in \['admin', 'compras'\]/)
    expect(fn).toMatch(/docUsuario\(\)\.editaHorasExtra == true/)
  })
})

describe("reglas de firestore para notificaciones leídas", () => {
  it("separa la lectura de la validación exclusiva de escrituras", () => {
    const reglas = readFileSync(resolve(raiz, "firestore.rules"), "utf8")
    const bloque = reglas.match(
      /match \/notificaciones_leidas\/\{notificacionId\} \{([\s\S]*?)\n      \}/
    )?.[1]

    expect(bloque).toBeTruthy()
    expect(bloque).toMatch(
      /allow read: if estaAutenticado\(\)[\s\S]*?request\.auth\.uid == uid;/
    )
    expect(bloque).toMatch(
      /allow create, update: if estaAutenticado\(\)[\s\S]*?request\.resource\.data\.keys\(\)\.hasOnly\(\['leidoEn'\]\)/
    )
    expect(bloque).not.toMatch(/allow read, create, update/)
  })
})
