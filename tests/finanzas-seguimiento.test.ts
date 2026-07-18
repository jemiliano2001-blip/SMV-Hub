import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import {
  eliminarSeguimientoCobranza,
  guardarSeguimientoCobranza,
  listarSeguimientosCobranza,
} from "@/lib/finanzas-seguimiento"
import {
  SeguimientoCobranzaInputSchema,
  SeguimientoCobranzaSchema,
} from "@/lib/schemas"

vi.mock("@/lib/firebase", () => ({
  db: { type: "mocked-db" },
}))

const { mockCollectionRef, mockDocRef, mockServerTimestamp } = vi.hoisted(() => ({
  mockCollectionRef: { type: "collection-ref" },
  mockDocRef: { type: "doc-ref" },
  mockServerTimestamp: { type: "server-timestamp" },
}))

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => mockCollectionRef),
  deleteDoc: vi.fn(),
  doc: vi.fn(() => mockDocRef),
  getDocs: vi.fn(),
  serverTimestamp: vi.fn(() => mockServerTimestamp),
  setDoc: vi.fn(),
}))

const entradaValida = {
  facturaId: "odoo_1478",
  nota: "Compras confirmó el pago.",
  promesaPagoFecha: "2026-07-24",
  enDisputa: false,
  actualizadoPor: "admin@smv.mx",
}

describe("schemas de seguimiento de cobranza", () => {
  it("valida y normaliza la entrada del formulario", () => {
    const resultado = SeguimientoCobranzaInputSchema.parse({
      ...entradaValida,
      nota: "  Nota con espacios  ",
    })
    expect(resultado.nota).toBe("Nota con espacios")
  })

  it("rechaza factura, fecha y correo inválidos", () => {
    expect(() =>
      SeguimientoCobranzaInputSchema.parse({
        ...entradaValida,
        facturaId: "../otra-coleccion",
      })
    ).toThrow()
    expect(() =>
      SeguimientoCobranzaInputSchema.parse({
        ...entradaValida,
        promesaPagoFecha: "24/07/2026",
      })
    ).toThrow()
    expect(() =>
      SeguimientoCobranzaInputSchema.parse({
        ...entradaValida,
        actualizadoPor: "sin-correo",
      })
    ).toThrow()
  })

  it("exige timestamp y rechaza campos desconocidos en el documento completo", () => {
    expect(() =>
      SeguimientoCobranzaSchema.parse({
        ...entradaValida,
        actualizadoEn: new Date(),
        campoInesperado: true,
      })
    ).toThrow()
  })
})

describe("finanzas-seguimiento CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-18T16:00:00Z"))
  })

  it("guarda por facturaId con validación y timestamp de servidor", async () => {
    const guardado = await guardarSeguimientoCobranza(entradaValida)

    expect(doc).toHaveBeenCalledWith(db, "finanzas_seguimiento", "odoo_1478")
    expect(serverTimestamp).toHaveBeenCalledOnce()
    expect(setDoc).toHaveBeenCalledWith(mockDocRef, {
      ...entradaValida,
      actualizadoEn: mockServerTimestamp,
    })
    expect(guardado.actualizadoEn).toEqual(new Date("2026-07-18T16:00:00Z"))
  })

  it("no toca Firestore cuando la entrada es inválida", async () => {
    await expect(
      guardarSeguimientoCobranza({
        ...entradaValida,
        actualizadoPor: "invalido",
      })
    ).rejects.toThrow()
    expect(setDoc).not.toHaveBeenCalled()
  })

  it("lista documentos, convierte Timestamp y usa doc.id como facturaId", async () => {
    const fecha = new Date("2026-07-18T15:00:00Z")
    vi.mocked(getDocs).mockResolvedValue({
      docs: [
        {
          id: "odoo_1478",
          data: () => ({
            ...entradaValida,
            facturaId: "odoo_9999",
            actualizadoEn: { toDate: () => fecha },
          }),
        },
      ],
    } as unknown as Awaited<ReturnType<typeof getDocs>>)

    const resultado = await listarSeguimientosCobranza()

    expect(collection).toHaveBeenCalledWith(db, "finanzas_seguimiento")
    expect(resultado).toEqual([
      {
        ...entradaValida,
        facturaId: "odoo_1478",
        actualizadoEn: fecha,
      },
    ])
  })

  it("elimina el documento validando primero el facturaId", async () => {
    await eliminarSeguimientoCobranza("odoo_1478")
    expect(deleteDoc).toHaveBeenCalledWith(mockDocRef)

    await expect(eliminarSeguimientoCobranza("factura/invalida")).rejects.toThrow()
    expect(deleteDoc).toHaveBeenCalledTimes(1)
  })
})
