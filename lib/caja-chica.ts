import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  where,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { MovimientoCajaChica } from "@/lib/schemas"
import { makeDateConverter, actualizarDocumento } from "@/lib/firestore-helpers"

const movimientoConverter = makeDateConverter<MovimientoCajaChica>()
const cajaChicaRef = () => collection(db, "caja_chica_movimientos").withConverter(movimientoConverter)

export type NuevoMovimientoCajaPayload = Omit<MovimientoCajaChica, "id" | "creadoEn" | "actualizadoEn">

export async function listarMovimientosCajaChica(periodo?: string): Promise<MovimientoCajaChica[]> {
  // periodo format: "YYYY-MM"
  let q = query(cajaChicaRef(), orderBy("fecha", "desc"), orderBy("creadoEn", "desc"))
  
  if (periodo) {
    q = query(
      cajaChicaRef(),
      where("periodo", "==", periodo),
      orderBy("fecha", "desc"),
      orderBy("creadoEn", "desc")
    )
  }
  
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data())
}

export async function crearMovimientoCajaChica(payload: NuevoMovimientoCajaPayload): Promise<string> {
  const ahora = new Date()
  const ref = await addDoc(cajaChicaRef(), {
    ...payload,
    creadoEn: ahora,
    actualizadoEn: ahora,
  } as MovimientoCajaChica)
  return ref.id
}

export async function actualizarMovimientoCajaChica(
  id: string,
  cambios: Partial<Omit<MovimientoCajaChica, "id" | "creadoEn">>
): Promise<void> {
  await actualizarDocumento("caja_chica_movimientos", id, cambios as Record<string, unknown>)
}

export async function eliminarMovimientoCajaChica(id: string): Promise<void> {
  await deleteDoc(doc(db, "caja_chica_movimientos", id))
}
