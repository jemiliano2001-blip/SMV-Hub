import { describe, expect, it } from "vitest"
import type { OrdenCompra } from "@/lib/schemas"
import {
  aplicarReglaConfianza,
  armarChunksOrdenes,
  construirPromptTraduccionLote,
  parsearRespuestaTraduccion,
} from "@/lib/reportes-contables-ia"

function crearOrden(id: string, lineas: number, pendiente = true): OrdenCompra {
  return {
    id,
    proveedor: "Proveedor de prueba",
    numeroFactura: null,
    fechaFactura: null,
    moneda: "USD",
    subtotal: 100,
    envio: null,
    impuestos: null,
    total: 100,
    requisitor: "Ana",
    ordenTrabajo: "",
    empresa: "SMV",
    cuentaCargo: "Stock",
    destino: "SMV",
    estado: "pendiente",
    creadoEn: new Date("2026-07-14"),
    actualizadoEn: new Date("2026-07-14"),
    items: Array.from({ length: lineas }, (_, indice) => ({
      descripcion: `Artículo ${id}-${indice + 1}`,
      descripcionSimplificada: pendiente ? "" : "Artículo de prueba",
      cantidad: 1,
      precioUnitario: 10,
      total: 10,
      claveProdServ: pendiente ? null : "31161500",
      satPendiente: pendiente,
      empresa: "SMV",
      cuentaCargo: "Stock",
      requisitor: "Ana",
      ordenTrabajo: "",
    })),
  }
}

describe("construirPromptTraduccionLote", () => {
  it("incluye reglas industriales y conserva las descripciones en orden", () => {
    const prompt = construirPromptTraduccionLote(["Sheet Metal Punch", "Wiha Screwdriver Set"])

    expect(prompt).toContain("objeto principal")
    expect(prompt).toContain("HARFINGTON Sheet Metal Punch")
    expect(prompt).toContain("exactamente 2 elementos")
    expect(prompt).toContain('["Sheet Metal Punch","Wiha Screwdriver Set"]')
  })
})

describe("parsearRespuestaTraduccion", () => {
  it("acepta textos válidos y elimina espacios sobrantes", () => {
    expect(parsearRespuestaTraduccion('["  Punzón de lámina  ", "Destornillador"]', 2)).toEqual([
      "Punzón de lámina",
      "Destornillador",
    ])
  })

  it("rechaza una cantidad distinta a la solicitada", () => {
    expect(() => parsearRespuestaTraduccion('["Solo una"]', 2)).toThrow("se esperaban 2")
  })

  it("rechaza JSON que no contiene strings útiles", () => {
    expect(() => parsearRespuestaTraduccion('["", 4]', 2)).toThrow("vacía o inválida")
  })
})

describe("aplicarReglaConfianza", () => {
  it("persiste claves de confianza alta o media", () => {
    expect(aplicarReglaConfianza({
      claveProdServ: "31161500",
      descripcionSat: "Tornillos",
      confianza: "media",
      motivo: "Coincidencia",
      fuente: "local",
    })).toEqual({ claveProdServ: "31161500", satPendiente: false })
  })

  it("deja pendiente una sugerencia baja o inexistente", () => {
    expect(aplicarReglaConfianza({
      claveProdServ: "31161500",
      descripcionSat: "Tornillos",
      confianza: "baja",
      motivo: "Ambigua",
      fuente: "manual",
    })).toEqual({ claveProdServ: null, satPendiente: true })
    expect(aplicarReglaConfianza(null)).toEqual({ claveProdServ: null, satPendiente: true })
  })
})

describe("armarChunksOrdenes", () => {
  it("no parte una orden y respeta los límites de órdenes y líneas", () => {
    const ordenes = [
      crearOrden("a", 10),
      crearOrden("b", 8),
      crearOrden("c", 2),
      crearOrden("sin-faltantes", 1, false),
    ]
    const chunks = armarChunksOrdenes(ordenes, 2, 15)

    expect(chunks.map((chunk) => chunk.map((orden) => orden.id))).toEqual([
      ["a"],
      ["b", "c"],
    ])
    expect(chunks.every((chunk) => chunk.length <= 2)).toBe(true)
  })

  it("por defecto arma chunks compatibles con el limite seguro del API", () => {
    const ordenes = [
      crearOrden("a", 1),
      crearOrden("b", 1),
      crearOrden("c", 1),
      crearOrden("d", 1),
    ]
    const chunks = armarChunksOrdenes(ordenes)

    expect(chunks.map((chunk) => chunk.map((orden) => orden.id))).toEqual([
      ["a", "b"],
      ["c", "d"],
    ])
    expect(chunks.every((chunk) => chunk.length <= 2)).toBe(true)
  })

  it("rechaza límites no válidos", () => {
    expect(() => armarChunksOrdenes([crearOrden("a", 1)], 0, 15)).toThrow("mayores que cero")
  })
})
