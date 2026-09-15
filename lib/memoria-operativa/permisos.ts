/**
 * Permisos por fuente del índice semántico — la única tabla fuente → módulo.
 *
 * La comparten `/api/busqueda-semantica` (Cmd+K) y `/api/memoria-operativa/consultar` para que
 * las dos rutas filtren exactamente igual **antes** de leer Firestore (criterio heredado del spec
 * 2026-08-17: quien no tiene el módulo no recibe esa fuente, ni siquiera en el fetch).
 * Ver docs/superpowers/specs/2026-09-13-memoria-operativa-design.md § Permisos.
 */

import type { FuenteBusquedaIndice, ModuloId } from "@/lib/schemas"

export interface PermisosUsuarioFuentes {
  esSuperAdmin: boolean
  modulos: readonly ModuloId[]
}

/** Módulo que habilita cada fuente. Super-admin ve todas. */
export const MODULO_POR_FUENTE: Record<FuenteBusquedaIndice, ModuloId> = {
  "orden-item": "ordenes",
  proveedor: "proveedores",
  cotizacion: "cotizaciones",
}

/** Orden estable (el de la tabla), para que las consultas `where in` y las cachés tengan la misma clave. */
const FUENTES_ORDENADAS = Object.keys(MODULO_POR_FUENTE) as FuenteBusquedaIndice[]

export function fuentesPermitidasPara(usuario: PermisosUsuarioFuentes): FuenteBusquedaIndice[] {
  if (usuario.esSuperAdmin) return [...FUENTES_ORDENADAS]
  return FUENTES_ORDENADAS.filter((fuente) => usuario.modulos.includes(MODULO_POR_FUENTE[fuente]))
}

/**
 * Quién ve montos en la memoria operativa (decisión #3 del plan del frente C): módulo `ordenes`
 * o `cotizaciones`. Almacén ve "comprado antes" sin precios, misma regla que *Por recibir*.
 */
export function puedeVerPrecios(usuario: PermisosUsuarioFuentes): boolean {
  if (usuario.esSuperAdmin) return true
  return usuario.modulos.includes("ordenes") || usuario.modulos.includes("cotizaciones")
}
