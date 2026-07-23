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
import { db, getClienteAuth } from "@/lib/firebase"
import type { MovimientoCajaChica } from "@/lib/schemas"
import { makeDateConverter, actualizarDocumento } from "@/lib/firestore-helpers"
import { registrarAuditoria } from "@/lib/auditoria"

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

  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "CREAR", "caja_chica_movimientos", ref.id, `Registró movimiento de caja chica (${payload.tipo}): $${payload.monto} - ${payload.descripcion}`)

  return ref.id
}

export async function actualizarMovimientoCajaChica(
  id: string,
  cambios: Partial<Omit<MovimientoCajaChica, "id" | "creadoEn">>
): Promise<void> {
  await actualizarDocumento("caja_chica_movimientos", id, cambios as Record<string, unknown>)
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "EDITAR", "caja_chica_movimientos", id, `Actualizó movimiento de caja chica: ${Object.keys(cambios).join(', ')}`)
}

export async function eliminarMovimientoCajaChica(id: string): Promise<void> {
  await deleteDoc(doc(db, "caja_chica_movimientos", id))
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "BORRAR", "caja_chica_movimientos", id, "Eliminó movimiento de caja chica")
}
