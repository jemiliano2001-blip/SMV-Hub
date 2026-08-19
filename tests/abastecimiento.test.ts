import { describe, it, expect } from "vitest"
import { derivarPasosAbastecimiento } from "@/lib/abastecimiento"

describe("derivarPasosAbastecimiento (Lógica pura del Stepper)", () => {
  it("deriva pasos para requisición recién creada sin orden de compra", () => {
    const pasos = derivarPasosAbastecimiento({
      origen: {
        tipo: "requisicion",
        id: "req-123",
        folio: "REQ-2026-001",
        descripcion: "Insertos de carburo CNMG",
        estado: "no_comprado",
        estatusFlujo: "aprobada",
      },
      orden: null,
      entradaAlmacenId: null,
    })

    expect(pasos).toHaveLength(3)
    expect(pasos[0]).toEqual({
      id: "solicitado",
      titulo: "Requisición REQ-2026-001",
      detalle: "Insertos de carburo CNMG",
      estado: "actual",
      href: "/requisiciones",
    })
    expect(pasos[1].estado).toBe("pendiente")
    expect(pasos[2].estado).toBe("pendiente")
  })

  it("deriva pasos para requisición con orden de compra aprobada en tránsito", () => {
    const pasos = derivarPasosAbastecimiento({
      origen: {
        tipo: "requisicion",
        id: "req-123",
        folio: "REQ-2026-001",
        descripcion: "Insertos de carburo",
        estado: "comprado",
      },
      orden: {
        id: "ord-456",
        numeroFactura: "F-9921",
        proveedor: "Shars Tool",
        estado: "aprobada",
        estadoRecepcion: "pendiente",
      },
      entradaAlmacenId: null,
    })

    expect(pasos[0].estado).toBe("completo")
    expect(pasos[1]).toEqual({
      id: "comprado",
      titulo: "OC Shars Tool #F-9921",
      detalle: "Orden aprobada (en tránsito)",
      estado: "actual",
      href: "/ordenes",
    })
    expect(pasos[2].estado).toBe("pendiente")
    expect(pasos[2].href).toBe("/almacen")
  })

  it("deriva pasos para pedido de almacén recibido en planta", () => {
    const pasos = derivarPasosAbastecimiento({
      origen: {
        tipo: "pedido-almacen",
        id: "ped-789",
        descripcion: "Tornillos M6x20",
        estado: "recibido",
      },
      orden: {
        id: "ord-555",
        proveedor: "McMaster-Carr",
        estado: "aprobada",
        estadoRecepcion: "recibida",
        fechaRecepcion: "2026-08-19",
        recibidoPor: "Jesus Almacen",
      },
      entradaAlmacenId: "ent-001",
    })

    expect(pasos[0].estado).toBe("completo")
    expect(pasos[1].estado).toBe("completo")
    expect(pasos[2]).toEqual({
      id: "recibido",
      titulo: "Recibido en Almacén",
      detalle: "Recibido el 2026-08-19 (Jesus Almacen)",
      estado: "completo",
      href: "/almacen",
    })
  })

  it("deriva pasos para compra directa sin requisición ni pedido previo", () => {
    const pasos = derivarPasosAbastecimiento({
      origen: null,
      orden: {
        id: "ord-999",
        proveedor: "MSC Industrial",
        numeroFactura: "MSC-1002",
        estado: "pendiente",
        estadoRecepcion: "pendiente",
      },
      entradaAlmacenId: null,
    })

    expect(pasos[0]).toEqual({
      id: "solicitado",
      titulo: "Compra Directa",
      detalle: "Sin solicitud previa",
      estado: "completo",
      href: null,
    })
    expect(pasos[1].estado).toBe("actual")
    expect(pasos[2].estado).toBe("pendiente")
  })

  it("soporta órdenes históricas con estadoRecepcion omitido (retrocompatibilidad)", () => {
    const pasos = derivarPasosAbastecimiento({
      origen: null,
      orden: {
        id: "ord-legacy",
        proveedor: "Travers",
        estado: "aprobada",
      },
      entradaAlmacenId: null,
    })

    expect(pasos[0].estado).toBe("completo")
    expect(pasos[1].estado).toBe("actual")
    expect(pasos[2].estado).toBe("pendiente")
  })
})
