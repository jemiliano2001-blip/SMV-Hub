/**
 * B1 · T1.2 — matcher de proveedores con alias y niveles de confianza.
 *
 * Los nombres libres son los 10 más frecuentes en facturas reales sin `proveedorId` según la
 * calibración B0 (docs/superpowers/plans/2026-09-13-estructura-datos-normalizacion.md, B0.2).
 * El catálogo fixture refleja el catálogo real después de T1.7 (altas de marketplaces y alias
 * aprendidos). Criterio #2 del spec: ≥ 9 de 10 vinculan solos o con la sugerencia correcta.
 */
import { describe, expect, it } from "vitest"
import { matchProveedorPorNombre, resolverProveedor } from "@/lib/pieza-matching"

const CATALOGO = [
  { id: "mcmaster", nombre: "McMaster-Carr", aliases: ["MCMASTER"] },
  { id: "msc", nombre: "MSC Industrial Direct", aliases: ["MSC Industrial Supply"] },
  { id: "mouser", nombre: "MOUSER ELECTRONICS.", aliases: [] },
  { id: "digikey", nombre: "DigiKey Electronics", aliases: ["Digikey"] },
  { id: "ebay", nombre: "eBay", aliases: [] },
  { id: "amazon", nombre: "Amazon", aliases: ["Amazon USA"] },
  { id: "aliexpress", nombre: "AliExpress", aliases: ["ALI EXPRESS"] },
  { id: "homedepot", nombre: "Home Depot", aliases: ["The Home Depot"] },
  { id: "ptsolutions", nombre: "PTSolutions", aliases: [] },
  { id: "automationdirect", nombre: "AutomationDirect", aliases: ["AutomationDirect.com, Inc."] },
]

/** [nombre en la factura, id esperado, nivel esperado] — top 10 de B0.2 por número de órdenes. */
const FACTURAS: Array<[string, string, "exacto" | "sugerido"]> = [
  ["McMaster-Carr", "mcmaster", "exacto"],
  ["EBAY", "ebay", "exacto"],
  ["Amazon", "amazon", "exacto"],
  ["Mouser Electronics", "mouser", "exacto"], // "mouser electronics" vs "mouser electronics." normalizan igual
  ["MSC Industrial Supply", "msc", "exacto"], // por alias
  ["DigiKey Electronics", "digikey", "exacto"],
  ["Home Depot", "homedepot", "exacto"],
  ["PTSOLUTIONS", "ptsolutions", "exacto"],
  ["ALI EXPRESS", "aliexpress", "exacto"], // por alias
  ["DigiKey", "digikey", "exacto"], // por alias
]

describe("resolverProveedor — los 10 nombres de factura más frecuentes (B0.2)", () => {
  it.each(FACTURAS)("%s → %s (%s)", (libre, id, nivel) => {
    const r = resolverProveedor(libre, CATALOGO)
    expect(r?.proveedor.id).toBe(id)
    expect(r?.nivel).toBe(nivel)
  })

  it("cumple el criterio #2: ≥ 9 de 10 con proveedor correcto", () => {
    const aciertos = FACTURAS.filter(([libre, id]) => resolverProveedor(libre, CATALOGO)?.proveedor.id === id)
    expect(aciertos.length).toBeGreaterThanOrEqual(9)
  })
})

describe("resolverProveedor — niveles", () => {
  it("alias normalizado = exacto: vincula solo", () => {
    expect(resolverProveedor("msc industrial supply", CATALOGO)).toEqual({
      proveedor: CATALOGO[1],
      nivel: "exacto",
    })
  })

  it("coincidencia parcial (empieza con / incluye) = sugerido: hay que confirmar", () => {
    expect(resolverProveedor("Mouser", CATALOGO)?.nivel).toBe("sugerido")
    expect(resolverProveedor("Mouser", CATALOGO)?.proveedor.id).toBe("mouser")
    expect(resolverProveedor("Amazon USA Marketplace", CATALOGO)?.nivel).toBe("sugerido")
  })

  it("un alias repetido en dos proveedores nunca vincula solo", () => {
    const ambiguo = [
      { id: "a", nombre: "Grainger MX", aliases: ["Grainger"] },
      { id: "b", nombre: "Grainger USA", aliases: ["Grainger"] },
    ]
    const r = resolverProveedor("Grainger", ambiguo)
    expect(r?.nivel).toBe("sugerido")
    expect(r?.proveedor.id).toBe("a")
  })

  it("sin coincidencia → null; nombre vacío → null", () => {
    expect(resolverProveedor("Novotechnik", CATALOGO)).toBeNull()
    expect(resolverProveedor("   ", CATALOGO)).toBeNull()
  })

  it("los alias vacíos o con solo puntuación se ignoran", () => {
    const conBasura = [{ id: "x", nombre: "ACME", aliases: ["", "  ", "---"] }]
    expect(resolverProveedor("---", conBasura)).toBeNull()
    expect(resolverProveedor("acme", conBasura)?.nivel).toBe("exacto")
  })

  it("funciona con catálogos sin campo aliases (compatibilidad)", () => {
    const sinAlias = [{ id: "x", nombre: "Shars Tool Company" }]
    expect(resolverProveedor("shars tool company", sinAlias)?.nivel).toBe("exacto")
    expect(resolverProveedor("Shars", sinAlias)?.nivel).toBe("sugerido")
  })
})

describe("matchProveedorPorNombre — compatibilidad con los consumidores existentes", () => {
  it("devuelve el proveedor sin nivel, ahora también por alias", () => {
    expect(matchProveedorPorNombre("MSC Industrial Supply", CATALOGO)?.id).toBe("msc")
    expect(matchProveedorPorNombre("Mouser", CATALOGO)?.id).toBe("mouser")
    expect(matchProveedorPorNombre("Novotechnik", CATALOGO)).toBeNull()
  })
})
