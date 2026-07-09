/**
 * Perfil de compras SMV Maquinados: áreas de negocio → divisiones UNSPSC del catálogo SAT.
 */

export type AreaComprasSmv = "taller" | "automatizacion" | "oficina" | "general"

export type PerfilAreaSmv = {
  id: AreaComprasSmv
  etiqueta: string
  divisiones: string[]
  palabrasClave: string[]
  proveedores?: string[]
  ejemplos: string[]
}

export const AREAS_COMPRAS_SMV: PerfilAreaSmv[] = [
  {
    id: "taller",
    etiqueta: "Taller (torno, CNC, maquinado)",
    divisiones: ["23", "27", "31"],
    palabrasClave: [
      "end mill", "endmill", "drill", "reamer", "tap", "insert", "holder", "collet",
      "carbide", "hss", "fresa", "broca", "machuelo", "escariador", "mandril",
      "tornillo", "bolt", "screw", "nut", "washer", "bearing", "spring", "o-ring",
      "gasket", "caliper", "micrometer", "gauge", "deburr", "boring", "mill",
      "rodamiento", "resorte", "arandela", "tuerca", "portaherramienta", "inserto",
      "cutting", "tooling", "flute", "chuck", "countersink", "counterbore",
    ],
    proveedores: [
      "mcmaster", "msc", "grainger", "travers", "shars", "ebay", "amazon",
      "digikey", "mouser", "home depot",
    ],
    ejemplos: [
      "Fresas y brocas de carburo",
      "Insertos y portaherramientas",
      "Tornillería y rodamientos",
      "Calibradores y micrómetros",
    ],
  },
  {
    id: "taller",
    etiqueta: "Materiales metálicos",
    divisiones: ["30", "31"],
    palabrasClave: [
      "steel", "stainless", "aluminum", "aluminium", "brass", "bronze", "copper",
      "bar stock", "round bar", "flat bar", "plate", "sheet", "tube", "pipe",
      "rod", "acero", "inoxidable", "aluminio", "laton", "bronce", "cobre",
      "barra", "varilla", "lamina", "placa", "tubo", "perfil", "angle", "channel",
    ],
    ejemplos: ["Barra redonda de acero", "Lámina de aluminio", "Perfiles y ángulos"],
  },
  {
    id: "automatizacion",
    etiqueta: "Automatización y electrónica",
    divisiones: ["26", "32", "39", "31"],
    palabrasClave: [
      "sensor", "proximity", "encoder", "plc", "relay", "contactor", "breaker",
      "fuse", "switch", "motor", "drive", "vfd", "inverter", "cable", "wire",
      "connector", "terminal", "resistor", "capacitor", "arduino", "pneumatic",
      "solenoid", "valve", "cylinder", "hmi", "transmitter", "automation",
      "electronic", "electric", "rele", "contacto", "fusible", "interruptor",
      "conector", "alambre", "neumatico", "valvula", "cilindro",
    ],
    proveedores: ["digikey", "mouser", "automation direct", "omega", "festo", "smc"],
    ejemplos: [
      "Sensores inductivos y encoders",
      "Contactores, relevadores y fusibles",
      "Motores y variadores",
      "Conectores y cableado",
    ],
  },
  {
    id: "oficina",
    etiqueta: "Papelería y suministros de oficina",
    divisiones: ["14", "41", "45", "55"],
    palabrasClave: [
      "paper", "toner", "ink", "cartridge", "folder", "binder", "stapler", "staples",
      "pen", "pencil", "marker", "highlighter", "notebook", "notepad", "envelope",
      "label", "tape", "office", "printer", "copy", "clipboard",
      "papel", "tinta", "carpeta", "grapa", "engrapadora", "pluma", "lapiz",
      "marcador", "libreta", "sobre", "etiqueta", "cinta", "impresora", "oficina",
      "archivo", "post-it", "sticky",
    ],
    proveedores: ["office depot", "staples", "costco", "amazon", "mercado libre"],
    ejemplos: ["Papel carta y libretas", "Toner e impresión", "Artículos de escritorio"],
  },
]

function normalizarProveedor(proveedor: string): string {
  return proveedor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

export type ClasificacionAreaSmv = {
  area: AreaComprasSmv
  divisiones: string[]
  coincidencias: string[]
  confianza: "alta" | "media" | "baja"
}

export function clasificarAreaComprasSmv(
  descripcion: string,
  proveedor = ""
): ClasificacionAreaSmv {
  const texto = descripcion.toLowerCase()
  const prov = normalizarProveedor(proveedor)

  let mejor: ClasificacionAreaSmv = {
    area: "general",
    divisiones: [],
    coincidencias: [],
    confianza: "baja",
  }
  let mejorScore = 0

  const perfilesPorArea = new Map<
    AreaComprasSmv,
    { score: number; hits: string[]; divisiones: Set<string> }
  >()

  for (const perfil of AREAS_COMPRAS_SMV) {
    let score = 0
    const hits: string[] = []

    for (const palabra of perfil.palabrasClave) {
      const escaped = palabra.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      const re = new RegExp(`\\b${escaped}\\b`, "i")
      if (re.test(texto)) {
        score += palabra.includes(" ") ? 3 : 1
        hits.push(palabra)
      }
    }

    if (perfil.proveedores && prov) {
      for (const p of perfil.proveedores) {
        if (prov.includes(p)) {
          score += 2
          hits.push(`proveedor:${p}`)
        }
      }
    }

    if (score === 0) continue

    const existente = perfilesPorArea.get(perfil.id) ?? {
      score: 0,
      hits: [],
      divisiones: new Set<string>(),
    }
    existente.score += score
    existente.hits.push(...hits)
    for (const d of perfil.divisiones) existente.divisiones.add(d)
    perfilesPorArea.set(perfil.id, existente)
  }

  for (const [area, data] of perfilesPorArea) {
    if (data.score <= mejorScore) continue
    mejorScore = data.score
    mejor = {
      area,
      divisiones: [...data.divisiones],
      coincidencias: [...new Set(data.hits)],
      confianza: data.score >= 4 ? "alta" : data.score >= 2 ? "media" : "baja",
    }
  }

  if (mejor.area === "general") {
    if (/\b(paper|toner|ink|folder|pen|office|papel|libreta)\b/i.test(descripcion)) {
      return {
        area: "oficina",
        divisiones: ["14", "41", "55"],
        coincidencias: ["heurística oficina"],
        confianza: "baja",
      }
    }
    if (/\b(sensor|relay|plc|motor drive|contactor|encoder|proximity)\b/i.test(descripcion)) {
      return {
        area: "automatizacion",
        divisiones: ["26", "32"],
        coincidencias: ["heurística automatización"],
        confianza: "baja",
      }
    }
    if (/\b(steel bar|aluminum plate|round bar|barra|lamina)\b/i.test(descripcion)) {
      return {
        area: "taller",
        divisiones: ["30", "31"],
        coincidencias: ["heurística materiales"],
        confianza: "baja",
      }
    }
  }

  return mejor
}

export function contextoSmvParaIa(clasificacion: ClasificacionAreaSmv): string {
  if (clasificacion.area === "general") {
    return `Comprador SMV: taller de torno/CNC, automatización industrial y oficina administrativa (Monterrey).
Divisiones SAT habituales: 23 herramientas de corte, 30 metales, 31 ferretería, 26/32 electrónica, 14/55 papelería.`
  }
  const perfiles = AREAS_COMPRAS_SMV.filter((a) => a.id === clasificacion.area)
  const ejemplos = [...new Set(perfiles.flatMap((a) => a.ejemplos))].join("; ")
  const etiqueta = perfiles[0]?.etiqueta ?? clasificacion.area
  return `Comprador SMV — área: ${etiqueta}. Divisiones SAT prioritarias: ${clasificacion.divisiones.join(", ")}. Productos típicos: ${ejemplos}.`
}
