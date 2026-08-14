import { collection, doc, getDocs, orderBy, query, setDoc } from "firebase/firestore"
import type { GafeteAjusteFoto, GafetePerfil } from "@/lib/schemas"
import { db, getClienteAuth } from "@/lib/firebase"
import { registrarAuditoria } from "@/lib/auditoria"
import { makeDateConverter } from "@/lib/firestore-helpers"

export const MEDIDAS_GAFETE_PULGADAS = {
  ancho: 2.462,
  alto: 3.802,
  porHoja: 4,
} as const

export const AJUSTE_FOTO_INICIAL: GafeteAjusteFoto = {
  rotacion: 0,
  zoom: 1,
  desplazamientoX: 0,
  desplazamientoY: 0,
}

/**
 * Datos institucionales impresos en todos los gafetes. Se mantienen fuera del
 * perfil individual para que una corrección aplique a todo el personal.
 */
export const DATOS_TALLER_GAFETES = {
  domicilio: "Calle: 7 de Diciembre #128 · Col. México Agrario · H. Matamoros, Tamaulipas, México · C.P. 87440",
  responsableNombre: "Ing. Antonio Vázquez Vicencio",
  responsablePuesto: "Gerente de Ingeniería / Ventas",
  responsableTelefono: "8681001683",
} as const

export type GafetePerfilPayload = Omit<GafetePerfil, "id" | "creadoEn" | "actualizadoEn">

const gafetesRef = () => collection(db, "gafetes").withConverter(makeDateConverter<GafetePerfil>())

type AjusteFotoEntrada = {
  rotacion?: number
  zoom?: number
  desplazamientoX?: number
  desplazamientoY?: number
}

export function normalizarAjusteFoto(ajuste?: AjusteFotoEntrada | null): GafeteAjusteFoto {
  const rotacionEntrada = Number(ajuste?.rotacion ?? 0)
  const rotacion = ((Math.round(rotacionEntrada / 90) * 90) % 360 + 360) % 360
  const limitar = (valor: number, min: number, max: number) => Math.min(max, Math.max(min, valor))

  return {
    rotacion: [0, 90, 180, 270].includes(rotacion) ? rotacion as GafeteAjusteFoto["rotacion"] : 0,
    zoom: limitar(Number(ajuste?.zoom ?? 1) || 1, 0.75, 2.5),
    desplazamientoX: limitar(Number(ajuste?.desplazamientoX ?? 0) || 0, -50, 50),
    desplazamientoY: limitar(Number(ajuste?.desplazamientoY ?? 0) || 0, -50, 50),
  }
}

export function estaCompletoGafete(perfil: GafetePerfil | null | undefined): perfil is GafetePerfil {
  if (!perfil) return false
  return [
    perfil.cargo,
    perfil.fechaIngreso,
    perfil.nss,
    perfil.rfc,
    perfil.fotoPath,
  ].every((valor) => valor.trim().length > 0)
}

/** Agrupa el mismo orden de frentes y reversos en hojas de cuatro gafetes. */
export function agruparGafetesParaImpresion<T>(gafetes: readonly T[]): T[][] {
  const hojas: T[][] = []
  for (let indice = 0; indice < gafetes.length; indice += MEDIDAS_GAFETE_PULGADAS.porHoja) {
    hojas.push(gafetes.slice(indice, indice + MEDIDAS_GAFETE_PULGADAS.porHoja))
  }
  return hojas
}

export async function listarGafetes(): Promise<GafetePerfil[]> {
  const snap = await getDocs(query(gafetesRef(), orderBy("operadorId", "asc")))
  return snap.docs.map((item) => item.data())
}

export async function guardarGafete(
  payload: GafetePerfilPayload,
  creadoEnExistente?: Date
): Promise<void> {
  const ahora = new Date()
  const perfil: GafetePerfil = {
    ...payload,
    fotoAjuste: normalizarAjusteFoto(payload.fotoAjuste),
    id: payload.operadorId,
    creadoEn: creadoEnExistente ?? ahora,
    actualizadoEn: ahora,
  }

  await setDoc(doc(gafetesRef(), payload.operadorId), perfil)
  await registrarAuditoria(
    getClienteAuth().currentUser?.email,
    creadoEnExistente ? "EDITAR" : "CREAR",
    "gafetes",
    payload.operadorId,
    `${creadoEnExistente ? "Actualizó" : "Creó"} gafete de personal`
  )
}
