import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import {
  SeguimientoCobranzaInputSchema,
  SeguimientoCobranzaSchema,
  type SeguimientoCobranza,
  type SeguimientoCobranzaInput,
} from "@/lib/schemas"

const COLECCION = "finanzas_seguimiento"

type TimestampLike = { toDate: () => Date }

function esTimestampLike(valor: unknown): valor is TimestampLike {
  return (
    typeof valor === "object" &&
    valor !== null &&
    "toDate" in valor &&
    typeof valor.toDate === "function"
  )
}

/** Lee todo el seguimiento; el volumen esperado es una entrada por factura. */
export async function listarSeguimientosCobranza(): Promise<SeguimientoCobranza[]> {
  const snap = await getDocs(collection(db, COLECCION))
  return snap.docs.map((documento) => {
    const data = documento.data()
    return SeguimientoCobranzaSchema.parse({
      ...data,
      facturaId: documento.id,
      actualizadoEn: esTimestampLike(data.actualizadoEn)
        ? data.actualizadoEn.toDate()
        : data.actualizadoEn,
    })
  })
}

/**
 * Crea o reemplaza el seguimiento de una factura. La validación Zod ocurre
 * antes de tocar Firestore y la marca de tiempo se genera en esta frontera.
 */
export async function guardarSeguimientoCobranza(
  entrada: SeguimientoCobranzaInput
): Promise<SeguimientoCobranza> {
  const payload = SeguimientoCobranzaInputSchema.parse(entrada)
  const seguimiento = SeguimientoCobranzaSchema.parse({
    ...payload,
    actualizadoEn: new Date(),
  })

  await setDoc(doc(db, COLECCION, payload.facturaId), {
    ...seguimiento,
    actualizadoEn: serverTimestamp(),
  })

  return seguimiento
}

export async function eliminarSeguimientoCobranza(facturaId: string): Promise<void> {
  const id = SeguimientoCobranzaInputSchema.shape.facturaId.parse(facturaId)
  await deleteDoc(doc(db, COLECCION, id))
}
