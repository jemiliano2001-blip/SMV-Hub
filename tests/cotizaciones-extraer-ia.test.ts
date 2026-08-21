import { describe, it, expect } from "vitest"
import {
  normalizarCotizacionExtraida,
  normalizarCotizacionMulti,
  type CotizacionExtraida,
} from "@/lib/cotizaciones-extraer-ia"


describe("normalizarCotizacionExtraida", () => {
  it("normaliza datos completos de un producto en USD", () => {
    const raw: Partial<CotizacionExtraida> = {
      numeroParte: " 140M-C2E-C16 ",
      descripcion: "  Motor Protection Circuit Breaker 10-16A  ",
      proveedor: " Rockwell Automation ",
      marca: " Allen-Bradley ",
      precioUnitario: 145.5,
      moneda: "USD",
      ubicacion: "USA",
      cantidad: 2,
      diasHabiles: "2 días",
      link: "https://rockwellautomation.com/item/140m",
      notas: "Nuevo en caja",
    }

    const res = normalizarCotizacionExtraida(raw)
    expect(res.numeroParte).toBe("140M-C2E-C16")
    expect(res.descripcion).toBe("Motor Protection Circuit Breaker 10-16A")
    expect(res.proveedor).toBe("Rockwell Automation")
    expect(res.marca).toBe("Allen-Bradley")
    expect(res.precioUnitario).toBe(145.5)
    expect(res.moneda).toBe("USD")
    expect(res.ubicacion).toBe("USA")
    expect(res.cantidad).toBe(2)
    expect(res.total).toBe(291)
    expect(res.diasHabiles).toBe("2 días")
    expect(res.link).toBe("https://rockwellautomation.com/item/140m")
    expect(res.notas).toBe("Nuevo en caja")
  })

  it("calcula total y cantidad default cuando vienen vacíos o null", () => {
    const raw: Partial<CotizacionExtraida> = {
      numeroParte: "SKU-99",
      precioUnitario: 25.5,
      moneda: "MXN",
    }

    const res = normalizarCotizacionExtraida(raw, "https://proveedor.mx/item")
    expect(res.cantidad).toBe(1)
    expect(res.total).toBe(25.5)
    expect(res.moneda).toBe("MXN")
    expect(res.ubicacion).toBe("MX")
    expect(res.link).toBe("https://proveedor.mx/item")
  })

  it("asigna valores por defecto seguros cuando faltan campos", () => {
    const res = normalizarCotizacionExtraida({})
    expect(res.descripcion).toBe("Producto cotizado")
    expect(res.proveedor).toBe("Proveedor")
    expect(res.moneda).toBe("USD")
    expect(res.ubicacion).toBe("USA")
    expect(res.cantidad).toBe(1)
    expect(res.precioUnitario).toBeNull()
    expect(res.total).toBeNull()
    expect(res.numeroParte).toBeNull()
  })
})

describe("normalizarCotizacionMulti", () => {
  it("normaliza múltiples partidas y metadatos generales", () => {
    const raw = {
      proveedor: " McMaster-Carr ",
      moneda: "USD" as const,
      ubicacion: "USA" as const,
      fechaCotizacion: "2026-08-20",
      solicitante: "Edgar",
      notasGenerales: "Envío UPS Ground",
      items: [
        {
          numeroParte: "91290A115",
          descripcion: "Tornillo Socket M6x20mm",
          precioUnitario: 12.5,
          cantidad: 5,
        },
        {
          numeroParte: "8975K11",
          descripcion: "Placa Aluminio 6061 1/2in",
          precioUnitario: 45.0,
          cantidad: 2,
        },
      ],
    }

    const multi = normalizarCotizacionMulti(raw)
    expect(multi.proveedor).toBe("McMaster-Carr")
    expect(multi.moneda).toBe("USD")
    expect(multi.ubicacion).toBe("USA")
    expect(multi.fechaCotizacion).toBe("2026-08-20")
    expect(multi.solicitante).toBe("Edgar")
    expect(multi.notasGenerales).toBe("Envío UPS Ground")
    expect(multi.items).toHaveLength(2)
    expect(multi.items[0].numeroParte).toBe("91290A115")
    expect(multi.items[0].total).toBe(62.5)
    expect(multi.items[1].numeroParte).toBe("8975K11")
    expect(multi.items[1].total).toBe(90.0)
  })

  it("crea un ítem default si el array de items viene vacío", () => {
    const multi = normalizarCotizacionMulti({ proveedor: "Grainger" })
    expect(multi.items).toHaveLength(1)
    expect(multi.items[0].descripcion).toBe("Producto cotizado")
    expect(multi.proveedor).toBe("Grainger")
  })
})

