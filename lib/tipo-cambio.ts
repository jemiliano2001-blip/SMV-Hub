/**
 * Tipo de cambio configurable (USD ↔ MXN) para inteligencia de compras.
 * Reemplaza el hardcode MXN/20.0 del motor de recomendación.
 * Precisión financiera: nunca mezcla monedas; convierte solo para comparar.
 */

import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { db, getClienteAuth } from "@/lib/firebase"
import { TipoCambioConfigSchema, type TipoCambioConfig } from "@/lib/schemas"
import { registrarAuditoria } from "@/lib/auditoria"

export const TIPO_CAMBIO_DEFAULT_USD_MXN = 20.0
export const COLECCION_CONFIG = "config_sistema"
export const DOC_TIPO_CAMBIO = "tipo_cambio"

/** Convierte un monto a USD usando el tipo de cambio dado. */
export function aUSD(
  monto: number,
  moneda: "USD" | "MXN",
  usdToMxn: number = TIPO_CAMBIO_DEFAULT_USD_MXN
): number {
  if (moneda === "USD") return monto
  if (usdToMxn <= 0) return monto / TIPO_CAMBIO_DEFAULT_USD_MXN
  return monto / usdToMxn
}

/** Convierte un monto a MXN usando el tipo de cambio dado. */
export function aMXN(
  monto: number,
  moneda: "USD" | "MXN",
  usdToMxn: number = TIPO_CAMBIO_DEFAULT_USD_MXN
): number {
  if (moneda === "MXN") return monto
  if (usdToMxn <= 0) return monto * TIPO_CAMBIO_DEFAULT_USD_MXN
  return monto * usdToMxn
}

export async function obtenerTipoCambio(): Promise<TipoCambioConfig> {
  try {
    const snap = await getDoc(doc(db, COLECCION_CONFIG, DOC_TIPO_CAMBIO))
    if (snap.exists()) {
      const parsed = TipoCambioConfigSchema.safeParse({ id: "tipo_cambio", ...snap.data() })
      if (parsed.success) return parsed.data
    }
  } catch (err) {
    console.warn("No se pudo leer tipo de cambio; usando default:", err)
  }
  return {
    id: "tipo_cambio",
    usdToMxn: TIPO_CAMBIO_DEFAULT_USD_MXN,
    actualizadoEn: new Date().toISOString(),
    actualizadoPor: "sistema",
    nota: "Valor por defecto (no configurado en Firestore)",
  }
}

export async function guardarTipoCambio(
  usdToMxn: number,
  nota: string = ""
): Promise<TipoCambioConfig> {
  if (!(usdToMxn > 0) || !Number.isFinite(usdToMxn)) {
    throw new Error("El tipo de cambio debe ser un número positivo.")
  }
  const user = getClienteAuth().currentUser
  const config: TipoCambioConfig = {
    id: "tipo_cambio",
    usdToMxn,
    actualizadoEn: new Date().toISOString(),
    actualizadoPor: user?.email ?? "desconocido",
    nota,
  }
  const validated = TipoCambioConfigSchema.parse(config)
  await setDoc(doc(db, COLECCION_CONFIG, DOC_TIPO_CAMBIO), {
    ...validated,
    actualizadoEn: serverTimestamp(),
  })
  await registrarAuditoria(
    user?.email,
    "EDITAR",
    COLECCION_CONFIG,
    DOC_TIPO_CAMBIO,
    `Actualizó tipo de cambio a ${usdToMxn} MXN/USD. ${nota}`
  )
  return validated
}
