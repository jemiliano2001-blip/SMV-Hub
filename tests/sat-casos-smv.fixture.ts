/** Casos reales SMV para benchmark de sugerencias SAT (sin llamadas a Gemini). */
export type CasoSmvSat = {
  descripcion: string
  proveedor?: string
  /** Clave SAT esperada (8 dígitos). */
  claveEsperada: string
  /** Patrón en descripción SAT del catálogo (regex string). */
  patronDescripcionSat?: string
  /** Fuentes aceptables del pipeline. */
  fuentesAceptables?: string[]
}

export const CASOS_SMV_SAT: CasoSmvSat[] = [
  {
    descripcion:
      '9.6mm (.378") 6 Flute HSS Straight Flute Chucking Reamer L&I LV533-3780',
    proveedor: 'stsvs',
    claveEsperada: '23241645',
    patronDescripcionSat: 'escariador|limador|precision',
    fuentesAceptables: ['glosario', 'mapeo_smv', 'historial_sku', 'historial_fuzzy', 'traduccion'],
  },
  {
    descripcion: '1/4 SE 4 Flute STUB ALTIN Solid Carbide End Mill',
    proveedor: 'Shars Tool Company',
    claveEsperada: '23241614',
    patronDescripcionSat: 'fresa|herramienta|corte',
    fuentesAceptables: ['glosario', 'mapeo_smv', 'historial_sku', 'historial_fuzzy', 'traduccion'],
  },
  {
    descripcion: 'Hex Bolt 1/4-20',
    claveEsperada: '31161500',
    patronDescripcionSat: 'tornillo',
    fuentesAceptables: ['historial', 'local', 'glosario', 'mapeo_smv'],
  },
  {
    descripcion: 'Compression Spring 2" x 0.5"',
    claveEsperada: '31161904',
    patronDescripcionSat: 'resorte',
    fuentesAceptables: ['glosario', 'mapeo_smv', 'local'],
  },
  {
    descripcion: '10pcs BS1010 Deburring Blade',
    claveEsperada: '23241609',
    patronDescripcionSat: 'cuchill|desbarb|bisel',
    fuentesAceptables: ['glosario', 'mapeo_smv', 'historial_sku', 'historial_fuzzy'],
  },
  {
    descripcion: 'Buna-N O-Ring 1/4" ID',
    claveEsperada: '31162411',
    patronDescripcionSat: 'anillo|empaque|sello',
    fuentesAceptables: ['glosario', 'mapeo_smv', 'historial_fuzzy', 'traduccion'],
  },
]
