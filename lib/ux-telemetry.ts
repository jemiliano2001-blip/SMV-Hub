import type { Analytics } from "firebase/analytics"

export type WebVitalPermitido =
  | "CLS"
  | "FCP"
  | "INP"
  | "LCP"
  | "TTFB"
  | "Next.js-hydration"
  | "Next.js-route-change-to-render"
  | "Next.js-render"

export interface WebVitalEntrada {
  name: string
  value: number
  delta: number
  rating?: "good" | "needs-improvement" | "poor"
  navigationType?: string
}

export interface WebVitalSeguro {
  metric_name: WebVitalPermitido
  metric_value: number
  metric_delta: number
  metric_rating: "good" | "needs-improvement" | "poor" | "unknown"
  navigation_type: string
}

const METRICAS_PERMITIDAS = new Set<WebVitalPermitido>([
  "CLS",
  "FCP",
  "INP",
  "LCP",
  "TTFB",
  "Next.js-hydration",
  "Next.js-route-change-to-render",
  "Next.js-render",
])

const NAVEGACIONES_PERMITIDAS = new Set([
  "navigate",
  "reload",
  "back-forward",
  "back-forward-cache",
  "prerender",
  "restore",
])

export function prepararWebVital(metric: WebVitalEntrada): WebVitalSeguro | null {
  if (!METRICAS_PERMITIDAS.has(metric.name as WebVitalPermitido)) return null
  if (!Number.isFinite(metric.value) || !Number.isFinite(metric.delta)) return null

  const metricName = metric.name as WebVitalPermitido
  const scale = metricName === "CLS" ? 1000 : 1
  const navigationType =
    metric.navigationType && NAVEGACIONES_PERMITIDAS.has(metric.navigationType)
      ? metric.navigationType
      : "unknown"

  return {
    metric_name: metricName,
    metric_value: Math.round(metric.value * scale),
    metric_delta: Math.round(metric.delta * scale),
    metric_rating: metric.rating ?? "unknown",
    navigation_type: navigationType,
  }
}

function telemetriaHabilitada(): boolean {
  return (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_UX_TELEMETRY_ENABLED !== "false"
  )
}

async function cargarAnalytics(): Promise<{
  analytics: Analytics
  logEvent: typeof import("firebase/analytics")["logEvent"]
} | null> {
  if (!telemetriaHabilitada()) return null

  const [{ getClienteAnalytics }, { logEvent }] = await Promise.all([
    import("@/lib/firebase"),
    import("firebase/analytics"),
  ])
  const analytics = await getClienteAnalytics()
  return analytics ? { analytics, logEvent } : null
}

export async function registrarWebVital(metric: WebVitalEntrada): Promise<void> {
  const payload = prepararWebVital(metric)
  if (!payload) return

  try {
    const cliente = await cargarAnalytics()
    if (!cliente) return
    cliente.logEvent(cliente.analytics, "web_vital", payload)
  } catch {
    // La telemetría nunca debe afectar el recorrido del usuario.
  }
}

export async function registrarErrorInterfaz(
  scope: "app" | "proveedores"
): Promise<void> {
  try {
    const cliente = await cargarAnalytics()
    if (!cliente) return
    cliente.logEvent(cliente.analytics, "exception", {
      description: `ui_${scope}`,
      fatal: false,
    })
  } catch {
    // No enviamos mensajes, rutas, digests ni datos del usuario.
  }
}

