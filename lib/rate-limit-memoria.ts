// ponytail: Map en memoria del proceso, sin dependencia nueva. Se resetea en
// cold start — está bien para un tope de cortesía contra gasto de cuota de
// APIs externas, no para un límite de seguridad.
const LIMITE_POR_MINUTO = 20
const VENTANA_MS = 60_000
const peticionesPorClave = new Map<string, number[]>()

export function excedeLimite(clave: string): boolean {
  const ahora = Date.now()
  const marcas = (peticionesPorClave.get(clave) ?? []).filter((t) => ahora - t < VENTANA_MS)
  marcas.push(ahora)
  peticionesPorClave.set(clave, marcas)
  return marcas.length > LIMITE_POR_MINUTO
}
