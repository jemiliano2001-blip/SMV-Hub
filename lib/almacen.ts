import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { EntradaAlmacen, SalidaAlmacen } from "@/lib/schemas"
import { makeDateConverter, actualizarDocumento } from "@/lib/firestore-helpers"

// ── Entradas ────────────────────────────────────────────────────────────

const entradaConverter = makeDateConverter<EntradaAlmacen>()
const entradasRef = () => collection(db, "almacen-entradas").withConverter(entradaConverter)

export type NuevaEntradaPayload = Omit<EntradaAlmacen, "id" | "creadoEn" | "actualizadoEn">

export async function listarEntradas(): Promise<EntradaAlmacen[]> {
  const snap = await getDocs(query(entradasRef(), orderBy("fecha", "desc"), orderBy("creadoEn", "desc")))
  return snap.docs.map((d) => d.data())
}

export async function crearEntrada(payload: NuevaEntradaPayload): Promise<string> {
  const ahora = new Date()
  const ref = await addDoc(entradasRef(), {
    ...payload,
    creadoEn: ahora,
    actualizadoEn: ahora,
  } as EntradaAlmacen)
  return ref.id
}

export async function actualizarEntrada(
  id: string,
  cambios: Partial<Omit<EntradaAlmacen, "id" | "creadoEn">>
): Promise<void> {
  await actualizarDocumento("almacen-entradas", id, cambios as Record<string, unknown>)
}

export async function eliminarEntrada(id: string): Promise<void> {
  await deleteDoc(doc(db, "almacen-entradas", id))
}

// ── Salidas ─────────────────────────────────────────────────────────────

const salidaConverter = makeDateConverter<SalidaAlmacen>()
const salidasRef = () => collection(db, "almacen-salidas").withConverter(salidaConverter)

export type NuevaSalidaPayload = Omit<SalidaAlmacen, "id" | "creadoEn" | "actualizadoEn">

export async function listarSalidas(): Promise<SalidaAlmacen[]> {
  const snap = await getDocs(query(salidasRef(), orderBy("fecha", "desc"), orderBy("creadoEn", "desc")))
  return snap.docs.map((d) => d.data())
}

export async function crearSalida(payload: NuevaSalidaPayload): Promise<string> {
  const ahora = new Date()
  const ref = await addDoc(salidasRef(), {
    ...payload,
    creadoEn: ahora,
    actualizadoEn: ahora,
  } as SalidaAlmacen)
  return ref.id
}

export async function actualizarSalida(
  id: string,
  cambios: Partial<Omit<SalidaAlmacen, "id" | "creadoEn">>
): Promise<void> {
  await actualizarDocumento("almacen-salidas", id, cambios as Record<string, unknown>)
}

export async function eliminarSalida(id: string): Promise<void> {
  await deleteDoc(doc(db, "almacen-salidas", id))
}
