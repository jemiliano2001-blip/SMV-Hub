import { describe, it, expect, vi } from "vitest"
import OrdenesPage from "@/app/ordenes/page"

vi.mock("@/lib/firebase", () => ({
  db: {},
  storage: {},
}))

vi.mock("@/lib/ordenes", () => ({
  listarOrdenes: vi.fn().mockResolvedValue([]),
  eliminarOrden: vi.fn().mockResolvedValue(undefined),
  actualizarOrden: vi.fn().mockResolvedValue(undefined),
}))

describe("OrdenesPage Server Component", () => {
  it("se renderiza envuelto en AuthGuard con el layout base dentro", () => {
    const element = OrdenesPage()
    expect(element).toBeDefined()
    // La página ahora está protegida: <AuthGuard><main>…</main></AuthGuard>
    expect(typeof element.type).toBe("function")
    const hijo = element.props.children as { type: unknown }
    expect(hijo.type).toBe("main")
  })
})
