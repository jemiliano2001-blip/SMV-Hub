import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { OrdenCompra, NuevaCompraForm, EstadoOrden } from "@/lib/schemas"

// ── Converter Date ↔ Timestamp ────────────────────────────────────────────────

const ordenConverter: FirestoreDataConverter<OrdenCompra> = {
  toFirestore(orden) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, creadoEn, actualizadoEn, ...rest } = orden as OrdenCompra
    return {
      ...rest,
      creadoEn: Timestamp.fromDate(creadoEn),
      actualizadoEn: Timestamp.fromDate(actualizadoEn),
    }
  },
  fromFirestore(snap: QueryDocumentSnapshot) {
    const d = snap.data()
    const creadoEn = d.creadoEn instanceof Timestamp ? d.creadoEn.toDate() : new Date()
    const actualizadoEn = d.actualizadoEn instanceof Timestamp ? d.actualizadoEn.toDate() : new Date()
    return { ...d, id: snap.id, creadoEn, actualizadoEn } as OrdenCompra
  },
}

const ordenesRef = () =>
  collection(db, "ordenes").withConverter(ordenConverter)

// ── CRUD ──────────────────────────────────────────────────────────────────────

export type NuevaOrdenPayload = NuevaCompraForm & {
  imagenUrl?: string
  imagenPath?: string
  linkProveedor?: string | null
  fechaEntrega?: string | null
  estado?: EstadoOrden
}

export async function crearOrden(payload: NuevaOrdenPayload): Promise<string> {
  const ahora = new Date()
  const ref = await addDoc(ordenesRef(), {
    ...payload,
    id: "",
    estado: payload.estado ?? ("pendiente" as const),
    creadoEn: ahora,
    actualizadoEn: ahora,
  })
  return ref.id
}

export async function listarOrdenes(): Promise<OrdenCompra[]> {
  const snap = await getDocs(
    query(ordenesRef(), orderBy("creadoEn", "desc"))
  )
  return snap.docs.map((d) => d.data())
}

export async function obtenerOrden(id: string): Promise<OrdenCompra | null> {
  const snap = await getDoc(
    doc(db, "ordenes", id).withConverter(ordenConverter)
  )
  return snap.exists() ? snap.data() : null
}

export async function actualizarOrden(
  id: string,
  cambios: Partial<Omit<OrdenCompra, "id" | "creadoEn">>
): Promise<void> {
  const ref = doc(db, "ordenes", id)
  // updateDoc no necesita converter; cast explícito para satisfacer UpdateData<DocumentData>
  await updateDoc(ref, {
    ...(cambios as Record<string, unknown>),
    actualizadoEn: Timestamp.fromDate(new Date()),
  })
}

export async function eliminarOrden(id: string): Promise<void> {
  await deleteDoc(doc(db, "ordenes", id))
}
