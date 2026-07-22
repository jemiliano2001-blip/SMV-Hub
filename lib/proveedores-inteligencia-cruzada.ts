/**
 * Inteligencia cruzada USA Tooling: precio histórico, lead time real vs prometido,
 * scorecard automática, alertas de precio, ranking por categoría, proveedor preferido
 * y comparador alimentado por histórico.
 *
 * Lógica pura (sin Firestore) salvo funciones de persistencia explícitas.
 */

import type {
  Cotizacion,
  CompraProveedor,
  CotizacionRequisicion,
  CotizacionComparacion,
  OfertaCotizacion,
  OrdenCompra,
  EvaluacionProveedor,
  Proveedor,
  CategoriaProveedor,
} from "@/lib/schemas"
import { CotizacionRequisicionSchema } from "@/lib/schemas"
import { aUSD, TIPO_CAMBIO_DEFAULT_USD_MXN } from "@/lib/tipo-cambio"
import {
  generarLlavePieza,
  llavesCoinciden,
  matchProveedorPorNombre,
} from "@/lib/pieza-matching"
import { fechaHoyLocal } from "@/lib/format"
import { collection, addDoc, getDocs, query, where } from "firebase/firestore"
import { db, getClienteAuth } from "@/lib/firebase"
import { registrarAuditoria } from "@/lib/auditoria"

// ── B1: Precio histórico por proveedor/pieza ─────────────────────────────────

import type { FacturaProveedor } from "@/lib/schemas"

export type FuentePrecio = "cotizacion_historica" | "compra" | "cotizacion_requisicion" | "factura_odoo"

export interface PuntoPrecioHistorico {
  llavePieza: string
  descripcion: string
  numeroParte: string | null
  proveedorId: string | null
  proveedorNombre: string
  precioUnitarioUSD: number
  monedaOriginal: "USD" | "MXN"
  precioOriginal: number
  fecha: string
  fuente: FuentePrecio
  docId: string
}

export interface ResumenPrecioPiezaProveedor {
  llavePieza: string
  descripcion: string
  proveedorId: string | null
  proveedorNombre: string
  precioMinUSD: number
  precioMaxUSD: number
  precioPromedioUSD: number
  ultimoPrecioUSD: number
  ultimaFecha: string
  muestras: number
  puntos: PuntoPrecioHistorico[]
}

export function fusionarPuntosPrecio(
  historico: Cotizacion[],
  compras: CompraProveedor[],
  cotizacionesReq: CotizacionRequisicion[],
  tipoCambioUsdMxn: number = TIPO_CAMBIO_DEFAULT_USD_MXN,
  facturasOdoo: FacturaProveedor[] = []
): PuntoPrecioHistorico[] {
  const puntos: PuntoPrecioHistorico[] = []

  for (const c of historico) {
    if (c.precioUnitario == null || c.precioUnitario <= 0) continue
    const llave = c.llavePieza || generarLlavePieza(c.numeroParte, c.descripcion)
    puntos.push({
      llavePieza: llave,
      descripcion: c.descripcion,
      numeroParte: c.numeroParte,
      proveedorId: c.proveedorId ?? null,
      proveedorNombre: c.proveedor,
      precioUnitarioUSD: aUSD(c.precioUnitario, c.moneda, tipoCambioUsdMxn),
      monedaOriginal: c.moneda,
      precioOriginal: c.precioUnitario,
      fecha: c.fecha || "",
      fuente: "cotizacion_historica",
      docId: c.id,
    })
  }

  for (const compra of compras) {
    if (compra.precioUnitario <= 0) continue
    const llave = generarLlavePieza(null, compra.producto)
    puntos.push({
      llavePieza: llave,
      descripcion: compra.producto,
      numeroParte: null,
      proveedorId: compra.proveedorId,
      proveedorNombre: compra.proveedorNombre,
      precioUnitarioUSD: aUSD(compra.precioUnitario, compra.moneda, tipoCambioUsdMxn),
      monedaOriginal: compra.moneda,
      precioOriginal: compra.precioUnitario,
      fecha: compra.fecha,
      fuente: "compra",
      docId: compra.id,
    })
  }

  for (const cr of cotizacionesReq) {
    for (const it of cr.itemsCotizados) {
      if (it.precioUnitario <= 0) continue
      const llave = generarLlavePieza(null, it.descripcion)
      puntos.push({
        llavePieza: llave,
        descripcion: it.descripcion,
        numeroParte: null,
        proveedorId: cr.proveedorId,
        proveedorNombre: cr.proveedorNombre,
        precioUnitarioUSD: aUSD(it.precioUnitario, cr.moneda, tipoCambioUsdMxn),
        monedaOriginal: cr.moneda,
        precioOriginal: it.precioUnitario,
        fecha: cr.fechaCotizacion,
        fuente: "cotizacion_requisicion",
        docId: cr.id,
      })
    }
  }

  for (const fo of facturasOdoo) {
    if (fo.total <= 0) continue
    const moneda = fo.moneda === "USD" ? "USD" : "MXN"
    puntos.push({
      llavePieza: generarLlavePieza(null, `Factura Odoo ${fo.numeroFactura}`),
      descripcion: `Factura Odoo ${fo.numeroFactura}`,
      numeroParte: null,
      proveedorId: null,
      proveedorNombre: fo.proveedorNombre,
      precioUnitarioUSD: aUSD(fo.total, moneda, tipoCambioUsdMxn),
      monedaOriginal: moneda,
      precioOriginal: fo.total,
      fecha: fo.fechaFactura || "",
      fuente: "factura_odoo",
      docId: fo.id,
    })
  }

  return puntos
}

export function resumirPreciosPorPiezaProveedor(
  puntos: PuntoPrecioHistorico[]
): ResumenPrecioPiezaProveedor[] {
  const grupos = new Map<string, PuntoPrecioHistorico[]>()
  for (const p of puntos) {
    const key = `${p.proveedorId || p.proveedorNombre}::${p.llavePieza}`
    const arr = grupos.get(key) ?? []
    arr.push(p)
    grupos.set(key, arr)
  }

  const resúmenes: ResumenPrecioPiezaProveedor[] = []
  for (const arr of grupos.values()) {
    const precios = arr.map((p) => p.precioUnitarioUSD)
    const ordenados = [...arr].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""))
    const ultimo = ordenados[0]
    resúmenes.push({
      llavePieza: arr[0].llavePieza,
      descripcion: arr[0].descripcion,
      proveedorId: arr[0].proveedorId,
      proveedorNombre: arr[0].proveedorNombre,
      precioMinUSD: Math.min(...precios),
      precioMaxUSD: Math.max(...precios),
      precioPromedioUSD: precios.reduce((s, n) => s + n, 0) / precios.length,
      ultimoPrecioUSD: ultimo.precioUnitarioUSD,
      ultimaFecha: ultimo.fecha,
      muestras: arr.length,
      puntos: arr,
    })
  }
  return resúmenes.sort((a, b) => b.muestras - a.muestras)
}

// ── B6: Alertas de precio ────────────────────────────────────────────────────

export type TipoAlertaPrecio = "mejor_que_historico" | "en_rango" | "caro" | "sin_historico"

export interface AlertaPrecio {
  tipo: TipoAlertaPrecio
  mensaje: string
  precioActualUSD: number
  precioMinHistoricoUSD: number | null
  desviacionPct: number | null
}

const UMBRAL_CARO = 0.35

export function evaluarAlertaPrecio(
  precioActual: number,
  moneda: "USD" | "MXN",
  llavePieza: string,
  proveedorId: string | null,
  resúmenes: ResumenPrecioPiezaProveedor[],
  tipoCambioUsdMxn: number = TIPO_CAMBIO_DEFAULT_USD_MXN
): AlertaPrecio {
  const actualUSD = aUSD(precioActual, moneda, tipoCambioUsdMxn)
  const candidatos = resúmenes.filter(
    (r) =>
      llavesCoinciden(r.llavePieza, llavePieza) &&
      (proveedorId ? r.proveedorId === proveedorId : true)
  )
  if (candidatos.length === 0) {
    return {
      tipo: "sin_historico",
      mensaje: "Sin histórico de precio para esta pieza/proveedor.",
      precioActualUSD: actualUSD,
      precioMinHistoricoUSD: null,
      desviacionPct: null,
    }
  }
  const minHist = Math.min(...candidatos.map((c) => c.precioMinUSD))
  // Un mínimo histórico de 0 (precio no capturado; el schema lo default-ea a 0)
  // no es base válida de comparación: dividir entre él daría Infinity/NaN.
  if (minHist <= 0) {
    return {
      tipo: "sin_historico",
      mensaje: "Sin histórico de precio válido para comparar.",
      precioActualUSD: actualUSD,
      precioMinHistoricoUSD: null,
      desviacionPct: null,
    }
  }
  const desv = (actualUSD - minHist) / minHist
  if (actualUSD <= minHist) {
    return {
      tipo: "mejor_que_historico",
      mensaje: `Mejor que el mínimo histórico ($${minHist.toFixed(2)} USD).`,
      precioActualUSD: actualUSD,
      precioMinHistoricoUSD: minHist,
      desviacionPct: desv,
    }
  }
  if (desv > UMBRAL_CARO) {
    return {
      tipo: "caro",
      mensaje: `Caro: +${(desv * 100).toFixed(0)}% sobre mínimo histórico ($${minHist.toFixed(2)} USD).`,
      precioActualUSD: actualUSD,
      precioMinHistoricoUSD: minHist,
      desviacionPct: desv,
    }
  }
  return {
    tipo: "en_rango",
    mensaje: `En rango histórico (mín $${minHist.toFixed(2)} USD).`,
    precioActualUSD: actualUSD,
    precioMinHistoricoUSD: minHist,
    desviacionPct: desv,
  }
}

// ── B2: Lead time real vs prometido ──────────────────────────────────────────

export interface ConfiabilidadLeadTime {
  proveedorId: string
  proveedorNombre: string
  muestras: number
  leadPrometidoPromedio: number
  leadRealPromedio: number
  deltaPromedioDias: number
  /** Score 1–5 para alimentar el motor (5 = siempre a tiempo o antes). */
  scoreConfiabilidad: number
}

/**
 * Compara leadTimeRealDias de compras vs leadTimeDias prometido en cotizaciones
 * de requisición del mismo proveedor.
 */
export function calcularConfiabilidadLeadTime(
  compras: CompraProveedor[],
  cotizacionesReq: CotizacionRequisicion[]
): ConfiabilidadLeadTime[] {
  const porProv = new Map<
    string,
    { nombre: string; reales: number[]; prometidos: number[] }
  >()

  for (const c of compras) {
    if (c.leadTimeRealDias == null || c.leadTimeRealDias < 0) continue
    const key = c.proveedorId || c.proveedorNombre
    const entry = porProv.get(key) ?? { nombre: c.proveedorNombre, reales: [], prometidos: [] }
    entry.reales.push(c.leadTimeRealDias)
    porProv.set(key, entry)
  }

  for (const cr of cotizacionesReq) {
    const key = cr.proveedorId || cr.proveedorNombre
    const entry = porProv.get(key) ?? { nombre: cr.proveedorNombre, reales: [], prometidos: [] }
    entry.prometidos.push(cr.leadTimeDias)
    entry.nombre = cr.proveedorNombre
    porProv.set(key, entry)
  }

  const out: ConfiabilidadLeadTime[] = []
  for (const [id, data] of porProv) {
    if (data.reales.length === 0) continue
    const leadRealPromedio = data.reales.reduce((s, n) => s + n, 0) / data.reales.length
    const leadPrometidoPromedio =
      data.prometidos.length > 0
        ? data.prometidos.reduce((s, n) => s + n, 0) / data.prometidos.length
        : leadRealPromedio
    const delta = leadRealPromedio - leadPrometidoPromedio
    // Score: a tiempo o antes → 5; +1 día → 4; +2 → 3; +3 → 2; +4+ → 1
    let score = 5
    if (delta > 0) score = Math.max(1, 5 - Math.ceil(delta))
    out.push({
      proveedorId: id,
      proveedorNombre: data.nombre,
      muestras: data.reales.length,
      leadPrometidoPromedio,
      leadRealPromedio,
      deltaPromedioDias: delta,
      scoreConfiabilidad: score,
    })
  }
  return out.sort((a, b) => b.scoreConfiabilidad - a.scoreConfiabilidad)
}

/** Mapa proveedorId → score 1–5 para pasar al motor. */
export function mapaConfiabilidad(
  confiabilidades: ConfiabilidadLeadTime[]
): Record<string, number> {
  const m: Record<string, number> = {}
  for (const c of confiabilidades) {
    m[c.proveedorId] = c.scoreConfiabilidad
  }
  return m
}

// ── B4: Scorecard automática desde órdenes ───────────────────────────────────

export interface ScorecardAutomatica {
  proveedorId: string
  proveedorNombre: string
  totalOrdenes: number
  ordenesAprobadas: number
  ordenesRechazadas: number
  /** 1–5 derivado de ratio aprobadas. */
  scoreCumplimiento: number
  /** 1–5 derivado de lead time real si hay compras; default 4. */
  scoreCalidad: number
  promedioGeneral: number
  /** Scorecard listo para persistir (sin id/creadoEn). */
  evaluacionPayload: Omit<EvaluacionProveedor, "id" | "creadoEn">
}

export function generarScorecardsDesdeOrdenes(
  ordenes: OrdenCompra[],
  compras: CompraProveedor[],
  catalogo: Proveedor[],
  confiabilidades: ConfiabilidadLeadTime[] = []
): ScorecardAutomatica[] {
  const porProv = new Map<
    string,
    { nombre: string; total: number; aprobadas: number; rechazadas: number }
  >()

  for (const o of ordenes) {
    let id = o.proveedorId ?? ""
    let nombre = o.proveedor
    if (!id) {
      const match = matchProveedorPorNombre(o.proveedor, catalogo)
      if (match) {
        id = match.id
        nombre = match.nombre
      } else {
        id = `fantasma:${nombre.toLowerCase()}`
      }
    }
    const entry = porProv.get(id) ?? { nombre, total: 0, aprobadas: 0, rechazadas: 0 }
    entry.total++
    if (o.estado === "aprobada") entry.aprobadas++
    if (o.estado === "rechazada") entry.rechazadas++
    porProv.set(id, entry)
  }

  const hoy = fechaHoyLocal()
  const out: ScorecardAutomatica[] = []

  for (const [proveedorId, data] of porProv) {
    if (proveedorId.startsWith("fantasma:")) continue
    const ratioAprob = data.total > 0 ? data.aprobadas / data.total : 0.8
    const scoreCumplimiento = Math.max(1, Math.min(5, Math.round(ratioAprob * 5 * 10) / 10))
    const conf = confiabilidades.find((c) => c.proveedorId === proveedorId)
    const comprasProv = compras.filter((c) => c.proveedorId === proveedorId)
    const scoreCalidad = conf?.scoreConfiabilidad ?? (comprasProv.length > 0 ? 4.0 : 3.5)
    const promedio =
      Math.round(
        ((scoreCumplimiento + scoreCalidad + 4.0 + 4.0 + 4.0 + 4.0) / 6) * 10
      ) / 10

    out.push({
      proveedorId,
      proveedorNombre: data.nombre,
      totalOrdenes: data.total,
      ordenesAprobadas: data.aprobadas,
      ordenesRechazadas: data.rechazadas,
      scoreCumplimiento,
      scoreCalidad,
      promedioGeneral: promedio,
      evaluacionPayload: {
        proveedorId,
        precio: 4,
        tiempoEntrega: conf?.scoreConfiabilidad ?? 4,
        calidad: scoreCalidad,
        respuestaComunicacion: 4,
        cumplimiento: scoreCumplimiento,
        facilidadCompra: 4,
        promedioGeneral: promedio,
        fortalezas:
          ratioAprob >= 0.9
            ? ["Alto ratio de órdenes aprobadas"]
            : comprasProv.length > 3
              ? ["Historial de compras frecuente"]
              : [],
        debilidades:
          data.rechazadas > 0 ? [`${data.rechazadas} órdenes rechazadas`] : [],
        fechaEvaluacion: hoy,
        evaluadoPor: "Scorecard automática SMV Hub",
      },
    })
  }
  return out
}

export async function persistirScorecardsAutomaticas(
  scorecards: ScorecardAutomatica[]
): Promise<number> {
  let guardadas = 0
  for (const sc of scorecards) {
    await addDoc(collection(db, "evaluaciones_proveedores"), {
      ...sc.evaluacionPayload,
      creadoEn: new Date(),
    })
    guardadas++
  }
  const user = getClienteAuth().currentUser
  await registrarAuditoria(
    user?.email,
    "CREAR",
    "evaluaciones_proveedores",
    "AUTO",
    `Generó ${guardadas} scorecards automáticas desde órdenes`
  )
  return guardadas
}

// ── B3 + B5: Más barato por categoría + KPI por proveedor ────────────────────

export interface RankingBaratoCategoria {
  categoria: CategoriaProveedor
  proveedorId: string
  proveedorNombre: string
  precioPromedioUSD: number
  muestras: number
}

export interface KpiProveedor {
  proveedorId: string
  proveedorNombre: string
  gastoUSD: number
  gastoMXN: number
  ticketPromedioUSD: number
  numOrdenes: number
  numCompras: number
  leadTimePromedio: number | null
  ultimaCompra: string | null
  scoreConfiabilidad: number | null
}

export function rankingMasBaratoPorCategoria(
  compras: CompraProveedor[],
  tipoCambioUsdMxn: number = TIPO_CAMBIO_DEFAULT_USD_MXN
): RankingBaratoCategoria[] {
  const grupos = new Map<
    string,
    { categoria: CategoriaProveedor; proveedorId: string; nombre: string; precios: number[] }
  >()

  for (const c of compras) {
    const cat = (c.categoria || "otros") as CategoriaProveedor
    const key = `${cat}::${c.proveedorId}`
    const entry = grupos.get(key) ?? {
      categoria: cat,
      proveedorId: c.proveedorId,
      nombre: c.proveedorNombre,
      precios: [],
    }
    entry.precios.push(aUSD(c.precioUnitario, c.moneda, tipoCambioUsdMxn))
    grupos.set(key, entry)
  }

  const porCat = new Map<CategoriaProveedor, RankingBaratoCategoria>()
  for (const g of grupos.values()) {
    const promedio = g.precios.reduce((s, n) => s + n, 0) / g.precios.length
    const actual = porCat.get(g.categoria)
    if (!actual || promedio < actual.precioPromedioUSD) {
      porCat.set(g.categoria, {
        categoria: g.categoria,
        proveedorId: g.proveedorId,
        proveedorNombre: g.nombre,
        precioPromedioUSD: promedio,
        muestras: g.precios.length,
      })
    }
  }
  return Array.from(porCat.values())
}

export function calcularKpisPorProveedor(
  ordenes: OrdenCompra[],
  compras: CompraProveedor[],
  catalogo: Proveedor[],
  confiabilidades: ConfiabilidadLeadTime[] = []
): KpiProveedor[] {
  return catalogo.map((p) => {
    const ords = ordenes.filter(
      (o) =>
        o.proveedorId === p.id ||
        (!o.proveedorId && matchProveedorPorNombre(o.proveedor, [p]))
    )
    const comps = compras.filter((c) => c.proveedorId === p.id)
    let gastoUSD = 0
    let gastoMXN = 0
    for (const o of ords) {
      const total = o.total ?? 0
      if (o.moneda === "MXN") gastoMXN += total
      else gastoUSD += total
    }
    // También sumar compras si no hay órdenes vinculadas
    if (ords.length === 0) {
      for (const c of comps) {
        if (c.moneda === "MXN") gastoMXN += c.costoTotal
        else gastoUSD += c.costoTotal
      }
    }
    const leads = comps
      .map((c) => c.leadTimeRealDias)
      .filter((n): n is number => n != null && n >= 0)
    const conf = confiabilidades.find((c) => c.proveedorId === p.id)
    const fechas = comps.map((c) => c.fecha).filter(Boolean).sort()
    const numTickets = ords.length || comps.length
    const ticketPromedioUSD =
      numTickets > 0 ? gastoUSD / Math.max(1, ords.filter((o) => o.moneda !== "MXN").length || comps.filter((c) => c.moneda !== "MXN").length || 1) : 0

    return {
      proveedorId: p.id,
      proveedorNombre: p.nombre,
      gastoUSD,
      gastoMXN,
      ticketPromedioUSD,
      numOrdenes: ords.length,
      numCompras: comps.length,
      leadTimePromedio: leads.length > 0 ? leads.reduce((s, n) => s + n, 0) / leads.length : null,
      ultimaCompra: fechas.length > 0 ? fechas[fechas.length - 1] : null,
      scoreConfiabilidad: conf?.scoreConfiabilidad ?? null,
    }
  })
}

// ── B7 + B10: Proveedor preferido + sugerencia de precio ─────────────────────

export interface PreferenciaPieza {
  llavePieza: string
  descripcion: string
  proveedorId: string
  proveedorNombre: string
  vecesGanador: number
  ultimoPrecioUSD: number
  ultimaFecha: string
  monedaUltima: "USD" | "MXN"
  precioOriginal: number
}

export function aprenderProveedorPreferidoPorPieza(
  cotizacionesReq: CotizacionRequisicion[],
  historico: Cotizacion[],
  tipoCambioUsdMxn: number = TIPO_CAMBIO_DEFAULT_USD_MXN
): PreferenciaPieza[] {
  const contadores = new Map<
    string,
    {
      llave: string
      desc: string
      proveedorId: string
      nombre: string
      wins: number
      precioUSD: number
      precioOrig: number
      moneda: "USD" | "MXN"
      fecha: string
    }
  >()

  for (const cr of cotizacionesReq.filter((c) => c.ganadora)) {
    for (const it of cr.itemsCotizados) {
      const llave = generarLlavePieza(null, it.descripcion)
      const key = `${llave}::${cr.proveedorId}`
      const prev = contadores.get(key)
      const precioUSD = aUSD(it.precioUnitario, cr.moneda, tipoCambioUsdMxn)
      if (!prev || cr.fechaCotizacion >= prev.fecha) {
        contadores.set(key, {
          llave,
          desc: it.descripcion,
          proveedorId: cr.proveedorId,
          nombre: cr.proveedorNombre,
          wins: (prev?.wins ?? 0) + 1,
          precioUSD,
          precioOrig: it.precioUnitario,
          moneda: cr.moneda,
          fecha: cr.fechaCotizacion,
        })
      } else {
        prev.wins++
      }
    }
  }

  // Refuerzo con histórico (sin "ganadora", cuenta apariciones)
  for (const c of historico) {
    if (c.precioUnitario == null) continue
    const llave = c.llavePieza || generarLlavePieza(c.numeroParte, c.descripcion)
    const provId = c.proveedorId || c.proveedor
    const key = `${llave}::${provId}`
    const prev = contadores.get(key)
    const precioUSD = aUSD(c.precioUnitario, c.moneda, tipoCambioUsdMxn)
    if (!prev) {
      contadores.set(key, {
        llave,
        desc: c.descripcion,
        proveedorId: provId,
        nombre: c.proveedor,
        wins: 1,
        precioUSD,
        precioOrig: c.precioUnitario,
        moneda: c.moneda,
        fecha: c.fecha || "",
      })
    } else {
      prev.wins++
      if ((c.fecha || "") >= prev.fecha) {
        prev.precioUSD = precioUSD
        prev.precioOrig = c.precioUnitario
        prev.moneda = c.moneda
        prev.fecha = c.fecha || ""
      }
    }
  }

  // Quedarse con el proveedor más frecuente por llave
  const porLlave = new Map<string, PreferenciaPieza>()
  for (const v of contadores.values()) {
    const actual = porLlave.get(v.llave)
    if (!actual || v.wins > actual.vecesGanador) {
      porLlave.set(v.llave, {
        llavePieza: v.llave,
        descripcion: v.desc,
        proveedorId: v.proveedorId,
        proveedorNombre: v.nombre,
        vecesGanador: v.wins,
        ultimoPrecioUSD: v.precioUSD,
        ultimaFecha: v.fecha,
        monedaUltima: v.moneda,
        precioOriginal: v.precioOrig,
      })
    }
  }
  return Array.from(porLlave.values())
}

export function sugerirPrecioYProveedor(
  numeroParte: string | null | undefined,
  descripcion: string,
  preferencias: PreferenciaPieza[]
): PreferenciaPieza | null {
  const llave = generarLlavePieza(numeroParte, descripcion)
  const exacta = preferencias.find((p) => p.llavePieza === llave)
  if (exacta) return exacta
  return preferencias.find((p) => llavesCoinciden(p.llavePieza, llave)) ?? null
}

// ── B8: Comparador alimentado por histórico ──────────────────────────────────

export function ofertasDesdeHistorico(
  concepto: string,
  numeroParte: string | null | undefined,
  historico: Cotizacion[],
  catalogo: Proveedor[]
): OfertaCotizacion[] {
  const llave = generarLlavePieza(numeroParte, concepto)
  const relevantes = historico.filter((c) => {
    const l = c.llavePieza || generarLlavePieza(c.numeroParte, c.descripcion)
    return llavesCoinciden(l, llave) || simplificaIncluye(c.descripcion, concepto)
  })

  // Última cotización por proveedor
  const porProv = new Map<string, Cotizacion>()
  for (const c of relevantes) {
    const key = c.proveedorId || c.proveedor
    const prev = porProv.get(key)
    if (!prev || (c.fecha || "") >= (prev.fecha || "")) {
      porProv.set(key, c)
    }
  }

  const ofertas: OfertaCotizacion[] = []
  for (const c of porProv.values()) {
    if (c.precioUnitario == null) continue
    const match = c.proveedorId
      ? catalogo.find((p) => p.id === c.proveedorId)
      : matchProveedorPorNombre(c.proveedor, catalogo)
    ofertas.push({
      proveedorId: match?.id || c.proveedorId || c.proveedor,
      proveedorNombre: match?.nombre || c.proveedor,
      precioUnitario: c.precioUnitario,
      moneda: c.moneda,
      leadTimeDias: parseLeadTimeTexto(c.diasHabiles) ?? match?.leadTimeDias ?? 5,
      MOQ: 1,
      marca: "",
      disponible: true,
      garantia: "Garantía estándar",
      enlace: c.link || "",
      notas: `Auto desde histórico (${c.fecha || "sin fecha"})`,
      scoreCalculado: 0,
    })
  }
  return ofertas
}

function simplificaIncluye(a: string, b: string): boolean {
  const na = a.toLowerCase()
  const nb = b.toLowerCase()
  return na.includes(nb) || nb.includes(na)
}

function parseLeadTimeTexto(texto: string | null): number | null {
  if (!texto) return null
  const m = texto.match(/(\d+)/)
  return m ? Number(m[1]) : null
}

/** Carga cotizaciones de requisición (helper para inteligencia). */
export async function listarTodasCotizacionesRequisicion(): Promise<CotizacionRequisicion[]> {
  const snap = await getDocs(collection(db, "cotizaciones_requisicion"))
  const out: CotizacionRequisicion[] = []
  for (const d of snap.docs) {
    const parsed = CotizacionRequisicionSchema.safeParse({ id: d.id, ...d.data() })
    if (parsed.success) out.push(parsed.data)
  }
  return out
}

export async function listarCotizacionesRequisicionPorReq(
  requisicionId: string
): Promise<CotizacionRequisicion[]> {
  const snap = await getDocs(
    query(collection(db, "cotizaciones_requisicion"), where("requisicionId", "==", requisicionId))
  )
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CotizacionRequisicion)
}

/** Payload mínimo para crear comparación desde histórico. */
export function construirComparacionDesdeHistorico(
  concepto: string,
  categoria: CategoriaProveedor,
  ofertas: OfertaCotizacion[]
): Omit<CotizacionComparacion, "id" | "creadoEn" | "actualizadoEn"> {
  return {
    concepto,
    categoria,
    fecha: fechaHoyLocal(),
    ofertas,
  }
}
