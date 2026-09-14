/**
 * B3 · T3.1 — parser de `diasHabiles` → lead time numérico.
 *
 * Dos capas: reglas explícitas (documentan la decisión) y un golden con los 110 valores distintos
 * reales de producción al 2026-09-14 (tests/fixtures/lead-time-valores-prod-2026-09-14.json), que
 * fija el comportamiento sobre lo que de verdad escribe la gente. Si el parser cambia a
 * propósito, se regenera el fixture y se revisa el diff; no se "arregla" el test a ciegas.
 */
import { describe, expect, it } from "vitest"
import { describirLeadTime, leadTimeDesdeDiasHabiles, parsearDiasHabiles } from "@/lib/lead-time"
import fixture from "./fixtures/lead-time-valores-prod-2026-09-14.json"

const ok = (min: number, max: number, tipo: string) => ({ ok: true, min, max, tipo })
const nulo = (motivo: string) => ({ ok: false, motivo })

describe("parsearDiasHabiles — reglas", () => {
  it.each([
    ["5 dias", ok(5, 5, "numero")],
    ["1 dia", ok(1, 1, "numero")],
    ["3 dis habiles", ok(3, 3, "numero")],
    ["mty 2 días", ok(2, 2, "numero")],
    ["5 dias hábiles", ok(5, 5, "numero")],
    ["1 dia previo pago", ok(1, 1, "numero")],
  ])("número: %s", (v, e) => expect(parsearDiasHabiles(v)).toEqual(e))

  it.each([
    ["3 - 4", ok(3, 4, "rango")],
    ["20-30 dias", ok(20, 30, "rango")],
    ["7 a 8 dias", ok(7, 8, "rango")],
    ["5 - 7 dias h", ok(5, 7, "rango")], // la "h" es hábiles, no horas
    ["20-30 dias 10 dlls o 3-5 dias 3 dlls", ok(20, 30, "rango")], // primer par; "dlls" no lo vuelve moneda porque hay unidad
  ])("rango: %s", (v, e) => expect(parsearDiasHabiles(v)).toEqual(e))

  it.each([
    ["1 semana", ok(5, 5, "semanas")],
    ["2 - 3 semanas", ok(10, 15, "semanas")],
    ["5-6 Semanas", ok(25, 30, "semanas")],
    ["17 semanas", ok(85, 85, "semanas")],
    ["1 mes", ok(20, 20, "meses")],
    ["1-2 meses", ok(20, 40, "meses")],
  ])("semanas ×5 / meses ×20: %s", (v, e) => expect(parsearDiasHabiles(v)).toEqual(e))

  it("horas: solo con hrs/horas explícitas, mínimo 1 día", () => {
    expect(parsearDiasHabiles("24-48 hrs")).toEqual(ok(1, 2, "horas"))
    expect(parsearDiasHabiles("2 horas")).toEqual(ok(1, 1, "horas"))
  })

  it.each([
    "stock", "STOCK", "Stock local", "local stock", "En stock", "entrega inmediata", "stock en japon",
    "10 piezas disponibles", "In Stock: 24 Can Ship Immediately", "Can Ship Immediately (20 in stock)",
  ])("stock → 0 días: %s", (v) => expect(parsearDiasHabiles(v)).toEqual(ok(0, 0, "stock")))

  it("en stock pero con tiempo de fábrica: manda el tiempo, la cantidad disponible no cuenta", () => {
    expect(parsearDiasHabiles("En stock (10 disponibles para envío inmediato) / Tiempo de fábrica: 4 semanas")).toEqual(ok(20, 20, "semanas"))
  })

  it.each([
    ["$1,00", 1], ["$5,00", 5], ["$15,00", 15], ["$ 3.00", 3], ["60,00", 60],
  ])("columna de días con formato de moneda (T3.0): %s → %i", (v, d) =>
    expect(parsearDiasHabiles(v)).toEqual(ok(d, d, "moneda_formato"))
  )

  it.each([
    "$88.978,54", "$61,00", "precios 2026", "10 dlls", "150 usd", "2500 pesos",
  ])("dinero de verdad → null moneda: %s", (v) => expect(parsearDiasHabiles(v)).toEqual(nulo("moneda")))

  it.each([
    "18 diciembre - 5 enero", "18 - 20 diciembre", "mayo 2", "Tue, Aug 25 - Fri, Aug 28",
    "Estimated between Mon, Aug 24 and Thu, Aug 27", "Llega el lunes", "Llega entre el martes y el miércoles",
  ])("fechas → null fecha: %s", (v) => expect(parsearDiasHabiles(v)).toEqual(nulo("fecha")))

  it.each(["Sin stock", "Sin stocl", "Out of Stock", "No tienen", "agotado", "no hay existencia"])(
    "sin existencia → null sin_stock: %s",
    (v) => expect(parsearDiasHabiles(v)).toEqual(nulo("sin_stock"))
  )

  it.each(["", "   ", "pte", "Pte confirmar", "N/A", "Envío estándar (FedEx Ground Economy)", null, undefined])(
    "sin número → null sin_numero: %s",
    (v) => expect(parsearDiasHabiles(v)).toEqual(nulo("sin_numero"))
  )

  it("más de un año → fuera de rango", () => {
    expect(parsearDiasHabiles("400 dias")).toEqual(nulo("fuera_de_rango"))
    expect(parsearDiasHabiles("80 semanas")).toEqual(nulo("fuera_de_rango"))
  })
})

describe("golden — 110 valores distintos reales de producción (2026-09-14)", () => {
  it("cubre el universo real y parsea ≥ 80 % de las filas (criterio #5)", () => {
    const total = fixture.filas.reduce((a, f) => a + f.n, 0)
    const parseadas = fixture.filas.filter((f) => f.esperado.ok).reduce((a, f) => a + f.n, 0)
    expect(fixture.filas.length).toBe(110)
    expect(total).toBe(268)
    expect(parseadas / total).toBeGreaterThanOrEqual(0.8)
  })

  it.each(fixture.filas.map((f) => [f.valor, f.esperado] as const))("%j", (valor, esperado) => {
    expect(parsearDiasHabiles(valor)).toEqual(esperado)
  })

  it("ninguna semana quedó contada como días (el bug del parser anterior)", () => {
    for (const f of fixture.filas) {
      if (!/seman/i.test(f.valor)) continue
      const r = parsearDiasHabiles(f.valor)
      if (r.ok) expect(r.min % 5).toBe(0)
    }
  })
})

describe("helpers", () => {
  it("leadTimeDesdeDiasHabiles devuelve los dos campos o nulls", () => {
    expect(leadTimeDesdeDiasHabiles("2 - 3 semanas")).toEqual({ leadTimeMinDias: 10, leadTimeMaxDias: 15 })
    expect(leadTimeDesdeDiasHabiles("precios 2026")).toEqual({ leadTimeMinDias: null, leadTimeMaxDias: null })
    expect(leadTimeDesdeDiasHabiles(null)).toEqual({ leadTimeMinDias: null, leadTimeMaxDias: null })
  })

  it("describirLeadTime explica al usuario en vivo", () => {
    expect(describirLeadTime("")).toBeNull()
    expect(describirLeadTime("2 - 3 semanas")).toBe("10–15 días hábiles")
    expect(describirLeadTime("5 dias")).toBe("5 días hábiles")
    expect(describirLeadTime("stock")).toBe("en stock: 0 días")
    expect(describirLeadTime("precios 2026")).toBe("parece un precio, no días")
    expect(describirLeadTime("mayo 2")).toBe("es una fecha; escribe los días")
    expect(describirLeadTime("pte")).toBe("no se entiende; escribe un número de días")
  })
})
