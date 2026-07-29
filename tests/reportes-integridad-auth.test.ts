import { describe, expect, it } from "vitest"
import {
  principalCanTriggerPurchasingSync,
  principalCanViewFullIntegrity,
  principalCanViewOwnIntegrity,
  principalHasLegacyPurchasingSyncAccess,
  type CallablePrincipal,
} from "../functions/src/auth"

function principal(
  overrides: Partial<CallablePrincipal> = {}
): CallablePrincipal {
  return {
    uid: "u1",
    email: "user@example.com",
    modules: [],
    isSuperAdmin: false,
    isBreakGlass: false,
    active: true,
    template: null,
    ...overrides,
  }
}

describe("políticas de autorización de Integridad", () => {
  it("exige reportes y finanzas para detalle completo y sync", () => {
    expect(
      principalCanViewFullIntegrity(
        principal({ modules: ["reportes", "finanzas"] })
      )
    ).toBe(true)
    expect(
      principalCanViewFullIntegrity(principal({ modules: ["reportes"] }))
    ).toBe(false)
    expect(
      principalCanTriggerPurchasingSync(
        principal({ modules: ["finanzas", "reportes"] })
      )
    ).toBe(true)
  })

  it("limita Mis casos al módulo proveedores", () => {
    expect(
      principalCanViewOwnIntegrity(principal({ modules: ["proveedores"] }))
    ).toBe(true)
    expect(principalCanViewOwnIntegrity(principal())).toBe(false)
  })

  it("preserva acceso legacy del sync sin ampliar el detalle financiero", () => {
    const compras = principal({ template: "compras", modules: ["proveedores"] })
    expect(principalHasLegacyPurchasingSyncAccess(compras)).toBe(true)
    expect(principalCanViewFullIntegrity(compras)).toBe(false)
  })

  it("superadmin y break-glass tienen las capacidades completas", () => {
    for (const actor of [
      principal({ isSuperAdmin: true }),
      principal({ isBreakGlass: true }),
    ]) {
      expect(principalCanViewFullIntegrity(actor)).toBe(true)
      expect(principalCanViewOwnIntegrity(actor)).toBe(true)
      expect(principalCanTriggerPurchasingSync(actor)).toBe(true)
    }
  })
})

