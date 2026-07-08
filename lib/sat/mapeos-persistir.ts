import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { construirEntradaMapeoSmv } from "@/lib/sat/historial-sat"
import type { MapeoSmvEntry } from "@/lib/sat/types"
import { getClienteAuth } from "@/lib/firebase"
import { registrarAuditoria } from "@/lib/auditoria"

export type AsignacionSatValidada = {
  descripcion: string
  claveProdServ: string
  validadoPor?: string
}

/** Persiste asignaciones validadas por el usuario para aprendizaje futuro. */
export async function guardarAsignacionesSatValidadas(
  asignaciones: AsignacionSatValidada[]
): Promise<number> {
  let guardadas = 0
  for (const asignacion of asignaciones) {
    const entrada = construirEntradaMapeoSmv(asignacion.descripcion, asignacion.claveProdServ)
    if (!entrada) continue

    const id = entrada.sku
      ? `sku-${entrada.sku.toLowerCase()}`
      : `tok-${entrada.tokensNormalizados.slice(0, 4).join("-") || "gen"}`

    const ref = doc(collection(db, "sat_asignaciones"), id)
    await setDoc(
      ref,
      {
        ...entrada,
        validadoPor: asignacion.validadoPor ?? null,
        validadoEn: serverTimestamp(),
      },
      { merge: true }
    )
    guardadas++
  }
  
  if (guardadas > 0) {
    const user = getClienteAuth().currentUser
    await registrarAuditoria(user?.email, 'CREAR', 'sat_asignaciones', 'LOTE', `Validó ${guardadas} asignaciones SAT`)
  }
  
  return guardadas
}

export function mapeoDesdeFirestore(data: Record<string, unknown>): MapeoSmvEntry | null {
  const clave = typeof data.claveProdServ === "string" ? data.claveProdServ : null
  const tokens = Array.isArray(data.tokensNormalizados)
    ? data.tokensNormalizados.filter((t): t is string => typeof t === "string")
    : []
  const ejemplo = typeof data.descripcionEjemplo === "string" ? data.descripcionEjemplo : ""
  if (!clave || !/^\d{8}$/.test(clave) || tokens.length === 0) return null
  return {
    tokensNormalizados: tokens,
    sku: typeof data.sku === "string" ? data.sku : null,
    claveProdServ: clave,
    descripcionEjemplo: ejemplo,
  }
}
