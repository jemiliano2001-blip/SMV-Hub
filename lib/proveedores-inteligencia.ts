import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type {
  CompraProveedor,
  EvaluacionProveedor,
  CotizacionComparacion,
  OfertaCotizacion,
  CategoriaProveedor,
} from "@/lib/schemas"
import { fechaHoyLocal } from "@/lib/format"
import { formatearFecha } from "@/lib/firestore-helpers"

const COLECCION_COMPRAS = "compras_proveedores"
const COLECCION_EVALUACIONES = "evaluaciones_proveedores"
const COLECCION_COTIZACIONES = "cotizaciones_comparador"

export type NuevaCompraPayload = Omit<CompraProveedor, "id" | "creadoEn">
export type NuevaCotizacionComparacionPayload = Omit<CotizacionComparacion, "id" | "creadoEn" | "actualizadoEn">



// ── 1. HISTORIAL DE COMPRAS ───────────────────────────────────────────────────

export async function obtenerComprasProveedor(
  proveedorId?: string,
  maximo = 200
): Promise<CompraProveedor[]> {
  try {
    const ref = collection(db, COLECCION_COMPRAS)
    const q = proveedorId
      ? query(ref, where("proveedorId", "==", proveedorId), limit(maximo))
      : query(ref, orderBy("fecha", "desc"), limit(maximo))

    const snap = await getDocs(q)

    const items: CompraProveedor[] = snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        proveedorId: data.proveedorId ?? "",
        proveedorNombre: data.proveedorNombre ?? "",
        numeroOrden: data.numeroOrden ?? "",
        fecha: data.fecha ?? fechaHoyLocal(),
        producto: data.producto ?? "",
        categoria: (data.categoria as CategoriaProveedor) ?? "tooling",
        marca: data.marca ?? "",
        cantidad: data.cantidad ?? 1,
        precioUnitario: data.precioUnitario ?? 0,
        moneda: data.moneda === "MXN" ? "MXN" : "USD",
        costoTotal: data.costoTotal ?? 0,
        leadTimeRealDias: data.leadTimeRealDias ?? 3,
        notas: data.notas ?? "",
        creadoEn: formatearFecha(data.creadoEn),
      }
    })

    // Excluir órdenes de compra sin precio (precioUnitario y costoTotal <= 0)
    return items.filter((c) => c.precioUnitario > 0 || c.costoTotal > 0)
  } catch (err) {
    console.error("Error al obtener compras de proveedor:", err)
    return []
  }
}

export async function crearCompraProveedor(payload: NuevaCompraPayload): Promise<CompraProveedor> {
  const docRef = doc(collection(db, COLECCION_COMPRAS))
  const data = {
    ...payload,
    creadoEn: serverTimestamp(),
  }
  await setDoc(docRef, data)
  return {
    id: docRef.id,
    ...payload,
    creadoEn: new Date().toISOString(),
  }
}

export function calcularMetricasProveedor(compras: CompraProveedor[]) {
  if (compras.length === 0) {
    return {
      totalCompras: 0,
      gastoAcumulado: 0,
      ticketPromedio: 0,
      ultimoPedido: "Sin pedidos registrados",
      leadTimePromedio: 0,
      categoriasCompradas: [],
    }
  }

  const totalCompras = compras.length
  const gastoAcumulado = compras.reduce((acc, curr) => acc + (curr.costoTotal || 0), 0)
  const ticketPromedio = gastoAcumulado / totalCompras
  const leadTimePromedio = Math.round(
    compras.reduce((acc, curr) => acc + (curr.leadTimeRealDias || 0), 0) / totalCompras
  )

  const fechasOrdenadas = compras
    .map((c) => c.fecha)
    .sort((a, b) => b.localeCompare(a))
  const ultimoPedido = fechasOrdenadas[0] ?? ""

  const cats = Array.from(new Set(compras.map((c) => c.categoria)))

  return {
    totalCompras,
    gastoAcumulado,
    ticketPromedio,
    ultimoPedido,
    leadTimePromedio,
    categoriasCompradas: cats,
  }
}

// ── 2. SCORECARD Y EVALUACIONES ─────────────────────────────────────────────

export async function obtenerEvaluacionesProveedor(): Promise<EvaluacionProveedor[]> {
  try {
    const snap = await getDocs(query(collection(db, COLECCION_EVALUACIONES), limit(100)))

    return snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        proveedorId: data.proveedorId ?? "",
        precio: data.precio ?? 4,
        tiempoEntrega: data.tiempoEntrega ?? 4,
        calidad: data.calidad ?? 4,
        respuestaComunicacion: data.respuestaComunicacion ?? 4,
        cumplimiento: data.cumplimiento ?? 4,
        facilidadCompra: data.facilidadCompra ?? 4,
        promedioGeneral: data.promedioGeneral ?? 4.0,
        fortalezas: Array.isArray(data.fortalezas) ? data.fortalezas : [],
        debilidades: Array.isArray(data.debilidades) ? data.debilidades : [],
        fechaEvaluacion: data.fechaEvaluacion ?? fechaHoyLocal(),
        evaluadoPor: data.evaluadoPor ?? "Compras SMV",
        creadoEn: formatearFecha(data.creadoEn),
      }
    })
  } catch (err) {
    console.error("Error al obtener evaluaciones:", err)
    return []
  }
}

export async function guardarEvaluacionProveedor(
  evaluacion: Omit<EvaluacionProveedor, "id" | "creadoEn">
): Promise<EvaluacionProveedor> {
  const docRef = doc(collection(db, COLECCION_EVALUACIONES))
  const data = {
    ...evaluacion,
    creadoEn: serverTimestamp(),
  }
  await setDoc(docRef, data)
  return {
    id: docRef.id,
    ...evaluacion,
    creadoEn: new Date().toISOString(),
  }
}

// ── 3. COMPARADOR DE COTIZACIONES & RANKING INTELIGENTE ──────────────────────

export async function obtenerCotizacionesComparacion(maximo = 100): Promise<CotizacionComparacion[]> {
  try {
    const snap = await getDocs(query(collection(db, COLECCION_COTIZACIONES), orderBy("fecha", "desc"), limit(maximo)))

    return snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        concepto: data.concepto ?? "",
        categoria: (data.categoria as CategoriaProveedor) ?? "endmills",
        fecha: data.fecha ?? fechaHoyLocal(),
        ofertas: Array.isArray(data.ofertas) ? data.ofertas : [],
        creadoEn: formatearFecha(data.creadoEn),
        actualizadoEn: formatearFecha(data.actualizadoEn),
      }
    })
  } catch (err) {
    console.error("Error al obtener cotizaciones de comparación:", err)
    return []
  }
}

export async function crearCotizacionComparacion(
  payload: NuevaCotizacionComparacionPayload
): Promise<CotizacionComparacion> {
  const docRef = doc(collection(db, COLECCION_COTIZACIONES))
  const data = {
    ...payload,
    creadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
  }
  await setDoc(docRef, data)
  return {
    id: docRef.id,
    ...payload,
    creadoEn: new Date().toISOString(),
    actualizadoEn: new Date().toISOString(),
  }
}

/**
 * Fórmula Transparente de Ranking Multicriterio SMV:
 * Total Score (0 - 100 pts) = (Precio Score * 40%) + (Lead Time Score * 30%) + (Calificación Score * 30%)
 */
export function calcularRankingCotizacion(
  ofertas: OfertaCotizacion[],
  calificacionesMap: Record<string, number> = {}
) {
  if (ofertas.length === 0) return []

  const preciosValidos = ofertas.map((o) => o.precioUnitario).filter((p) => p > 0)
  const minPrecio = preciosValidos.length > 0 ? Math.min(...preciosValidos) : 1

  const leadTimesValidos = ofertas.map((o) => o.leadTimeDias).filter((lt) => lt > 0)
  const minLeadTime = leadTimesValidos.length > 0 ? Math.min(...leadTimesValidos) : 1

  const evaluadas = ofertas.map((of) => {
    // 1. Score Precio (40%): Inversamente proporcional al precio mínimo
    const scorePrecio = of.precioUnitario > 0 ? (minPrecio / of.precioUnitario) * 100 : 0

    // 2. Score Lead Time (30%): Inversamente proporcional al tiempo de entrega mínimo
    const scoreLeadTime = of.leadTimeDias > 0 ? (minLeadTime / of.leadTimeDias) * 100 : 0

    // 3. Score Calificación (30%): Calificación histórica del proveedor (1 a 5 estrellas)
    const calif = calificacionesMap[of.proveedorId] ?? 4.5
    const scoreCalificacion = (calif / 5) * 100

    const scoreTotal = Math.round(scorePrecio * 0.4 + scoreLeadTime * 0.3 + scoreCalificacion * 0.3)

    return {
      ...of,
      scoreCalculado: scoreTotal,
      esMejorPrecio: of.precioUnitario === minPrecio,
      esMasRapido: of.leadTimeDias === minLeadTime,
    }
  })

  // Ordenar de mayor a menor score
  const ordenadas = evaluadas.sort((a, b) => b.scoreCalculado - a.scoreCalculado)
  const maxScore = ordenadas[0]?.scoreCalculado ?? 0

  return ordenadas.map((of) => ({
    ...of,
    esMejorBalance: of.scoreCalculado === maxScore,
  }))
}
