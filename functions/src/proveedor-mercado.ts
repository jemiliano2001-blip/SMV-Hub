/**
 * Regla única para `mercado` y `origenProveedor` cuando el documento del proveedor no los trae
 * persistidos (frente B, B4). Antes esta inferencia vivía solo en `lib/proveedores.ts` al leer,
 * así que todo lo que leía el documento crudo — el indexador semántico, el sync de Odoo, los
 * scripts — no la conocía: 101 de 104 proveedores aparecían "sin mercado" fuera de la UI.
 *
 * Copia espejo en `functions/src/proveedor-mercado.ts` — deben ser idénticas
 * (`tests/proveedor-mercado.test.ts` compara ambos archivos byte a byte).
 */

export type MercadoProveedor = "usa" | "mexico"
export type OrigenProveedor = "semilla" | "manual" | "odoo"

type DocProveedorMinimo = {
  mercado?: unknown
  origenProveedor?: unknown
  odooPartnerId?: unknown
}

function esMercado(v: unknown): v is MercadoProveedor {
  return v === "usa" || v === "mexico"
}

function esOrigen(v: unknown): v is OrigenProveedor {
  return v === "semilla" || v === "manual" || v === "odoo"
}

function vieneDeOdoo(doc: DocProveedorMinimo): boolean {
  return typeof doc.odooPartnerId === "number" && doc.odooPartnerId > 0
}

/**
 * Mercado efectivo: el persistido si es válido; si no, `mexico` cuando el proveedor viene de
 * Odoo (res.partner) y `usa` en cualquier otro caso. Decisión de Emiliano (2026-09-13): los
 * partners de Odoo que facturan en USD también son `mexico`.
 */
export function inferirMercadoProveedor(doc: DocProveedorMinimo): MercadoProveedor {
  if (esMercado(doc.mercado)) return doc.mercado
  return vieneDeOdoo(doc) ? "mexico" : "usa"
}

/** Origen efectivo: el persistido si es válido; si no, `odoo` con partner y `manual` sin él. */
export function inferirOrigenProveedor(doc: DocProveedorMinimo): OrigenProveedor {
  if (esOrigen(doc.origenProveedor)) return doc.origenProveedor
  return vieneDeOdoo(doc) ? "odoo" : "manual"
}

export type CambioMercadoProveedor = {
  id: string
  nombre: string
  /** Solo los campos que faltan; nunca se pisa un valor ya persistido. */
  cambios: { mercado?: MercadoProveedor; origenProveedor?: "odoo" }
  regla: "odoo→mexico" | "sin-odoo→usa"
}

export type PlanBackfillMercado = {
  cambios: CambioMercadoProveedor[]
  sinCambio: number
  total: number
}

/**
 * Plan del backfill: persistir lo que la regla ya infiere al leer. `origenProveedor` solo se
 * completa para los que vienen de Odoo (el resto se deja al fallback `manual` del lector: no hay
 * forma de distinguir semilla de manual a posteriori y no vale la pena adivinar).
 */
export function planBackfillMercado(
  docs: Array<{ id: string; nombre: string } & DocProveedorMinimo>
): PlanBackfillMercado {
  const cambios: CambioMercadoProveedor[] = []
  let sinCambio = 0
  for (const doc of docs) {
    const faltaMercado = !esMercado(doc.mercado)
    const faltaOrigenOdoo = vieneDeOdoo(doc) && !esOrigen(doc.origenProveedor)
    if (!faltaMercado && !faltaOrigenOdoo) {
      sinCambio++
      continue
    }
    const mercado = inferirMercadoProveedor(doc)
    cambios.push({
      id: doc.id,
      nombre: doc.nombre,
      cambios: {
        ...(faltaMercado ? { mercado } : {}),
        ...(faltaOrigenOdoo ? { origenProveedor: "odoo" as const } : {}),
      },
      regla: vieneDeOdoo(doc) ? "odoo→mexico" : "sin-odoo→usa",
    })
  }
  return { cambios, sinCambio, total: docs.length }
}

/**
 * Campos a completar en un proveedor existente que el sync de Odoo acaba de emparejar con un
 * `res.partner`: solo los que faltan. Para el sync el partner es un hecho, así que no depende de
 * que `odooPartnerId` ya esté en el documento.
 */
export function camposMercadoFaltantesOdoo(
  doc: DocProveedorMinimo
): { mercado?: "mexico"; origenProveedor?: "odoo" } {
  return {
    ...(esMercado(doc.mercado) ? {} : { mercado: "mexico" as const }),
    ...(esOrigen(doc.origenProveedor) ? {} : { origenProveedor: "odoo" as const }),
  }
}
