import type { EndmillMedida, EstadoStockEndmill } from "@/lib/schemas"
import { fechaHoyLocal } from "@/lib/format"

export const UMBRAL_CRITICO_ENDMILLS = 0.25

export function redondearUSD(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100
}

export function calcularObjetivoPar(
  stockAntesPedido: number | null,
  cantidadPedida: number
): number | null {
  if (stockAntesPedido === null) return null
  return Math.max(0, Math.trunc(stockAntesPedido) + Math.trunc(cantidadPedida))
}

export function calcularCantidadSugerida(
  objetivoPar: number | null,
  stockActual: number
): number | null {
  if (objetivoPar === null) return null
  return Math.max(0, Math.trunc(objetivoPar) - Math.trunc(stockActual))
}

export function clasificarStockEndmill(
  stockActual: number,
  objetivoPar: number | null
): EstadoStockEndmill {
  if (objetivoPar === null) return "sin_base"
  if (objetivoPar <= 0) return "ok"
  if (
    stockActual === 0 ||
    stockActual <= Math.ceil(objetivoPar * UMBRAL_CRITICO_ENDMILLS)
  ) {
    return "critico"
  }
  if (stockActual < objetivoPar) return "bajo"
  return "ok"
}

export interface LineaTotalEndmills {
  cantidadPedida: number
  precioUnitarioUSD: number
}

export interface TotalesPedidoEndmills {
  costoItemsUSD: number
  aliCostUSD: number
  shippingUSD: number
  totalUSD: number
  numeroPartidas: number
  numeroPiezas: number
}

export function calcularTotalesPedidoEndmills(
  partidas: readonly LineaTotalEndmills[],
  aliCostUSD: number,
  shippingUSD: number
): TotalesPedidoEndmills {
  const incluidas = partidas.filter((partida) => partida.cantidadPedida > 0)
  const costoItemsUSD = redondearUSD(
    incluidas.reduce(
      (total, partida) =>
        total + redondearUSD(partida.cantidadPedida * partida.precioUnitarioUSD),
      0
    )
  )
  const ali = redondearUSD(Math.max(0, aliCostUSD))
  const shipping = redondearUSD(Math.max(0, shippingUSD))
  return {
    costoItemsUSD,
    aliCostUSD: ali,
    shippingUSD: shipping,
    totalUSD: redondearUSD(costoItemsUSD + ali + shipping),
    numeroPartidas: incluidas.length,
    numeroPiezas: incluidas.reduce((total, partida) => total + partida.cantidadPedida, 0),
  }
}

export function sugerenciaParaMedida(medida: EndmillMedida): number | null {
  return calcularCantidadSugerida(medida.objetivoPar, medida.stockActual)
}

/**
 * Días entre dos fechas `YYYY-MM-DD`. Devuelve `null` cuando alguna no es válida
 * o cuando la final es anterior a la inicial: un lead time negativo es un error
 * de captura que hay que corregir, no un 0 que se traga el problema.
 */
export function diferenciaEnDias(
  fechaInicioISO: string,
  fechaFinISO: string
): number | null {
  const ini = new Date(`${fechaInicioISO}T00:00:00Z`).getTime()
  const fin = new Date(`${fechaFinISO}T00:00:00Z`).getTime()
  if (Number.isNaN(ini) || Number.isNaN(fin) || fin < ini) return null
  return Math.round((fin - ini) / (1000 * 60 * 60 * 24))
}

export function calcularLeadTimePromedio(
  pedidos: readonly { diasLeadTime?: number | null; estado: string }[]
): number | null {
  const conLeadTime = pedidos.filter(
    (p) => p.estado === "recibido" && p.diasLeadTime !== undefined && p.diasLeadTime !== null
  )
  if (conLeadTime.length === 0) return null
  const suma = conLeadTime.reduce((acc, curr) => acc + (curr.diasLeadTime ?? 0), 0)
  return Math.round(suma / conLeadTime.length)
}

export function parsearFraccionPulgadas(medida: string): number {
  const limpia = medida.replace(/["' ]/g, "").trim()
  if (!limpia) return 0
  if (limpia.includes("/")) {
    const [num, den] = limpia.split("/").map(Number)
    if (den && !Number.isNaN(num) && !Number.isNaN(den)) return num / den
  }
  const decimal = parseFloat(limpia)
  return Number.isNaN(decimal) ? 0 : decimal
}

/**
 * Precios de referencia de mercado de herramientas de carburo sólido en EE.UU. (McMaster / MSC / Shars)
 * para calcular el benchmark de ahorro real de SMV al importar directamente de China.
 */
export function obtenerPrecioEstimadoUSA(medidaPulgadas: string, categoria?: string): number {
  const diametro = parsearFraccionPulgadas(medidaPulgadas)
  let baseUSD = 28.0

  if (diametro <= 0.035) baseUSD = 32.0 // Micro endmills (0.015", 1/32")
  else if (diametro <= 0.065) baseUSD = 24.0 // 1/16"
  else if (diametro <= 0.10) baseUSD = 22.0 // 3/32"
  else if (diametro <= 0.13) baseUSD = 22.0 // 1/8"
  else if (diametro <= 0.19) baseUSD = 26.0 // 3/16"
  else if (diametro <= 0.26) baseUSD = 32.0 // 1/4"
  else if (diametro <= 0.32) baseUSD = 42.0 // 5/16"
  else if (diametro <= 0.38) baseUSD = 52.0 // 3/8"
  else if (diametro <= 0.51) baseUSD = 82.0 // 1/2"
  else if (diametro <= 0.63) baseUSD = 125.0 // 5/8"
  else if (diametro <= 0.76) baseUSD = 185.0 // 3/4"
  else baseUSD = 310.0 // 1" o superior

  const cat = (categoria || "").toUpperCase()
  let factor = 1.0
  if (cat.includes("BALL") || cat.includes("BOLA")) factor *= 1.2
  if (cat.includes("LARGO") || cat.includes("LONG")) factor *= 1.4
  if (cat.includes("EXTRA")) factor *= 1.6
  if (cat.includes("RUPA") || cat.includes("CARBURO") || cat.includes("ROUGHER")) factor *= 1.3

  return redondearUSD(baseUSD * factor)
}

export interface ResultadoAhorroUSA {
  totalChinaUSD: number
  totalUSAUSD: number
  ahorroUSD: number
  porcentajeAhorro: number
}

export function calcularAhorroPedidoUSA(
  partidas: readonly {
    medidaPulgadas: string
    categoria?: string
    cantidad: number
    precioUnitarioUSD: number
  }[]
): ResultadoAhorroUSA {
  const incluidas = partidas.filter((p) => p.cantidad > 0)
  const totalChina = redondearUSD(
    incluidas.reduce((acc, p) => acc + p.cantidad * p.precioUnitarioUSD, 0)
  )
  const totalUSA = redondearUSD(
    incluidas.reduce((acc, p) => acc + p.cantidad * obtenerPrecioEstimadoUSA(p.medidaPulgadas, p.categoria), 0)
  )
  const ahorroUSD = redondearUSD(Math.max(0, totalUSA - totalChina))
  const porcentajeAhorro = totalUSA > 0 ? Math.round((ahorroUSD / totalUSA) * 100) : 0

  return {
    totalChinaUSD: totalChina,
    totalUSAUSD: totalUSA,
    ahorroUSD,
    porcentajeAhorro,
  }
}

export function generarTextoWeChat(
  seleccionadas: readonly EndmillMedida[],
  filas: Record<string, { cantidad: number; precio: number }>
): string {
  const incluidas = seleccionadas
    .map((medida) => ({ medida, fila: filas[medida.id] }))
    .filter((item) => item.fila && item.fila.cantidad > 0)

  const totalPiezas = incluidas.reduce((total, { fila }) => total + fila.cantidad, 0)
  const totalUSD = incluidas.reduce(
    (total, { fila }) => total + redondearUSD(fila.cantidad * fila.precio),
    0
  )

  return [
    "Hi Rita,",
    "Please confirm price & stock for the following end mills order:",
    "",
    ...incluidas.map(
      ({ medida, fila }, index) =>
        `${index + 1}. ${medida.medidaPulgadas}" ${medida.descripcion} (${medida.specPropuesta}) - Qty: ${fila.cantidad} pcs @ $${fila.precio.toFixed(2)} USD = $${redondearUSD(fila.cantidad * fila.precio).toFixed(2)} USD`
    ),
    "",
    `Total Items: ${incluidas.length} | Total Pieces: ${totalPiezas}`,
    `Estimated Total: $${redondearUSD(totalUSD).toFixed(2)} USD`,
    "Thank you! - SMV Maquinados",
  ].join("\n")
}

export function generarTextoWhatsApp(
  seleccionadas: readonly EndmillMedida[],
  filas: Record<string, { cantidad: number; precio: number }>,
  shippingUSD = 0,
  aliCostUSD = 0
): string {
  const incluidas = seleccionadas
    .map((medida) => ({ medida, fila: filas[medida.id] }))
    .filter((item) => item.fila && item.fila.cantidad > 0)

  const totalPiezas = incluidas.reduce((total, { fila }) => total + fila.cantidad, 0)
  const itemsUSD = incluidas.reduce(
    (total, { fila }) => total + redondearUSD(fila.cantidad * fila.precio),
    0
  )
  const totalFinalUSD = redondearUSD(itemsUSD + (shippingUSD || 0) + (aliCostUSD || 0))

  const lineasPartidas = incluidas.map(
    ({ medida, fila }, index) =>
      `🔹 *${index + 1}.* \`${medida.medidaPulgadas}"\` ${medida.descripcion}\n   ▫️ *Qty:* ${fila.cantidad} pcs  |  *Unit:* $${fila.precio.toFixed(2)} USD  |  *Sub:* $${redondearUSD(fila.cantidad * fila.precio).toFixed(2)} USD\n   ▫️ *Spec:* _${medida.specPropuesta}_`
  )

  const lineas = [
    `📦 *PURCHASE ORDER - SMV MAQUINADOS*`,
    `To: *Rita / ChangZhou North Alloy Tool Co.*`,
    `Date: *${fechaHoyLocal()}*`,
    ``,
    `Hello Rita, please confirm stock and lead time for this order:`,
    ``,
    ...lineasPartidas,
    ``,
    `───────────────`,
    `📊 *Items Total:* $${redondearUSD(itemsUSD).toFixed(2)} USD (${incluidas.length} items / ${totalPiezas} pcs)`,
  ]

  if (shippingUSD > 0) {
    lineas.push(`✈️ *Estimated Shipping (DHL/FedEx):* $${shippingUSD.toFixed(2)} USD`)
  }
  if (aliCostUSD > 0) {
    lineas.push(`💳 *Alibaba / Platform Fee:* $${aliCostUSD.toFixed(2)} USD`)
  }
  lineas.push(
    `💰 *TOTAL USD:* *$${totalFinalUSD.toFixed(2)} USD*`,
    `───────────────`,
    `Please prepare proforma invoice. Thank you! 🙏`
  )

  return lineas.join("\n")
}

export function generarEmailPedidoEndmills(
  seleccionadas: readonly EndmillMedida[],
  filas: Record<string, { cantidad: number; precio: number }>,
  proveedor: { nombre: string; contacto: string; email: string },
  shippingUSD = 0,
  aliCostUSD = 0,
  folioProveedor?: string
): { asunto: string; cuerpo: string; mailtoUrl: string } {
  const fechaHoy = fechaHoyLocal()
  const asunto = `Purchase Order - SMV Maquinados / ChangZhou North Alloy Tool Co. - ${fechaHoy}${folioProveedor ? ` (Ref: ${folioProveedor})` : ""}`
  const textoMensaje = generarTextoWhatsApp(seleccionadas, filas, shippingUSD, aliCostUSD)

  const mailtoUrl = `mailto:${proveedor.email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(textoMensaje)}`

  return {
    asunto,
    cuerpo: textoMensaje,
    mailtoUrl,
  }
}

