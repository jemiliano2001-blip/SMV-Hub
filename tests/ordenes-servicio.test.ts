import { describe, it, expect } from "vitest"
import {
  calcularCantidadPendiente,
  formatearCantidadEntrega,
  normalizarEstatusOrdenServicio,
  normalizarOrdenServicioDesdeFirestore,
  parseCantidadNumerica,
  truncarNota,
} from "@/lib/ordenes-servicio-helpers"
import type { OrdenServicio } from "@/lib/schemas"

function ordenBase(overrides: Partial<OrdenServicio> = {}): OrdenServicio {
  const ahora = new Date("2026-07-01T12:00:00Z")
  return {
    id: "test-1",
    estatus: "pendiente",
    fechaOC: "2026-06-28",
    numOC: "MXN047274",
    requisitor: "Cindy Chaires",
    ingAcargo: "Antonio Vazquez",
    ordenTrabajo: "SO19422",
    descripcion: "Retrabajo de 24 nidos",
    cantidad: "12",
    cantidadEntregada: null,
    cantidadPendiente: null,
    tiempoEntrega: "??",
    fechaEntrega: "??",
    fechaEntregaActualizada: null,
    nota: null,
    creadoEn: ahora,
    actualizadoEn: ahora,
    ...overrides,
  }
}

describe("normalizarEstatusOrdenServicio", () => {
  it("mapea recibido legacy a entregada", () => {
    expect(normalizarEstatusOrdenServicio("recibido")).toBe("entregada")
  })

  it("conserva estatus válidos", () => {
    expect(normalizarEstatusOrdenServicio("detenida")).toBe("detenida")
    expect(normalizarEstatusOrdenServicio("en_proceso")).toBe("en_proceso")
  })

  it("fallback a pendiente para valores desconocidos", () => {
    expect(normalizarEstatusOrdenServicio("foo")).toBe("pendiente")
  })
})

describe("parseCantidadNumerica", () => {
  it("parsea enteros simples", () => {
    expect(parseCantidadNumerica("12")).toBe(12)
  })

  it("extrae número de texto con unidad", () => {
    expect(parseCantidadNumerica("3 mts")).toBe(3)
  })

  it("devuelve null si no hay número", () => {
    expect(parseCantidadNumerica("??")).toBeNull()
    expect(parseCantidadNumerica(null)).toBeNull()
  })
})

describe("calcularCantidadPendiente", () => {
  it("calcula total menos entregadas", () => {
    expect(calcularCantidadPendiente("15", 9)).toBe(6)
  })

  it("no baja de cero", () => {
    expect(calcularCantidadPendiente("5", 10)).toBe(0)
  })

  it("null si falta total o entregadas", () => {
    expect(calcularCantidadPendiente("??", 2)).toBeNull()
    expect(calcularCantidadPendiente("10", null)).toBeNull()
  })
})

describe("normalizarOrdenServicioDesdeFirestore", () => {
  it("normaliza estatus y defaults de campos nuevos", () => {
    const raw = {
      ...ordenBase({ estatus: "recibido" as never }),
      cantidadEntregada: undefined,
      nota: undefined,
    }
    const result = normalizarOrdenServicioDesdeFirestore(raw)
    expect(result.estatus).toBe("entregada")
    expect(result.cantidadEntregada).toBeNull()
    expect(result.nota).toBeNull()
  })
})

describe("formatearCantidadEntrega", () => {
  it("muestra solo cantidad si no hay entregas", () => {
    expect(formatearCantidadEntrega(ordenBase())).toBe("12")
  })

  it("muestra entregadas/total y pendientes", () => {
    const o = ordenBase({ cantidadEntregada: 9, cantidadPendiente: 3 })
    expect(formatearCantidadEntrega(o)).toBe("9/12 (↓3)")
  })
})

describe("truncarNota", () => {
  it("trunca notas largas", () => {
    const larga = "a".repeat(80)
    expect(truncarNota(larga, 60)).toHaveLength(61)
    expect(truncarNota(larga, 60).endsWith("…")).toBe(true)
  })

  it("devuelve vacío para null", () => {
    expect(truncarNota(null)).toBe("")
  })
})
