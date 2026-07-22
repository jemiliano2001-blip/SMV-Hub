import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type {
  Requisicion,
  ItemRequisicion,
  CotizacionRequisicion,
  EstatusRequisicionFlujo,
  PrioridadFlujo,
} from "@/lib/schemas"
import { CotizacionRequisicionSchema } from "@/lib/schemas"
import { crearOrden } from "@/lib/ordenes"
import { crearCompraProveedor } from "@/lib/proveedores-inteligencia"
import { getClienteAuth } from "@/lib/firebase"
import { registrarAuditoria } from "@/lib/auditoria"
import { fechaHoyLocal } from "@/lib/format"

const COLECCION_REQUISICIONES = "requisiciones"
const COLECCION_COTIZACIONES_REQ = "cotizaciones_requisicion"

export type NuevaRequisicionFlujoPayload = {
  solicitante: string
  departamento: string
  prioridadFlujo: PrioridadFlujo
  motivoJustificacion: string
  aprobacionRequerida: boolean
  aprobador?: string
  items: Array<{
    descripcion: string
    categoria: string
    cantidad: number
    unidad: string
    marcaPreferida?: string
    especificacion?: string
    fechaRequerida?: string
    proveedorSugeridoId?: string
    proveedorSugeridoNombre?: string
  }>
}

function formatearFecha(fecha: unknown): string {
  if (!fecha) return new Date().toISOString()
  if (fecha instanceof Timestamp) return fecha.toDate().toISOString()
  if (fecha instanceof Date) return fecha.toISOString()
  return String(fecha)
}

// ── REQUISICIONES FLUIDAS Y COMPLETAS ────────────────────────────────────────

export async function obtenerRequisicionesFlujo(): Promise<Requisicion[]> {
  try {
    const snap = await getDocs(query(collection(db, COLECCION_REQUISICIONES), orderBy("creadoEn", "desc")))
    if (snap.empty) {
      return await inicializarRequisicionesSemilla()
    }
    return snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        folio: data.folio || `REQ-${d.id.substring(0, 6).toUpperCase()}`,
        tipo: data.tipo || "general",
        solicitante: data.solicitante || "Taller CNC",
        departamento: data.departamento || "Maquinados",
        prioridadFlujo: (data.prioridadFlujo as PrioridadFlujo) || "media",
        estatusFlujo: (data.estatusFlujo as EstatusRequisicionFlujo) || "enviada",
        estado: data.estado || "en_proceso",
        fechaPedido: data.fechaPedido || fechaHoyLocal(),
        tienda: data.tienda || null,
        descripcion: data.descripcion || (data.items && data.items[0]?.descripcion) || "Solicitud de herramientas",
        link: data.link || null,
        cantidad: data.cantidad || null,
        prioridad: data.prioridad || "3-5 dias",
        empresa: data.empresa || "Taller",
        ordenServicio: data.ordenServicio || null,
        parteNumero: data.parteNumero || null,
        fechaEntregaEst: data.fechaEntregaEst || null,
        recibio: data.recibio || null,
        revisionFinanzas: data.revisionFinanzas || null,
        nota: data.nota || null,
        motivoJustificacion: data.motivoJustificacion || "",
        items: Array.isArray(data.items) ? data.items : [],
        proveedorGanadorId: data.proveedorGanadorId || null,
        proveedorGanadorNombre: data.proveedorGanadorNombre || null,
        motivoSeleccion: data.motivoSeleccion || null,
        fechaDecision: data.fechaDecision || null,
        usuarioDecision: data.usuarioDecision || null,
        aprobacionRequerida: data.aprobacionRequerida === true,
        aprobador: data.aprobador || null,
        estatusAprobacion: data.estatusAprobacion || "pendiente",
        fechaAprobacion: data.fechaAprobacion || null,
        ordenCompraFolio: data.ordenCompraFolio || null,
        ordenCompraId: data.ordenCompraId || null,
        creadoEn: formatearFecha(data.creadoEn),
        actualizadoEn: formatearFecha(data.actualizadoEn),
      } as unknown as Requisicion
    })
  } catch (err) {
    console.error("Error al obtener requisiciones flujo:", err)
    return DEMO_REQUISICIONES
  }
}

export async function crearRequisicionFlujo(payload: NuevaRequisicionFlujoPayload): Promise<Requisicion> {
  const docRef = doc(collection(db, COLECCION_REQUISICIONES))
  const ahora = new Date()
  const sec = Math.floor(100 + Math.random() * 900)
  const folio = `REQ-2026-${sec}`

  const itemsConId: ItemRequisicion[] = payload.items.map((it, idx) => ({
    id: `item-${idx + 1}`,
    ...it,
  }))

  const nuevaData = {
    folio,
    solicitante: payload.solicitante,
    departamento: payload.departamento,
    prioridadFlujo: payload.prioridadFlujo,
    estatusFlujo: "enviada" as EstatusRequisicionFlujo,
    motivoJustificacion: payload.motivoJustificacion,
    aprobacionRequerida: payload.aprobacionRequerida,
    aprobador: payload.aprobador || null,
    estatusAprobacion: payload.aprobacionRequerida ? ("pendiente" as const) : ("aprobada" as const),
    items: itemsConId,
    // Compatibilidad con tabla vieja
    tipo: "general",
    estado: "en_proceso",
    fechaPedido: fechaHoyLocal(ahora),
    descripcion: itemsConId[0]?.descripcion || "Requisición de herramental",
    cantidad: `${itemsConId.reduce((acc, i) => acc + i.cantidad, 0)} pz(s)`,
    creadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
  }

  await setDoc(docRef, nuevaData)

  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "CREAR", "requisiciones", docRef.id, `Creó requisición ${folio} con ${itemsConId.length} ítems`)

  return {
    id: docRef.id,
    ...nuevaData,
    creadoEn: ahora.toISOString(),
    actualizadoEn: ahora.toISOString(),
  } as unknown as Requisicion
}

// ── COTIZACIONES POR REQUISICIÓN ─────────────────────────────────────────────

export async function obtenerCotizacionesRequisicion(requisicionId: string): Promise<CotizacionRequisicion[]> {
  try {
    const q = query(
      collection(db, COLECCION_COTIZACIONES_REQ),
      where("requisicionId", "==", requisicionId)
    )
    const snap = await getDocs(q)
    return snap.docs.map((d) => {
      const data = d.data()
      return {
        id: d.id,
        requisicionId: data.requisicionId,
        proveedorId: data.proveedorId,
        proveedorNombre: data.proveedorNombre,
        fechaCotizacion: data.fechaCotizacion || fechaHoyLocal(),
        moneda: data.moneda || "USD",
        condicionesPago: data.condicionesPago || "Net 30",
        leadTimeDias: data.leadTimeDias || 3,
        costoEnvioUSD: data.costoEnvioUSD || 0,
        subtotal: data.subtotal || 0,
        total: data.total || 0,
        observaciones: data.observaciones || "",
        itemsCotizados: Array.isArray(data.itemsCotizados) ? data.itemsCotizados : [],
        ganadora: data.ganadora === true,
        creadoEn: data.creadoEn ? new Date(formatearFecha(data.creadoEn)) : new Date(),
      }
    })
  } catch (err) {
    console.error("Error al obtener cotizaciones de requisición:", err)
    return DEMO_COTIZACIONES.filter((c) => c.requisicionId === requisicionId)
  }
}

export async function agregarCotizacionRequisicion(
  payload: Omit<CotizacionRequisicion, "id" | "creadoEn">
): Promise<CotizacionRequisicion> {
  const validated = CotizacionRequisicionSchema.omit({ id: true, creadoEn: true }).parse(payload)
  const docRef = doc(collection(db, COLECCION_COTIZACIONES_REQ))
  await setDoc(docRef, {
    ...validated,
    creadoEn: serverTimestamp(),
  })

  // Actualizar estatus de la requisición a "cotizando" si estaba en enviada
  const reqRef = doc(db, COLECCION_REQUISICIONES, validated.requisicionId)
  const reqSnap = await getDoc(reqRef)
  if (reqSnap.exists()) {
    const reqData = reqSnap.data()
    if (reqData.estatusFlujo === "enviada" || reqData.estatusFlujo === "borrador") {
      await setDoc(reqRef, { estatusFlujo: "cotizando", actualizadoEn: serverTimestamp() }, { merge: true })
    }
  }

  return {
    id: docRef.id,
    ...validated,
    creadoEn: new Date(),
  }
}

// ── SELECCIÓN DE PROVEEDOR GANADOR & APROBACIÓN ──────────────────────────────

export async function seleccionarProveedorGanador(
  requisicionId: string,
  cotizacionId: string,
  motivoSeleccion: string,
  usuario: string = "Compras SMV"
): Promise<void> {
  // 1. Marcar todas las cotizaciones de la req como no ganadoras
  const cotizSnap = await getDocs(
    query(collection(db, COLECCION_COTIZACIONES_REQ), where("requisicionId", "==", requisicionId))
  )

  let cotGanadora: CotizacionRequisicion | null = null

  for (const docSnap of cotizSnap.docs) {
    const esEsta = docSnap.id === cotizacionId
    await setDoc(docSnap.ref, { ganadora: esEsta }, { merge: true })
    if (esEsta) {
      cotGanadora = { id: docSnap.id, ...docSnap.data() } as CotizacionRequisicion
    }
  }

  if (!cotGanadora) {
    throw new Error("No se encontró la cotización seleccionada.")
  }

  // 2. Actualizar requisición con ganador y estatus "aprobada"
  const hoy = fechaHoyLocal()
  await setDoc(
    doc(db, COLECCION_REQUISICIONES, requisicionId),
    {
      proveedorGanadorId: cotGanadora.proveedorId,
      proveedorGanadorNombre: cotGanadora.proveedorNombre,
      motivoSeleccion,
      fechaDecision: hoy,
      usuarioDecision: usuario,
      estatusFlujo: "aprobada",
      estatusAprobacion: "aprobada",
      fechaAprobacion: hoy,
      actualizadoEn: serverTimestamp(),
    },
    { merge: true }
  )

  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "EDITAR", "requisiciones", requisicionId, `Seleccionó a ${cotGanadora.proveedorNombre} como ganador de la requisición`)
}

// ── GENERACIÓN DE ORDEN DE COMPRA (OC) DESDE REQUISICIÓN ─────────────────────

export async function generarOrdenCompraDesdeRequisicion(
  requisicion: Requisicion,
  cotizacionGanadora: CotizacionRequisicion,
  condicionesPago?: string,
  fechaEntregaEstimada?: string,
  notasInternas?: string
): Promise<{ ordenId: string; folioOC: string }> {
  if (!cotizacionGanadora) {
    throw new Error("Se requiere una cotización ganadora para generar la Orden de Compra.")
  }

  const sec = Math.floor(100 + Math.random() * 900)
  const folioOC = `OC-2026-${sec}`
  const hoy = fechaHoyLocal()

  // 1. Crear Orden en colección 'ordenes' (con FKs de trazabilidad USA Tooling)
  const ordenId = await crearOrden({
    proveedor: cotizacionGanadora.proveedorNombre,
    proveedorId: cotizacionGanadora.proveedorId,
    cotizacionGanadoraId: cotizacionGanadora.id,
    requisicionId: requisicion.id,
    requisitor: requisicion.solicitante || "SMV Maquinados",
    ordenTrabajo: requisicion.folio || "OT-GENERAL",
    empresa: "AFX",
    destino: "AFX",
    cuentaCargo: "Herramental",
    numeroFactura: null,
    fechaFactura: null,
    envio: cotizacionGanadora.costoEnvioUSD || 0,
    moneda: cotizacionGanadora.moneda || "USD",
    estado: "aprobada",
    fechaEntrega: fechaEntregaEstimada || hoy,
    subtotal: cotizacionGanadora.subtotal,
    impuestos: 0,
    total: cotizacionGanadora.total,
    items: cotizacionGanadora.itemsCotizados.map((it) => ({
      descripcion: it.descripcion,
      descripcionSimplificada: it.descripcion,
      cantidad: it.cantidad,
      precioUnitario: it.precioUnitario,
      subtotal: it.subtotal,
      total: it.subtotal,
      claveProdServ: null,
      satPendiente: false,
      cuentaCargo: "Herramental",
      requisitor: requisicion.solicitante || "SMV Maquinados",
      empresa: "AFX",
      ordenTrabajo: requisicion.folio || "OT-GENERAL",
    })),
  })

  // 2. Registrar en la inteligencia de proveedores
  for (const it of cotizacionGanadora.itemsCotizados) {
    await crearCompraProveedor({
      proveedorId: cotizacionGanadora.proveedorId,
      proveedorNombre: cotizacionGanadora.proveedorNombre,
      numeroOrden: folioOC,
      fecha: hoy,
      producto: it.descripcion,
      categoria: "endmills",
      marca: cotizacionGanadora.proveedorNombre,
      cantidad: it.cantidad,
      precioUnitario: it.precioUnitario,
      moneda: cotizacionGanadora.moneda,
      costoTotal: it.subtotal,
      leadTimeRealDias: cotizacionGanadora.leadTimeDias,
      notas: `Generado desde Requisición ${requisicion.folio || requisicion.id}. ${notasInternas || ''}`,
    })
  }

  // 3. Actualizar estatus de la Requisición a 'convertida_a_oc'
  await setDoc(
    doc(db, COLECCION_REQUISICIONES, requisicion.id),
    {
      estatusFlujo: "convertida_a_oc",
      estado: "comprado",
      ordenCompraFolio: folioOC,
      ordenCompraId: ordenId,
      actualizadoEn: serverTimestamp(),
    },
    { merge: true }
  )

  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "CREAR", "ordenes", ordenId, `Generó Orden de Compra ${folioOC} para Requisición ${requisicion.folio || requisicion.id}`)

  return { ordenId, folioOC }
}

// ── SEMILLA DE DEMO DE REQUISICIONES DE MAQUINADO EE.UU. ─────────────────────

export const DEMO_REQUISICIONES: Requisicion[] = [
  {
    id: "req-demo-001",
    folio: "REQ-2026-881",
    tipo: "general",
    solicitante: "Oscar Pantoja (Líder CNC)",
    departamento: "Taller Maquinados AFX",
    prioridadFlujo: "urgente",
    estatusFlujo: "aprobada",
    estado: "en_proceso",
    fechaPedido: "2026-07-20",
    tienda: "Shars Tool / OnlineCarbide",
    descripcion: "Juego de Endmills de Carburo Sólido 1/2' AlTiN (5 Gavilanes) para Titanio y Acero Inox",
    cantidad: "20 pz(s)",
    prioridad: "1-2 dias",
    empresa: "AFX",
    ordenServicio: "OT-9942",
    motivoJustificacion: "Requerido de urgencia para producción de flechas de acero 4140 en Centro de Maquinado 5 Ejes.",
    items: [
      {
        id: "it-1",
        descripcion: "Endmill 1/2' 5 Gavilanes AlTiN Carburo Micrograno",
        categoria: "endmills",
        cantidad: 15,
        unidad: "pza",
        marcaPreferida: "OnlineCarbide / Shars",
        especificacion: "Diámetro 1/2', Z=5, Cuello Relevado 2.0', Z-Axis High Speed Milling",
        fechaRequerida: "2026-07-25",
        proveedorSugeridoId: "shars-tool",
        proveedorSugeridoNombre: "Shars Tool",
      },
      {
        id: "it-2",
        descripcion: "Insertos de Carreado APMT 1604 PDER AlTiN",
        categoria: "insertos",
        cantidad: 50,
        unidad: "pza",
        marcaPreferida: "YG-1 / Shars",
        especificacion: "Geometría para desbaste pesado en fundición",
        fechaRequerida: "2026-07-25",
        proveedorSugeridoId: "yg1-usa",
        proveedorSugeridoNombre: "YG-1 USA",
      },
    ],
    proveedorGanadorId: "shars-tool",
    proveedorGanadorNombre: "Shars Tool Company",
    motivoSeleccion: "Mejor balance general: 30% más económico que Kennametal y entrega garantizada en 3 días en Laredo, TX.",
    fechaDecision: "2026-07-21",
    usuarioDecision: "Edgar Rojo (Gerente de Compras)",
    aprobacionRequerida: true,
    aprobador: "Ing. Francisco Pantoja",
    estatusAprobacion: "aprobada",
    fechaAprobacion: "2026-07-21",
    ordenCompraFolio: "OC-2026-904",
    ordenCompraId: "ord-demo-904",
    creadoEn: new Date("2026-07-20T10:00:00Z"),
    actualizadoEn: new Date("2026-07-21T11:00:00Z"),
  } as unknown as Requisicion,
  {
    id: "req-demo-002",
    folio: "REQ-2026-882",
    tipo: "general",
    solicitante: "Salvador (Programador Mastercam)",
    departamento: "Ingeniería de Procesos",
    prioridadFlujo: "alta",
    estatusFlujo: "cotizando",
    estado: "en_proceso",
    fechaPedido: "2026-07-21",
    tienda: "YG-1 / Kennametal",
    descripcion: "Insertos WNMG 080408 para Torneado CNC en Inconel 718",
    cantidad: "100 pz(s)",
    prioridad: "3-5 dias",
    empresa: "Taller",
    ordenServicio: "OT-9950",
    motivoJustificacion: "Desgaste acelerado de rompevirutas en lote de turbinas para sector aeroespacial.",
    items: [
      {
        id: "it-3",
        descripcion: "Insertos Torneado WNMG 080408-SM Grado TiAlN",
        categoria: "insertos",
        cantidad: 100,
        unidad: "pza",
        marcaPreferida: "Kennametal / Iscar",
        especificacion: "Grado KCU10 para súperaleaciones de níquel",
        fechaRequerida: "2026-07-28",
        proveedorSugeridoId: "kennametal-us",
        proveedorSugeridoNombre: "Kennametal US",
      },
    ],
    aprobacionRequerida: true,
    aprobador: "Ing. Francisco Pantoja",
    estatusAprobacion: "pendiente",
    creadoEn: new Date("2026-07-21T08:30:00Z"),
    actualizadoEn: new Date("2026-07-21T08:30:00Z"),
  } as unknown as Requisicion,
  {
    id: "req-demo-003",
    folio: "REQ-2026-883",
    tipo: "general",
    solicitante: "Lorena (Control de Inventarios)",
    departamento: "Almacén General",
    prioridadFlujo: "media",
    estatusFlujo: "enviada",
    estado: "no_comprado",
    fechaPedido: "2026-07-21",
    tienda: "Travers / Discount Tooling",
    descripcion: "Refrigerante Soluble Blaser Swisslube 2000 (Tambo 55 Gal)",
    cantidad: "1 tambo",
    prioridad: "7-14 dias",
    empresa: "OHD",
    ordenServicio: null,
    motivoJustificacion: "Reabastecimiento mensual de fluidos de corte para centro de maquinado Haas VF-4.",
    items: [
      {
        id: "it-4",
        descripcion: "Tambo Refrigerante Blasocut 2000 Universal 55 Gal",
        categoria: "consumibles",
        cantidad: 1,
        unidad: "tambo",
        marcaPreferida: "Blaser Swisslube",
        especificacion: "Emulsión base aceite mineral sintético libre de cloro",
        fechaRequerida: "2026-08-01",
        proveedorSugeridoId: "travers-tool",
        proveedorSugeridoNombre: "Travers Tool Co",
      },
    ],
    aprobacionRequerida: false,
    creadoEn: new Date("2026-07-21T12:00:00Z"),
    actualizadoEn: new Date("2026-07-21T12:00:00Z"),
  } as unknown as Requisicion,
]

export const DEMO_COTIZACIONES: CotizacionRequisicion[] = [
  {
    id: "cot-demo-101",
    requisicionId: "req-demo-001",
    proveedorId: "shars-tool",
    proveedorNombre: "Shars Tool Company",
    fechaCotizacion: "2026-07-20",
    moneda: "USD",
    condicionesPago: "Tarjeta de Crédito / Net 30",
    leadTimeDias: 3,
    costoEnvioUSD: 18.5,
    subtotal: 620.0,
    total: 638.5,
    observaciones: "Envío FedEx Express a nuestra bodega en Laredo, TX (78045). Stock disponible inmediato.",
    itemsCotizados: [
      { itemId: "it-1", descripcion: "Endmill 1/2' 5 Gavilanes AlTiN", cantidad: 15, precioUnitario: 28.0, subtotal: 420.0 },
      { itemId: "it-2", descripcion: "Insertos APMT 1604 PDER AlTiN", cantidad: 50, precioUnitario: 4.0, subtotal: 200.0 },
    ],
    ganadora: true,
  },
  {
    id: "cot-demo-102",
    requisicionId: "req-demo-001",
    proveedorId: "kennametal-us",
    proveedorNombre: "Kennametal US",
    fechaCotizacion: "2026-07-20",
    moneda: "USD",
    condicionesPago: "Crédito 30 días",
    leadTimeDias: 2,
    costoEnvioUSD: 25.0,
    subtotal: 1050.0,
    total: 1075.0,
    observaciones: "High Performance Premium Tooling. Entrega al día siguiente vía UPS Air.",
    itemsCotizados: [
      { itemId: "it-1", descripcion: "Endmill 1/2' 5 Gavilanes AlTiN HARVI", cantidad: 15, precioUnitario: 50.0, subtotal: 750.0 },
      { itemId: "it-2", descripcion: "Insertos APMT 1604 High Performance", cantidad: 50, precioUnitario: 6.0, subtotal: 300.0 },
    ],
    ganadora: false,
  },
  {
    id: "cot-demo-103",
    requisicionId: "req-demo-002",
    proveedorId: "yg1-usa",
    proveedorNombre: "YG-1 USA",
    fechaCotizacion: "2026-07-21",
    moneda: "USD",
    condicionesPago: "Net 30",
    leadTimeDias: 4,
    costoEnvioUSD: 15.0,
    subtotal: 580.0,
    total: 595.0,
    observaciones: "Excelente alternativa en grado YG801 para aleaciones de niquel.",
    itemsCotizados: [
      { itemId: "it-3", descripcion: "Insertos WNMG 080408 YG801", cantidad: 100, precioUnitario: 5.8, subtotal: 580.0 },
    ],
    ganadora: false,
  },
  {
    id: "cot-demo-104",
    requisicionId: "req-demo-002",
    proveedorId: "iscar-metals-usa",
    proveedorNombre: "Iscar Metals USA",
    fechaCotizacion: "2026-07-21",
    moneda: "USD",
    condicionesPago: "Crédito 30 días",
    leadTimeDias: 2,
    costoEnvioUSD: 20.0,
    subtotal: 790.0,
    total: 810.0,
    observaciones: "Insertos IC807 originales de alta durabilidad.",
    itemsCotizados: [
      { itemId: "it-3", descripcion: "Insertos WNMG 080408 IC807 Premium", cantidad: 100, precioUnitario: 7.9, subtotal: 790.0 },
    ],
    ganadora: false,
  },
]

export async function inicializarRequisicionesSemilla(): Promise<Requisicion[]> {
  for (const r of DEMO_REQUISICIONES) {
    const docRef = doc(db, COLECCION_REQUISICIONES, r.id)
    await setDoc(docRef, {
      ...r,
      creadoEn: serverTimestamp(),
      actualizadoEn: serverTimestamp(),
    })
  }
  for (const c of DEMO_COTIZACIONES) {
    const docRef = doc(db, COLECCION_COTIZACIONES_REQ, c.id)
    await setDoc(docRef, {
      ...c,
      creadoEn: serverTimestamp(),
    })
  }
  return DEMO_REQUISICIONES
}
