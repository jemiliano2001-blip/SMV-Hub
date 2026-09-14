/**
 * Mapeos de clasificación aprobados por el equipo (`clasificacion_ia_mapeos`) aplicados durante el
 * sync de compras Odoo, para que una corrección humana sobreviva a cada corrida del espejo.
 *
 * Antes de esto el sync reconstruía cada ítem con `set()` sin merge y heurística pura: lo que el
 * equipo aprobaba en `PanelClasificacionIA` se perdía a las dos horas. Ver el spec
 * docs/superpowers/specs/2026-09-13-estructura-datos-normalizacion-design.md (B2).
 *
 * Copia espejo en `lib/compras-odoo/mapeos-aprobados.ts` — deben ser idénticos
 * (`tests/mapeos-aprobados-sync.test.ts` compara ambos archivos byte a byte).
 *
 * Regla de empate para autoaplicar — más conservadora que la del cliente (regla D de la
 * calibración B0, docs/superpowers/plans/2026-09-13-estructura-datos-normalizacion.md):
 *   1. Igualdad de descripción normalizada (cualquier categoría, incluida `otros`: es la
 *      decisión humana literal), o
 *   2. la descripción del ítem contiene al mapeo completo con límite de palabra, y el mapeo es
 *      específico — ≥ 12 caracteres o con dígitos (SKU / medida) —, tiene ≥ 5 caracteres y no
 *      apunta a `otros`.
 * Nunca al revés (ítem más corto que el mapeo) ni con palabras genéricas ("Balero", "Extensión"):
 * en la calibración esos eran justo los falsos positivos de la regla del cliente.
 */

export type MapeoAprobadoSync = {
  descripcionNormalizada: string
  categoriaId: string
  tipoInsumo: string | null
  medida: string | null
}

/** Índice precalculado una vez por corrida: exactos por hash, específicos ordenados por longitud. */
export type IndiceMapeosAprobados = {
  exactos: Map<string, MapeoAprobadoSync>
  /** Solo mapeos que califican para "incluye"; del más largo al más corto para que gane el más específico. */
  especificos: MapeoAprobadoSync[]
  total: number
}

const LONGITUD_MINIMA_INCLUYE = 5
const LONGITUD_ESPECIFICA = 12

/**
 * Normalización idéntica a `normalizarDescripcionMapeo` de
 * `lib/compras-odoo/mapeos-clasificacion.ts`: minúsculas, sin acentos, solo [a-z0-9], espacios
 * colapsados. Si cambia allá, debe cambiar aquí (test de paridad).
 */
export function normalizarDescripcionMapeo(desc: string): string {
  return desc
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** Parsea un documento de `clasificacion_ia_mapeos`; null si le falta lo mínimo para aplicarse. */
export function mapeoAprobadoDesdeDoc(data: Record<string, unknown>): MapeoAprobadoSync | null {
  const norm =
    typeof data.descripcionNormalizada === "string" ? data.descripcionNormalizada.trim() : ""
  const categoriaId = typeof data.categoriaId === "string" ? data.categoriaId.trim() : ""
  if (!norm || !categoriaId) return null
  const tipoInsumo =
    typeof data.tipoInsumo === "string" && data.tipoInsumo.trim() ? data.tipoInsumo.trim() : null
  const medida = typeof data.medida === "string" && data.medida.trim() ? data.medida.trim() : null
  return { descripcionNormalizada: norm, categoriaId, tipoInsumo, medida }
}

export function esMapeoEspecifico(mapeo: MapeoAprobadoSync): boolean {
  const norm = mapeo.descripcionNormalizada
  if (norm.length < LONGITUD_MINIMA_INCLUYE) return false
  if (mapeo.categoriaId === "otros") return false
  return norm.length >= LONGITUD_ESPECIFICA || /\d/.test(norm)
}

export function indexarMapeosAprobados(mapeos: MapeoAprobadoSync[]): IndiceMapeosAprobados {
  const exactos = new Map<string, MapeoAprobadoSync>()
  for (const m of mapeos) {
    // El id del doc deriva de la descripción normalizada, así que un duplicado es raro; si
    // ocurre, gana el primero para que el resultado sea determinista entre corridas.
    if (!exactos.has(m.descripcionNormalizada)) exactos.set(m.descripcionNormalizada, m)
  }
  const especificos = [...exactos.values()]
    .filter(esMapeoEspecifico)
    .sort((a, b) => b.descripcionNormalizada.length - a.descripcionNormalizada.length)
  return { exactos, especificos, total: exactos.size }
}

/**
 * Busca el mapeo aprobado aplicable a una descripción de ítem Odoo. `descripcion` es el texto
 * crudo de la línea; aquí se normaliza.
 */
export function buscarMapeoAprobadoSync(
  descripcion: string,
  indice: IndiceMapeosAprobados
): MapeoAprobadoSync | null {
  const norm = normalizarDescripcionMapeo(descripcion)
  if (!norm) return null
  const exacto = indice.exactos.get(norm)
  if (exacto) return exacto
  // norm y las descripciones del índice solo contienen [a-z0-9 ]: bordear con espacios es un
  // límite de palabra exacto sin regex ni escapes.
  const conBordes = ` ${norm} `
  for (const m of indice.especificos) {
    if (conBordes.includes(` ${m.descripcionNormalizada} `)) return m
  }
  return null
}

/**
 * Lee `clasificacion_ia_mapeos` con Admin SDK y devuelve el índice listo para el sync. Una sola
 * lectura por corrida. Best-effort: si falla, devuelve null y el sync sigue con heurística —
 * nunca se bloquea el espejo de Odoo por la memoria de clasificación.
 */
export async function cargarMapeosAprobados(
  firestore: FirebaseFirestore.Firestore
): Promise<IndiceMapeosAprobados | null> {
  try {
    const snap = await firestore.collection("clasificacion_ia_mapeos").get()
    const mapeos: MapeoAprobadoSync[] = []
    for (const d of snap.docs) {
      const m = mapeoAprobadoDesdeDoc(d.data())
      if (m) mapeos.push(m)
    }
    return indexarMapeosAprobados(mapeos)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error)
    console.warn(`No se pudieron cargar clasificacion_ia_mapeos; se clasifica solo por heurística: ${mensaje}`)
    return null
  }
}
