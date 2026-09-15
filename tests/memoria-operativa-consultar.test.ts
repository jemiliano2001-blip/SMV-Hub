import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import type { EntradaIndiceVectorizada } from "@/lib/busqueda-semantica-catalogo"
import { indexarMapeosAprobados } from "@/lib/compras-odoo/mapeos-aprobados"
import {
  construirContextoOperativo,
  MAX_PARECIDOS_POR_FUENTE,
  UMBRAL_PARECIDO,
} from "@/lib/memoria-operativa/consultar"
import type { PiezaConsulta } from "@/lib/memoria-operativa/tipos"

/**
 * Golden de C0 (2026-09-15): 40 descripciones reales de órdenes de smv-brain con su top 5 real
 * del índice (coseno RETRIEVAL_QUERY medido en producción). No trae vectores; se reconstruyen
 * en 2 dimensiones de modo que el coseno contra la consulta [1, 0] sea exactamente el score.
 */
type Golden = {
  umbralSugerido: number
  muestras: Array<{
    grupo: "repetida" | "sin_empate"
    refId: string
    descripcion: string
    llave: string
    proveedor: string
    fecha: string
    top: Array<{ refId: string; titulo: string; score: number; llave: string; exacto: boolean; proveedor: string }>
  }>
}

const golden = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "fixtures", "memoria-operativa-muestra-2026-09-15.json"), "utf8")
) as Golden

const CONSULTA = [1, 0]

function vectorConScore(score: number): number[] {
  const s = Math.min(1, Math.max(-1, score))
  return [s, Math.sqrt(1 - s * s)]
}

function entrada(
  id: string,
  titulo: string,
  score: number,
  metadata: Record<string, unknown> = {},
  fuente: "orden-item" | "cotizacion" = "orden-item"
): EntradaIndiceVectorizada {
  return {
    id,
    embedding: vectorConScore(score),
    data: { id, fuente, refPath: fuente === "orden-item" ? "/ordenes?id=x" : "/cotizaciones?id=x", titulo, metadata },
  }
}

function entradasDeMuestra(m: Golden["muestras"][number], extra: Record<string, unknown> = {}) {
  return m.top.map((t, i) =>
    entrada(t.refId, t.titulo, t.score, { proveedorNombre: t.proveedor, fecha: `2026-0${(i % 8) + 1}-15`, ...extra })
  )
}

function contextoDe(m: Golden["muestras"][number], opciones: { verPrecios?: boolean; extra?: Record<string, unknown> } = {}) {
  const [ctx] = construirContextoOperativo(
    [{ descripcion: m.descripcion }],
    [CONSULTA],
    entradasDeMuestra(m, opciones.extra),
    { verPrecios: opciones.verPrecios ?? true }
  )
  return ctx
}

const porDescripcion = (fragmento: string) => {
  const m = golden.muestras.find((x) => x.descripcion.includes(fragmento))
  if (!m) throw new Error(`No hay muestra con "${fragmento}"`)
  return m
}

describe("construirContextoOperativo — golden de C0", () => {
  it("el umbral del código es el calibrado en C0", () => {
    expect(UMBRAL_PARECIDO).toBe(golden.umbralSugerido)
  })

  it("criterio #1: las 20 llaves repetidas encuentran al menos un exacto (por llave o número de parte)", () => {
    const repetidas = golden.muestras.filter((m) => m.grupo === "repetida")
    expect(repetidas).toHaveLength(20)
    const sinExacto = repetidas.filter((m) => contextoDe(m).totalExactos === 0).map((m) => m.descripcion)
    expect(sinExacto).toEqual([])
  })

  it("criterio #2: un candidato con número de parte distinto es hermano, nunca exacto, aunque el coseno sea alto", () => {
    const casos: Array<[string, string]> = [
      ["140M-C2E-C20", "140M-C2E-C16"],
      ["Compression Spring, 2.5\" Long", "9657K153"],
      ["Nitride-Coated H13 Tool Steel Ejector Pin, 1/4", "93772A528"],
    ]
    for (const [consulta, hermano] of casos) {
      const m = porDescripcion(consulta)
      const ctx = contextoDe(m)
      const ref = ctx.comprasPrevias.find((r) => r.titulo.includes(hermano))
      expect(ref, `${consulta} → ${hermano}`).toBeDefined()
      expect(ref!.empate).toBe("hermano")
      expect(ref!.score).toBeGreaterThanOrEqual(0.8)
    }
  })

  it("rescata repetidos ocultos por la redacción: mismo número de parte → exacto aunque la llave sea otra", () => {
    // El RFID Omron aparece 3 veces con 3 llaves (número de listado de eBay pegado).
    const omron = golden.muestras.find((m) => m.grupo === "sin_empate" && m.descripcion.includes("OMRON V680S"))!
    const ctx = contextoDe(omron)
    expect(ctx.totalExactos).toBeGreaterThanOrEqual(1)
    expect(ctx.comprasPrevias[0].empate).toBe("exacto")
    expect(ctx.numerosParte).toEqual(["V680SD2KF68M"])

    // El inserto 90259A132 con y sin "easy-to-install": llave distinta, mismo número de parte.
    const inserto = porDescripcion("Thread-Locking Insert Easy-to-Install")
    const ctxInserto = contextoDe(inserto)
    const porPn = ctxInserto.comprasPrevias.filter((r) => r.titulo.includes("90259A132"))
    expect(porPn.length).toBeGreaterThan(0)
    expect(porPn.every((r) => r.empate === "exacto")).toBe(true)
  })

  it("ninguna alerta de precio se calcula contra hermanos ni parecidos", () => {
    // Guardamotor C20: solo hermanos (C16, F8E-C45, F8E-C32) — aunque traigan precio, no hay alerta.
    const m = porDescripcion("140M-C2E-C20")
    const [ctx] = construirContextoOperativo(
      [{ descripcion: m.descripcion, precioUnitario: 999, moneda: "MXN" }],
      [CONSULTA],
      entradasDeMuestra(m, { precio: 100, moneda: "MXN" }),
      { verPrecios: true }
    )
    expect(ctx.totalExactos).toBe(0)
    expect(ctx.alertaPrecio).toBeNull()
    expect(ctx.comprasPrevias.every((r) => r.empate !== "exacto")).toBe(true)
  })

  it("alerta 'caro' solo sobre exactos: +50 % sobre el mínimo histórico de la misma pieza", () => {
    const m = porDescripcion("Tool Balancer TECNA 9313")
    const entradas = entradasDeMuestra(m).map((e) =>
      e.data.titulo.includes("TECNA 9313") ? { ...e, data: { ...e.data, metadata: { ...e.data.metadata, precio: 200, moneda: "USD" } } } : e
    )
    const [ctx] = construirContextoOperativo(
      [{ descripcion: m.descripcion, precioUnitario: 300, moneda: "USD" }],
      [CONSULTA],
      entradas,
      { verPrecios: true }
    )
    expect(ctx.totalExactos).toBeGreaterThanOrEqual(1)
    expect(ctx.alertaPrecio?.tipo).toBe("caro")
    expect(ctx.alertaPrecio?.precioMinHistoricoUSD).toBe(200)
    expect(ctx.alertaPrecio?.desviacionPct).toBeCloseTo(0.5, 5)
    expect(ctx.proveedorPreferido?.proveedorNombre).toBe("Tool Balancers USA")
  })

  it("sin exacto: familiaComprada agrega los parecidos por proveedor (el caso del 90 % según C0)", () => {
    const m = porDescripcion("302 Stainless Steel Corrosion-Resistant Compression Springs 0.938")
    const ctx = contextoDe(m, { extra: { precio: 12.5, moneda: "USD" } })
    expect(ctx.totalExactos).toBe(0)
    expect(ctx.familiaComprada?.proveedorNombre).toBe("McMaster-Carr")
    expect(ctx.familiaComprada?.veces).toBeGreaterThanOrEqual(3)
    expect(ctx.familiaComprada?.ultimoPrecio).toBe(12.5)
  })

  it("verPrecios=false conserva las referencias pero borra montos, familia.ultimoPrecio y alerta", () => {
    const m = porDescripcion("Tool Balancer TECNA 9313")
    const [ctx] = construirContextoOperativo(
      [{ descripcion: m.descripcion, precioUnitario: 300, moneda: "USD" }],
      [CONSULTA],
      entradasDeMuestra(m, { precio: 200, moneda: "USD" }),
      { verPrecios: false }
    )
    expect(ctx.comprasPrevias.length).toBeGreaterThan(0)
    expect(ctx.comprasPrevias.every((r) => r.precioUnitario === null && r.moneda === null)).toBe(true)
    expect(ctx.alertaPrecio).toBeNull()
  })

  it("máximo 3 parecidos visibles por fuente; exactos primero ordenados por fecha desc", () => {
    const pieza: PiezaConsulta = { descripcion: "Fresa de carburo 1/4 4 filos" }
    const entradas = [
      entrada("ex-vieja", "Fresa de carburo 1/4 4 filos", 0.9, { fecha: "2026-01-01" }),
      entrada("ex-nueva", "Fresa de carburo 1/4 4 filos", 0.88, { fecha: "2026-09-01" }),
      ...Array.from({ length: 6 }, (_, i) => entrada(`par-${i}`, `Fresa de carburo ${i + 2}/8 otra`, 0.85 - i * 0.01)),
    ]
    const [ctx] = construirContextoOperativo([pieza], [CONSULTA], entradas, { verPrecios: true })
    expect(ctx.comprasPrevias.map((r) => r.refId).slice(0, 2)).toEqual(["ex-nueva", "ex-vieja"])
    expect(ctx.comprasPrevias.filter((r) => r.empate !== "exacto")).toHaveLength(MAX_PARECIDOS_POR_FUENTE)
    expect(ctx.totalParecidos).toBe(6)
  })

  it("degradado (sin vector): solo exactos por llave / número de parte, ningún parecido", () => {
    const m = porDescripcion("Tool Balancer TECNA 9313")
    const [ctx] = construirContextoOperativo([{ descripcion: m.descripcion }], [null], entradasDeMuestra(m), {
      verPrecios: true,
    })
    expect(ctx.totalExactos).toBeGreaterThanOrEqual(1)
    expect(ctx.totalParecidos).toBe(0)
    expect(ctx.comprasPrevias.every((r) => r.empate === "exacto" && r.score === 0)).toBe(true)
  })

  it("separa compras (orden-item) de cotizaciones (cotizacion) e ignora entradas de proveedor", () => {
    const entradas: EntradaIndiceVectorizada[] = [
      entrada("o1", "Sensor IFM PN2271", 0.9, { proveedorNombre: "Acomee" }, "orden-item"),
      entrada("c1", "Sensor inductivo IFM", 0.9, { proveedorNombre: "ifm", numeroParte: "PN2271", precio: 850, moneda: "MXN" }, "cotizacion"),
      { id: "p1", embedding: vectorConScore(0.95), data: { id: "p1", fuente: "proveedor", refPath: "/proveedores", titulo: "ifm", metadata: {} } },
    ]
    const [ctx] = construirContextoOperativo([{ descripcion: "Sensor IFM PN2271" }], [CONSULTA], entradas, { verPrecios: true })
    expect(ctx.comprasPrevias.map((r) => r.refId)).toEqual(["o1"])
    expect(ctx.cotizacionesPrevias.map((r) => r.refId)).toEqual(["c1"])
    expect(ctx.cotizacionesPrevias[0].empate).toBe("exacto")
    expect(ctx.cotizacionesPrevias[0].precioUnitario).toBe(850)
  })

  it("familia desde los mapeos aprobados (regla D de B2) y descripción vacía → contexto vacío", () => {
    const indice = indexarMapeosAprobados([
      { descripcionNormalizada: "sensor ifm pn2271", categoriaId: "electronica", tipoInsumo: "sensor", medida: null },
    ])
    const [conFamilia, vacio] = construirContextoOperativo(
      [{ descripcion: "Sensor IFM PN2271" }, { descripcion: "   " }],
      [CONSULTA, CONSULTA],
      [],
      { verPrecios: true, mapeosAprobados: indice }
    )
    expect(conFamilia.familia).toEqual({ categoriaId: "electronica", tipoInsumo: "sensor", medida: null })
    expect(vacio.comprasPrevias).toEqual([])
    expect(vacio.familia).toBeNull()
  })

  it("un lote de 20 piezas devuelve 20 contextos en el mismo orden", () => {
    const piezas = golden.muestras.slice(0, 20).map((m) => ({ descripcion: m.descripcion }))
    const entradas = golden.muestras.slice(0, 20).flatMap((m) => entradasDeMuestra(m))
    const contextos = construirContextoOperativo(piezas, piezas.map(() => CONSULTA), entradas, { verPrecios: true })
    expect(contextos).toHaveLength(20)
    expect(contextos.map((c) => c.indice)).toEqual(piezas.map((_, i) => i))
  })
})
