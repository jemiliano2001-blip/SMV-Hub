import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
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
  // El converter (toFirestore) descarta `id`; el id real es ref.id.
  const ref = await addDoc(ordenesRef(), {
    ...payload,
    estado: payload.estado ?? ("pendiente" as const),
    creadoEn: ahora,
    actualizadoEn: ahora,
  } as OrdenCompra)
  return ref.id
}

// Inserta muchas órdenes con writeBatch (atómico por lote, ≤500 escrituras).
// Reutilizado por la importación masiva (CSV y capturas).
export async function crearOrdenesLote(
  payloads: NuevaOrdenPayload[],
  onProgreso?: (completadas: number, total: number) => void
): Promise<number> {
  const LOTE = 400 // margen bajo el límite de 500 de writeBatch
  let creadas = 0

  for (let i = 0; i < payloads.length; i += LOTE) {
    const grupo = payloads.slice(i, i + LOTE)
    const batch = writeBatch(db)
    const ahora = new Date()
    for (const payload of grupo) {
      const ref = doc(ordenesRef()) // id autogenerado + converter heredado
      batch.set(ref, {
        ...payload,
        estado: payload.estado ?? ("pendiente" as const),
        creadoEn: ahora,
        actualizadoEn: ahora,
      } as OrdenCompra)
    }
    await batch.commit()
    creadas += grupo.length
    onProgreso?.(creadas, payloads.length)
  }

  return creadas
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

// Busca órdenes existentes por combinación numeroFactura+proveedor para deduplicación.
// Solo evalúa facturas con numeroFactura no nulo. Divide en chunks de 30 (límite Firestore `in`).
export async function buscarPorFacturaYProveedor(
  pares: Array<{ numeroFactura: string; proveedor: string }>
): Promise<Array<{ numeroFactura: string | null; proveedor: string }>> {
  if (pares.length === 0) return []

  const CHUNK = 30
  const resultados: Array<{ numeroFactura: string | null; proveedor: string }> = []

  for (let i = 0; i < pares.length; i += CHUNK) {
    const facturas = pares.slice(i, i + CHUNK).map(p => p.numeroFactura)
    const snap = await getDocs(
      query(collection(db, "ordenes"), where("numeroFactura", "in", facturas))
    )
    snap.docs.forEach(d => {
      const data = d.data() as { numeroFactura?: string | null; proveedor?: string }
      resultados.push({
        numeroFactura: data.numeroFactura ?? null,
        proveedor: data.proveedor ?? "",
      })
    })
  }

  return resultados
}
