import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/firebase", () => ({ db: {}, storage: {} }))
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  Timestamp: {
    now: () => ({ toDate: () => new Date() }),
    fromDate: (d: Date) => ({ toDate: () => d }),
  },
}))
vi.mock("@/lib/cotizaciones", () => ({
  clavesExistentes: vi.fn().mockResolvedValue(new Set()),
}))
vi.mock("@/lib/cotizaciones-importar", () => ({
  procesarCSVCotizaciones: vi.fn(),
  verificarDuplicadosCotizacion: vi.fn().mockReturnValue([]),
  importarCotizaciones: vi.fn().mockResolvedValue({ importadas: 2 }),
}))

import {
  obtenerConfigCotizacionesSync,
  sincronizarCotizacionesDesdeUrl,
} from "@/lib/cotizaciones-sync"
import { getDoc, setDoc } from "firebase/firestore"
import { procesarCSVCotizaciones } from "@/lib/cotizaciones-importar"
import type { FilaCotizacion } from "@/lib/cotizaciones-importar"

const filaValida: FilaCotizacion = {
  indice: 0,
  datos: {
    solicitante: "Compras",
    fecha: "2026-07-22",
    estatus: "cotizado",
    ubicacion: "USA",
    proveedor: "McMaster",
    descripcion: "Tornillo M6",
    numeroParte: null,
    llavePieza: null,
    cantidad: 1,
    precioUnitario: 10,
    moneda: "USD",
    total: 10,
    diasHabiles: null,
    link: null,
    notas: null,
  },
  errores: [],
  advertencias: [],
  seleccionada: true,
}

describe("cotizaciones-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("retorna valores por defecto cuando no existe documento de configuración", async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => false,
      data: () => ({}),
    } as unknown as Awaited<ReturnType<typeof getDoc>>)

    const config = await obtenerConfigCotizacionesSync()
    expect(config.urlSheet).toBe("")
    expect(config.autoSyncActivo).toBe(false)
    expect(config.estadoUltimaSinc).toBe("nunca")
  })

  it("lanza error si la URL de sincronización está vacía", async () => {
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => false,
      data: () => ({}),
    } as unknown as Awaited<ReturnType<typeof getDoc>>)

    await expect(sincronizarCotizacionesDesdeUrl("")).rejects.toThrow("No hay un enlace de Google Sheet configurado.")
  })

  it("sincroniza exitosamente cuando el fetch retorna un CSV válido", async () => {
    const fakeCsv = "Proveedor,Descripcion\nMcMaster,Tornillo M6"
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: () => Promise.resolve(fakeCsv),
    } as unknown as Response)

    vi.mocked(procesarCSVCotizaciones).mockReturnValueOnce({
      filas: [filaValida],
      error: null,
      columnasDetectadas: ["proveedor", "descripcion"],
    })
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({ urlSheet: "https://docs.google.com/spreadsheets/d/e/fake/pub?output=csv", totalCotizaciones: 10 }),
    } as unknown as Awaited<ReturnType<typeof getDoc>>)

    const res = await sincronizarCotizacionesDesdeUrl("https://docs.google.com/spreadsheets/d/e/fake/pub?output=csv")

    expect(res.nuevas).toBe(2)
    expect(setDoc).toHaveBeenCalled()
  })
})
