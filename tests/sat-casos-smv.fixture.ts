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
  {
    descripcion: '140M-C2E-C20 - Guardamotor 14.5-20 A',
    proveedor: 'Almacén Automatización',
    claveEsperada: '39121601',
    patronDescripcionSat: 'breaker|circuito|interruptor',
    fuentesAceptables: ['local', 'mapeo_smv', 'glosario', 'historial_fuzzy', 'traduccion', 'ia_rag'],
  },
  {
    descripcion: '6003-2Z - Balero rígido de bolas, blindado',
    claveEsperada: '31171504',
    patronDescripcionSat: 'rodamiento|balinera',
    fuentesAceptables: ['local', 'mapeo_smv', 'glosario', 'historial_fuzzy', 'traduccion', 'ia_rag'],
  },
  {
    descripcion: '2323-DP-115V AC - Relevador o componente 115 VAC; por confirmar',
    claveEsperada: '39122300',
    patronDescripcionSat: 'rel[eé]',
    fuentesAceptables: ['local', 'mapeo_smv', 'glosario', 'historial_fuzzy', 'traduccion', 'ia_rag'],
  },
  {
    descripcion: '25B-D6P0N114 - Variador PowerFlex 525, 3 HP / 2.2 kW',
    claveEsperada: '39121007',
    patronDescripcionSat: 'conversor|frecuencia|control',
    fuentesAceptables: ['local', 'mapeo_smv', 'glosario', 'historial_fuzzy', 'traduccion', 'ia_rag'],
  },
]
