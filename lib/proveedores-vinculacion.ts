/**
 * Vinculación estructural: backfill de proveedorId en órdenes/cotizaciones
 * y detección de "proveedores fantasma" (nombre libre sin match en catálogo).
 */

import { collection, getDocs, writeBatch, doc, serverTimestamp } from "firebase/firestore"
import { db, getClienteAuth } from "@/lib/firebase"
import { makeDateConverter } from "@/lib/firestore-helpers"
import type { OrdenCompra, Cotizacion, Proveedor } from "@/lib/schemas"
import { matchProveedorPorNombre, generarLlavePieza } from "@/lib/pieza-matching"
import { obtenerProveedores } from "@/lib/proveedores"
import { registrarAuditoria } from "@/lib/auditoria"

const ordenConverter = makeDateConverter<OrdenCompra>()
const cotizacionConverter = makeDateConverter<Cotizacion>()

export interface ResultadoBackfill {
  revisados: number
  vinculados: number
  sinMatch: number
  yaTenianId: number
  errores: string[]
}

export interface ProveedorFantasma {
  nombreLibre: string
  origen: "orden" | "cotizacion"
  cantidadDocs: number
  idsDocs: string[]
  sugerenciaCatalogo: { id: string; nombre: string } | null
}

const BATCH_SIZE = 400

/**
 * Asigna proveedorId a órdenes existentes por matching de nombre contra el catálogo.
 * Solo escribe donde proveedorId está vacío/null.
 */
export async function backfillProveedorIdEnOrdenes(
  catalogo?: Proveedor[]
): Promise<ResultadoBackfill> {
  const proveedores = catalogo ?? (await obtenerProveedores())
  const snap = await getDocs(collection(db, "ordenes").withConverter(ordenConverter))
  const resultado: ResultadoBackfill = {
    revisados: 0,
    vinculados: 0,
    sinMatch: 0,
    yaTenianId: 0,
    errores: [],
  }

  let batch = writeBatch(db)
  let ops = 0

  for (const d of snap.docs) {
    resultado.revisados++
    const orden = d.data()
    if (orden.proveedorId) {
      resultado.yaTenianId++
      continue
    }
    const match = matchProveedorPorNombre(orden.proveedor, proveedores)
    if (!match) {
      resultado.sinMatch++
      continue
    }
    batch.update(d.ref, { proveedorId: match.id, actualizadoEn: serverTimestamp() })
    ops++
    resultado.vinculados++
    if (ops >= BATCH_SIZE) {
      await batch.commit()
      batch = writeBatch(db)
      ops = 0
    }
  }
  if (ops > 0) await batch.commit()

  const user = getClienteAuth().currentUser
  await registrarAuditoria(
    user?.email,
    "EDITAR",
    "ordenes",
    "BACKFILL",
    `Backfill proveedorId: ${resultado.vinculados} vinculados, ${resultado.sinMatch} sin match de ${resultado.revisados}`
  )
  return resultado
}

/**
 * Asigna proveedorId + llavePieza a cotizaciones históricas.
 */
export async function backfillProveedorIdEnCotizaciones(
  catalogo?: Proveedor[]
): Promise<ResultadoBackfill> {
  const proveedores = catalogo ?? (await obtenerProveedores())
  const snap = await getDocs(collection(db, "cotizaciones").withConverter(cotizacionConverter))
  const resultado: ResultadoBackfill = {
    revisados: 0,
    vinculados: 0,
    sinMatch: 0,
    yaTenianId: 0,
    errores: [],
  }

  let batch = writeBatch(db)
  let ops = 0

  for (const d of snap.docs) {
    resultado.revisados++
    const cot = d.data()
    const updates: { proveedorId?: string; llavePieza?: string; actualizadoEn: ReturnType<typeof serverTimestamp> } = {
      actualizadoEn: serverTimestamp(),
    }

    if (!cot.llavePieza) {
      updates.llavePieza = generarLlavePieza(cot.numeroParte, cot.descripcion)
    }

    if (cot.proveedorId) {
      resultado.yaTenianId++
    } else {
      const match = matchProveedorPorNombre(cot.proveedor, proveedores)
      if (match) {
        updates.proveedorId = match.id
        resultado.vinculados++
      } else {
        resultado.sinMatch++
      }
    }

    if (updates.proveedorId || updates.llavePieza) {
      batch.update(d.ref, updates)
      ops++
      if (ops >= BATCH_SIZE) {
        await batch.commit()
        batch = writeBatch(db)
        ops = 0
      }
    }
  }
  if (ops > 0) await batch.commit()

  const user = getClienteAuth().currentUser
  await registrarAuditoria(
    user?.email,
    "EDITAR",
    "cotizaciones",
    "BACKFILL",
    `Backfill proveedorId/llavePieza: ${resultado.vinculados} vinculados, ${resultado.sinMatch} sin match de ${resultado.revisados}`
  )
  return resultado
}

/**
 * Detecta nombres de proveedor en órdenes/cotizaciones que no matchean el catálogo.
 */
export async function detectarProveedoresFantasma(
  catalogo?: Proveedor[]
): Promise<ProveedorFantasma[]> {
  const proveedores = catalogo ?? (await obtenerProveedores())
  const ordenesSnap = await getDocs(collection(db, "ordenes").withConverter(ordenConverter))
  const cotSnap = await getDocs(collection(db, "cotizaciones").withConverter(cotizacionConverter))

  return detectarFantasmasEnMemoria(
    ordenesSnap.docs.map((d) => {
      const o = d.data()
      return { id: d.id, proveedor: o.proveedor, proveedorId: o.proveedorId }
    }),
    cotSnap.docs.map((d) => {
      const c = d.data()
      return { id: d.id, proveedor: c.proveedor, proveedorId: c.proveedorId }
    }),
    proveedores
  )
}

/**
 * Versión pura (sin Firestore) para tests y UI con datos ya cargados.
 */
export function detectarFantasmasEnMemoria(
  ordenes: Array<{ id: string; proveedor: string; proveedorId?: string | null }>,
  cotizaciones: Array<{ id: string; proveedor: string; proveedorId?: string | null }>,
  catalogo: Proveedor[]
): ProveedorFantasma[] {
  const mapa = new Map<string, ProveedorFantasma>()

  function esFantasma(
    nombre: string,
    proveedorId: string | null | undefined
  ): { fantasma: boolean; sugerencia: { id: string; nombre: string } | null } {
    if (proveedorId && catalogo.some((p) => p.id === proveedorId)) {
      return { fantasma: false, sugerencia: null }
    }
    const match = matchProveedorPorNombre(nombre, catalogo)
    if (!proveedorId && match) {
      // Se puede resolver con backfill — no es fantasma
      return { fantasma: false, sugerencia: { id: match.id, nombre: match.nombre } }
    }
    if (proveedorId && !catalogo.some((p) => p.id === proveedorId)) {
      return {
        fantasma: true,
        sugerencia: match ? { id: match.id, nombre: match.nombre } : null,
      }
    }
    return {
      fantasma: true,
      sugerencia: match ? { id: match.id, nombre: match.nombre } : null,
    }
  }

  for (const o of ordenes) {
    const { fantasma, sugerencia } = esFantasma(o.proveedor, o.proveedorId)
    if (fantasma) agregarFantasma(mapa, o.proveedor, "orden", o.id, sugerencia)
  }

  for (const c of cotizaciones) {
    const { fantasma, sugerencia } = esFantasma(c.proveedor, c.proveedorId)
    if (fantasma) agregarFantasma(mapa, c.proveedor, "cotizacion", c.id, sugerencia)
  }

  return Array.from(mapa.values()).sort((a, b) => b.cantidadDocs - a.cantidadDocs)
}

function agregarFantasma(
  mapa: Map<string, ProveedorFantasma>,
  nombreLibre: string,
  origen: "orden" | "cotizacion",
  idDoc: string,
  sugerencia: { id: string; nombre: string } | null
) {
  const key = `${origen}::${nombreLibre.trim().toLowerCase()}`
  const prev = mapa.get(key)
  if (prev) {
    prev.cantidadDocs++
    if (prev.idsDocs.length < 20) prev.idsDocs.push(idDoc)
    return
  }
  mapa.set(key, {
    nombreLibre: nombreLibre.trim(),
    origen,
    cantidadDocs: 1,
    idsDocs: [idDoc],
    sugerenciaCatalogo: sugerencia,
  })
}

/** Vincula manualmente un doc de orden/cotización a un proveedor del catálogo. */
export async function vincularProveedorManual(
  coleccion: "ordenes" | "cotizaciones",
  docId: string,
  proveedorId: string
): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, coleccion, docId), { proveedorId })
  await batch.commit()
  const user = getClienteAuth().currentUser
  await registrarAuditoria(
    user?.email,
    "EDITAR",
    coleccion,
    docId,
    `Vinculó manualmente proveedorId=${proveedorId}`
  )
}
