import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const mockSuccess = vi.fn()
const mockError = vi.fn()

vi.mock("sonner", () => ({
  toast: { success: mockSuccess, error: mockError },
}))

const { copiarAlPortapapeles } = await import("@/lib/portapapeles")

describe("copiarAlPortapapeles", () => {
  const originalNavigator = globalThis.navigator

  beforeEach(() => {
    mockSuccess.mockClear()
    mockError.mockClear()
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    })
    vi.restoreAllMocks()
  })

  const conPortapapeles = (writeText: () => Promise<void>) => {
    Object.defineProperty(globalThis, "navigator", {
      value: { clipboard: { writeText } },
      writable: true,
      configurable: true,
    })
  }

  it("avisa éxito solo cuando la escritura resuelve", async () => {
    conPortapapeles(() => Promise.resolve())
    await expect(copiarAlPortapapeles("ABC-123", "Factura copiada")).resolves.toBe(true)
    expect(mockSuccess).toHaveBeenCalledWith("Factura copiada", undefined)
    expect(mockError).not.toHaveBeenCalled()
  })

  it("pasa la descripción cuando se proporciona", async () => {
    conPortapapeles(() => Promise.resolve())
    await copiarAlPortapapeles("ABC-123", "Factura copiada", "ABC-123")
    expect(mockSuccess).toHaveBeenCalledWith("Factura copiada", { description: "ABC-123" })
  })

  it("NO muestra éxito falso cuando el portapapeles falla", async () => {
    // Este era el bug: `void navigator.clipboard.writeText(x)` descartaba la
    // promesa y el toast de éxito salía siempre, aunque no se copiara nada.
    conPortapapeles(() => Promise.reject(new Error("permiso denegado")))
    await expect(copiarAlPortapapeles("ABC-123", "Factura copiada")).resolves.toBe(false)
    expect(mockSuccess).not.toHaveBeenCalled()
    expect(mockError).toHaveBeenCalledWith("No se pudo copiar", expect.anything())
  })

  it("falla con aviso si el navegador no expone el portapapeles", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      writable: true,
      configurable: true,
    })
    await expect(copiarAlPortapapeles("x", "Copiado")).resolves.toBe(false)
    expect(mockSuccess).not.toHaveBeenCalled()
    expect(mockError).toHaveBeenCalled()
  })
})
