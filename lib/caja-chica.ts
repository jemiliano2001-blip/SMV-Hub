import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  doc,
  query,
  orderBy,
  where,
  serverTimestamp,
} from "firebase/firestore"
import { db, getClienteAuth } from "@/lib/firebase"
import type { MovimientoCajaChica } from "@/lib/schemas"
import { makeDateConverter, actualizarDocumento } from "@/lib/firestore-helpers"
import { registrarAuditoria } from "@/lib/auditoria"

const movimientoConverter = makeDateConverter<MovimientoCajaChica>()
const cajaChicaRef = () => collection(db, "caja_chica_movimientos").withConverter(movimientoConverter)

const COLECCION_CONFIG = "caja_chica_config"
const DOC_FONDO_FIJO = "fondo_fijo"
const COLECCION_ARQUEOS = "caja_chica_arqueos"

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
  return snap.docs.map((d) => d.data()).filter((m) => !m.anulado)
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

// Soft delete: preserva el registro (trazabilidad de movimientos de dinero real)
// en vez de un borrado duro. `listarMovimientosCajaChica` ya filtra los anulados.
export async function eliminarMovimientoCajaChica(id: string): Promise<void> {
  await actualizarDocumento("caja_chica_movimientos", id, { anulado: true })
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "BORRAR", "caja_chica_movimientos", id, "Anuló movimiento de caja chica")
}

// ── Fondo fijo (compartido en Firestore, ya no solo en localStorage del navegador) ──

export async function obtenerFondoFijoCajaChica(): Promise<number> {
  const snap = await getDoc(doc(db, COLECCION_CONFIG, DOC_FONDO_FIJO))
  if (!snap.exists()) return 0
  const valor = snap.data().fondoFijo
  return typeof valor === "number" && valor >= 0 ? valor : 0
}

export async function guardarFondoFijoCajaChica(valor: number): Promise<void> {
  if (!(valor >= 0) || !Number.isFinite(valor)) {
    throw new Error("El fondo fijo debe ser un número no negativo.")
  }
  await setDoc(doc(db, COLECCION_CONFIG, DOC_FONDO_FIJO), {
    fondoFijo: valor,
    actualizadoEn: serverTimestamp(),
  })
  const user = getClienteAuth().currentUser
  await registrarAuditoria(user?.email, "EDITAR", COLECCION_CONFIG, DOC_FONDO_FIJO, `Actualizó el fondo fijo de caja chica a $${valor}`)
}

// ── Arqueos de caja (conteo físico vs saldo teórico) ─────────────────────────

export type NuevoArqueoCajaPayload = {
  periodo: string
  efectivoFisico: number
  saldoTeorico: number
  diferencia: number
  nota?: string
}

export type ArqueoCaja = NuevoArqueoCajaPayload & {
  id: string
  creadoEn: Date
  creadoPor: string
}

export async function crearArqueoCaja(payload: NuevoArqueoCajaPayload): Promise<string> {
  const user = getClienteAuth().currentUser
  const ref = await addDoc(collection(db, COLECCION_ARQUEOS), {
    ...payload,
    creadoEn: serverTimestamp(),
    creadoPor: user?.email ?? "desconocido",
  })
  await registrarAuditoria(
    user?.email,
    "CREAR",
    COLECCION_ARQUEOS,
    ref.id,
    `Registró arqueo de caja chica: físico $${payload.efectivoFisico} vs teórico $${payload.saldoTeorico} (diferencia $${payload.diferencia})`
  )
  return ref.id
}

export async function listarArqueosCaja(periodo?: string): Promise<ArqueoCaja[]> {
  const ref = collection(db, COLECCION_ARQUEOS)
  const q = periodo
    ? query(ref, where("periodo", "==", periodo), orderBy("creadoEn", "desc"))
    : query(ref, orderBy("creadoEn", "desc"))
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      periodo: data.periodo,
      efectivoFisico: data.efectivoFisico,
      saldoTeorico: data.saldoTeorico,
      diferencia: data.diferencia,
      nota: data.nota,
      creadoPor: data.creadoPor,
      creadoEn: data.creadoEn?.toDate?.() ?? new Date(),
    } as ArqueoCaja
  })
}
