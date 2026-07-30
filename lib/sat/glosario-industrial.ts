import { normalizarTexto } from "@/lib/sugerencias-compra"
import { extraerTerminosClaveIndustrial } from "@/lib/sat/extraer-terminos"

/** Frases compuestas EN → ES (ordenadas de más larga a más corta). */
const FRASES_EN_ES: Array<[string, string]> = [
  ["straight flute chucking reamer", "escariador limador precision agujeros"],
  ["spiral flute reamer", "escariador limador precision"],
  ["chucking reamer", "escariador limador precision agujeros"],
  ["hand reamer", "escariador limador precision"],
  ["straight flute reamer", "escariador limador precision"],
  ["deburring blade", "cuchilla desbarbado"],
  ["boring head", "cabezal barrenado"],
  ["tap wrench", "llave machuelo"],
  ["end mill", "herramienta de corte metal"],
  ["endmill", "herramienta de corte metal"],
  ["solid carbide", "carburo solido"],
  ["carbide end", "herramienta corte carburo"],
  ["drill bit", "broca metal"],
  ["tap drill", "broca para machuelo"],
  ["counter sink", "avellanador"],
  ["countersink", "avellanador"],
  ["counter bore", "escariador conico"],
  ["counterbore", "escariador conico"],
  ["ball end", "fresa esferica"],
  ["flat end", "fresa plana"],
  ["compression spring", "resorte compresion"],
  ["extension spring", "resorte extension"],
  ["ball spring plunger", "perno bola resorte"],
  ["spring plunger", "perno resorte"],
  ["hex bolt", "tornillo hexagonal"],
  ["hex screw", "tornillo hexagonal"],
  ["socket head", "tornillo cabeza cilindrica"],
  ["set screw", "tornillo prisionero"],
  ["lock washer", "arandela de presion"],
  ["flat washer", "arandela plana"],
  ["needle bearing", "rodamiento de agujas"],
  ["ball bearing", "rodamiento de bolas"],
  ["thrust bearing", "rodamiento axial"],
  ["cutting tool", "herramienta de corte"],
  ["tool holder", "portaherramienta"],
  ["collet chuck", "portapinzas"],
  ["indexable insert", "inserto indexable"],
  ["thread tap", "machuelo"],
  ["spiral flute", "espiral"],
  ["straight flute", "recta"],
  ["o-ring", "oring empaque"],
  ["round bar", "barra redonda acero"],
  ["flat bar", "barra plana acero"],
  ["bar stock", "barra acero"],
  ["proximity sensor", "sensor proximidad"],
  ["photoelectric sensor", "sensor fotoeletrico"],
  ["copy paper", "papel imprenta"],
  ["printer paper", "papel imprenta"],
  ["sticky notes", "papel notas"],
  ["post-it", "papel notas"],
]

/** Palabras sueltas EN → ES. */
const PALABRAS_EN_ES: Record<string, string> = {
  drill: "broca",
  reamer: "escariador limador",
  tap: "machuelo",
  milling: "fresado",
  mill: "fresa",
  endmill: "fresa",
  carbide: "carburo",
  cobalt: "cobalto",
  insert: "inserto",
  holder: "portaherramienta",
  collet: "pinza",
  chuck: "mandril",
  boring: "barrenado",
  deburr: "desbarbado",
  deburring: "desbarbado",
  blade: "cuchilla",
  gauge: "calibrador",
  caliper: "calibre",
  micrometer: "micrometro",
  wrench: "llave",
  bolt: "tornillo",
  screw: "tornillo",
  nut: "tuerca",
  washer: "arandela",
  bearing: "rodamiento",
  spring: "resorte",
  gasket: "empaque",
  seal: "sello",
  valve: "valvula",
  fitting: "conexion",
  coupling: "acoplamiento",
  hose: "manguera",
  cable: "cable",
  wire: "alambre",
  lubricant: "lubricante",
  grease: "grasa",
  oil: "aceite",
  abrasive: "abrasivo",
  sandpaper: "lija",
  grinding: "rectificado",
  polishing: "pulido",
  cutting: "corte",
  tooling: "herramienta corte",
  shank: "zanco",
  coated: "recubierto",
  solid: "solido",
  hardened: "templado",
  steel: "acero",
  stainless: "inoxidable",
  aluminum: "aluminio",
  brass: "laton",
  copper: "cobre",
  plastic: "plastico",
  rubber: "hule",
  nylon: "nylon",
  pin: "pasador",
  rivet: "remache",
  clamp: "abrazadera",
  bracket: "soporte",
  plate: "placa",
  bar: "barra",
  rod: "varilla",
  tube: "tubo",
  pipe: "tubo",
  sheet: "lamina",
  filter: "filtro",
  pump: "bomba",
  motor: "motor",
  sensor: "sensor",
  switch: "interruptor",
  relay: "rele",
  fuse: "fusible",
  connector: "conector",
  terminal: "terminal",
  resistor: "resistencia",
  capacitor: "capacitor",
  countersink: "avellanador",
  counterbore: "escariador conico",
  head: "cabeza",
  proximity: "proximidad",
  encoder: "encoder",
  contactor: "contactor",
  breaker: "interruptor termomagnetico",
  pneumatic: "neumatico",
  cylinder: "cilindro",
  solenoid: "solenoide",
  toner: "toner impresion",
  cartridge: "cartucho toner",
  folder: "carpeta archivo",
  stapler: "engrapadora",
  staples: "grapas",
  notebook: "libreta",
  envelope: "sobre",
  marker: "marcador",
  highlighter: "marcador resaltador",
  channel: "canal perfil",
  angle: "angulo perfil",
}

const STOPWORDS_EN = new Set([
  "the", "and", "for", "with", "of", "in", "to", "a", "an", "x", "mm", "in", "dia",
  "diameter", "length", "size", "type", "series", "grade", "class", "pack", "each",
  "pcs", "qty", "new", "used", "set", "kit", "assortment", "piece", "pieces",
  "flute", "flutes", "straight", "spiral", "stub", "hss", "chucking",
])

const PALABRAS_ES_INDUSTRIAL = new Set([
  "fresa", "broca", "tornillo", "tuerca", "arandela", "resorte", "resortes",
  "rodamiento",
  "herramienta", "empaque", "valvula", "inserto", "machuelo", "escariador",
  "carburo", "calibre", "calibrador", "micrometro", "avellanador", "desbarbado",
  "cuchilla", "limador", "precision", "agujeros", "corte", "portaherramienta",
  // Modificadores de producto: sin ellos "resorte de compresión" → solo "resorte"
  // y el buscador prioriza máquinas/herramientas que mencionan "resorte".
  "compresion", "extension", "traccion", "torsion", "helicoidal",
])

export type TraduccionGlosario = {
  terminosBusqueda: string
  fuente: "glosario"
}

/**
 * Traducción determinística EN→ES para descripciones industriales comunes.
 * Usa texto limpio (sin medidas/SKU) antes de traducir.
 */
export function traducirConGlosario(descripcion: string): TraduccionGlosario | null {
  const { textoLimpio } = extraerTerminosClaveIndustrial(descripcion)
  let texto = normalizarTexto(textoLimpio || descripcion)
  if (!texto) return null

  for (const [en, es] of FRASES_EN_ES) {
    texto = texto.replace(new RegExp(en.replace(/\s+/g, "\\s+"), "gi"), es)
  }

  const tokens = texto
    .replace(/[^a-z0-9\s./-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2)

  const traducidos: string[] = []
  let hits = 0

  for (const token of tokens) {
    if (STOPWORDS_EN.has(token)) continue
    const es = PALABRAS_EN_ES[token]
    if (es) {
      traducidos.push(es)
      hits++
    } else if (/^\d/.test(token) || token.length <= 2) {
      continue
    } else if (PALABRAS_ES_INDUSTRIAL.has(token)) {
      traducidos.push(token)
      hits++
    }
  }

  if (hits < 1) return null

  const terminosBusqueda = [...new Set(traducidos)].join(" ").trim()
  if (!terminosBusqueda) return null

  return { terminosBusqueda, fuente: "glosario" }
}
