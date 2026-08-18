import { describe, it, expect } from "vitest"
import { excedeLimite } from "@/lib/rate-limit-memoria"

describe("excedeLimite", () => {
  it("permite hasta el límite y bloquea la siguiente dentro de la misma ventana", () => {
    const clave = "user-limite"
    for (let i = 0; i < 20; i++) {
      expect(excedeLimite(clave)).toBe(false)
    }
    expect(excedeLimite(clave)).toBe(true)
  })

  it("claves distintas no comparten cupo", () => {
    for (let i = 0; i < 20; i++) excedeLimite("user-a")
    expect(excedeLimite("user-a")).toBe(true)
    expect(excedeLimite("user-b")).toBe(false)
  })
})
