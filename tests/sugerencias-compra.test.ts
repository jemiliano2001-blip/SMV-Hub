/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from "vitest"
import {
  aplanarHistorial,
  completarCamposItem,
  esProbableHerramienta,
  normalizarTexto,
  tokenizarDescripcion,
  type ItemHistorico,
} from "@/lib/sugerencias-compra"
import type { OrdenCompra } from "@/lib/schemas"

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeHistorico(overrides: Partial<ItemHistorico> = {}): ItemHistorico {
  return {
    descripcion: "Reamer 1/4",
    proveedor: "McMaster-Carr",
    empresa: "SMV",
    cuentaCargo: "Stock",
    requisitor: "Daniel",
    creadoEn: new Date("2026-06-10"),
    ...overrides,
  }
}

function makeOrden(overrides: Partial<OrdenCompra> = {}): OrdenCompra {
  return {
    id: "ord-1",
    proveedor: "McMaster-Carr",
    numeroFactura: "INV-001",
    fechaFactura: "2026-06-10",
    moneda: "USD",
    subtotal: 100,
    envio: null,
    impuestos: 16,
    total: 116,
    items: [
      {
        descripcion: "Reamer 1/4",
        cantidad: 1,
        precioUnitario: 100,
        total: 100,
        empresa: "SMV",
        cuentaCargo: "Stock",
        requisitor: "Daniel",
        ordenTrabajo: "",
      } as any,
    ],
    requisitor: "",
    ordenTrabajo: "",
    empresa: "",
    cuentaCargo: "",
    destino: "",
    estado: "pendiente",
    estadoRecepcion: "pendiente",
    creadoEn: new Date("2026-06-10"),
    actualizadoEn: new Date("2026-06-10"),
    ...overrides,
  }
}

// ── normalizarTexto / tokenizar ───────────────────────────────────────────────

describe("normalizarTexto", () => {
  it("quita acentos, baja a minúsculas y colapsa espacios", () => {
    expect(normalizarTexto("  Máquina   CNC  ")).toBe("maquina cnc")
  })
})

describe("tokenizarDescripcion", () => {
  it("descarta tokens cortos y stopwords", () => {
    expect(tokenizarDescripcion("End mill de 1/2 carbide")).toEqual([
      "end",
      "mill",
      "carbide",
    ])
  })
})

// ── esProbableHerramienta ─────────────────────────────────────────────────────

describe("esProbableHerramienta", () => {
  it("detecta herramientas por palabra clave", () => {
    expect(esProbableHerramienta("Carbide End Mill 1/2")).toBe(true)
    expect(esProbableHerramienta("Broca HSS 6mm")).toBe(true)
  })

  it("descarta consumibles obvios aunque el proveedor sea de herramienta", () => {
    expect(esProbableHerramienta("Tornillo M6x20", "McMaster-Carr")).toBe(false)
  })

  it("usa el proveedor como señal cuando la descripción es ambigua", () => {
    expect(esProbableHerramienta("Item genérico", "Grainger")).toBe(true)
    expect(esProbableHerramienta("Item genérico", "Amazon")).toBe(false)
  })
})

// ── aplanarHistorial ──────────────────────────────────────────────────────────

describe("aplanarHistorial", () => {
  it("genera una línea por ítem con campos resueltos item→orden", () => {
    const orden = makeOrden({
      empresa: "APX",
      cuentaCargo: "SO1",
      requisitor: "Legacy",
      items: [
        {
          descripcion: "Pieza A",
          cantidad: 1,
          precioUnitario: 1,
          total: 1,
          empresa: "",
          cuentaCargo: "",
          requisitor: "",
          ordenTrabajo: "",
        } as any,
      ],
    })
    const lineas = aplanarHistorial([orden])
    expect(lineas).toHaveLength(1)
    expect(lineas[0].empresa).toBe("APX")
    expect(lineas[0].cuentaCargo).toBe("SO1")
    expect(lineas[0].requisitor).toBe("Legacy")
  })
})

// ── completarCamposItem ───────────────────────────────────────────────────────

describe("completarCamposItem", () => {
  it("respeta los valores ya presentes (extraídos por IA)", () => {
    const historial = [makeHistorico({ empresa: "APX", cuentaCargo: "SO9", requisitor: "Otro" })]
    const out = completarCamposItem(
      { descripcion: "Reamer 1/4", empresa: "OHD", cuentaCargo: "SO123", requisitor: "Juan" },
      "McMaster-Carr",
      historial
    )
    expect(out).toEqual({ empresa: "OHD", cuentaCargo: "SO123", requisitor: "Juan" })
  })

  it("usa match exacto de descripción + proveedor (registro más reciente)", () => {
    const historial = [
      makeHistorico({
        descripcion: "Reamer 1/4",
        empresa: "APX",
        cuentaCargo: "SO-VIEJO",
        requisitor: "Viejo",
        creadoEn: new Date("2026-01-01"),
      }),
      makeHistorico({
        descripcion: "Reamer 1/4",
        empresa: "OHD",
        cuentaCargo: "SO-NUEVO",
        requisitor: "Nuevo",
        creadoEn: new Date("2026-06-01"),
      }),
    ]
    const out = completarCamposItem(
      { descripcion: "Reamer 1/4", empresa: "", cuentaCargo: "", requisitor: "" },
      "McMaster-Carr",
      historial
    )
    expect(out).toEqual({ empresa: "OHD", cuentaCargo: "SO-NUEVO", requisitor: "Nuevo" })
  })

  it("cae a moda por proveedor cuando la descripción es nueva", () => {
    const historial = [
      makeHistorico({ descripcion: "Pieza X", empresa: "APX", cuentaCargo: "SO1", requisitor: "Ana" }),
      makeHistorico({ descripcion: "Pieza Y", empresa: "APX", cuentaCargo: "SO2", requisitor: "Ana" }),
      makeHistorico({ descripcion: "Pieza Z", empresa: "OHD", cuentaCargo: "SO3", requisitor: "Beto" }),
    ]
    const out = completarCamposItem(
      { descripcion: "Cosa totalmente distinta zzz", empresa: "", cuentaCargo: "", requisitor: "" },
      "McMaster-Carr",
      historial
    )
    expect(out.empresa).toBe("APX")
    expect(out.requisitor).toBe("Ana")
  })

  it("herramienta sin historial → SMV / Stock", () => {
    const out = completarCamposItem(
      { descripcion: "Carbide End Mill 1/2", empresa: "", cuentaCargo: "", requisitor: "" },
      "Proveedor Nuevo SA",
      []
    )
    expect(out.empresa).toBe("SMV")
    expect(out.cuentaCargo).toBe("Stock")
    expect(out.requisitor).toBe("")
  })

  it("herramienta sin proveedor conocido → requisitor más frecuente entre compras de Stock", () => {
    const historial = [
      makeHistorico({ descripcion: "Algo", proveedor: "Otro Prov", empresa: "SMV", cuentaCargo: "Stock", requisitor: "Lorena" }),
      makeHistorico({ descripcion: "Algo2", proveedor: "Otro Prov", empresa: "SMV", cuentaCargo: "Stock", requisitor: "Lorena" }),
      makeHistorico({ descripcion: "Algo3", proveedor: "Otro Prov", empresa: "SMV", cuentaCargo: "Stock", requisitor: "Pedro" }),
    ]
    const out = completarCamposItem(
      { descripcion: "Drill bit 3mm", empresa: "", cuentaCargo: "", requisitor: "" },
      "Sin Historial SA",
      historial
    )
    expect(out.empresa).toBe("SMV")
    expect(out.cuentaCargo).toBe("Stock")
    expect(out.requisitor).toBe("Lorena")
  })

  it("does not use the global mode for a provider without history", () => {
    const historial = [
      makeHistorico({ proveedor: "Proveedor A", empresa: "APX", cuentaCargo: "SO1", requisitor: "Ana" }),
      makeHistorico({ proveedor: "Proveedor B", empresa: "OHD", cuentaCargo: "SO2", requisitor: "Beto" }),
    ]

    const out = completarCamposItem(
      { descripcion: "Empaque especial", empresa: "", cuentaCargo: "", requisitor: "" },
      "Proveedor nuevo",
      historial
    )

    expect(out).toEqual({ empresa: "", cuentaCargo: "", requisitor: "" })
  })

  it("solo completa los campos vacíos, deja intactos los llenos", () => {
    const historial = [makeHistorico({ empresa: "APX", cuentaCargo: "SO9", requisitor: "Ana" })]
    const out = completarCamposItem(
      { descripcion: "Reamer 1/4", empresa: "MIA", cuentaCargo: "", requisitor: "" },
      "McMaster-Carr",
      historial
    )
    expect(out.empresa).toBe("MIA")
    expect(out.cuentaCargo).toBe("SO9")
    expect(out.requisitor).toBe("Ana")
  })

  it("sin historial ni herramienta → deja vacíos", () => {
    const out = completarCamposItem(
      { descripcion: "Servicio de flete", empresa: "", cuentaCargo: "", requisitor: "" },
      "DHL",
      []
    )
    expect(out).toEqual({ empresa: "", cuentaCargo: "", requisitor: "" })
  })
})
