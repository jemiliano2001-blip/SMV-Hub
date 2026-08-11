import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
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

export async function obtenerComprasProveedor(proveedorId?: string): Promise<CompraProveedor[]> {
  try {
    const ref = collection(db, COLECCION_COMPRAS)
    const q = proveedorId
      ? query(ref, where("proveedorId", "==", proveedorId))
      : query(ref, orderBy("fecha", "desc"))

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
    const snap = await getDocs(collection(db, COLECCION_EVALUACIONES))

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

export async function obtenerCotizacionesComparacion(): Promise<CotizacionComparacion[]> {
  try {
    const snap = await getDocs(query(collection(db, COLECCION_COTIZACIONES), orderBy("fecha", "desc")))

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

// ── 4. SINCRONIZACIÓN DESDE ÓRDENES DE COMPRA HISTÓRICAS ────────────────────

function inferirCategoria(desc: string): CategoriaProveedor {
  const d = desc.toLowerCase()
  if (d.includes("endmill") || d.includes("cortador") || d.includes("fresa") || d.includes("gavilanes") || d.includes("carburo")) return "endmills"
  if (d.includes("inserto") || d.includes("apmt") || d.includes("wnmg") || d.includes("ccmt") || d.includes("carbides")) return "insertos"
  if (d.includes("cono") || d.includes("bt40") || d.includes("cat40") || d.includes("er32") || d.includes("mandril") || d.includes("tooling")) return "tooling"
  if (d.includes("refrigerante") || d.includes("aceite") || d.includes("blaser") || d.includes("grasa") || d.includes("taller")) return "consumibles"
  return "otros"
}

/**
 * Escanea la colección 'ordenes' (Ver Órdenes) e importa sus compras históricas
 * directamente al módulo de Inteligencia de Proveedores.
 */
export async function sincronizarComprasDesdeOrdenes(): Promise<{ importadas: number; proveedoresAfectados: number }> {
  try {
    const ordenesSnap = await getDocs(collection(db, "ordenes"))
    if (ordenesSnap.empty) {
      return { importadas: 0, proveedoresAfectados: 0 }
    }

    const proveedoresSnap = await getDocs(collection(db, "proveedores"))
    const proveedoresExistentes = proveedoresSnap.docs.map((d) => ({
      id: d.id,
      nombre: (d.data().nombre as string) ?? "",
    }))

    const comprasExistentesSnap = await getDocs(collection(db, COLECCION_COMPRAS))
    const ordenesProcesadas = new Set(comprasExistentesSnap.docs.map((d) => d.data().numeroOrden))

    let importadas = 0
    const proveedoresSet = new Set<string>()

    for (const docSnap of ordenesSnap.docs) {
      const data = docSnap.data()
      const ordenId = docSnap.id
      const numOrden = data.numeroFactura || `ORD-${ordenId.substring(0, 6)}`

      if (ordenesProcesadas.has(numOrden)) continue

      const nombreProvRaw = (data.proveedor as string) ?? "Proveedor Desconocido"
      // Buscar coincidencia en proveedores existentes
      const provMatch = proveedoresExistentes.find((p) =>
        p.nombre.toLowerCase().includes(nombreProvRaw.toLowerCase()) ||
        nombreProvRaw.toLowerCase().includes(p.nombre.toLowerCase())
      )

      const provId = provMatch ? provMatch.id : `prov-${nombreProvRaw.toLowerCase().replace(/\s+/g, "-")}`
      const provNombre = provMatch ? provMatch.nombre : nombreProvRaw
      proveedoresSet.add(provId)

      const items = Array.isArray(data.items) ? data.items : []
      const fecha = data.fechaFactura || (data.creadoEn ? formatearFecha(data.creadoEn).substring(0, 10) : fechaHoyLocal())
      const moneda = data.moneda === "MXN" ? "MXN" : "USD"

      if (items.length > 0) {
        for (const item of items) {
          const itemDesc = item.descripcion || "Herramental / Material"
          const cantidad = item.cantidad || 1
          const pu = item.precioUnitario || item.subtotal || 0
          const costoTotal = item.subtotal || pu * cantidad

          // Omitir órdenes / items sin precio (precio = 0)
          if (pu <= 0 && costoTotal <= 0) continue

          await crearCompraProveedor({
            proveedorId: provId,
            proveedorNombre: provNombre,
            numeroOrden: numOrden,
            fecha,
            producto: itemDesc,
            categoria: inferirCategoria(itemDesc),
            marca: item.marca || provNombre,
            cantidad,
            precioUnitario: pu,
            moneda,
            costoTotal,
            leadTimeRealDias: 4,
            notas: `Importado automáticamente desde Ver Órdenes (Doc: ${ordenId})`,
          })
          importadas++
        }
      } else {
        const total = data.total || 0
        // Omitir órdenes generales sin precio (precio = 0)
        if (total <= 0) continue

        // Si no tiene items desglosados, se importa el total de la orden
        await crearCompraProveedor({
          proveedorId: provId,
          proveedorNombre: provNombre,
          numeroOrden: numOrden,
          fecha,
          producto: `Orden de Compra General (${provNombre})`,
          categoria: "tooling",
          marca: provNombre,
          cantidad: 1,
          precioUnitario: total,
          moneda,
          costoTotal: total,
          leadTimeRealDias: 4,
          notas: `Importado automáticamente desde Ver Órdenes (Doc: ${ordenId})`,
        })
        importadas++
      }
    }

    return { importadas, proveedoresAfectados: proveedoresSet.size }
  } catch (err) {
    console.error("Error al sincronizar desde ordenes:", err)
    throw new Error("No se pudieron sincronizar las órdenes de compra.")
  }
}

