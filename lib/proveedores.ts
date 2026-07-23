import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore"
import { db, getClienteAuth } from "@/lib/firebase"
import { registrarAuditoria } from "@/lib/auditoria"
import type {
  Proveedor,
  CategoriaProveedor,
  EstatusProveedor,
  TipoProveedor,
  MetodoPago,
  TiempoRespuesta,
  FrecuenciaCompra,
  Prioridad,
} from "@/lib/schemas"
import type { DocumentData } from "firebase/firestore"

const COLECCION_PROVEEDORES = "proveedores"

export type NuevoProveedorPayload = Omit<
  Proveedor,
  | "id"
  | "creadoEn"
  | "actualizadoEn"
  | "odooPartnerId"
  | "mercado"
  | "origenProveedor"
  | "ordenesOdoo"
  | "ultimaCompraOdoo"
> & {
  mercado?: "usa" | "mexico"
}

/** Catálogo base de proveedores reales de EE.UU. orientados a CNC y suministros industriales. */
export const PROVEEDORES_SEMILLA: NuevoProveedorPayload[] = [
  {
    nombre: "Shars Tool Company",
    estatus: "actual",
    tipoProveedor: "barato",
    barato: true,
    recomendado: true,
    categorias: ["endmills", "insertos", "tooling"],
    pais: "Estados Unidos",
    ubicacion: "St. Charles, Illinois, USA",
    shippingAddressUSA: "840 S Frontenac St, Aurora, IL 60504 (Bodega Laredo TX)",
    brokerAduanal: "Agencia Aduanal Rangel (Laredo, TX)",
    web: "https://www.shars.com",
    contacto: "Sales Dept",
    email: "sales@shars.com",
    telefono: "+1 630-444-1680",
    whatsapp: "",
    marcas: ["Shars", "Aven", "KBC"],
    moneda: "USD",
    facturaUSD: true,
    metodosPago: ["tarjeta", "transferencia"],
    tiempoRespuesta: "mismo_dia",
    frecuenciaCompra: "mensual",
    prioridad: "alta",
    leadTimeDias: 5,
    pedidoMinimo: 50,
    calificacion: 5,
    notas: "Excelente opción económica para fresas de carburo monolíticas, cortadores de 4 gavilanes AlTiN y portaherramientas BT40/CAT40.",
    experienciaCompra: "Excelente relación costo-beneficio. Se envía a bodegas de Laredo TX sin cobro adicional por compras superiores a $150 USD.",
  },
  {
    nombre: "McMaster-Carr",
    estatus: "actual",
    tipoProveedor: "estandar",
    barato: false,
    recomendado: true,
    categorias: ["tooling", "consumibles", "otros"],
    pais: "Estados Unidos",
    ubicacion: "Estados Unidos",
    shippingAddressUSA: "Entrega a bodega/forwarder en Texas",
    brokerAduanal: "",
    web: "https://www.mcmaster.com",
    contacto: "Customer Service",
    email: "",
    telefono: "+1 630-833-0300",
    whatsapp: "",
    marcas: ["McMaster-Carr"],
    moneda: "USD",
    facturaUSD: true,
    metodosPago: ["tarjeta", "credito"],
    tiempoRespuesta: "inmediato",
    frecuenciaCompra: "semanal",
    prioridad: "alta",
    leadTimeDias: 2,
    pedidoMinimo: 0,
    calificacion: 5,
    notas: "Proveedor habitual de suministros industriales, tornillería, materiales, herramientas y consumibles.",
    experienciaCompra: "Catálogo amplio y entregas rápidas a direcciones de Estados Unidos.",
  },
  {
    nombre: "OnlineCarbide",
    estatus: "actual",
    tipoProveedor: "barato",
    barato: true,
    recomendado: true,
    categorias: ["endmills"],
    pais: "Estados Unidos",
    ubicacion: "Chesterfield, Michigan, USA",
    shippingAddressUSA: "51336 Ore Creek Dr, Chesterfield, MI 48051 (Tránsito McAllen TX)",
    brokerAduanal: "Forwarding Express Laredo",
    web: "https://www.onlinecarbide.com",
    contacto: "Customer Care",
    email: "support@onlinecarbide.com",
    telefono: "+1 800-475-4082",
    whatsapp: "",
    marcas: ["OnlineCarbide Made in USA"],
    moneda: "USD",
    facturaUSD: true,
    metodosPago: ["tarjeta", "paypal"],
    tiempoRespuesta: "inmediato",
    frecuenciaCompra: "semanal",
    prioridad: "alta",
    leadTimeDias: 3,
    pedidoMinimo: 0,
    calificacion: 5,
    notas: "Fabricante directo en EE.UU. de endmills de carburo sólido a precio de fábrica. Muy recomendados para aluminio y aceros suaves.",
    experienciaCompra: "Envíos el mismo día. La durabilidad del recubrimiento ZrN en fresas para aluminio iguala marcas de doble precio.",
  },
  {
    nombre: "Cutting Edge Tooling (CET)",
    estatus: "prospecto",
    tipoProveedor: "barato",
    barato: true,
    recomendado: false,
    categorias: ["endmills", "consumibles"],
    pais: "Estados Unidos",
    ubicacion: "Phoenix, Arizona, USA",
    shippingAddressUSA: "2415 E Washington St, Phoenix, AZ 85034",
    brokerAduanal: "Despacho Express Laredo",
    web: "https://www.cuttingedgetooling.com",
    contacto: "Sales Desk",
    email: "info@cuttingedgetooling.com",
    telefono: "+1 602-273-7300",
    whatsapp: "",
    marcas: ["CET Carbide", "Micro-100"],
    moneda: "USD",
    facturaUSD: true,
    metodosPago: ["tarjeta", "paypal"],
    tiempoRespuesta: "24_48h",
    frecuenciaCompra: "ocasional",
    prioridad: "baja",
    leadTimeDias: 4,
    pedidoMinimo: 0,
    calificacion: 4,
    notas: "Proveedor especializado en endmills micro-diámetro y cortadores de chaflán de costo accesible para talleres de precisión.",
    experienciaCompra: "Cotizaciones rápidas vía correo. Pendiente realizar primera orden de prueba para fresas de 1/16 in.",
  },
  {
    nombre: "Discount Tooling & Supply",
    estatus: "prospecto",
    tipoProveedor: "barato",
    barato: true,
    recomendado: false,
    categorias: ["insertos", "tooling"],
    pais: "Estados Unidos",
    ubicacion: "Dallas, Texas, USA",
    shippingAddressUSA: "11500 Harry Hines Blvd, Dallas, TX 75229",
    brokerAduanal: "Despacho Express Laredo",
    web: "https://www.discounttooling.com",
    contacto: "Mark Stevens",
    email: "mark@discounttooling.com",
    telefono: "+1 214-555-0199",
    whatsapp: "+1 214-555-0199",
    marcas: ["Deskar", "ZCC-CT", "Kyocera"],
    moneda: "USD",
    facturaUSD: true,
    metodosPago: ["tarjeta", "paypal"],
    tiempoRespuesta: "24_48h",
    frecuenciaCompra: "ocasional",
    prioridad: "baja",
    leadTimeDias: 6,
    pedidoMinimo: 0,
    calificacion: 4,
    notas: "Distribuidor prospecto con muy buen precio en insertos para torneado APMT/CCMT/WNMG. Pendiente cotización formal.",
    experienciaCompra: "Aún sin primera compra en firme. Cotizar lote de prueba de 20 insertos APMT 1604.",
  },
  {
    nombre: "YG-1 USA Industrial Tooling",
    estatus: "actual",
    tipoProveedor: "premium",
    barato: false,
    recomendado: true,
    categorias: ["endmills", "insertos", "tooling"],
    pais: "Estados Unidos",
    ubicacion: "Vernon Hills, Illinois, USA",
    shippingAddressUSA: "730 Enterprise Dr, Vernon Hills, IL 60061 (Bodega Hidalgo TX)",
    brokerAduanal: "Logística Y-G Transfronteriza",
    web: "https://www.yg1usa.com",
    contacto: "Technical Sales Team",
    email: "orders@yg1usa.com",
    telefono: "+1 800-765-8665",
    whatsapp: "",
    marcas: ["YG-1", "V7 Plus", "Alu-Power", "Tank-Power"],
    moneda: "USD",
    facturaUSD: true,
    metodosPago: ["tarjeta", "transferencia", "credito"],
    tiempoRespuesta: "inmediato",
    frecuenciaCompra: "mensual",
    prioridad: "alta",
    leadTimeDias: 4,
    pedidoMinimo: 100,
    calificacion: 5,
    notas: "Proveedor de gama alta industrial. Serie V7 Plus para desbaste pesado en acero inoxidable y titanio.",
    experienciaCompra: "Respuesta en minutos. Nos otorgan crédito a 30 días tras 3 compras validadas con invoice comercial en USD.",
  },
  {
    nombre: "Kennametal US Direct",
    estatus: "actual",
    tipoProveedor: "premium",
    barato: false,
    recomendado: true,
    categorias: ["insertos", "tooling"],
    pais: "Estados Unidos",
    ubicacion: "Pittsburgh, Pennsylvania, USA",
    shippingAddressUSA: "525 William Penn Pl, Pittsburgh, PA 15219 (Laredo Cross-Border)",
    brokerAduanal: "Aduanas Especializadas de Monterrey",
    web: "https://www.kennametal.com",
    contacto: "Enterprise Orders",
    email: "k-na.service@kennametal.com",
    telefono: "+1 800-458-3600",
    whatsapp: "",
    marcas: ["Kennametal", "Beyond", "KCP25B"],
    moneda: "USD",
    facturaUSD: true,
    metodosPago: ["transferencia", "credito"],
    tiempoRespuesta: "mismo_dia",
    frecuenciaCompra: "trimestral",
    prioridad: "media",
    leadTimeDias: 6,
    pedidoMinimo: 300,
    calificacion: 5,
    notas: "Insertos de alto rendimiento para maquinado de acero tratado. Excelente tolerancia en insertos de roscado y tronzado.",
    experienciaCompra: "Precio elevado pero cero fallas en producción. Ideal para proyectos de alta precisión donde la herramienta no puede quebrarse.",
  },
  {
    nombre: "Iscar Metals USA",
    estatus: "actual",
    tipoProveedor: "premium",
    barato: false,
    recomendado: true,
    categorias: ["endmills", "insertos", "tooling"],
    pais: "Estados Unidos",
    ubicacion: "Arlington, Texas, USA",
    shippingAddressUSA: "6000 Iscar Dr, Arlington, TX 76018",
    brokerAduanal: "Agencia Aduanal Rangel",
    web: "https://www.iscar.com",
    contacto: "Customer Service US",
    email: "info@iscarmetals.com",
    telefono: "+1 817-258-3000",
    whatsapp: "",
    marcas: ["Iscar", "Helido", "Logiq4Feed", "Sumo-Tec"],
    moneda: "USD",
    facturaUSD: true,
    metodosPago: ["tarjeta", "transferencia", "credito"],
    tiempoRespuesta: "inmediato",
    frecuenciaCompra: "mensual",
    prioridad: "alta",
    leadTimeDias: 5,
    pedidoMinimo: 200,
    calificacion: 5,
    notas: "Líder tecnológico en insertos de alto avance (High Feed Milling) y geometrías helicoidales para desbaste agresivo.",
    experienciaCompra: "Gran soporte técnico. Envían parámetros exactos de corte (Vc, fz) por tipo de material.",
  },
  {
    nombre: "Garr Tool Company",
    estatus: "actual",
    tipoProveedor: "premium",
    barato: false,
    recomendado: true,
    categorias: ["endmills"],
    pais: "Estados Unidos",
    ubicacion: "Alma, Michigan, USA",
    shippingAddressUSA: "7800 N Alger Rd, Alma, MI 48801",
    brokerAduanal: "Forwarding Express Laredo",
    web: "https://www.garrtool.com",
    contacto: "Orders Desk",
    email: "garr@garrtool.com",
    telefono: "+1 800-248-9003",
    whatsapp: "",
    marcas: ["Garr Tool", "VRX", "VX-7"],
    moneda: "USD",
    facturaUSD: true,
    metodosPago: ["tarjeta", "transferencia"],
    tiempoRespuesta: "mismo_dia",
    frecuenciaCompra: "mensual",
    prioridad: "media",
    leadTimeDias: 3,
    pedidoMinimo: 50,
    calificacion: 5,
    notas: "Especialistas en endmills de carburo sólido de 4 y 5 gavilanes con recubrimientos AlTiN y AlCrN para aceros inoxidables.",
    experienciaCompra: "Acabado superficial impecable en aluminio 6061 y aceros 4140. Calidad de primera garantizada.",
  },
  {
    nombre: "Harvey Performance Company (Harvey Tool)",
    estatus: "prospecto",
    tipoProveedor: "premium",
    barato: false,
    recomendado: true,
    categorias: ["endmills", "tooling"],
    pais: "Estados Unidos",
    ubicacion: "Rowley, Massachusetts, USA",
    shippingAddressUSA: "8 Main St, Rowley, MA 01969",
    brokerAduanal: "Despacho Express Laredo",
    web: "https://www.harveytool.com",
    contacto: "Technical Support",
    email: "sales@harveytool.com",
    telefono: "+1 800-649-2666",
    whatsapp: "",
    marcas: ["Harvey Tool", "Helical Solutions"],
    moneda: "USD",
    facturaUSD: true,
    metodosPago: ["tarjeta", "transferencia"],
    tiempoRespuesta: "inmediato",
    frecuenciaCompra: "ocasional",
    prioridad: "media",
    leadTimeDias: 3,
    pedidoMinimo: 0,
    calificacion: 5,
    notas: "Herramientas especializadas de miniatura, cortadores cónicos, machuelos de rosca fina y cortadores de ranuras en T.",
    experienciaCompra: "Surtido único para geometrías difíciles. Indispensable para maquinado de moldes e instrumental médico.",
  },
  {
    nombre: "Travers Tool Co.",
    estatus: "actual",
    tipoProveedor: "estandar",
    barato: true,
    recomendado: false,
    categorias: ["endmills", "insertos", "tooling", "consumibles"],
    pais: "Estados Unidos",
    ubicacion: "Flushing, New York, USA",
    shippingAddressUSA: "128-15 26th Ave, Flushing, NY 11354 (Bodega Texas)",
    brokerAduanal: "Rangel Forwarding Inc.",
    web: "https://www.travers.com",
    contacto: "International Desk",
    email: "orders@travers.com",
    telefono: "+1 800-221-0270",
    whatsapp: "",
    marcas: ["OTM", "KORLOY", "YG-1", "Niagara Cutter"],
    moneda: "USD",
    facturaUSD: true,
    metodosPago: ["tarjeta", "paypal"],
    tiempoRespuesta: "24_48h",
    frecuenciaCompra: "mensual",
    prioridad: "media",
    leadTimeDias: 4,
    pedidoMinimo: 100,
    calificacion: 4,
    notas: "Gran catálogo de cortadores, machuelos y mandriles. Promociones mensuales frecuentes en marcas asiáticas y americanas.",
    experienciaCompra: "Buen empaque protegido contra humedad. Las ofertas relámpago bajan precios de insertos Korloy hasta un 35%.",
  },
  {
    nombre: "MSC Industrial Direct",
    estatus: "actual",
    tipoProveedor: "estandar",
    barato: false,
    recomendado: true,
    categorias: ["endmills", "insertos", "tooling", "consumibles", "otros"],
    pais: "Estados Unidos",
    ubicacion: "Melville, New York, USA",
    shippingAddressUSA: "515 Broadhollow Rd, Melville, NY 11747 (Laredo Hub)",
    brokerAduanal: "Agencia Aduanal Rangel",
    web: "https://www.mscdirect.com",
    contacto: "Enterprise Care",
    email: "customercare@mscdirect.com",
    telefono: "+1 800-645-7270",
    whatsapp: "",
    marcas: ["Accupro", "Niagara", "Iscar", "Seco", "Garr Tool"],
    moneda: "USD",
    facturaUSD: true,
    metodosPago: ["tarjeta", "transferencia", "credito"],
    tiempoRespuesta: "inmediato",
    frecuenciaCompra: "mensual",
    prioridad: "alta",
    leadTimeDias: 2,
    pedidoMinimo: 0,
    calificacion: 5,
    notas: "Distribuidor masivo en EE.UU. ideal para componentes de emergencia o marcas muy específicas como Accupro o Garr Tool.",
    experienciaCompra: "Entrega express en 48 horas a bodega de Texas. Descuentos negociados por volumen comercial en la cuenta SMV.",
  },
  {
    nombre: "KBC Tools & Machinery",
    estatus: "prospecto",
    tipoProveedor: "estandar",
    barato: true,
    recomendado: false,
    categorias: ["endmills", "insertos", "tooling"],
    pais: "Estados Unidos",
    ubicacion: "Sterling Heights, Michigan, USA",
    shippingAddressUSA: "6300 18 Mile Rd, Sterling Heights, MI 48314",
    brokerAduanal: "Despacho Express Laredo",
    web: "https://www.kbctools.com",
    contacto: "Sales Desk",
    email: "kbcsales@kbctools.com",
    telefono: "+1 800-822-1150",
    whatsapp: "",
    marcas: ["Brand KBC", "Micro 100", "Accupro"],
    moneda: "USD",
    facturaUSD: true,
    metodosPago: ["tarjeta", "paypal"],
    tiempoRespuesta: "24_48h",
    frecuenciaCompra: "ocasional",
    prioridad: "baja",
    leadTimeDias: 5,
    pedidoMinimo: 50,
    calificacion: 4,
    notas: "Excelente catálogo de herramientas de corte económicas e instrumentos de medición para taller de maquinado.",
    experienciaCompra: "Revisar catálogo impreso y promociones de primavera en accesorios de sujeción para prensa CNC.",
  },
]

function formatearFecha(fecha: unknown): string {
  if (!fecha) return new Date().toISOString()
  if (fecha instanceof Timestamp) return fecha.toDate().toISOString()
  if (fecha instanceof Date) return fecha.toISOString()
  return String(fecha)
}

function idSemillaProveedor(nombre: string): string {
  const normalizado = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
  return `semilla-${normalizado}`
}

/** Convierte un documento de Firestore al contrato estable usado por la interfaz. */
export function mapearProveedorDocumento(id: string, data: DocumentData): Proveedor {
  return {
    id,
    nombre: data.nombre ?? "",
    estatus: (data.estatus as EstatusProveedor) ?? "actual",
    tipoProveedor: (data.tipoProveedor as TipoProveedor) ?? (data.barato ? "barato" : "estandar"),
    barato: data.barato === true,
    recomendado: data.recomendado === true,
    categorias: (data.categorias as CategoriaProveedor[]) ?? ["tooling"],
    pais: data.pais ?? "Estados Unidos",
    ubicacion: data.ubicacion ?? "",
    shippingAddressUSA: data.shippingAddressUSA ?? "",
    brokerAduanal: data.brokerAduanal ?? "",
    web: data.web ?? "",
    contacto: data.contacto ?? "",
    email: data.email ?? "",
    telefono: data.telefono ?? "",
    whatsapp: data.whatsapp ?? "",
    marcas: Array.isArray(data.marcas) ? data.marcas : [],
    moneda: data.moneda === "MXN" ? "MXN" : "USD",
    facturaUSD: data.facturaUSD !== false,
    metodosPago: (data.metodosPago as MetodoPago[]) ?? ["tarjeta"],
    tiempoRespuesta: (data.tiempoRespuesta as TiempoRespuesta) ?? "mismo_dia",
    frecuenciaCompra: (data.frecuenciaCompra as FrecuenciaCompra) ?? "mensual",
    prioridad: (data.prioridad as Prioridad) ?? "media",
    leadTimeDias: typeof data.leadTimeDias === "number" ? data.leadTimeDias : null,
    pedidoMinimo: typeof data.pedidoMinimo === "number" ? data.pedidoMinimo : null,
    calificacion: typeof data.calificacion === "number" ? data.calificacion : 5,
    notas: data.notas ?? "",
    experienciaCompra: data.experienciaCompra ?? "",
    odooPartnerId: typeof data.odooPartnerId === "number" ? data.odooPartnerId : null,
    mercado:
      data.mercado === "mexico" || data.mercado === "usa"
        ? data.mercado
        : typeof data.odooPartnerId === "number"
          ? "mexico"
          : "usa",
    origenProveedor:
      data.origenProveedor === "odoo" || data.origenProveedor === "manual" || data.origenProveedor === "semilla"
        ? data.origenProveedor
        : typeof data.odooPartnerId === "number"
          ? "odoo"
          : "manual",
    ordenesOdoo: typeof data.ordenesOdoo === "number" ? data.ordenesOdoo : undefined,
    ultimaCompraOdoo: typeof data.ultimaCompraOdoo === "string" ? data.ultimaCompraOdoo : null,
    creadoEn: formatearFecha(data.creadoEn),
    actualizadoEn: formatearFecha(data.actualizadoEn),
  }
}

/** Obtiene todos los proveedores ordenados por nombre. */
export async function obtenerProveedores(): Promise<Proveedor[]> {
  try {
    const q = query(collection(db, COLECCION_PROVEEDORES), orderBy("nombre", "asc"))
    const snap = await getDocs(q)

    if (snap.empty) {
      return await inicializarProveedoresSemilla()
    }

    return snap.docs.map((docSnap) => mapearProveedorDocumento(docSnap.id, docSnap.data()))
  } catch (error) {
    console.error("Error al obtener proveedores de Firestore:", error)
    throw error instanceof Error ? error : new Error("No se pudieron cargar los proveedores")
  }
}

/** Crea un proveedor nuevo en Firestore. */
export async function crearProveedor(payload: NuevoProveedorPayload): Promise<Proveedor> {
  const docRef = doc(collection(db, COLECCION_PROVEEDORES))
  const mercado =
    payload.mercado ??
    (payload.moneda === "MXN" || /m[eé]xico/i.test(payload.pais) ? "mexico" : "usa")
  const nuevo: Record<string, unknown> = {
    ...payload,
    mercado,
    origenProveedor: "manual",
    odooPartnerId: null,
    creadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp(),
  }
  await setDoc(docRef, nuevo)

  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "CREAR", "proveedores", docRef.id, `Creó proveedor: ${payload.nombre}`)

  return {
    id: docRef.id,
    ...payload,
    mercado,
    origenProveedor: "manual",
    odooPartnerId: null,
    creadoEn: new Date().toISOString(),
    actualizadoEn: new Date().toISOString(),
  }
}

/** Actualiza un proveedor existente. */
export async function actualizarProveedor(
  id: string,
  cambios: Partial<NuevoProveedorPayload>
): Promise<void> {
  const docRef = doc(db, COLECCION_PROVEEDORES, id)
  await updateDoc(docRef, {
    ...cambios,
    actualizadoEn: serverTimestamp(),
  })
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "EDITAR", "proveedores", id, `Actualizó proveedor: ${Object.keys(cambios).join(', ')}`)
}

/** Elimina un proveedor. */
export async function eliminarProveedor(id: string): Promise<void> {
  const docRef = doc(db, COLECCION_PROVEEDORES, id)
  await deleteDoc(docRef)
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "BORRAR", "proveedores", id, "Eliminó proveedor")
}

/** Siembra los 12 proveedores de prueba iniciales en Firestore si la colección está vacía. */
export async function inicializarProveedoresSemilla(): Promise<Proveedor[]> {
  const creados: Proveedor[] = []
  for (const prov of PROVEEDORES_SEMILLA) {
    const docRef = doc(db, COLECCION_PROVEEDORES, idSemillaProveedor(prov.nombre))
    const data = {
      ...prov,
      mercado: "usa" as const,
      origenProveedor: "semilla" as const,
      creadoEn: serverTimestamp(),
      actualizadoEn: serverTimestamp(),
    }
    await setDoc(docRef, data)
    creados.push({
      id: docRef.id,
      ...prov,
      odooPartnerId: null,
      mercado: "usa",
      origenProveedor: "semilla",
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    })
  }
  return creados
}

// ── Matriz de proveedor primario/backup por categoría (antes solo en useState) ──

const COLECCION_MATRIZ_BACKUP = "proveedores_matriz_backup"
const DOC_MATRIZ_BACKUP = "matriz"

export type MatrizBackupProveedores = Record<string, { primarioId: string; backupId: string }>

export async function obtenerMatrizBackupProveedores(): Promise<MatrizBackupProveedores> {
  const snap = await getDoc(doc(db, COLECCION_MATRIZ_BACKUP, DOC_MATRIZ_BACKUP))
  if (!snap.exists()) return {}
  const data = snap.data()
  return (data.mapeo as MatrizBackupProveedores) ?? {}
}

export async function guardarMatrizBackupProveedores(mapeo: MatrizBackupProveedores): Promise<void> {
  await setDoc(doc(db, COLECCION_MATRIZ_BACKUP, DOC_MATRIZ_BACKUP), {
    mapeo,
    actualizadoEn: serverTimestamp(),
  })
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "EDITAR", COLECCION_MATRIZ_BACKUP, DOC_MATRIZ_BACKUP, "Actualizó la matriz de proveedor primario/backup por categoría")
}
