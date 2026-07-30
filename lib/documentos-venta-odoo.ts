import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { VentaOdooSo } from "@/lib/schemas"

const COLECCION_SO = "ventas_odoo_so"
const SYNC_STATE_DOC = "ventas_odoo_sync_state/latest"

export type EstadoSyncVentasOdoo = {
  ultimaSyncEn: Date | null
  filas: number
  error: string | null
}

const ventaSoConverter: FirestoreDataConverter<VentaOdooSo> = {
  toFirestore(entity: VentaOdooSo) {
    const { id: _id, sincronizadoEn, ...rest } = entity
    return {
      ...rest,
      sincronizadoEn: Timestamp.fromDate(sincronizadoEn),
    }
  },
  fromFirestore(snap: QueryDocumentSnapshot) {
    const d = snap.data()
    return {
      id: snap.id,
      odooId: d.odooId,
      name: d.name,
      clientOrderRef: d.clientOrderRef ?? null,
      partnerId: d.partnerId,
      partnerName: d.partnerName,
      dateOrder: d.dateOrder ?? null,
      state: d.state,
      invoiceStatus: d.invoiceStatus,
      lineas: d.lineas ?? [],
      remisiones: d.remisiones ?? [],
      sincronizadoEn:
        d.sincronizadoEn instanceof Timestamp ? d.sincronizadoEn.toDate() : new Date(),
    } as VentaOdooSo
  },
}

const ventasSoRef = () => collection(db, COLECCION_SO).withConverter(ventaSoConverter)

function parseEstadoSync(data: Record<string, unknown> | undefined): EstadoSyncVentasOdoo {
  if (!data) {
    return { ultimaSyncEn: null, filas: 0, error: null }
  }
  const ultimaSyncEn =
    data.ultimaSyncEn instanceof Timestamp
      ? data.ultimaSyncEn.toDate()
      : data.ultimaSyncEn &&
          typeof data.ultimaSyncEn === "object" &&
          "toDate" in data.ultimaSyncEn &&
          typeof data.ultimaSyncEn.toDate === "function"
        ? (data.ultimaSyncEn as Timestamp).toDate()
        : null
  return {
    ultimaSyncEn,
    filas: typeof data.filas === "number" ? data.filas : 0,
    error: typeof data.error === "string" ? data.error : null,
  }
}

export function suscribirVentasOdooSo(
  onData: (rows: VentaOdooSo[]) => void,
  onError: (e: Error) => void
): () => void {
  const q = query(ventasSoRef(), orderBy("name", "desc"))
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data()))
    },
    (err) => {
      console.error("Error en suscripción a ventas_odoo_so:", err)
      onError(err)
    }
  )
}

export function suscribirVentasOdooSyncState(
  onData: (state: EstadoSyncVentasOdoo) => void,
  onError: (e: Error) => void
): () => void {
  const ref = doc(db, "ventas_odoo_sync_state", "latest")
  return onSnapshot(
    ref,
    (snap) => {
      onData(parseEstadoSync(snap.exists() ? snap.data() : undefined))
    },
    (err) => {
      console.error("Error en suscripción a ventas_odoo_sync_state:", err)
      onError(err)
    }
  )
}
