import { getClienteAuth } from "@/lib/firebase"
import { normalizarClaveProdServ } from "@/lib/sat/normalizar"

/**
 * Validación de claves SAT **desde el cliente** sin cargar el catálogo.
 *
 * `lib/sat/validar-clave.ts` es la verdad en servidor, pero arrastra
 * `lib/sat/catalogo.ts` (10.5 MB de `data/sat/catalogo.json`) y es `server-only`;
 * importarlo desde un componente cliente mandaba ese JSON completo al navegador
 * en `/nueva-compra` y en los modales de `/ordenes`.
 *
 * Aquí el formato se revisa en local y la existencia se consulta en lote a
 * `POST /api/claves-sat/validar`. Los resultados se cachean en memoria por
 * sesión para que las comprobaciones síncronas de render (`claveSatConocida`)
 * respondan al instante, y las claves que ya llegan validadas por el servidor
 * (sugerencias IA, memoria operativa, alternativas del catálogo) se siembran
 * con `registrarClavesSatValidadas` sin gastar una petición.
 */

export type ClaveSatValidada = { clave: string; descripcion: string }

// Caché por sesión: clave normalizada → entrada si existe, null si el servidor
// confirmó que no está en el catálogo.
const conocidas = new Map<string, ClaveSatValidada | null>()
// Peticiones en vuelo por clave, para no repetir la misma consulta en paralelo.
const enVuelo = new Map<string, Promise<void>>()

/** Devuelve la clave en formato SAT (8 dígitos) o null. No consulta el catálogo. */
export function formatoClaveProdServ(value: string | null | undefined): string | null {
  return normalizarClaveProdServ(value)
}

/**
 * Comprobación síncrona contra la caché: `true`/`false` si ya se consultó, `null`
 * si aún no se sabe (o el valor no tiene formato de clave).
 */
export function claveSatConocida(value: string | null | undefined): boolean | null {
  const clave = normalizarClaveProdServ(value)
  if (!clave) return false
  if (!conocidas.has(clave)) return null
  return conocidas.get(clave) !== null
}

/** Descripción cacheada de una clave ya validada, o null. */
export function descripcionClaveSatConocida(value: string | null | undefined): string | null {
  const clave = normalizarClaveProdServ(value)
  return clave ? (conocidas.get(clave)?.descripcion ?? null) : null
}

/**
 * Siembra la caché con claves que el servidor ya validó contra el catálogo
 * (respuestas de `/api/sugerir-clave-sat`, `/api/claves-sat`, memoria operativa).
 */
export function registrarClavesSatValidadas(
  entradas: Iterable<{ clave: string | null | undefined; descripcion?: string | null } | string | null | undefined>
): void {
  for (const entrada of entradas) {
    const valor = typeof entrada === "string" || entrada == null ? entrada : entrada.clave
    const clave = normalizarClaveProdServ(valor)
    if (!clave) continue
    const descripcion = typeof entrada === "object" && entrada?.descripcion ? entrada.descripcion : ""
    const previa = conocidas.get(clave)
    // No pisar una descripción real con una vacía.
    if (previa && previa.descripcion && !descripcion) continue
    conocidas.set(clave, { clave, descripcion })
  }
}

/**
 * Valida en el catálogo (vía API) las claves que aún no estén cacheadas y
 * devuelve el conjunto de claves normalizadas que sí existen entre `valores`.
 *
 * Lanza si la API no responde: quien llama decide si bloquea o deja la clave
 * como pendiente. Nunca devuelve como válida una clave que el servidor no confirmó.
 */
export async function validarClavesSatEnCatalogo(
  valores: Iterable<string | null | undefined>
): Promise<Set<string>> {
  const claves = new Set<string>()
  for (const valor of valores) {
    const clave = normalizarClaveProdServ(valor)
    if (clave) claves.add(clave)
  }

  const pendientes = [...claves].filter((clave) => !conocidas.has(clave))
  if (pendientes.length > 0) {
    await consultarEnLote(pendientes)
  }

  const validas = new Set<string>()
  for (const clave of claves) {
    if (conocidas.get(clave)) validas.add(clave)
  }
  return validas
}

/** Atajo: valida un solo valor y devuelve la clave normalizada si existe. */
export async function validarClaveSatEnCatalogo(value: string | null | undefined): Promise<string | null> {
  const clave = normalizarClaveProdServ(value)
  if (!clave) return null
  const validas = await validarClavesSatEnCatalogo([clave])
  return validas.has(clave) ? clave : null
}

/** Sólo para pruebas: vacía la caché de la sesión. */
export function limpiarCacheClavesSat(): void {
  conocidas.clear()
  enVuelo.clear()
}

const MAX_CLAVES_POR_PETICION = 200

async function consultarEnLote(claves: string[]): Promise<void> {
  // Reutiliza peticiones en vuelo para las claves que ya se están consultando.
  const esperas: Promise<void>[] = []
  const nuevas: string[] = []
  for (const clave of claves) {
    const actual = enVuelo.get(clave)
    if (actual) esperas.push(actual)
    else nuevas.push(clave)
  }

  if (nuevas.length > 0) {
    for (let i = 0; i < nuevas.length; i += MAX_CLAVES_POR_PETICION) {
      const chunk = nuevas.slice(i, i + MAX_CLAVES_POR_PETICION)
      const peticion = consultarApi(chunk).finally(() => {
        for (const clave of chunk) enVuelo.delete(clave)
      })
      for (const clave of chunk) enVuelo.set(clave, peticion)
      esperas.push(peticion)
    }
  }

  await Promise.all(esperas)
}

async function consultarApi(claves: string[]): Promise<void> {
  const token = await getClienteAuth().currentUser?.getIdToken()
  const res = await fetch("/api/claves-sat/validar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ claves }),
  })
  if (!res.ok) {
    throw new Error(`No se pudieron validar las claves SAT (HTTP ${res.status})`)
  }
  const data = (await res.json()) as { validas?: ClaveSatValidada[] }
  const validas = new Map<string, ClaveSatValidada>()
  for (const entrada of data.validas ?? []) {
    if (entrada && typeof entrada.clave === "string") validas.set(entrada.clave, entrada)
  }
  for (const clave of claves) {
    conocidas.set(clave, validas.get(clave) ?? null)
  }
}
