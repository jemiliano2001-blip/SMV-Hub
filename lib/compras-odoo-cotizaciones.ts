import {
  orderBy,
  limit,
  type QueryConstraint,
} from "firebase/firestore"
import type { RegistroCotizacionOdoo } from "@/lib/schemas"
import { crearRepositorio } from "@/lib/repositorio"

const repo = crearRepositorio<RegistroCotizacionOdoo>({ coleccion: "compras_odoo" })

export async function listarCotizacionesOdoo(
  limiteRegistros = 100
): Promise<RegistroCotizacionOdoo[]> {
  const restricciones: QueryConstraint[] = [
    orderBy("creadoEn", "desc"),
    limit(limiteRegistros),
  ]
  const items = await repo.listar(restricciones)
  return items
}
