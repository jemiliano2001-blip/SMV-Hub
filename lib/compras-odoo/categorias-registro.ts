/**
 * Registro abierto de categorías de producto para el ETL de compras Odoo.
 * Añadir una categoría = una entrada aquí (o un doc en Firestore).
 * La lógica de resolución no usa switch/enum cerrado.
 */

export type CategoriaProductoDef = {
  id: string
  etiqueta: string
  /** Prefijos UNSPSC de 2 dígitos (claveProdServ SAT). */
  divisionesSat: string[]
  palabrasClave: string[]
  /** Patrones de nombre de categoría Odoo (product.category) que mapean a esta familia. */
  odooPatrones?: string[]
}

/** Seed. Extensible sin tocar resolverCategoriaProducto. */
export const CATEGORIAS_PRODUCTO_REGISTRO: CategoriaProductoDef[] = [
  {
    id: "metals",
    etiqueta: "Metales",
    divisionesSat: ["30"],
    palabrasClave: [
      "steel", "stainless", "aluminum", "aluminium", "brass", "bronze", "copper",
      "bar stock", "round bar", "flat bar", "plate", "sheet", "tube", "pipe",
      "rod", "acero", "inox", "inoxidable", "aluminio", "laton", "latón", "bronce",
      "cobre", "barra", "varilla", "lamina", "lámina", "placa", "tubo", "perfil",
      "fierro", "hierro", "hr", "cr", "cold rolled", "hot rolled",
      "solera", "angulo", "ángulo", "canal", "viga", "ptr", "redondo",
    ],
    odooPatrones: ["metal", "acero", "aluminio", "fierro", "hierro", "laton", "bronce", "cobre", "steel", "iron"],
  },
  {
    id: "tools",
    etiqueta: "Herramientas",
    divisionesSat: ["23", "27"],
    palabrasClave: [
      "end mill", "endmill", "drill", "reamer", "tap", "insert", "holder", "collet",
      "carbide", "hss", "fresa", "broca", "machuelo", "escariador", "mandril",
      "inserto", "portaherramienta", "tooling", "cutting", "chuck", "countersink",
      "counterbore", "boring bar", "face mill", "ball nose",
    ],
    odooPatrones: ["herramienta", "tooling", "tool", "consumible", "ferreteria"],
  },
  {
    id: "electronica",
    etiqueta: "Electrónica y automatización",
    divisionesSat: ["26", "32", "39"],
    palabrasClave: [
      "cable", "sensor", "proximity", "encoder", "plc", "relay", "rele", "contactor",
      "breaker", "fuse", "fusible", "switch", "motor", "drive", "vfd", "inverter",
      "variador", "connector", "conector", "terminal", "resistor", "capacitor",
      "hmi", "transmitter", "automation", "electronic", "electric", "interruptor",
      "alambre", "wire", "m-12", "m12", "m-8", "m8", "proximidad", "inductivo",
    ],
    odooPatrones: ["electronica", "electronic", "electric", "automation", "automatizacion", "plc", "sensor"],
  },
  {
    id: "neumatica",
    etiqueta: "Neumática e hidráulica",
    divisionesSat: ["40", "41"],
    palabrasClave: [
      "valvula", "válvula", "valve", "cilindro", "cylinder", "manguera", "hose",
      "fitting", "conexion", "conexión", "pneumatic", "neumatico", "neumático",
      "solenoid", "solenoides", "festo", "smc", "hidraulica", "hidráulica",
      "hydraulic", "regulador", "filtro neumatico", "filtro neumático",
    ],
    odooPatrones: ["neumatica", "neumática", "pneumatic", "hidraulica", "hidráulica", "valvula", "cilindro"],
  },
  {
    id: "quimicos",
    etiqueta: "Químicos y fluidos",
    divisionesSat: ["12", "15"],
    palabrasClave: [
      "lubricante", "lubricant", "refrigerante", "coolant", "solvente", "solvent",
      "aceite", "oil", "grasa", "grease", "fluido", "fluid", "aditivo", "additive",
      "desengrasante", "degreaser", "anticorrosivo", "quimico", "químico",
    ],
    odooPatrones: ["quimico", "químico", "lubricante", "fluido", "aceite", "coolant"],
  },
  {
    id: "consumibles",
    etiqueta: "Consumibles de taller",
    divisionesSat: ["23", "31"],
    palabrasClave: [
      "alambre edm", "wire edm", "electrodo", "electrode", "soldadura", "welding",
      "tungsteno", "tungsten", "carburo consumible", "gas argon", "gas co2",
      "mig wire", "alambre mig", "flux", "flux core", "antorcha", "torch",
      "varilla soldadura", "rod soldadura",
    ],
    odooPatrones: ["consumible", "soldadura", "edm", "tungsteno", "electrodo"],
  },
  {
    id: "abrasivos",
    etiqueta: "Abrasivos",
    divisionesSat: ["31"],
    palabrasClave: [
      "lija", "sandpaper", "disco", "flap", "grinding", "deburr", "desbarbar",
      "piedra esmeril", "grinding wheel", "abrasive", "abrasivo", "cutoff",
      "disco corte", "disco de corte", "manta abrasiva", "belt sander",
    ],
    odooPatrones: ["abrasivo", "abrasive", "lija", "disco"],
  },
  {
    id: "empaques",
    etiqueta: "Empaques y sellos",
    divisionesSat: ["31"],
    palabrasClave: [
      "o-ring", "o ring", "orring", "junta", "gasket", "sello", "seal", "empaque",
      "retén", "reten", "packing", "arillo", "ring seal", "viton", "nbr",
    ],
    odooPatrones: ["empaque", "junta", "sello", "o-ring", "gasket"],
  },
  {
    id: "tornilleria",
    etiqueta: "Tornillería y fijación",
    divisionesSat: ["31"],
    palabrasClave: [
      "tornillo", "tuerca", "arandela", "perno", "bolt", "screw", "nut", "washer",
      "rodamiento", "bearing", "fijacion", "fijación", "fastener", "threaded",
      "socket head", "hex bolt", "allen", "prisionero", "espárrago", "esparrago",
    ],
    odooPatrones: ["tornilleria", "tornillería", "tornillo", "ferreteria", "fastener"],
  },
  {
    id: "plastics",
    etiqueta: "Plásticos",
    divisionesSat: ["13"],
    palabrasClave: [
      "plastic", "plastico", "plástico", "nylon", "delrin", "acetal", "uhmw",
      "ptfe", "teflon", "teflón", "pvc", "abs", "polycarbonate", "policarbonato",
      "acrylic", "acrilico", "acrílico", "hdpe", "ldpe", "polyethylene", "polietileno",
    ],
    odooPatrones: ["plastico", "plastic", "nylon", "acetal", "polimero"],
  },
  {
    id: "office",
    etiqueta: "Papelería y oficina",
    divisionesSat: ["14", "44", "55"],
    palabrasClave: [
      "papel", "paper", "toner", "tinta", "ink", "carpeta", "folder", "pluma", "pen",
      "lapiz", "lápiz", "pencil", "grapadora", "stapler", "clip", "sobre", "envelope",
      "impresora", "printer", "oficina", "office", "resma", "cuaderno", "notebook",
    ],
    odooPatrones: ["oficina", "office", "papeleria", "stationery"],
  },
  {
    id: "medical",
    etiqueta: "Medicinas e insumos médicos",
    divisionesSat: ["42", "51"],
    palabrasClave: [
      "medicina", "medicamento", "farmacia", "analgesico", "analgésico", "ibuprofeno",
      "paracetamol", "aspirina", "vendaje", "gasas", "alcohol", "antiseptico",
      "antiséptico", "botiquin", "botiquín", "cura", "pastilla", "jarabe", "suero",
      "guantes latex", "guantes de latex", "cubrebocas", "tapabocas",
    ],
    odooPatrones: ["medicina", "medical", "farmacia", "botiquin"],
  },
  {
    id: "otros",
    etiqueta: "Otros insumos",
    divisionesSat: [],
    palabrasClave: [],
  },
]

export type ResolverCategoriaInput = {
  claveProdServ?: string | null
  descripcion?: string | null
  registro?: CategoriaProductoDef[]
  /** Nombre de la categoría Odoo (product.category) del producto. */
  odooCategoria?: string | null
}

/**
 * Resuelve categoría por división SAT → odooCategoria → keywords (match más largo) → `otros`.
 */
export function resolverCategoriaProducto(input: ResolverCategoriaInput): string {
  const registro = input.registro ?? CATEGORIAS_PRODUCTO_REGISTRO
  const clave = (input.claveProdServ ?? "").replace(/\D/g, "")
  const division = clave.length >= 2 ? clave.slice(0, 2) : ""

  if (division) {
    for (const cat of registro) {
      if (cat.id === "otros") continue
      if (cat.divisionesSat.includes(division)) return cat.id
    }
  }

  // Señal de categoría Odoo (ej. "Metal / Acero" → metals)
  const odooCat = (input.odooCategoria ?? "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
  if (odooCat) {
    for (const cat of registro) {
      if (cat.id === "otros" || !cat.odooPatrones?.length) continue
      for (const patron of cat.odooPatrones) {
        const patronNorm = patron.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
        if (odooCat.includes(patronNorm)) return cat.id
      }
    }
  }

  const desc = (input.descripcion ?? "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
  if (desc) {
    let mejor: { id: string; len: number } | null = null
    for (const cat of registro) {
      if (cat.id === "otros") continue
      for (const kw of cat.palabrasClave) {
        const kwNorm = kw.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
        if (!kwNorm || !desc.includes(kwNorm)) continue
        const len = kwNorm.length
        if (
          !mejor ||
          len > mejor.len ||
          (len === mejor.len && mejor.id === "metals" && cat.id !== "metals")
        ) {
          mejor = { id: cat.id, len }
        }
      }
    }
    if (mejor) return mejor.id
  }

  const otros = registro.find((c) => c.id === "otros")
  return otros?.id ?? "otros"
}

/** Tipo de insumo dentro de una categoría (keyword más larga que matchea). */
export function detectarTipoInsumo(
  descripcion: string,
  categoriaId: string,
  registro: CategoriaProductoDef[] = CATEGORIAS_PRODUCTO_REGISTRO
): string | null {
  const cat = registro.find((c) => c.id === categoriaId)
  if (!cat || cat.palabrasClave.length === 0) return null
  const desc = descripcion.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
  let mejor: string | null = null
  let mejorLen = 0
  for (const kw of cat.palabrasClave) {
    const kwNorm = kw.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
    if (!kwNorm || !desc.includes(kwNorm)) continue
    if (kwNorm.length > mejorLen) {
      mejor = kwNorm.replace(/\s+/g, "_")
      mejorLen = kwNorm.length
    }
  }
  return mejor
}

export function obtenerCategoriaDef(
  id: string,
  registro: CategoriaProductoDef[] = CATEGORIAS_PRODUCTO_REGISTRO
): CategoriaProductoDef | undefined {
  return registro.find((c) => c.id === id)
}

/** Familias con UI de rangos de precio. */
export const FAMILIAS_CON_RANGO = [
  "metals",
  "tools",
  "electronica",
  "neumatica",
  "quimicos",
  "consumibles",
  "abrasivos",
  "empaques",
  "tornilleria",
  "plastics",
  "office",
  "medical",
  "otros",
] as const
