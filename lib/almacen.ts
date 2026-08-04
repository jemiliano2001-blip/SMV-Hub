import { orderBy } from "firebase/firestore"
import type { EntradaAlmacen, SalidaAlmacen } from "@/lib/schemas"
import { crearRepositorio } from "@/lib/repositorio"

// ── Entradas ────────────────────────────────────────────────────────────

const repoEntradas = crearRepositorio<EntradaAlmacen>({ coleccion: "almacen-entradas" })

export type NuevaEntradaPayload = Omit<EntradaAlmacen, "id" | "creadoEn" | "actualizadoEn">

export async function listarEntradas(): Promise<EntradaAlmacen[]> {
  return repoEntradas.listar([orderBy("fecha", "desc"), orderBy("creadoEn", "desc")])
}

export async function crearEntrada(payload: NuevaEntradaPayload): Promise<string> {
  return repoEntradas.crear(payload, `Registró entrada de almacén: ${payload.descripcion}`)
}

export async function actualizarEntrada(
  id: string,
  cambios: Partial<Omit<EntradaAlmacen, "id" | "creadoEn">>
): Promise<void> {
  await repoEntradas.actualizar(id, cambios, `Actualizó entrada de almacén: ${Object.keys(cambios).join(', ')}`)
}

export async function eliminarEntrada(id: string): Promise<void> {
  await repoEntradas.eliminar(id, "Eliminó entrada de almacén")
}

// ── Salidas ─────────────────────────────────────────────────────────────

const repoSalidas = crearRepositorio<SalidaAlmacen>({ coleccion: "almacen-salidas" })

export type NuevaSalidaPayload = Omit<SalidaAlmacen, "id" | "creadoEn" | "actualizadoEn">

export async function listarSalidas(): Promise<SalidaAlmacen[]> {
  return repoSalidas.listar([orderBy("fecha", "desc"), orderBy("creadoEn", "desc")])
}

export async function crearSalida(payload: NuevaSalidaPayload): Promise<string> {
  return repoSalidas.crear(
    payload,
    `Registró salida de almacén: ${payload.cantidad}x ${payload.herramienta} para ${payload.operador}`
  )
}

export async function actualizarSalida(
  id: string,
  cambios: Partial<Omit<SalidaAlmacen, "id" | "creadoEn">>
): Promise<void> {
  await repoSalidas.actualizar(id, cambios, `Actualizó salida de almacén: ${Object.keys(cambios).join(', ')}`)
}

export async function eliminarSalida(id: string): Promise<void> {
  await repoSalidas.eliminar(id, "Eliminó salida de almacén")
}
