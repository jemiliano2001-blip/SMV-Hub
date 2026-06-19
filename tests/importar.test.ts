import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockCrearOrdenesLote } = vi.hoisted(() => ({
  // Simula el lote real: invoca onProgreso una vez y devuelve el conteo.
  mockCrearOrdenesLote: vi.fn(
    async (
      payloads: unknown[],
      onProgreso?: (completadas: number, total: number) => void
    ) => {
      onProgreso?.(payloads.length, payloads.length)
      return payloads.length
    }
  ),
}))

vi.mock("@/lib/ordenes", () => ({
  crearOrdenesLote: mockCrearOrdenesLote,
}))

vi.mock("@/lib/firebase", () => ({
  db: {},
  storage: {},
}))

import {
  parsearCSVTexto,
  detectarColumnas,
  mapearFila,
  mapearExtraccion,
  erroresRequeridos,
  procesarCSV,
  importarOrdenes,
  verificarDuplicados,
} from "@/lib/importar"
import type { ExtraccionInvoice } from "@/lib/schemas"

// ── parsearCSVTexto ──────────────────────────────────────────────────────────

describe("parsearCSVTexto", () => {
  it("parsea CSV de dos filas con tres columnas", () => {
    const csv = "a,b,c\n1,2,3"
    expect(parsearCSVTexto(csv)).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ])
  })

  it("maneja campos entre comillas que contienen comas", () => {
    const csv = '"Tornillo, M6",10,15.00\nText,1,2'
    const rows = parsearCSVTexto(csv)
    expect(rows[0][0]).toBe("Tornillo, M6")
  })

  it("hace trim de espacios en celdas no entrecomilladas", () => {
    const csv = " Proveedor , Requisitor \n acme , juan "
    const rows = parsearCSVTexto(csv)
    expect(rows[0]).toEqual(["Proveedor", "Requisitor"])
    expect(rows[1]).toEqual(["acme", "juan"])
  })

  it("ignora líneas en blanco al final", () => {
    const csv = "a,b\n1,2\n\n"
    expect(parsearCSVTexto(csv)).toHaveLength(2)
  })

  it("maneja saltos de línea CRLF (Windows)", () => {
    const csv = "a,b\r\n1,2\r\n3,4"
    expect(parsearCSVTexto(csv)).toHaveLength(3)
  })
})

// ── detectarColumnas ─────────────────────────────────────────────────────────

describe("detectarColumnas", () => {
  it("detecta columnas en el orden exacto del spec", () => {
    const headers = [
      "Estado del pedido", "Fecha del pedido", "Proveedor",
      "Cantidad", "Descripción", "Link",
      "Fecha entrega", "Requisitor", "Orden de trabajo", "Empresa",
    ]
    const idx = detectarColumnas(headers)
    expect(idx["estado"]).toBe(0)
    expect(idx["fechaFactura"]).toBe(1)
    expect(idx["proveedor"]).toBe(2)
    expect(idx["cantidad"]).toBe(3)
    expect(idx["descripcion"]).toBe(4)
    expect(idx["linkProveedor"]).toBe(5)
    expect(idx["fechaEntrega"]).toBe(6)
    expect(idx["requisitor"]).toBe(7)
    expect(idx["ordenTrabajo"]).toBe(8)
    expect(idx["empresa"]).toBe(9)
  })

  it("es case-insensitive y hace trim", () => {
    const headers = ["  PROVEEDOR  ", "REQUISITOR", "ORDEN DE TRABAJO", "EMPRESA"]
    const idx = detectarColumnas(headers)
    expect(idx["proveedor"]).toBe(0)
    expect(idx["requisitor"]).toBe(1)
    expect(idx["ordenTrabajo"]).toBe(2)
    expect(idx["empresa"]).toBe(3)
  })

  it("reconoce alias 'Guía' para fechaEntrega", () => {
    const headers = ["Guía"]
    const idx = detectarColumnas(headers)
    expect(idx["fechaEntrega"]).toBe(0)
  })

  it("reconoce alias 'Fecha' para fechaFactura", () => {
    const headers = ["Fecha"]
    const idx = detectarColumnas(headers)
    expect(idx["fechaFactura"]).toBe(0)
  })

  it("devuelve objeto vacío si ningún header es reconocido", () => {
    const idx = detectarColumnas(["XYZ", "ABC"])
    expect(Object.keys(idx)).toHaveLength(0)
  })
})

// ── mapearFila ───────────────────────────────────────────────────────────────

describe("mapearFila", () => {
  const COL: Record<string, number> = {
    estado: 0, fechaFactura: 1, proveedor: 2,
    cantidad: 3, descripcion: 4, linkProveedor: 5,
    fechaEntrega: 6, requisitor: 7, ordenTrabajo: 8, empresa: 9,
  }

  const filaOK = [
    "Aprobado", "2024-06-01", "Amazon",
    "2", "Cable USB", "https://amazon.com",
    "2024-06-15", "Juan", "OT-100", "SMV Norte",
  ]

  it("produce fila válida sin errores ni advertencias", () => {
    const r = mapearFila(filaOK, COL, 0)
    expect(r.errores).toHaveLength(0)
    expect(r.advertencias).toHaveLength(0)
    expect(r.seleccionada).toBe(true)
  })

  it("mapea estado 'Aprobado' → 'aprobada'", () => {
    const r = mapearFila(filaOK, COL, 0)
    expect(r.datos.estado).toBe("aprobada")
  })

  it("mapea estado 'Pendiente' → 'pendiente'", () => {
    const fila = [...filaOK]
    fila[0] = "Pendiente"
    const r = mapearFila(fila, COL, 0)
    expect(r.datos.estado).toBe("pendiente")
  })

  it("estado desconocido → 'pendiente' + advertencia", () => {
    const fila = [...filaOK]
    fila[0] = "Entregado"
    const r = mapearFila(fila, COL, 0)
    expect(r.datos.estado).toBe("pendiente")
    expect(r.advertencias).toHaveLength(1)
    expect(r.advertencias[0]).toContain("Entregado")
  })

  it("cantidad numérica se convierte a number", () => {
    const r = mapearFila(filaOK, COL, 0)
    expect(r.datos.items[0].cantidad).toBe(2)
  })

  it("cantidad no numérica → null + advertencia", () => {
    const fila = [...filaOK]
    fila[3] = "dos cajas"
    const r = mapearFila(fila, COL, 0)
    expect(r.datos.items[0].cantidad).toBeNull()
    expect(r.advertencias.some(a => a.includes("cantidad") || a.includes("Cantidad"))).toBe(true)
  })

  it("cantidad vacía → null sin advertencia", () => {
    const fila = [...filaOK]
    fila[3] = ""
    const r = mapearFila(fila, COL, 0)
    expect(r.datos.items[0].cantidad).toBeNull()
    expect(r.advertencias).toHaveLength(0)
  })

  it("proveedor vacío → error bloqueante", () => {
    const fila = [...filaOK]
    fila[2] = ""
    const r = mapearFila(fila, COL, 0)
    expect(r.errores.some(e => e.toLowerCase().includes("proveedor"))).toBe(true)
  })

  it("requisitor vacío → error bloqueante", () => {
    const fila = [...filaOK]
    fila[7] = ""
    const r = mapearFila(fila, COL, 0)
    expect(r.errores.some(e => e.toLowerCase().includes("requisitor"))).toBe(true)
  })

  it("ordenTrabajo vacío → error bloqueante", () => {
    const fila = [...filaOK]
    fila[8] = ""
    const r = mapearFila(fila, COL, 0)
    expect(r.errores.some(e => e.toLowerCase().includes("trabajo") || e.toLowerCase().includes("orden"))).toBe(true)
  })

  it("empresa vacía → error bloqueante", () => {
    const fila = [...filaOK]
    fila[9] = ""
    const r = mapearFila(fila, COL, 0)
    expect(r.errores.some(e => e.toLowerCase().includes("empresa"))).toBe(true)
  })

  it("linkProveedor y fechaEntrega se mapean correctamente", () => {
    const r = mapearFila(filaOK, COL, 0)
    expect(r.datos.linkProveedor).toBe("https://amazon.com")
    expect(r.datos.fechaEntrega).toBe("2024-06-15")
  })

  it("campo ausente del colIdx produce null, no error", () => {
    const colSinLink: Record<string, number> = { ...COL }
    delete colSinLink["linkProveedor"]
    const r = mapearFila(filaOK, colSinLink, 0)
    expect(r.datos.linkProveedor).toBeNull()
    expect(r.errores).toHaveLength(0)
  })
})

// ── erroresRequeridos ─────────────────────────────────────────────────────────

describe("erroresRequeridos", () => {
  const completo = { proveedor: "A", requisitor: "B", ordenTrabajo: "C", empresa: "D" }

  it("no devuelve errores si todos los campos están presentes", () => {
    expect(erroresRequeridos(completo)).toHaveLength(0)
  })

  it("detecta cada campo obligatorio vacío", () => {
    expect(erroresRequeridos({ ...completo, proveedor: "" })[0]).toMatch(/proveedor/i)
    expect(erroresRequeridos({ ...completo, requisitor: "  " })[0]).toMatch(/requisitor/i)
    expect(erroresRequeridos({ ...completo, ordenTrabajo: "" })[0]).toMatch(/trabajo/i)
    expect(erroresRequeridos({ ...completo, empresa: "" })[0]).toMatch(/empresa/i)
  })
})

// ── mapearExtraccion ──────────────────────────────────────────────────────────

describe("mapearExtraccion", () => {
  const extraccion: ExtraccionInvoice = {
    proveedor: "Amazon",
    numeroFactura: "INV-1",
    fechaFactura: "2024-06-01",
    moneda: "USD",
    subtotal: 100,
    impuestos: 8,
    total: 108,
    items: [{ descripcion: "Cable", cantidad: 2, precioUnitario: 50, total: 100 }],
  }

  it("copia los datos de factura y deja vacíos los campos manuales", () => {
    const fila = mapearExtraccion(extraccion, 0)
    expect(fila.datos.proveedor).toBe("Amazon")
    expect(fila.datos.total).toBe(108)
    expect(fila.datos.items).toHaveLength(1)
    expect(fila.datos.requisitor).toBe("")
    expect(fila.datos.ordenTrabajo).toBe("")
    expect(fila.datos.empresa).toBe("")
  })

  it("marca errores bloqueantes por los campos manuales vacíos y queda no seleccionada", () => {
    const fila = mapearExtraccion(extraccion, 3)
    expect(fila.indice).toBe(3)
    expect(fila.errores).toHaveLength(3) // requisitor, ordenTrabajo, empresa
    expect(fila.seleccionada).toBe(false)
    expect(fila.datos.estado).toBe("pendiente")
  })

  it("si el proveedor viene vacío también lo marca como error", () => {
    const fila = mapearExtraccion({ ...extraccion, proveedor: "" }, 0)
    expect(fila.errores).toHaveLength(4)
  })
})

// ── procesarCSV ──────────────────────────────────────────────────────────────

describe("procesarCSV", () => {
  const CSV_OK = [
    "Estado del pedido,Fecha del pedido,Proveedor,Cantidad,Descripción,Link,Fecha entrega,Requisitor,Orden de trabajo,Empresa",
    "Pendiente,2024-06-01,Amazon,2,Cable USB,https://amazon.com,2024-06-15,Juan,OT-100,SMV Norte",
    "Aprobado,2024-06-02,Grainger,1,Guante,,2024-06-20,María,OT-200,SMV Sur",
  ].join("\n")

  it("parsea dos filas válidas sin error", () => {
    const { filas, error } = procesarCSV(CSV_OK)
    expect(error).toBeNull()
    expect(filas).toHaveLength(2)
  })

  it("devuelve error si falta columna requerida", () => {
    const csvSinProveedor = [
      "Estado del pedido,Requisitor,Orden de trabajo,Empresa",
      "Pendiente,Juan,OT-100,SMV Norte",
    ].join("\n")
    const { error } = procesarCSV(csvSinProveedor)
    expect(error).not.toBeNull()
    expect(error).toContain("proveedor")
  })

  it("devuelve error si el CSV tiene menos de 2 filas", () => {
    const { error } = procesarCSV("Proveedor,Requisitor")
    expect(error).not.toBeNull()
  })
})

// ── verificarDuplicados ───────────────────────────────────────────────────────

describe("verificarDuplicados", () => {
  const filaConFactura = (indice: number, numeroFactura: string, proveedor: string) => ({
    indice,
    datos: {
      proveedor,
      numeroFactura,
      fechaFactura: null,
      moneda: "USD",
      subtotal: null,
      impuestos: null,
      total: null,
      items: [],
      requisitor: "juan",
      ordenTrabajo: "OT-1",
      empresa: "SMV",
      cuentaCargo: "",
      destino: "",
      linkProveedor: null,
      fechaEntrega: null,
      estado: "pendiente" as const,
    },
    errores: [] as string[],
    advertencias: [] as string[],
    seleccionada: true,
  })

  it("devuelve [] cuando no hay duplicados", () => {
    const filas = [filaConFactura(0, "INV-1", "Amazon")]
    const existentes = [{ numeroFactura: "INV-99", proveedor: "Amazon" }]
    expect(verificarDuplicados(filas, existentes)).toHaveLength(0)
  })

  it("detecta un duplicado exacto", () => {
    const filas = [filaConFactura(0, "INV-1", "Amazon")]
    const existentes = [{ numeroFactura: "INV-1", proveedor: "Amazon" }]
    const result = verificarDuplicados(filas, existentes)
    expect(result).toHaveLength(1)
    expect(result[0].indice).toBe(0)
    expect(result[0].motivo).toContain("INV-1")
  })

  it("la comparación es case-insensitive", () => {
    const filas = [filaConFactura(0, "inv-1", "AMAZON")]
    const existentes = [{ numeroFactura: "INV-1", proveedor: "amazon" }]
    expect(verificarDuplicados(filas, existentes)).toHaveLength(1)
  })

  it("ignora filas cuyo numeroFactura es null", () => {
    const filas = [{
      ...filaConFactura(0, "INV-1", "Amazon"),
      datos: { ...filaConFactura(0, "INV-1", "Amazon").datos, numeroFactura: null },
    }]
    const existentes = [{ numeroFactura: "INV-1", proveedor: "Amazon" }]
    expect(verificarDuplicados(filas, existentes)).toHaveLength(0)
  })

  it("ignora existentes cuyo numeroFactura es null", () => {
    const filas = [filaConFactura(0, "INV-1", "Amazon")]
    const existentes = [{ numeroFactura: null, proveedor: "Amazon" }]
    expect(verificarDuplicados(filas, existentes)).toHaveLength(0)
  })

  it("mismo proveedor pero diferente factura no es duplicado", () => {
    const filas = [filaConFactura(0, "INV-1", "Amazon")]
    const existentes = [{ numeroFactura: "INV-2", proveedor: "Amazon" }]
    expect(verificarDuplicados(filas, existentes)).toHaveLength(0)
  })
})

// ── procesarCSV incluye columnasDetectadas ────────────────────────────────────

describe("procesarCSV — columnasDetectadas", () => {
  it("incluye las columnas detectadas en el resultado exitoso", () => {
    const csv = [
      "Proveedor,Requisitor,Orden de trabajo,Empresa,Fecha del pedido",
      "Amazon,Juan,OT-1,SMV,2026-01-01",
    ].join("\n")
    const { columnasDetectadas, error } = procesarCSV(csv)
    expect(error).toBeNull()
    expect(columnasDetectadas).toContain("proveedor")
    expect(columnasDetectadas).toContain("requisitor")
    expect(columnasDetectadas).toContain("ordenTrabajo")
    expect(columnasDetectadas).toContain("empresa")
    expect(columnasDetectadas).toContain("fechaFactura")
  })

  it("devuelve columnasDetectadas vacío cuando hay error de columna faltante", () => {
    const csv = ["Proveedor,Requisitor", "Amazon,Juan"].join("\n")
    const { columnasDetectadas, error } = procesarCSV(csv)
    expect(error).not.toBeNull()
    expect(columnasDetectadas).toEqual([])
  })

  it("devuelve columnasDetectadas vacío cuando CSV tiene menos de 2 filas", () => {
    const { columnasDetectadas } = procesarCSV("Proveedor,Requisitor")
    expect(columnasDetectadas).toEqual([])
  })
})

// ── importarOrdenes ──────────────────────────────────────────────────────────

function makeFilaValida(indice: number) {
  return {
    indice,
    datos: {
      proveedor: `Proveedor ${indice}`,
      numeroFactura: null,
      fechaFactura: null,
      moneda: "USD",
      subtotal: null,
      impuestos: null,
      total: null,
      items: [{ descripcion: "Item", cantidad: 1, precioUnitario: null, total: null }],
      requisitor: "Juan",
      ordenTrabajo: "OT-100",
      empresa: "SMV Norte",
      cuentaCargo: '',
      destino: '',
      linkProveedor: null,
      fechaEntrega: null,
      estado: "pendiente" as const,
    },
    errores: [] as string[],
    advertencias: [] as string[],
    seleccionada: true,
  }
}

describe("importarOrdenes", () => {
  beforeEach(() => {
    mockCrearOrdenesLote.mockClear()
  })

  it("importa 50 filas válidas pasando los 50 payloads al lote", async () => {
    const filas = Array.from({ length: 50 }, (_, i) => makeFilaValida(i))
    const { importadas } = await importarOrdenes(filas)
    expect(mockCrearOrdenesLote).toHaveBeenCalledTimes(1)
    expect(mockCrearOrdenesLote.mock.calls[0][0]).toHaveLength(50)
    expect(importadas).toBe(50)
  })

  it("omite filas con errores bloqueantes", async () => {
    const filas = [
      makeFilaValida(0),
      { ...makeFilaValida(1), errores: ["Proveedor vacío"] },
      makeFilaValida(2),
    ]
    const { importadas } = await importarOrdenes(filas)
    expect(mockCrearOrdenesLote.mock.calls[0][0]).toHaveLength(2)
    expect(importadas).toBe(2)
  })

  it("omite filas desmarcadas (seleccionada: false)", async () => {
    const filas = [
      makeFilaValida(0),
      { ...makeFilaValida(1), seleccionada: false },
      makeFilaValida(2),
    ]
    const { importadas } = await importarOrdenes(filas)
    expect(mockCrearOrdenesLote.mock.calls[0][0]).toHaveLength(2)
    expect(importadas).toBe(2)
  })

  it("propaga onProgreso desde el lote", async () => {
    const filas = Array.from({ length: 25 }, (_, i) => makeFilaValida(i))
    const progresos: number[] = []
    await importarOrdenes(filas, (n) => progresos.push(n))
    expect(progresos).toEqual([25])
  })

  it("importa cero filas si todas están desmarcadas", async () => {
    const filas = [{ ...makeFilaValida(0), seleccionada: false }]
    const { importadas } = await importarOrdenes(filas)
    expect(mockCrearOrdenesLote.mock.calls[0][0]).toHaveLength(0)
    expect(importadas).toBe(0)
  })
})
