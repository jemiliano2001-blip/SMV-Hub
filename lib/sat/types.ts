export type ConfianzaSat = "alta" | "media" | "baja"
export type FuenteSugerenciaSat =
  | "historial"
  | "historial_sku"
  | "historial_fuzzy"
  | "mapeo_smv"
  | "mapeo_validado"
  | "local"
  | "glosario"
  | "traduccion"
  | "ia_rag"
  | "manual"

export interface AlternativaSat {
  clave: string
  descripcionSat: string
  score: number
}

export interface SugerenciaClaveSat {
  claveProdServ: string | null
  descripcionSat: string | null
  confianza: ConfianzaSat
  motivo: string
  fuente: FuenteSugerenciaSat
  /** Términos en español usados para buscar en catálogo. */
  terminosBusqueda?: string
  /** Otras claves candidatas para revisión manual. */
  alternativas?: AlternativaSat[]
}

export interface ItemParaSugerirSat {
  descripcion: string
  proveedor?: string
}

export type HistorialSatEntry = {
  descripcionNormalizada: string
  claveProdServ: string
  creadoEn: Date
  tokensNormalizados?: string[]
  sku?: string | null
}

export type MapeoSmvEntry = {
  tokensNormalizados: string[]
  sku?: string | null
  claveProdServ: string
  descripcionEjemplo: string
  /** Origen del mapeo: JSON curado en repo o validación en Firestore. */
  origen?: "json" | "firestore"
}
