import { collection, doc, getDoc, getDocs, query, orderBy, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { FacturaCliente } from "@/lib/schemas"
import { makeDateConverter } from "@/lib/firestore-helpers"

export type EstadoSyncFinanzas = {
  ultimaCorridaEn: Date | null
  ultimoError: string | null
}

// Espejo de solo lectura: el Cloud Function de sync es el único que escribe
// aquí (Admin SDK). No hay crear/actualizar/borrar desde el cliente.
const facturaConverter = makeDateConverter<FacturaCliente>()
const facturasRef = () => collection(db, "finanzas_facturas").withConverter(facturaConverter)

export async function listarFacturas(): Promise<FacturaCliente[]> {
  const snap = await getDocs(query(facturasRef(), orderBy("fechaFactura", "desc")))
  return snap.docs.map((d) => d.data())
}

export async function listarFacturasPorPeriodo(desde: string, hasta: string): Promise<FacturaCliente[]> {
  // desde/hasta en formato YYYY-MM-DD — comparación lexicográfica válida para ISO.
  const q = query(
    facturasRef(),
    where("fechaFactura", ">=", desde),
    where("fechaFactura", "<=", hasta),
    orderBy("fechaFactura", "desc")
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => d.data())
}

export async function obtenerEstadoSync(): Promise<EstadoSyncFinanzas> {
  const snap = await getDoc(doc(db, "finanzas_sync_state", "odoo"))
  if (!snap.exists()) return { ultimaCorridaEn: null, ultimoError: null }
  const data = snap.data()
  const ultimaCorridaEn = data.ultimaCorridaEn?.toDate ? data.ultimaCorridaEn.toDate() : null
  return { ultimaCorridaEn, ultimoError: data.ultimoError ?? null }
}
