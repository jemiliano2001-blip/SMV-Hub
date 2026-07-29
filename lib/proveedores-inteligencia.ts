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

const COLECCION_COMPRAS = "compras_proveedores"
const COLECCION_EVALUACIONES = "evaluaciones_proveedores"
const COLECCION_COTIZACIONES = "cotizaciones_comparador"

export type NuevaCompraPayload = Omit<CompraProveedor, "id" | "creadoEn">
export type NuevaCotizacionComparacionPayload = Omit<CotizacionComparacion, "id" | "creadoEn" | "actualizadoEn">

function formatearFecha(fecha: unknown): string {
  if (!fecha) return new Date().toISOString()
  if (fecha instanceof Timestamp) return fecha.toDate().toISOString()
  if (fecha instanceof Date) return fecha.toISOString()
  return String(fecha)
}

// ── 1. HISTORIAL DE COMPRAS ───────────────────────────────────────────────────

export const COMPRAS_SEMILLA: NuevaCompraPayload[] = [
  {
    proveedorId: "shars-tool",
    proveedorNombre: "Shars Tool Company",
    numeroOrden: "PO-2026-089",
    fecha: "2026-06-15",
    producto: 'Endmill Carburo Sólido 1/2" 4 Gavilanes AlTiN',
    categoria: "endmills",
    marca: "Shars",
    cantidad: 10,
    precioUnitario: 24.5,
    moneda: "USD",
    costoTotal: 245.0,
    leadTimeRealDias: 4,
    notas: "Llegó a bodega de Laredo en 4 días sin ningún faltante.",
  },
  {
    proveedorId: "shars-tool",
    proveedorNombre: "Shars Tool Company",
    numeroOrden: "PO-2026-112",
    fecha: "2026-07-02",
    producto: "Portaherramientas BT40 ER32 + Llave de ajuste",
    categoria: "tooling",
    marca: "Shars",
    cantidad: 4,
    precioUnitario: 58.0,
    moneda: "USD",
    costoTotal: 232.0,
    leadTimeRealDias: 5,
    notas: "Excelente concentricidad y acabado en mandriles.",
  },
  {
    proveedorId: "onlinecarbide",
    proveedorNombre: "OnlineCarbide",
    numeroOrden: "PO-2026-077",
    fecha: "2026-05-20",
    producto: 'Endmill 3/8" 3 Gavilanes ZrN para Aluminio 6061',
    categoria: "endmills",
    marca: "OnlineCarbide Made in USA",
    cantidad: 15,
    precioUnitario: 18.9,
    moneda: "USD",
    costoTotal: 283.5,
    leadTimeRealDias: 3,
    notas: "Envío inmediato desde Michigan. Duración óptima en aluminio.",
  },
  {
    proveedorId: "yg1-usa",
    proveedorNombre: "YG-1 USA Industrial Tooling",
    numeroOrden: "PO-2026-104",
    fecha: "2026-06-28",
    producto: "Endmill V7 Plus 1/2\" Desbaste Pesado Acero Inoxidable",
    categoria: "endmills",
    marca: "YG-1",
    cantidad: 6,
    precioUnitario: 48.0,
    moneda: "USD",
    costoTotal: 288.0,
    leadTimeRealDias: 4,
    notas: "Alto rendimiento en inoxidable 316. Cero vibraciones.",
  },
  {
    proveedorId: "kennametal-us",
    proveedorNombre: "Kennametal US Direct",
    numeroOrden: "PO-2026-095",
    fecha: "2026-06-18",
    producto: "Insertos de Torneado WNMG 432-RP KCP25B (Caja 10 pzs)",
    categoria: "insertos",
    marca: "Kennametal",
    cantidad: 3,
    precioUnitario: 89.0,
    moneda: "USD",
    costoTotal: 267.0,
    leadTimeRealDias: 6,
    notas: "Excelente tenacidad en corte interrumpido de acero 4140.",
  },
  {
    proveedorId: "iscar-metals",
    proveedorNombre: "Iscar Metals USA",
    numeroOrden: "PO-2026-120",
    fecha: "2026-07-10",
    producto: "Insertos High Feed Logiq4Feed FF CX 0904 (Caja 10 pzs)",
    categoria: "insertos",
    marca: "Iscar",
    cantidad: 2,
    precioUnitario: 135.0,
    moneda: "USD",
    costoTotal: 270.0,
    leadTimeRealDias: 4,
    notas: "Incrementó avance a 120 in/min en cavidades profundas.",
  },
  {
    proveedorId: "msc-direct",
    proveedorNombre: "MSC Industrial Direct",
    numeroOrden: "PO-2026-131",
    fecha: "2026-07-18",
    producto: "Refrigerante Soluble Blaser Swisslube B-Cool 755 (Cubeta 5 Gal)",
    categoria: "consumibles",
    marca: "Blaser",
    cantidad: 2,
    precioUnitario: 165.0,
    moneda: "USD",
    costoTotal: 330.0,
    leadTimeRealDias: 2,
    notas: "Llegó al día siguiente por envío de emergencia.",
  },
]

export async function obtenerComprasProveedor(proveedorId?: string): Promise<CompraProveedor[]> {
  try {
    const ref = collection(db, COLECCION_COMPRAS)
    const q = proveedorId
      ? query(ref, where("proveedorId", "==", proveedorId))
      : query(ref, orderBy("fecha", "desc"))

    const snap = await getDocs(q)
    if (snap.empty) {
      return await inicializarComprasSemilla()
    }

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
    return COMPRAS_SEMILLA.filter((c) => c.precioUnitario > 0 || c.costoTotal > 0).map((c, i) => ({ id: `semilla-c-${i}`, ...c }))
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

export async function inicializarComprasSemilla(): Promise<CompraProveedor[]> {
  const creados: CompraProveedor[] = []
  for (const c of COMPRAS_SEMILLA) {
    const docRef = doc(collection(db, COLECCION_COMPRAS))
    const data = {
      ...c,
      creadoEn: serverTimestamp(),
    }
    await setDoc(docRef, data)
    creados.push({
      id: docRef.id,
      ...c,
      creadoEn: new Date().toISOString(),
    })
  }
  return creados
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

export const EVALUACIONES_SEMILLA: Omit<EvaluacionProveedor, "id" | "creadoEn">[] = [
  {
    proveedorId: "shars-tool",
    precio: 5,
    tiempoEntrega: 4,
    calidad: 4,
    respuestaComunicacion: 5,
    cumplimiento: 5,
    facilidadCompra: 5,
    promedioGeneral: 4.7,
    fortalezas: ["Precios muy económicos en carburo", "Envío rápido a Laredo TX", "Excelente soporte por correo"],
    debilidades: ["Catálogo limitado en insertos cerámicos especiales"],
    fechaEvaluacion: "2026-07-01",
    evaluadoPor: "J. Emiliano (Compras)",
  },
  {
    proveedorId: "yg1-usa",
    precio: 4,
    tiempoEntrega: 5,
    calidad: 5,
    respuestaComunicacion: 5,
    cumplimiento: 5,
    facilidadCompra: 5,
    promedioGeneral: 4.8,
    fortalezas: ["Rendimiento de corte superior en acero inox", "Crédito a 30 días", "Soporte técnico directo"],
    debilidades: ["Precios más elevados que competidores genéricos"],
    fechaEvaluacion: "2026-07-10",
    evaluadoPor: "J. Emiliano (Compras)",
  },
]

export async function obtenerEvaluacionesProveedor(): Promise<EvaluacionProveedor[]> {
  try {
    const snap = await getDocs(collection(db, COLECCION_EVALUACIONES))
    if (snap.empty) {
      return await inicializarEvaluacionesSemilla()
    }

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
    return EVALUACIONES_SEMILLA.map((e, i) => ({ id: `semilla-e-${i}`, ...e }))
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

export async function inicializarEvaluacionesSemilla(): Promise<EvaluacionProveedor[]> {
  const creadas: EvaluacionProveedor[] = []
  for (const ev of EVALUACIONES_SEMILLA) {
    const docRef = doc(collection(db, COLECCION_EVALUACIONES))
    const data = {
      ...ev,
      creadoEn: serverTimestamp(),
    }
    await setDoc(docRef, data)
    creadas.push({
      id: docRef.id,
      ...ev,
      creadoEn: new Date().toISOString(),
    })
  }
  return creadas
}

// ── 3. COMPARADOR DE COTIZACIONES & RANKING INTELIGENTE ──────────────────────

export const COTIZACIONES_SEMILLA: NuevaCotizacionComparacionPayload[] = [
  {
    concepto: 'Endmill Carburo Sólido 1/2" 4 Gavilanes Recubrimiento AlTiN',
    categoria: "endmills",
    fecha: "2026-07-15",
    ofertas: [
      {
        proveedorId: "shars-tool",
        proveedorNombre: "Shars Tool Company",
        precioUnitario: 24.5,
        moneda: "USD",
        leadTimeDias: 4,
        MOQ: 1,
        marca: "Shars Grade A",
        disponible: true,
        garantia: "Reemplazo por defecto",
        enlace: "",
        notas: "Opción recomendada por costo-beneficio.",
        scoreCalculado: 0,
      },
      {
        proveedorId: "onlinecarbide",
        proveedorNombre: "OnlineCarbide",
        precioUnitario: 21.0,
        moneda: "USD",
        leadTimeDias: 3,
        MOQ: 1,
        marca: "OnlineCarbide Direct",
        disponible: true,
        garantia: "Garantía de fábrica EE.UU.",
        enlace: "",
        notas: "Mejor precio absoluto de fábrica.",
        scoreCalculado: 0,
      },
      {
        proveedorId: "yg1-usa",
        proveedorNombre: "YG-1 USA Industrial Tooling",
        precioUnitario: 48.0,
        moneda: "USD",
        leadTimeDias: 3,
        MOQ: 1,
        marca: "YG-1 V7 Plus",
        disponible: true,
        garantia: "Rendimiento industrial garantizado",
        enlace: "",
        notas: "Mayor durabilidad en pasadas agresivas.",
        scoreCalculado: 0,
      },
    ],
  },
  {
    concepto: "Insertos para Fresado APMT 1604PDER (Caja 10 pzs)",
    categoria: "insertos",
    fecha: "2026-07-18",
    ofertas: [
      {
        proveedorId: "discount-tooling",
        proveedorNombre: "Discount Tooling & Supply",
        precioUnitario: 45.0,
        moneda: "USD",
        leadTimeDias: 6,
        MOQ: 1,
        marca: "Deskar Carbides",
        disponible: true,
        garantia: "Inspección previa",
        enlace: "",
        notas: "Precio de importación directo.",
        scoreCalculado: 0,
      },
      {
        proveedorId: "iscar-metals",
        proveedorNombre: "Iscar Metals USA",
        precioUnitario: 135.0,
        moneda: "USD",
        leadTimeDias: 4,
        MOQ: 1,
        marca: "Iscar Helido",
        disponible: true,
        garantia: "Garantía Iscar",
        enlace: "",
        notas: "Alto rendimiento sin desgaste prematuro.",
        scoreCalculado: 0,
      },
      {
        proveedorId: "shars-tool",
        proveedorNombre: "Shars Tool Company",
        precioUnitario: 52.0,
        moneda: "USD",
        leadTimeDias: 5,
        MOQ: 1,
        marca: "Shars Indexable",
        disponible: true,
        garantia: "Reemplazo de pieza",
        enlace: "",
        notas: "Stock disponible para entrega inmediata a Laredo.",
        scoreCalculado: 0,
      },
    ],
  },
]

export async function obtenerCotizacionesComparacion(): Promise<CotizacionComparacion[]> {
  try {
    const snap = await getDocs(query(collection(db, COLECCION_COTIZACIONES), orderBy("fecha", "desc")))
    if (snap.empty) {
      return await inicializarCotizacionesSemilla()
    }

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
    return COTIZACIONES_SEMILLA.map((cot, i) => ({ id: `semilla-cot-${i}`, ...cot }))
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

export async function inicializarCotizacionesSemilla(): Promise<CotizacionComparacion[]> {
  const creadas: CotizacionComparacion[] = []
  for (const cot of COTIZACIONES_SEMILLA) {
    const docRef = doc(collection(db, COLECCION_COTIZACIONES))
    const data = {
      ...cot,
      creadoEn: serverTimestamp(),
      actualizadoEn: serverTimestamp(),
    }
    await setDoc(docRef, data)
    creadas.push({
      id: docRef.id,
      ...cot,
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    })
  }
  return creadas
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

