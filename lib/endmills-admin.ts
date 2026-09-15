import { adminDb } from "@/lib/firebase-admin"
import { EndmillMedidaSchema, type EndmillMedida } from "@/lib/schemas"

const COLECCION_MEDIDAS = "endmills-medidas"

function aFecha(valor: unknown): Date {
  if (valor instanceof Date) return valor
  if (
    valor &&
    typeof valor === "object" &&
    "toDate" in valor &&
    typeof (valor as { toDate: unknown }).toDate === "function"
  ) {
    return (valor as { toDate: () => Date }).toDate()
  }
  return new Date()
}

/**
 * Lista el catálogo de medidas con Admin SDK.
 * Uso exclusivo en Route Handlers / server — el cliente SDK no tiene sesión
 * autenticada en el servidor y Firestore responde "Missing or insufficient permissions."
 */
export async function listarMedidasEndmillsAdmin(): Promise<EndmillMedida[]> {
  const snap = await adminDb.collection(COLECCION_MEDIDAS).orderBy("orden", "asc").get()
  return snap.docs.map((docSnap) => {
    const raw = docSnap.data()
    return EndmillMedidaSchema.parse({
      ...raw,
      id: docSnap.id,
      stockActualizadoEn: aFecha(raw.stockActualizadoEn),
      creadoEn: aFecha(raw.creadoEn),
      actualizadoEn: aFecha(raw.actualizadoEn),
    })
  })
}
