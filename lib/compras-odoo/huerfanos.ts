/** IDs en Firestore que ya no están en el set vigente de Odoo. */
export function idsHuerfanosCompras(idsExistentes: string[], idsActuales: string[]): string[] {
  const actuales = new Set(idsActuales)
  return idsExistentes.filter((id) => !actuales.has(id))
}
