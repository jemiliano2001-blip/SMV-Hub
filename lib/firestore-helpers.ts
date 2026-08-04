import {
  doc,
  updateDoc,
  writeBatch,
  Timestamp,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  CollectionReference,
} from "firebase/firestore"
import { db } from "@/lib/firebase"

type WithTimestamps = { id: string; creadoEn: Date; actualizadoEn: Date }

const LOTE = 400 // margen bajo el límite de 500 de writeBatch

export function makeDateConverter<T extends WithTimestamps>(): FirestoreDataConverter<T> {
  return {
    toFirestore(entity) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, creadoEn, actualizadoEn, ...rest } = entity as T
      return {
        ...rest,
        creadoEn: Timestamp.fromDate(creadoEn),
        actualizadoEn: Timestamp.fromDate(actualizadoEn),
      }
    },
    fromFirestore(snap: QueryDocumentSnapshot) {
      const d = snap.data()
      return {
        ...d,
        id: snap.id,
        creadoEn: d.creadoEn instanceof Timestamp ? d.creadoEn.toDate() : new Date(),
        actualizadoEn: d.actualizadoEn instanceof Timestamp ? d.actualizadoEn.toDate() : new Date(),
      } as T
    },
  }
}

export async function crearLote<T>(
  colRef: () => CollectionReference<T>,
  payloads: Record<string, unknown>[],
  onProgreso?: (completadas: number, total: number) => void
): Promise<number> {
  let creadas = 0
  for (let i = 0; i < payloads.length; i += LOTE) {
    const grupo = payloads.slice(i, i + LOTE)
    const batch = writeBatch(db)
    const ahora = new Date()
    for (const payload of grupo) {
      const ref = doc(colRef())
      batch.set(ref, { ...payload, creadoEn: ahora, actualizadoEn: ahora } as unknown as T)
    }
    await batch.commit()
    creadas += grupo.length
    onProgreso?.(creadas, payloads.length)
  }
  return creadas
}

export async function eliminarLote(coleccion: string, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  let eliminadas = 0
  for (let i = 0; i < ids.length; i += LOTE) {
    const grupo = ids.slice(i, i + LOTE)
    const batch = writeBatch(db)
    for (const id of grupo) {
      batch.delete(doc(db, coleccion, id))
    }
    await batch.commit()
    eliminadas += grupo.length
  }
  return eliminadas
}

export async function actualizarDocumento(
  coleccion: string,
  id: string,
  cambios: Record<string, unknown>
): Promise<void> {
  await updateDoc(doc(db, coleccion, id), {
    ...cambios,
    actualizadoEn: Timestamp.fromDate(new Date()),
  })
}

export async function actualizarLote(
  coleccion: string,
  actualizaciones: Array<{ id: string; cambios: Record<string, unknown> }>,
  onProgreso?: (completadas: number, total: number) => void
): Promise<number> {
  if (actualizaciones.length === 0) return 0
  let actualizadas = 0
  const ahora = Timestamp.fromDate(new Date())
  for (let i = 0; i < actualizaciones.length; i += LOTE) {
    const grupo = actualizaciones.slice(i, i + LOTE)
    const batch = writeBatch(db)
    for (const { id, cambios } of grupo) {
      batch.update(doc(db, coleccion, id), { ...cambios, actualizadoEn: ahora })
    }
    await batch.commit()
    actualizadas += grupo.length
    onProgreso?.(actualizadas, actualizaciones.length)
  }
  return actualizadas
}

/** Convierte Timestamp / Date / string a ISO string. Fuente única (antes copiada en 3 archivos). */
export function formatearFecha(fecha: unknown): string {
  if (!fecha) return new Date().toISOString()
  if (fecha instanceof Timestamp) return fecha.toDate().toISOString()
  if (fecha instanceof Date) return fecha.toISOString()
  return String(fecha)
}
