import { describe, it, expect } from "vitest"
import { CotizacionOdooPayloadSchema, PartidaCotizacionOdooSchema } from "@/lib/schemas"

describe("odoo-cotizacion schemas y payload", () => {
  it("valida una partida de cotización Odoo correctamente", () => {
    const partidaValida = {
      id: "partida_1",
      partida: 12,
      clave: "TSF 05X064",
      descripcion: "TOR SOCKET FINO 3/16-32 X 2-1/2",
      cantidad: 100,
      udm: "Pieza",
      precioUnitario: 3.88,
      subtotal: 388,
      impuesto: "IVA 16%",
      tasaIva: 0.16,
      requisitor: "Pablo",
      empresa: "Taller",
      uso: "General",
    }

    const res = PartidaCotizacionOdooSchema.safeParse(partidaValida)
    expect(res.success).toBe(true)
  })

  it("rechaza partida sin descripción o con cantidad <= 0", () => {
    const partidaInvalida = {
      id: "partida_2",
      descripcion: "",
      cantidad: -5,
      precioUnitario: 10,
      subtotal: -50,
    }

    const res = PartidaCotizacionOdooSchema.safeParse(partidaInvalida)
    expect(res.success).toBe(false)
  })

  it("valida payload completo de cotización hacia Odoo", () => {
    const payload = {
      proveedor: "PROTOSA",
      referenciaProveedor: "251165",
      moneda: "MXN",
      fecha: "2026-08-17",
      requisitorGeneral: "Pablo",
      empresaGeneral: "Taller",
      usoGeneral: "General",
      partidas: [
        {
          id: "p1",
          clave: "TSF 05X064",
          descripcion: "TOR SOCKET FINO 3/16-32 X 2-1/2",
          cantidad: 100,
          udm: "Pieza",
          precioUnitario: 3.88,
          subtotal: 388,
          impuesto: "IVA 16%",
          tasaIva: 0.16,
          requisitor: "Pablo",
          empresa: "Taller",
          uso: "General",
        },
      ],
    }

    const res = CotizacionOdooPayloadSchema.safeParse(payload)
    expect(res.success).toBe(true)
    if (res.success) {
      expect(res.data.proveedor).toBe("PROTOSA")
      expect(res.data.partidas).toHaveLength(1)
      expect(res.data.partidas[0].subtotal).toBe(388)
    }
  })
})
