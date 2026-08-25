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
  it("se renderiza envuelto en AuthGuard con el layout base dentro", async () => {
    // La página es async desde que lee `searchParams` (el param `q` siembra el
    // buscador cuando se llega desde /claves-sat).
    const element = await OrdenesPage({ searchParams: Promise.resolve({}) })
    expect(element).toBeDefined()
    expect(typeof element.type).toBe("function")
    const hijo = element.props.children as { type: unknown }
    expect(typeof hijo.type).toBe("function")
  })

  it("propaga el término de búsqueda de la URL a la lista", async () => {
    const element = await OrdenesPage({ searchParams: Promise.resolve({ q: "31161904" }) })

    // Recorre el árbol buscando el nodo que recibe `busquedaInicial`.
    const buscarProp = (nodo: unknown): unknown => {
      if (!nodo || typeof nodo !== "object") return undefined
      if (Array.isArray(nodo)) {
        for (const hijo of nodo) {
          const hallado = buscarProp(hijo)
          if (hallado !== undefined) return hallado
        }
        return undefined
      }
      const props = (nodo as { props?: Record<string, unknown> }).props
      if (props && "busquedaInicial" in props) return props.busquedaInicial
      return props ? buscarProp(props.children) : undefined
    }

    expect(buscarProp(element)).toBe("31161904")
  })
})
