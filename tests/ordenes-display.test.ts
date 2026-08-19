import { describe, it, expect } from "vitest"
import {
  formatFechaOrden,
  cuentaCargoEfectiva,
  ordenTieneSatPendiente,
  itemSatPendiente,
  displayOGuion,
  generarMensajeWhatsApp,
  obtenerUrlWhatsApp,
} from "@/lib/ordenes-display"
import type { OrdenCompra } from "@/lib/schemas"

const AHORA = new Date("2026-06-04T12:00:00.000Z")

function makeOrden(overrides: Partial<OrdenCompra> = {}): OrdenCompra {
  return {
    id: "ord-1",
    proveedor: "McMaster-Carr",
    numeroFactura: "INV-100",
    fechaFactura: "2026-06-01",
    moneda: "USD",
    subtotal: 100,
    impuestos: 8,
    envio: null,
    total: 108,
    estado: "pendiente",
    estadoRecepcion: "pendiente",
    requisitor: "Pablo",
    empresa: "SMV",
    cuentaCargo: "Stock",
    ordenTrabajo: "",
    destino: "SMV",
    items: [
      {
        descripcion: "Bolt",
        descripcionSimplificada: "Bolt",
        cantidad: 1,
        precioUnitario: 100,
        total: 100,
        claveProdServ: "31161500",
        satPendiente: false,
        empresa: "SMV",
        cuentaCargo: "OT-99",
        requisitor: "Pablo",
        ordenTrabajo: "",
      },
    ],
    creadoEn: AHORA,
    actualizadoEn: AHORA,
    ...overrides,
  }
}

describe("formatFechaOrden", () => {
  it("muestra fecha de factura y registro secundario", () => {
    const r = formatFechaOrden(makeOrden())
    expect(r.principal).toBe("01/06/2026")
    expect(r.secundaria).toMatch(/^Reg: /)
  })

  it("sin fechaFactura solo muestra registro sin secundaria", () => {
    const r = formatFechaOrden(makeOrden({ fechaFactura: null }))
    expect(r.principal).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    expect(r.secundaria).toBeNull()
  })
})

describe("cuentaCargoEfectiva", () => {
  it("prefiere cuenta cargo del primer ítem", () => {
    expect(cuentaCargoEfectiva(makeOrden())).toBe("OT-99")
  })

  it("usa cuenta cargo de orden si no hay ítems", () => {
    expect(cuentaCargoEfectiva(makeOrden({ items: [], cuentaCargo: "Stock" }))).toBe(
      "Stock"
    )
  })
})

describe("ordenTieneSatPendiente", () => {
  it("true cuando algún ítem sin clave SAT", () => {
    expect(
      ordenTieneSatPendiente(
        makeOrden({
          items: [
            {
              descripcion: "X",
              descripcionSimplificada: "X",
              cantidad: 1,
              precioUnitario: 1,
              total: 1,
              claveProdServ: "",
              satPendiente: true,
              empresa: "",
              cuentaCargo: "",
              requisitor: "",
              ordenTrabajo: "",
            },
          ],
        })
      )
    ).toBe(true)
  })

  it("false cuando todos tienen clave SAT", () => {
    expect(ordenTieneSatPendiente(makeOrden())).toBe(false)
  })
})

describe("itemSatPendiente", () => {
  it("false cuando satPendiente es false aunque falte clave", () => {
    expect(
      itemSatPendiente({
        descripcion: "X",
        descripcionSimplificada: "X",
        cantidad: 1,
        precioUnitario: 1,
        total: 1,
        claveProdServ: "",
        satPendiente: false,
        empresa: "",
        cuentaCargo: "",
        requisitor: "",
        ordenTrabajo: "",
      })
    ).toBe(false)
  })
})

describe("displayOGuion", () => {
  it("devuelve guion para vacío", () => {
    expect(displayOGuion("")).toBe("—")
    expect(displayOGuion(null)).toBe("—")
  })

  it("devuelve valor recortado", () => {
    expect(displayOGuion("  ABC  ")).toBe("ABC")
  })
})

function makeItem(overrides: Partial<OrdenCompra["items"][number]> = {}): OrdenCompra["items"][number] {
  return {
    descripcion: "Bolt",
    descripcionSimplificada: "",
    cantidad: 1,
    precioUnitario: 10,
    total: 10,
    claveProdServ: null,
    satPendiente: false,
    empresa: "taller",
    cuentaCargo: "",
    requisitor: "",
    ordenTrabajo: "",
    ...overrides,
  }
}

describe("generarMensajeWhatsApp", () => {
  it("usa el formato corto operativo del grupo de Compras", () => {
    const msg = generarMensajeWhatsApp(
      makeOrden({
        proveedor: "McMaster-Carr",
        subtotal: 77.67,
        impuestos: 0,
        total: 77.67,
        items: [
          makeItem({ descripcion: "Conectores de energía de alta resistencia", cantidad: 2, precioUnitario: 38.835, total: 77.67, empresa: "SUPRAJIT MEXICO" }),
        ],
      })
    )
    expect(msg).toBe(
      "*Notificación de Compra (EUA)*\n\nBuen día, se pidió 2 Conectores de energía de alta resistencia para SUPRAJIT MEXICO en McMaster-Carr por USD $77.67."
    )
  })

  it("resume múltiples partidas y destinos sin añadir campos administrativos", () => {
    const msg = generarMensajeWhatsApp(
      makeOrden({
        proveedor: "DigiKey",
        subtotal: 30,
        impuestos: 0,
        total: 30,
        items: [
          makeItem({ descripcion: "Fuente de poder", cantidad: 1, precioUnitario: 10, total: 10, empresa: "SUPRAJIT MEXICO", requisitor: "Francisco", cuentaCargo: "SO1547" }),
          makeItem({ descripcion: "Conector", cantidad: 2, precioUnitario: 10, total: 20, empresa: "SMV", requisitor: "Ana", ordenTrabajo: "OT-2" }),
        ],
      })
    )
    expect(msg).toContain("Fuente de poder y 2 Conector para SUPRAJIT MEXICO / SMV en DigiKey por USD $30.00.")
    expect(msg).not.toMatch(/Factura|Requisitor|Cuenta cargo|Orden de trabajo|Entrega estimada|Partidas:/)
  })

  it("usa valores de respaldo breves cuando faltan partidas o total", () => {
    const msg = generarMensajeWhatsApp(makeOrden({
      items: [],
      empresa: "",
      destino: "",
      proveedor: "",
      total: null,
    }))

    expect(msg).toBe("*Notificación de Compra (EUA)*\n\nBuen día, se pidió material para SMV en el proveedor.")
  })

  it("etiqueta correctamente montos MXN y otras monedas", () => {
    expect(generarMensajeWhatsApp(makeOrden({ moneda: "MXN", total: 77.67 }))).toContain("MXN $77.67")
    expect(generarMensajeWhatsApp(makeOrden({ moneda: "EUR", total: 10 }))).toContain("EUR 10.00")
  })
})

describe("obtenerUrlWhatsApp", () => {
  it("codifica correctamente el mensaje", () => {
    const url = obtenerUrlWhatsApp("Hola Mundo")
    expect(url).toBe("https://api.whatsapp.com/send?text=Hola%20Mundo")
  })
})

