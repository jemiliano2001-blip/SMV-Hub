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
import { formatearFecha } from "@/lib/firestore-helpers"
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
