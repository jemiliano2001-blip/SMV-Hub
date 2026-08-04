import { orderBy } from "firebase/firestore"
import type { Operador } from "@/lib/schemas"
import { crearRepositorio } from "@/lib/repositorio"

const repo = crearRepositorio<Operador>({ coleccion: "operadores" })

export type NuevoOperadorPayload = Omit<Operador, "id" | "creadoEn" | "actualizadoEn">

export async function listarOperadores(): Promise<Operador[]> {
  return repo.listar([orderBy("nombre", "asc")])
}

export async function crearOperador(payload: NuevoOperadorPayload): Promise<string> {
  return repo.crear(payload, `Creó operador: ${payload.nombre} (${payload.area})`)
}

export async function actualizarOperador(
  id: string,
  cambios: Partial<Omit<Operador, "id" | "creadoEn">>
): Promise<void> {
  await repo.actualizar(id, cambios, `Actualizó operador: ${Object.keys(cambios).join(', ')}`)
}

export async function eliminarOperador(id: string): Promise<void> {
  await repo.eliminar(id, "Eliminó operador")
}
