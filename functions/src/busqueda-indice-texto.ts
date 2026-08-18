import { createHash } from "node:crypto"

/**
 * Construcción de texto + hash por fuente para el índice de búsqueda semántica
 * (busqueda_indice). Lógica pura, sin Firebase — ver
 * docs/superpowers/specs/2026-08-17-busqueda-semantica-datos-reales.md.
 *
 * Tipos locales (no se importa lib/schemas.ts): functions/ se despliega como
 * paquete aislado de la app Next.js, mismo criterio que odoo-compras-mapeo.ts.
 * La forma debe coincidir estructuralmente con OrdenCompra/Proveedor de
 * lib/schemas.ts, pero sin acoplamiento de import entre los dos proyectos TS.
 */

export type FuenteBusquedaIndice = "orden-item" | "proveedor"

export interface EntradaBusquedaIndice {
  id: string
  fuente: FuenteBusquedaIndice
  refId: string
  refPath: string
  texto: string
  textoHash: string
  titulo: string
  metadata: {
    proveedorNombre?: string
    precio?: number
    moneda?: string
    fecha?: string
    ordenId?: string
    mercado?: string
    categorias?: string[]
  }
}

export interface OrdenParaIndice {
  id: string
  proveedor: string
  moneda: string
  fechaFactura: string | null
  items: Array<{
    descripcion: string
    descripcionSimplificada?: string
    precioUnitario: number | null
  }>
}

export interface ProveedorParaIndice {
  id: string
  nombre: string
  categorias: string[]
  marcas: string[]
  mercado?: string
}

export function calcularTextoHash(texto: string): string {
  return createHash("sha256").update(texto).digest("hex")
}

/** Una entrada por ítem de la orden. refId = "{ordenId}#{índice}" (estable mientras no se reordene el array). */
export function construirEntradasOrden(orden: OrdenParaIndice): EntradaBusquedaIndice[] {
  const entradas: EntradaBusquedaIndice[] = []

  orden.items.forEach((item, indice) => {
    const descripcion = item.descripcion?.trim() ?? ""
    // Ítem sin descripción no aporta nada que buscar (y "".includes(cualquier
    // cosa) es vacuamente cierto en otros lados del código — mismo guard que
    // A1 en documentos-venta-lector-ia.ts, por la misma razón).
    if (!descripcion) return

    const descSimplificada = item.descripcionSimplificada?.trim() ?? ""
    const proveedor = orden.proveedor?.trim() ?? ""

    const texto = [
      descripcion,
      descSimplificada && descSimplificada !== descripcion ? descSimplificada : null,
      proveedor ? `Proveedor: ${proveedor}.` : null,
    ]
      .filter(Boolean)
      .join(". ")

    const refId = `${orden.id}#${indice}`

    entradas.push({
      id: refId,
      fuente: "orden-item",
      refId,
      refPath: `/ordenes?id=${orden.id}`,
      texto,
      textoHash: calcularTextoHash(texto),
      titulo: descripcion,
      // Claves ausentes, no presentes-con-undefined: el Admin SDK de Firestore
      // truena al escribir un campo `undefined` (ignoreUndefinedProperties no
      // está activado en getDb()), y precioUnitario/fechaFactura/proveedor
      // vienen vacíos con frecuencia en datos reales.
      metadata: {
        ...(proveedor ? { proveedorNombre: proveedor } : {}),
        ...(item.precioUnitario != null ? { precio: item.precioUnitario } : {}),
        ...(orden.moneda ? { moneda: orden.moneda } : {}),
        ...(orden.fechaFactura ? { fecha: orden.fechaFactura } : {}),
        ordenId: orden.id,
      },
    })
  })

  return entradas
}

/** Texto compacto a propósito (nombre + categorías + marcas, sin relleno): en la
 * prueba de calidad de Fase 0 (búsqueda #8), filas de proveedor con texto largo
 * le ganaban el ranking a compras reales del mismo rubro. */
export function construirEntradaProveedor(proveedor: ProveedorParaIndice): EntradaBusquedaIndice | null {
  const nombre = proveedor.nombre?.trim() ?? ""
  if (!nombre) return null

  const categorias = (proveedor.categorias ?? []).filter(Boolean)
  const marcas = (proveedor.marcas ?? []).filter(Boolean)

  const texto = [
    nombre,
    categorias.length > 0 ? `Categorías: ${categorias.join(", ")}.` : null,
    marcas.length > 0 ? `Marcas: ${marcas.join(", ")}.` : null,
  ]
    .filter(Boolean)
    .join(" ")

  return {
    id: proveedor.id,
    fuente: "proveedor",
    refId: proveedor.id,
    refPath: `/proveedores?id=${proveedor.id}`,
    texto,
    textoHash: calcularTextoHash(texto),
    titulo: nombre,
    metadata: {
      ...(proveedor.mercado ? { mercado: proveedor.mercado } : {}),
      ...(categorias.length > 0 ? { categorias } : {}),
    },
  }
}
