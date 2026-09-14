/**
 * Llave canónica de pieza para cruzar histórico /cotizaciones ↔
 * cotizaciones_requisicion ↔ cotizaciones_comparador ↔ compras_proveedores.
 *
 * Formato: "{numeroParteNormalizado}|{descripcionSimplificada}"
 * Si no hay número de parte: "|{descripcionSimplificada}"
 */

/** Normaliza texto: minúsculas, sin acentos, sin puntuación extra, espacios colapsados. */
export function normalizarTextoPieza(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Normaliza número de parte: mayúsculas, sin espacios ni guiones redundantes. */
export function normalizarNumeroParte(numeroParte: string | null | undefined): string {
  if (!numeroParte) return ""
  return numeroParte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .trim()
}

/**
 * Simplifica descripción para matching: quita medidas redundantes comunes,
 * unidades y palabras de relleno, deja tokens significativos.
 */
export function simplificarDescripcion(descripcion: string): string {
  const base = normalizarTextoPieza(descripcion)
  // Quitar unidades y ruido frecuente en tooling
  return base
    .replace(/\b(pza|pzas|pcs|pc|und|unidad|unidades|ea|each)\b/g, " ")
    .replace(/\b(end\s*mill|endmill|fresa|inserto|insert|tooling)\b/g, (m) =>
      m.replace(/\s+/g, "")
    )
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Genera la llave canónica de pieza.
 * Preferencia: numeroParte; si no hay, usa descripción simplificada.
 */
export function generarLlavePieza(
  numeroParte: string | null | undefined,
  descripcion: string
): string {
  const np = normalizarNumeroParte(numeroParte)
  const desc = simplificarDescripcion(descripcion)
  if (np) return `${np}|${desc}`
  return `|${desc}`
}

/** Extrae el número de parte de una llave (antes del `|`). */
export function numeroParteDeLlave(llave: string): string {
  const idx = llave.indexOf("|")
  return idx >= 0 ? llave.slice(0, idx) : llave
}

/** Extrae la descripción de una llave (después del `|`). */
export function descripcionDeLlave(llave: string): string {
  const idx = llave.indexOf("|")
  return idx >= 0 ? llave.slice(idx + 1) : ""
}

/**
 * Compara dos llaves: exacta, o por número de parte si ambas lo tienen,
 * o por inclusión de descripción si no hay número de parte.
 */
export function llavesCoinciden(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  const npA = numeroParteDeLlave(a)
  const npB = numeroParteDeLlave(b)
  if (npA && npB && npA === npB) return true
  const dA = descripcionDeLlave(a)
  const dB = descripcionDeLlave(b)
  if (!npA && !npB && dA && dB) {
    return dA.includes(dB) || dB.includes(dA)
  }
  return false
}

/** Normaliza nombre de proveedor para matching (case-insensitive, sin puntuación). */
export function normalizarNombreProveedor(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Proveedor mínimo para matching: nombre y, si existen, los alias con que aparece en facturas. */
export type ProveedorParaMatch = { id: string; nombre: string; aliases?: readonly string[] }

export type NivelMatchProveedor = "exacto" | "sugerido"

export type ResolucionProveedor<T extends ProveedorParaMatch> = {
  proveedor: T
  /**
   * `exacto`: el nombre normalizado coincide con el nombre o un alias de UN solo proveedor — se
   * puede vincular sin preguntar. `sugerido`: coincidencia parcial (empieza con / incluye) o alias
   * ambiguo entre varios proveedores — hay que confirmar con el usuario.
   */
  nivel: NivelMatchProveedor
}

/** Nombres normalizados (nombre + alias) de un proveedor, sin vacíos. */
function nombresNormalizados(p: ProveedorParaMatch): string[] {
  const todos = [p.nombre, ...(p.aliases ?? [])].map(normalizarNombreProveedor).filter(Boolean)
  return Array.from(new Set(todos))
}

/**
 * Resuelve un nombre libre contra el catálogo distinguiendo el nivel de confianza.
 * Estrategia: exacto por nombre o alias (único) → empieza-con → incluye. Un alias repetido en dos
 * proveedores nunca vincula solo: baja a `sugerido`.
 */
export function resolverProveedor<T extends ProveedorParaMatch>(
  nombreLibre: string,
  catalogo: readonly T[]
): ResolucionProveedor<T> | null {
  const target = normalizarNombreProveedor(nombreLibre)
  if (!target) return null

  const exactos = catalogo.filter((p) => nombresNormalizados(p).includes(target))
  if (exactos.length === 1) return { proveedor: exactos[0], nivel: "exacto" }
  if (exactos.length > 1) return { proveedor: exactos[0], nivel: "sugerido" }

  const empieza = catalogo.find((p) =>
    nombresNormalizados(p).some((n) => n.startsWith(target) || target.startsWith(n))
  )
  if (empieza) return { proveedor: empieza, nivel: "sugerido" }

  const incluye = catalogo.find((p) =>
    nombresNormalizados(p).some((n) => n.includes(target) || target.includes(n))
  )
  return incluye ? { proveedor: incluye, nivel: "sugerido" } : null
}

/**
 * Busca el mejor match de un nombre libre contra un catálogo de proveedores, sin distinguir
 * nivel. Estrategia: exacto (nombre o alias) → empieza-con → incluye. Para decidir si se puede
 * vincular sin preguntar usa `resolverProveedor`.
 */
export function matchProveedorPorNombre<T extends ProveedorParaMatch>(
  nombreLibre: string,
  catalogo: readonly T[]
): T | null {
  return resolverProveedor(nombreLibre, catalogo)?.proveedor ?? null
}
