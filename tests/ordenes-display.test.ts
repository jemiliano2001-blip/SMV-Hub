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
  it("con cero items", () => {
    const msg = generarMensajeWhatsApp(
      makeOrden({ proveedor: "McMaster-Carr", items: [], subtotal: 0, impuestos: 0, total: 0 })
    )
    expect(msg).toContain("*Notificación de compra*")
    expect(msg).toContain("Proveedor: *McMaster-Carr*")
    expect(msg).not.toContain("Partidas:")
  })

  it("con un item cantidad 1", () => {
    const msg = generarMensajeWhatsApp(
      makeOrden({
        proveedor: "McMaster-Carr",
        subtotal: 10,
        impuestos: 0,
        total: 10,
        items: [
          makeItem({ descripcion: "servo motor para maquina WIRE EDM", cantidad: 1, precioUnitario: 10, total: 10, empresa: "taller" }),
        ],
      })
    )
    expect(msg).toContain("Empresa / destino: *taller*")
    expect(msg).toContain("Partidas:\n• servo motor para maquina WIRE EDM")
  })

  it("con un item cantidad > 1", () => {
    const msg = generarMensajeWhatsApp(
      makeOrden({
        proveedor: "Grainger",
        subtotal: 20,
        impuestos: 0,
        total: 20,
        items: [
          makeItem({ descripcion: "insertos de ceramica", cantidad: 3, precioUnitario: 6.66, total: 20, empresa: "taller" }),
        ],
      })
    )
    expect(msg).toContain("• 3 insertos de ceramica")
  })

  it("con multiples items y destinos", () => {
    const msg = generarMensajeWhatsApp(
      makeOrden({
        proveedor: "McMaster-Carr",
        subtotal: 120,
        impuestos: 0,
        total: 120,
        items: [
          makeItem({ descripcion: "servo motor para maquina WIRE EDM", cantidad: 1, precioUnitario: 100, total: 100, empresa: "taller" }),
          makeItem({ descripcion: "insertos de ceramica", cantidad: 2, precioUnitario: 10, total: 20, empresa: "taller" }),
        ],
      })
    )
    expect(msg).toContain("• servo motor para maquina WIRE EDM")
    expect(msg).toContain("• 2 insertos de ceramica")
  })

  it("con multiples items de mas de 2", () => {
    const msg = generarMensajeWhatsApp(
      makeOrden({
        proveedor: "eBay",
        subtotal: 30,
        impuestos: 0,
        total: 30,
        items: [
          makeItem({ descripcion: "A", cantidad: 1, precioUnitario: 10, total: 10, empresa: "taller" }),
          makeItem({ descripcion: "B", cantidad: 1, precioUnitario: 10, total: 10, empresa: "diseno" }),
          makeItem({ descripcion: "C", cantidad: 1, precioUnitario: 10, total: 10, empresa: "taller" }),
        ],
      })
    )
    expect(msg).toContain("Empresa / destino: *taller / diseno*")
  })

  it("mantiene el texto limpio sin URLs aunque la orden tenga comprobante", () => {
    const msg = generarMensajeWhatsApp({
      ...makeOrden({
        proveedor: "McMaster-Carr",
        subtotal: 10,
        impuestos: 0,
        total: 10,
        items: [makeItem({ descripcion: "servo motor", cantidad: 1, precioUnitario: 10, total: 10, empresa: "taller" })],
      }),
      imagenUrl: "https://storage.example.com/factura.jpg",
    })
    expect(msg).not.toContain("storage.example.com")
  })

  it("incluye los datos operativos únicos disponibles por ítem", () => {
    const msg = generarMensajeWhatsApp(
      makeOrden({
        numeroFactura: "INV-7",
        fechaFactura: "2026-08-12",
        fechaEntrega: "2026-08-20",
        linkProveedor: "https://compras.example.com/orden/7",
        items: [
          makeItem({ empresa: "SMV", requisitor: "Ana", cuentaCargo: "SO-100", ordenTrabajo: "OT-1" }),
          makeItem({ empresa: "APX", requisitor: "Luis", cuentaCargo: "SO-200", ordenTrabajo: "OT-2" }),
        ],
      })
    )

    expect(msg).toContain("Factura: *INV-7*")
    expect(msg).toContain("Lugar / enlace de compra: https://compras.example.com/orden/7")
    expect(msg).toContain("Fecha de factura: *12/08/2026*")
    expect(msg).toContain("Empresa / destino: *SMV / APX*")
    expect(msg).toContain("Requisitor: *Ana / Luis*")
    expect(msg).toContain("Cuenta cargo / SO: *SO-100 / SO-200*")
    expect(msg).toContain("Orden de trabajo: *OT-1 / OT-2*")
    expect(msg).toContain("Entrega estimada: *20/08/2026*")
    expect(msg).toContain("Total: *")
  })
})

describe("obtenerUrlWhatsApp", () => {
  it("codifica correctamente el mensaje", () => {
    const url = obtenerUrlWhatsApp("Hola Mundo")
    expect(url).toBe("https://api.whatsapp.com/send?text=Hola%20Mundo")
  })
})

