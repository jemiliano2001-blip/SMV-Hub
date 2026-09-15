/**
 * Cliente de `POST /api/memoria-operativa/consultar` (frente C, T2.5).
 *
 * Nunca lanza hacia la UI: devuelve `{ ok: false, motivo }` y el chip muestra "Sin historial
 * disponible". Corta a 8 s (spec §4: la memoria es un asistente, nunca bloquea la captura) y
 * acepta un `signal` externo para cancelar cuando el usuario sigue escribiendo.
 */

import { getClienteAuth } from "@/lib/firebase"
import {
  MAX_PIEZAS_POR_CONSULTA,
  type PiezaConsulta,
  type RespuestaMemoriaOperativa,
} from "@/lib/memoria-operativa/tipos"

export type { ContextoOperativo, PiezaConsulta, RespuestaMemoriaOperativa } from "@/lib/memoria-operativa/tipos"

export const TIMEOUT_MEMORIA_MS = 8_000

export type MotivoFalloMemoria = "sin_sesion" | "sin_permiso" | "timeout" | "cancelado" | "red" | "servidor" | "limite"

export type ResultadoConsultaMemoria =
  | { ok: true; respuesta: RespuestaMemoriaOperativa }
  | { ok: false; motivo: MotivoFalloMemoria; mensaje: string }

export interface OpcionesConsultaMemoria {
  signal?: AbortSignal
  timeoutMs?: number
  fetchFn?: typeof fetch
}

function limpiarPieza(p: PiezaConsulta): PiezaConsulta | null {
  const descripcion = p.descripcion?.trim() ?? ""
  if (!descripcion) return null
  return {
    descripcion: descripcion.slice(0, 500),
    numeroParte: p.numeroParte?.trim() || null,
    proveedor: p.proveedor?.trim() || null,
    proveedorId: p.proveedorId?.trim() || null,
    precioUnitario: typeof p.precioUnitario === "number" && Number.isFinite(p.precioUnitario) ? p.precioUnitario : null,
    moneda: p.moneda ?? null,
  }
}

/**
 * Consulta la memoria para hasta 20 piezas (las que tengan descripción). Devuelve los contextos
 * con `indice` relativo a la lista **enviada** (`piezasEnviadas`), para que el caller mapee de
 * vuelta a sus propios ítems.
 */
export async function consultarMemoriaOperativa(
  piezas: readonly PiezaConsulta[],
  opciones: OpcionesConsultaMemoria = {}
): Promise<ResultadoConsultaMemoria & { piezasEnviadas: PiezaConsulta[] }> {
  const piezasEnviadas = piezas.map(limpiarPieza).filter((p): p is PiezaConsulta => p !== null).slice(0, MAX_PIEZAS_POR_CONSULTA)
  if (piezasEnviadas.length === 0) {
    return {
      ok: true,
      piezasEnviadas,
      respuesta: { contextos: [], fuentesConsultadas: [], verPrecios: false, degradado: false, tiempoMs: 0 },
    }
  }

  const usuario = getClienteAuth().currentUser
  if (!usuario) return { ok: false, motivo: "sin_sesion", mensaje: "Inicia sesión para consultar el historial.", piezasEnviadas }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), opciones.timeoutMs ?? TIMEOUT_MEMORIA_MS)
  const externo = opciones.signal
  const onAbortExterno = () => controller.abort(externo?.reason)
  if (externo) {
    if (externo.aborted) onAbortExterno()
    else externo.addEventListener("abort", onAbortExterno, { once: true })
  }

  try {
    const token = await usuario.getIdToken()
    const fetchFn = opciones.fetchFn ?? fetch
    const respuesta = await fetchFn("/api/memoria-operativa/consultar", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ piezas: piezasEnviadas }),
      signal: controller.signal,
    })
    const body = (await respuesta.json().catch(() => ({}))) as Partial<RespuestaMemoriaOperativa> & { error?: string }
    if (respuesta.status === 401) return { ok: false, motivo: "sin_sesion", mensaje: body.error ?? "Sesión inválida.", piezasEnviadas }
    if (respuesta.status === 403) return { ok: false, motivo: "sin_permiso", mensaje: body.error ?? "Sin permiso.", piezasEnviadas }
    if (respuesta.status === 429) return { ok: false, motivo: "limite", mensaje: body.error ?? "Demasiadas consultas.", piezasEnviadas }
    if (!respuesta.ok || !Array.isArray(body.contextos)) {
      return { ok: false, motivo: "servidor", mensaje: body.error ?? `Error ${respuesta.status}`, piezasEnviadas }
    }
    return {
      ok: true,
      piezasEnviadas,
      respuesta: {
        contextos: body.contextos,
        fuentesConsultadas: body.fuentesConsultadas ?? [],
        verPrecios: body.verPrecios ?? false,
        degradado: body.degradado ?? false,
        tiempoMs: body.tiempoMs ?? 0,
      },
    }
  } catch (error) {
    if (controller.signal.aborted) {
      const esTimeout = controller.signal.reason instanceof DOMException && controller.signal.reason.name === "TimeoutError"
      return {
        ok: false,
        motivo: esTimeout ? "timeout" : "cancelado",
        mensaje: esTimeout ? "El historial tardó demasiado." : "Consulta cancelada.",
        piezasEnviadas,
      }
    }
    return { ok: false, motivo: "red", mensaje: error instanceof Error ? error.message : "Sin conexión.", piezasEnviadas }
  } finally {
    clearTimeout(timeout)
    externo?.removeEventListener("abort", onAbortExterno)
  }
}
