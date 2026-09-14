/**
 * B4 — regla única de `mercado` / `origenProveedor` y plan de backfill.
 * Casos tomados de la calibración B0.4 (13 semillas USA sin Odoo, 87 partners MXN, 4 partners
 * USD que por decisión son México, McMaster con mercado ya persistido).
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import {
  camposMercadoFaltantesOdoo,
  inferirMercadoProveedor,
  inferirOrigenProveedor,
  planBackfillMercado,
} from "@/lib/proveedor-mercado"
import { inferirMercadoProveedor as inferirEnFunctions } from "../functions/src/proveedor-mercado"
import { mapearProveedorDocumento } from "@/lib/proveedores"

const raiz = resolve(import.meta.dirname, "..")

describe("paridad lib/ ↔ functions/", () => {
  it("proveedor-mercado.ts es idéntico byte a byte en ambos lados", () => {
    const enLib = readFileSync(resolve(raiz, "lib/proveedor-mercado.ts"), "utf8")
    const enFunctions = readFileSync(resolve(raiz, "functions/src/proveedor-mercado.ts"), "utf8")
    expect(enLib).toBe(enFunctions)
  })

  it("y se comporta igual", () => {
    for (const doc of [{}, { odooPartnerId: 12 }, { mercado: "usa", odooPartnerId: 12 }, { mercado: "basura" }]) {
      expect(inferirEnFunctions(doc)).toBe(inferirMercadoProveedor(doc))
    }
  })
})

describe("inferirMercadoProveedor / inferirOrigenProveedor", () => {
  it("respeta lo persistido cuando es válido", () => {
    expect(inferirMercadoProveedor({ mercado: "usa", odooPartnerId: 12 })).toBe("usa")
    expect(inferirMercadoProveedor({ mercado: "mexico" })).toBe("mexico")
    expect(inferirOrigenProveedor({ origenProveedor: "semilla", odooPartnerId: 12 })).toBe("semilla")
  })

  it("partner de Odoo → mexico / odoo, aunque facture en USD (decisión 2026-09-13)", () => {
    const higoh = { odooPartnerId: 4471, moneda: "USD", pais: "Estados Unidos" }
    expect(inferirMercadoProveedor(higoh)).toBe("mexico")
    expect(inferirOrigenProveedor(higoh)).toBe("odoo")
  })

  it("sin partner → usa / manual; valores inválidos se ignoran", () => {
    expect(inferirMercadoProveedor({})).toBe("usa")
    expect(inferirMercadoProveedor({ mercado: "USA" })).toBe("usa") // mayúsculas no son un valor válido
    expect(inferirMercadoProveedor({ odooPartnerId: "12" })).toBe("usa") // string, no number
    expect(inferirMercadoProveedor({ odooPartnerId: 0 })).toBe("usa")
    expect(inferirOrigenProveedor({ origenProveedor: "otro" })).toBe("manual")
  })

  it("el mapper del cliente usa la misma regla (sin regresión)", () => {
    const p = mapearProveedorDocumento("x", { nombre: "HIGOH DISTRIBUCIONES", odooPartnerId: 4471, moneda: "USD" })
    expect(p.mercado).toBe("mexico")
    expect(p.origenProveedor).toBe("odoo")
    const seed = mapearProveedorDocumento("y", { nombre: "Shars Tool Company", moneda: "USD" })
    expect(seed.mercado).toBe("usa")
    expect(seed.origenProveedor).toBe("manual")
  })
})

describe("planBackfillMercado", () => {
  const docs = [
    { id: "mcmaster", nombre: "McMaster-Carr", mercado: "usa", origenProveedor: "semilla" },
    { id: "shars", nombre: "Shars Tool Company" },
    { id: "levinson", nombre: "ACEROS LEVINSON", odooPartnerId: 100 },
    { id: "higoh", nombre: "HIGOH DISTRIBUCIONES", odooPartnerId: 4471 },
    { id: "nuevo-odoo", nombre: "Partner nuevo", odooPartnerId: 999, mercado: "mexico", origenProveedor: "odoo" },
    { id: "alta-chip", nombre: "eBay", mercado: "usa" },
  ]

  it("solo propone lo que falta y nunca pisa lo persistido", () => {
    const plan = planBackfillMercado(docs)
    expect(plan.total).toBe(6)
    expect(plan.sinCambio).toBe(3) // mcmaster, nuevo-odoo, alta-chip
    expect(plan.cambios.map((c) => c.id)).toEqual(["shars", "levinson", "higoh"])
    expect(plan.cambios[0]).toEqual({
      id: "shars",
      nombre: "Shars Tool Company",
      cambios: { mercado: "usa" },
      regla: "sin-odoo→usa",
    })
    expect(plan.cambios[1].cambios).toEqual({ mercado: "mexico", origenProveedor: "odoo" })
    expect(plan.cambios[2].cambios).toEqual({ mercado: "mexico", origenProveedor: "odoo" })
  })

  it("con partner y mercado persistido pero sin origen, completa solo el origen", () => {
    const plan = planBackfillMercado([{ id: "a", nombre: "A", odooPartnerId: 5, mercado: "mexico" }])
    expect(plan.cambios[0].cambios).toEqual({ origenProveedor: "odoo" })
  })

  it("sin partner y sin origen no inventa origen (queda al fallback manual del lector)", () => {
    const plan = planBackfillMercado([{ id: "a", nombre: "A" }])
    expect(plan.cambios[0].cambios).toEqual({ mercado: "usa" })
  })
})

describe("camposMercadoFaltantesOdoo (sync de Odoo)", () => {
  it("completa mercado y origen cuando faltan; no toca lo que ya está", () => {
    expect(camposMercadoFaltantesOdoo({})).toEqual({ mercado: "mexico", origenProveedor: "odoo" })
    expect(camposMercadoFaltantesOdoo({ mercado: "usa" })).toEqual({ origenProveedor: "odoo" })
    expect(camposMercadoFaltantesOdoo({ mercado: "mexico", origenProveedor: "odoo" })).toEqual({})
    expect(camposMercadoFaltantesOdoo({ mercado: "raro", origenProveedor: "" })).toEqual({ mercado: "mexico", origenProveedor: "odoo" })
  })
})
