import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { mockGetIdToken } = vi.hoisted(() => ({
  mockGetIdToken: vi.fn(async () => "token-de-prueba"),
}))

vi.mock("@/lib/firebase", () => ({
  getClienteAuth: () => ({ currentUser: { getIdToken: mockGetIdToken } }),
}))

import {
  claveSatConocida,
  descripcionClaveSatConocida,
  formatoClaveProdServ,
  limpiarCacheClavesSat,
  registrarClavesSatValidadas,
  validarClaveSatEnCatalogo,
  validarClavesSatEnCatalogo,
} from "@/lib/sat/validar-clave-cliente"

type Validada = { clave: string; descripcion: string }

function respuesta(validas: Validada[], status = 200): Response {
  return new Response(JSON.stringify({ validas }), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()

function clavesEnviadas(llamada: number): string[] {
  const init = fetchMock.mock.calls[llamada][1]
  return (JSON.parse(String(init?.body)) as { claves: string[] }).claves
}

describe("validar-clave-cliente", () => {
  beforeEach(() => {
    limpiarCacheClavesSat()
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("formatoClaveProdServ sólo normaliza, no consulta", () => {
    expect(formatoClaveProdServ("31-1619-04")).toBe("31161904")
    expect(formatoClaveProdServ("1234")).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("claveSatConocida responde null hasta que se consulta y false para formato inválido", () => {
    expect(claveSatConocida("31161904")).toBeNull()
    expect(claveSatConocida("abc")).toBe(false)
    expect(claveSatConocida(null)).toBe(false)
  })

  it("registrarClavesSatValidadas siembra la caché sin tocar la red", async () => {
    registrarClavesSatValidadas([
      { clave: "31161904", descripcion: "Resortes de compresión" },
      "31-1619-05",
      null,
      { clave: "abc" },
    ])

    expect(claveSatConocida("31161904")).toBe(true)
    expect(descripcionClaveSatConocida("31161904")).toBe("Resortes de compresión")
    expect(claveSatConocida("31161905")).toBe(true)

    const validas = await validarClavesSatEnCatalogo(["31161904", "31161905"])
    expect([...validas].sort()).toEqual(["31161904", "31161905"])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("no pisa una descripción real con una vacía al re-sembrar", () => {
    registrarClavesSatValidadas([{ clave: "31161904", descripcion: "Resortes de compresión" }])
    registrarClavesSatValidadas(["31161904"])

    expect(descripcionClaveSatConocida("31161904")).toBe("Resortes de compresión")
  })

  it("consulta sólo las claves desconocidas, normalizadas y sin duplicados, con token", async () => {
    registrarClavesSatValidadas(["11111111"])
    fetchMock.mockResolvedValueOnce(respuesta([{ clave: "31161904", descripcion: "Resortes" }]))

    const validas = await validarClavesSatEnCatalogo(["11111111", "31-1619-04", "31161904", "99999999", "abc", null])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe("/api/claves-sat/validar")
    expect(init?.method).toBe("POST")
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer token-de-prueba")
    expect(clavesEnviadas(0).sort()).toEqual(["31161904", "99999999"])
    expect([...validas].sort()).toEqual(["11111111", "31161904"])
  })

  it("cachea tanto las válidas como las inexistentes tras consultar", async () => {
    fetchMock.mockResolvedValueOnce(respuesta([{ clave: "31161904", descripcion: "Resortes" }]))

    await validarClavesSatEnCatalogo(["31161904", "99999999"])

    expect(claveSatConocida("31161904")).toBe(true)
    expect(claveSatConocida("99999999")).toBe(false)
    expect(descripcionClaveSatConocida("31161904")).toBe("Resortes")

    // Segunda pasada: todo cacheado, sin red.
    const validas = await validarClavesSatEnCatalogo(["31161904", "99999999"])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect([...validas]).toEqual(["31161904"])
  })

  it("comparte una petición en vuelo entre llamadas concurrentes", async () => {
    let resolver: (r: Response) => void = () => {}
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolver = resolve
        })
    )

    const a = validarClaveSatEnCatalogo("31161904")
    const b = validarClaveSatEnCatalogo("31161904")
    // fetch se dispara después de `await getIdToken()`; esperar a que llegue.
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    resolver(respuesta([{ clave: "31161904", descripcion: "Resortes" }]))
    expect(await a).toBe("31161904")
    expect(await b).toBe("31161904")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("parte en lotes de 200 cuando hay más claves desconocidas", async () => {
    // Una Response por llamada: el body sólo se puede leer una vez.
    fetchMock.mockImplementation(async () => respuesta([]))
    const muchas = Array.from({ length: 250 }, (_, i) => String(10000000 + i))

    await validarClavesSatEnCatalogo(muchas)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(clavesEnviadas(0)).toHaveLength(200)
    expect(clavesEnviadas(1)).toHaveLength(50)
  })

  it("lanza si la API falla y no marca nada como válido ni como inexistente", async () => {
    fetchMock.mockResolvedValueOnce(respuesta([], 500))

    await expect(validarClavesSatEnCatalogo(["31161904"])).rejects.toThrow(/HTTP 500/)
    expect(claveSatConocida("31161904")).toBeNull()

    // Al reintentar vuelve a consultar (la clave no quedó cacheada).
    fetchMock.mockResolvedValueOnce(respuesta([{ clave: "31161904", descripcion: "Resortes" }]))
    expect(await validarClaveSatEnCatalogo("31161904")).toBe("31161904")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("validarClaveSatEnCatalogo devuelve null para formato inválido sin consultar", async () => {
    expect(await validarClaveSatEnCatalogo("12")).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
