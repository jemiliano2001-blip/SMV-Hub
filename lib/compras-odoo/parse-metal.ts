/**
 * Extrae tipo de metal, medida y unidad desde descripciones de la estación de compras.
 */

export type AtributosMetal = {
  tipoMetal: string | null
  medida: string | null
  unidad: string | null
}

const TIPOS_METAL: { id: string; patrones: RegExp[] }[] = [
  { id: "acero_1018", patrones: [/\b1018\b/i, /\bacero\s*1018\b/i] },
  { id: "acero_4140", patrones: [/\b4140\b/i, /\bacero\s*4140\b/i] },
  { id: "acero_1045", patrones: [/\b1045\b/i] },
  { id: "inox_304", patrones: [/\b304\b/i, /\binox(?:idable)?\s*304\b/i, /\bss\s*304\b/i] },
  { id: "inox_316", patrones: [/\b316\b/i, /\binox(?:idable)?\s*316\b/i] },
  { id: "aluminio_6061", patrones: [/\b6061\b/i, /\balumin(?:io|ium)\s*6061\b/i] },
  { id: "aluminio_7075", patrones: [/\b7075\b/i] },
  { id: "aluminio", patrones: [/\balumin(?:io|ium)\b/i] },
  { id: "laton", patrones: [/\blat[oó]n\b/i, /\bbrass\b/i] },
  { id: "bronce", patrones: [/\bbronce\b/i, /\bbronze\b/i] },
  { id: "cobre", patrones: [/\bcobre\b/i, /\bcopper\b/i] },
  { id: "acero", patrones: [/\bacero\b/i, /\bsteel\b/i, /\bfierro\b/i, /\bhierro\b/i] },
]

/** Fracciones, pulgadas, mm, placa NxM, diámetro Ø. */
const MEDIDA_PATRONES: RegExp[] = [
  /\b(\d+\s*\/\s*\d+)\s*(?:("|''|in|pulg|pulgadas?))?\b/i,
  /\b(\d+(?:\.\d+)?)\s*(mm|cm)\b/i,
  /\b(\d+(?:\.\d+)?)\s*("|''|in)\b/i,
  /\bØ\s*(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\b/i,
  /\bdiam(?:etro|\.?)\s*[:=]?\s*(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*(mm|in|"|'')?/i,
  /\bplaca\s+(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*(mm|in|"|'')?/i,
  /\bespesor\s*[:=]?\s*(\d+(?:\.\d+)?(?:\s*\/\s*\d+)?)\s*(mm|in|"|'')?/i,
  /\b(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*(?:x\s*(\d+(?:\.\d+)?))?\s*(mm|in|"|'')?/i,
]

function normalizarMedida(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/''/g, '"')
    .replace(/\s*\/\s*/g, "/")
    .trim()
    .toLowerCase()
}

export function parseAtributosMetal(descripcion: string): AtributosMetal {
  const texto = descripcion?.trim() ?? ""
  if (!texto) return { tipoMetal: null, medida: null, unidad: null }

  let tipoMetal: string | null = null
  for (const t of TIPOS_METAL) {
    if (t.patrones.some((p) => p.test(texto))) {
      tipoMetal = t.id
      break
    }
  }

  let medida: string | null = null
  let unidad: string | null = null
  for (const p of MEDIDA_PATRONES) {
    const m = texto.match(p)
    if (!m) continue
    if (m[0].toLowerCase().includes("x") && m[1] && m[2]) {
      const dims = [m[1], m[2], m[3]].filter(Boolean).join("x")
      unidad = (m[4] ?? "mm").replace(/''/g, '"') || null
      medida = normalizarMedida(`${dims}${unidad ? unidad : ""}`)
    } else {
      const valor = m[1] ?? m[0]
      unidad = (m[2] ?? "").replace(/''/g, '"') || null
      medida = normalizarMedida(unidad ? `${valor}${unidad}` : String(valor))
    }
    break
  }

  return { tipoMetal, medida, unidad }
}
