import {
  collection,
  doc,
  getDocs,
  query,
  orderBy,
  limit,
  writeBatch,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { getClienteAuth } from "@/lib/firebase"

export type ReporteContableLote = {
  id: string
  fechaGeneracion: Date
  creadoPor: string
  totalLineas: number
}

const lotesRef = collection(db, "reportes_contables")

export async function listarLotesContables(): Promise<ReporteContableLote[]> {
  const q = query(lotesRef, orderBy("fechaGeneracion", "desc"), limit(50))
  const snap = await getDocs(q)
  
  return snap.docs.map(d => {
    const data = d.data()
    return {
      id: d.id,
      fechaGeneracion: data.fechaGeneracion?.toDate ? data.fechaGeneracion.toDate() : new Date(data.fechaGeneracion),
      creadoPor: data.creadoPor || "",
      totalLineas: data.totalLineas || 0,
    }
  })
}

export async function crearLoteContable(ordenesIds: string[], totalLineas: number): Promise<string> {
  if (!ordenesIds.length) throw new Error("No hay órdenes para cerrar")
  
  const user = getClienteAuth().currentUser
  const creadoPor = user?.email || "desconocido"
  
  // Generar ID de lote (ej: "LOTE-20260713-1234")
  const hoy = new Date()
  const fechaStr = hoy.toISOString().split("T")[0].replace(/-/g, "")
  const idRandom = Math.random().toString(36).substring(2, 6).toUpperCase()
  const loteId = `LOTE-${fechaStr}-${idRandom}`
  
  // 1. Guardar el documento del lote
  const batch = writeBatch(db)
  const nuevoLoteRef = doc(lotesRef, loteId)
  
  batch.set(nuevoLoteRef, {
    fechaGeneracion: hoy,
    creadoPor,
    totalLineas
  })
  
  // 2. Actualizar todas las órdenes para asignarles este loteId
  // Firebase limit for batch is 500 operations. We'll assume < 499 orders for a single batch report.
  if (ordenesIds.length >= 499) {
    throw new Error("Demasiadas órdenes para un solo lote (> 499)")
  }
  
  for (const id of ordenesIds) {
    const ordenRef = doc(db, "ordenes", id)
    batch.update(ordenRef, {
      reporteContableId: loteId,
      actualizadoEn: hoy
    })
  }
  
  await batch.commit()
  return loteId
}
