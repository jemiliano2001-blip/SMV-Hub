/**
 * Consulta unificada de la memoria operativa — lógica pura (frente C, T2.2).
 *
 * "¿Qué sé ya de esta pieza?" sobre el índice semántico (orden-item + cotizacion), sin Firestore:
 * recibe las entradas del índice y los vectores de consulta y devuelve un `ContextoOperativo` por
 * pieza. La ruta (`app/api/memoria-operativa/consultar`) es la única que toca Admin SDK.
 *
 * Regla de empate (calibrada en C0 con datos reales, plan 2026-09-15):
 *   - el semántico PROPONE candidatos (coseno ≥ UMBRAL_PARECIDO);
 *   - la llave de pieza o el número de parte CONFIRMAN el exacto;
 *   - dos números de parte distintos hacen HERMANO: misma familia, nunca exacto, aunque el coseno
 *     sea 0.90 (resortes de otro tamaño, guardamotor C20 vs C16, cable de 15 m vs 7.5 m);
 *   - la alerta de precio se calcula SOLO sobre exactos.
 */

import { generarLlavePieza, llavesCoinciden, normalizarNombreProveedor } from "@/lib/pieza-matching"
import { similitudCoseno } from "@/lib/embeddings-ia"
import type { EntradaIndiceVectorizada } from "@/lib/busqueda-semantica-catalogo"
import {
  evaluarAlertaPrecio,
  resumirPreciosPorPiezaProveedor,
  type AlertaPrecio,
  type PuntoPrecioHistorico,
} from "@/lib/precios-historicos"
import { aUSD, TIPO_CAMBIO_DEFAULT_USD_MXN } from "@/lib/tipo-cambio"
import { buscarMapeoAprobadoSync, type IndiceMapeosAprobados } from "@/lib/compras-odoo/mapeos-aprobados"
import { buscarClaveSatValidada } from "@/lib/sat/sugerir-clave"
import type { MapeoSmvEntry } from "@/lib/sat/types"
import { compararNumerosParte, numerosParteDePieza } from "./numero-parte"
import type {
  ContextoOperativo,
  EmpateMemoria,
  FamiliaComprada,
  FuenteMemoria,
  PiezaConsulta,
  ProveedorPreferidoMemoria,
  ReferenciaHistorica,
} from "./tipos"

/** Coseno mínimo para mostrar un vecino como parecido/hermano (C0: 0.76). Los exactos no dependen de él. */
export const UMBRAL_PARECIDO = 0.76
export const MAX_EXACTOS_POR_FUENTE = 5
export const MAX_PARECIDOS_POR_FUENTE = 3

export interface OpcionesContexto {
  verPrecios: boolean
  umbralParecido?: number
  mapeosSat?: readonly MapeoSmvEntry[]
  mapeosAprobados?: IndiceMapeosAprobados | null
  tipoCambioUsdMxn?: number
}

type EntradaPreparada = {
  entrada: EntradaIndiceVectorizada
  fuente: FuenteMemoria
  llave: string
  numerosParte: string[]
}

type Candidato = {
  preparada: EntradaPreparada
  empate: EmpateMemoria
  score: number
}

function esFuenteMemoria(fuente: string): fuente is FuenteMemoria {
  return fuente === "orden-item" || fuente === "cotizacion"
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null
}

function numero(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

/** Llave y números de parte de cada entrada, una sola vez por request (no por pieza). */
export function prepararEntradas(entradas: readonly EntradaIndiceVectorizada[]): EntradaPreparada[] {
  const preparadas: EntradaPreparada[] = []
  for (const entrada of entradas) {
    if (!esFuenteMemoria(entrada.data.fuente)) continue
    const md = entrada.data.metadata as Record<string, unknown>
    const numeroParte = texto(md.numeroParte)
    const llave = texto(md.llavePieza) ?? generarLlavePieza(numeroParte, entrada.data.titulo ?? "")
    preparadas.push({
      entrada,
      fuente: entrada.data.fuente,
      llave,
      numerosParte: numerosParteDePieza(numeroParte, entrada.data.titulo ?? ""),
    })
  }
  return preparadas
}

function clasificar(
  llavePieza: string,
  numerosParte: readonly string[],
  preparada: EntradaPreparada,
  score: number,
  umbral: number
): EmpateMemoria | null {
  const cmp = compararNumerosParte(numerosParte, preparada.numerosParte)
  if (cmp === "igual") return "exacto"
  if (cmp === "distinto") return score >= umbral ? "hermano" : null
  if (llavesCoinciden(llavePieza, preparada.llave)) return "exacto"
  return score >= umbral ? "parecido" : null
}

function referenciaDesde(c: Candidato, verPrecios: boolean): ReferenciaHistorica {
  const { entrada } = c.preparada
  const md = entrada.data.metadata as Record<string, unknown>
  const precio = numero(md.precio)
  return {
    fuente: c.preparada.fuente,
    refId: entrada.id,
    refPath: entrada.data.refPath,
    titulo: entrada.data.titulo,
    proveedorNombre: texto(md.proveedorNombre),
    proveedorId: texto(md.proveedorId),
    precioUnitario: verPrecios && precio != null && precio > 0 ? precio : null,
    moneda: verPrecios ? texto(md.moneda) : null,
    fecha: texto(md.fecha),
    empate: c.empate,
    score: Number(c.score.toFixed(4)),
    numeroParte: texto(md.numeroParte),
    ubicacion: texto(md.ubicacion),
    estatus: texto(md.estatus),
  }
}

function fechaDe(c: Candidato): string {
  return texto((c.preparada.entrada.data.metadata as Record<string, unknown>).fecha) ?? ""
}

function ordenarYRecortar(candidatos: Candidato[]): Candidato[] {
  const exactos = candidatos
    .filter((c) => c.empate === "exacto")
    .sort((a, b) => fechaDe(b).localeCompare(fechaDe(a)) || b.score - a.score)
    .slice(0, MAX_EXACTOS_POR_FUENTE)
  const parecidos = candidatos
    .filter((c) => c.empate !== "exacto")
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(MAX_PARECIDOS_POR_FUENTE, Math.max(0, MAX_EXACTOS_POR_FUENTE - exactos.length)))
  return [...exactos, ...parecidos]
}

function familiaDesde(parecidos: readonly Candidato[], verPrecios: boolean): FamiliaComprada | null {
  const grupos = new Map<string, { nombre: string; proveedorId: string | null; candidatos: Candidato[] }>()
  for (const c of parecidos) {
    const md = c.preparada.entrada.data.metadata as Record<string, unknown>
    const nombre = texto(md.proveedorNombre)
    if (!nombre) continue
    const clave = texto(md.proveedorId) ?? normalizarNombreProveedor(nombre)
    const g = grupos.get(clave) ?? { nombre, proveedorId: texto(md.proveedorId), candidatos: [] }
    g.candidatos.push(c)
    grupos.set(clave, g)
  }
  if (grupos.size === 0) return null
  const ganador = [...grupos.values()].sort((a, b) => b.candidatos.length - a.candidatos.length)[0]
  const masReciente = [...ganador.candidatos].sort((a, b) => fechaDe(b).localeCompare(fechaDe(a)))[0]
  const md = masReciente.preparada.entrada.data.metadata as Record<string, unknown>
  const precio = numero(md.precio)
  return {
    proveedorNombre: ganador.nombre,
    proveedorId: ganador.proveedorId,
    veces: ganador.candidatos.length,
    ultimoPrecio: verPrecios && precio != null && precio > 0 ? precio : null,
    moneda: verPrecios ? texto(md.moneda) : null,
    ultimaFecha: texto(md.fecha),
  }
}

function preferidoDesde(exactos: readonly Candidato[]): ProveedorPreferidoMemoria | null {
  const conteo = new Map<string, ProveedorPreferidoMemoria>()
  for (const c of exactos) {
    const md = c.preparada.entrada.data.metadata as Record<string, unknown>
    const nombre = texto(md.proveedorNombre)
    if (!nombre) continue
    const clave = texto(md.proveedorId) ?? normalizarNombreProveedor(nombre)
    const actual = conteo.get(clave) ?? { proveedorNombre: nombre, proveedorId: texto(md.proveedorId), veces: 0 }
    actual.veces++
    conteo.set(clave, actual)
  }
  if (conteo.size === 0) return null
  return [...conteo.values()].sort((a, b) => b.veces - a.veces)[0]
}

function alertaDesde(
  pieza: PiezaConsulta,
  llavePieza: string,
  exactos: readonly Candidato[],
  tipoCambio: number
): AlertaPrecio | null {
  const precio = pieza.precioUnitario
  const moneda = pieza.moneda
  if (precio == null || precio <= 0 || (moneda !== "USD" && moneda !== "MXN")) return null

  const puntos: PuntoPrecioHistorico[] = []
  for (const c of exactos) {
    const md = c.preparada.entrada.data.metadata as Record<string, unknown>
    const p = numero(md.precio)
    const m = texto(md.moneda)
    if (p == null || p <= 0 || (m !== "USD" && m !== "MXN")) continue
    puntos.push({
      // La llave de la pieza consultada, no la de la entrada: `evaluarAlertaPrecio` filtra con
      // `llavesCoinciden` y un exacto por número de parte puede tener otra llave léxica.
      llavePieza,
      descripcion: c.preparada.entrada.data.titulo,
      numeroParte: texto(md.numeroParte),
      proveedorId: texto(md.proveedorId),
      proveedorNombre: texto(md.proveedorNombre) ?? "",
      precioUnitarioUSD: aUSD(p, m, tipoCambio),
      monedaOriginal: m,
      precioOriginal: p,
      fecha: texto(md.fecha) ?? "",
      fuente: c.preparada.fuente === "orden-item" ? "compra" : "cotizacion_historica",
      docId: c.preparada.entrada.id,
    })
  }
  if (puntos.length === 0) return null
  const resumenes = resumirPreciosPorPiezaProveedor(puntos)
  // proveedorId null: se compara contra el mínimo histórico de la pieza en cualquier proveedor.
  return evaluarAlertaPrecio(precio, moneda, llavePieza, null, resumenes, tipoCambio)
}

/**
 * Un `ContextoOperativo` por pieza. `vectoresConsulta[i]` puede ser null (Gemini caído): entonces
 * solo hay exactos por llave / número de parte y ningún parecido.
 */
export function construirContextoOperativo(
  piezas: readonly PiezaConsulta[],
  vectoresConsulta: ReadonlyArray<readonly number[] | null>,
  entradas: readonly EntradaIndiceVectorizada[],
  opciones: OpcionesContexto
): ContextoOperativo[] {
  const umbral = opciones.umbralParecido ?? UMBRAL_PARECIDO
  const tipoCambio = opciones.tipoCambioUsdMxn ?? TIPO_CAMBIO_DEFAULT_USD_MXN
  const preparadas = prepararEntradas(entradas)

  return piezas.map((pieza, indice) => {
    const descripcion = pieza.descripcion?.trim() ?? ""
    const llavePieza = generarLlavePieza(pieza.numeroParte, descripcion)
    const numerosParte = numerosParteDePieza(pieza.numeroParte, descripcion)
    const vector = vectoresConsulta[indice] ?? null

    const candidatos: Candidato[] = []
    if (descripcion) {
      for (const preparada of preparadas) {
        const emb = preparada.entrada.embedding
        const score = vector && emb.length === vector.length && emb.length > 0 ? similitudCoseno(vector, emb) : 0
        const empate = clasificar(llavePieza, numerosParte, preparada, score, umbral)
        if (empate) candidatos.push({ preparada, empate, score })
      }
    }

    const exactos = candidatos.filter((c) => c.empate === "exacto")
    const parecidos = candidatos.filter((c) => c.empate !== "exacto")
    const compras = ordenarYRecortar(candidatos.filter((c) => c.preparada.fuente === "orden-item"))
    const cotizaciones = ordenarYRecortar(candidatos.filter((c) => c.preparada.fuente === "cotizacion"))

    const alerta = opciones.verPrecios ? alertaDesde(pieza, llavePieza, exactos, tipoCambio) : null
    const familiaMapeo = descripcion && opciones.mapeosAprobados ? buscarMapeoAprobadoSync(descripcion, opciones.mapeosAprobados) : null
    const claveSatCruda =
      descripcion && opciones.mapeosSat?.length ? buscarClaveSatValidada(descripcion, [...opciones.mapeosSat]) : null
    const claveSat = claveSatCruda?.claveProdServ
      ? { claveProdServ: claveSatCruda.claveProdServ, descripcionSat: claveSatCruda.descripcionSat, confianza: claveSatCruda.confianza }
      : null

    return {
      indice,
      llavePieza,
      numerosParte,
      comprasPrevias: compras.map((c) => referenciaDesde(c, opciones.verPrecios)),
      cotizacionesPrevias: cotizaciones.map((c) => referenciaDesde(c, opciones.verPrecios)),
      totalExactos: exactos.length,
      totalParecidos: parecidos.length,
      familiaComprada: exactos.length === 0 ? familiaDesde(parecidos, opciones.verPrecios) : null,
      alertaPrecio: alerta,
      proveedorPreferido: preferidoDesde(exactos),
      claveSatValidada: claveSat,
      familia: familiaMapeo
        ? { categoriaId: familiaMapeo.categoriaId, tipoInsumo: familiaMapeo.tipoInsumo, medida: familiaMapeo.medida }
        : null,
    }
  })
}
