/**
 * Llave estable para consolidar el mismo ítem entre PO y factura.
 */

export function normalizarTextoLlave(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "_")
}

export type LlaveItemInput = {
  descripcion: string
  medida?: string | null
  odooPartnerId?: number | null
  tipoMetal?: string | null
}

export function generarLlaveItem(input: LlaveItemInput): string {
  const partes = [
    normalizarTextoLlave(input.descripcion),
    input.tipoMetal ? normalizarTextoLlave(input.tipoMetal) : "",
    input.medida ? normalizarTextoLlave(input.medida) : "",
    input.odooPartnerId != null && input.odooPartnerId > 0
      ? `p${input.odooPartnerId}`
      : "",
  ].filter(Boolean)
  return partes.join("__") || "sin_descripcion"
}
