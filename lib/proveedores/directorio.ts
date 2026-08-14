import type { CategoriaProveedor, Proveedor } from "@/lib/schemas"

export type MercadoProveedor = "usa" | "mexico"
export type OrdenamientoProveedor = "nombre" | "calificacion" | "leadTime" | "barato" | "prioridad" | "habitual"
export type CategoriaFiltroProveedor = CategoriaProveedor | "todas"

export interface FiltrosDirectorioProveedor {
  busqueda: string
  categoria: CategoriaFiltroProveedor
  orden: OrdenamientoProveedor
}

function textoBuscable(proveedor: Proveedor): string {
  return [
    proveedor.nombre,
    proveedor.contacto,
    proveedor.email,
    proveedor.brokerAduanal,
    proveedor.shippingAddressUSA,
    proveedor.notas,
    proveedor.experienciaCompra,
    proveedor.ubicacion,
    ...proveedor.marcas,
  ]
    .filter(Boolean)
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
}

export function filtrarOrdenarDirectorio(
  proveedores: Proveedor[],
  filtros: FiltrosDirectorioProveedor
): Proveedor[] {
  const termino = filtros.busqueda
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")

  const resultado = proveedores.filter((proveedor) => {
    if (filtros.categoria !== "todas" && !proveedor.categorias.includes(filtros.categoria)) {
      return false
    }
    return !termino || textoBuscable(proveedor).includes(termino)
  })

  return resultado.sort((a, b) => {
    if (filtros.orden === "nombre") return a.nombre.localeCompare(b.nombre, "es-MX")
    if (filtros.orden === "calificacion") return (b.calificacion ?? 0) - (a.calificacion ?? 0)
    if (filtros.orden === "leadTime") return (a.leadTimeDias ?? Number.MAX_SAFE_INTEGER) - (b.leadTimeDias ?? Number.MAX_SAFE_INTEGER)
    if (filtros.orden === "barato") {
      return a.barato === b.barato ? a.nombre.localeCompare(b.nombre, "es-MX") : a.barato ? -1 : 1
    }
    if (filtros.orden === "habitual") {
      const ordenesA = a.ordenesOdoo ?? 0
      const ordenesB = b.ordenesOdoo ?? 0
      const aHabitual = ordenesA > 0
      const bHabitual = ordenesB > 0
      if (aHabitual !== bHabitual) return aHabitual ? -1 : 1
      if (aHabitual && ordenesA !== ordenesB) return ordenesB - ordenesA
      return a.nombre.localeCompare(b.nombre, "es-MX")
    }
    const prioridad = { alta: 3, media: 2, baja: 1 }
    return prioridad[b.prioridad] - prioridad[a.prioridad]
  })
}

export function requiereCatalogoCompleto(filtros: FiltrosDirectorioProveedor): boolean {
  return Boolean(filtros.busqueda.trim()) || filtros.categoria !== "todas" || filtros.orden !== "nombre"
}
