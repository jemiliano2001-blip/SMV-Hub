import {
  crearRequisicionFlujo,
  obtenerCotizacionesRequisicion,
  agregarCotizacionRequisicion,
  seleccionarProveedorGanador,
  generarOrdenCompraDesdeRequisicion,
  type NuevaRequisicionFlujoPayload,
} from "@/lib/requisiciones-flujo"
import type { Requisicion, CotizacionRequisicion } from "@/lib/schemas"

interface UseRequisicionesFlujoOptions {
  requisiciones: Requisicion[]
  recargar: () => Promise<void>
  guardarLocal: (requisicion: Requisicion) => void
}

export function useRequisicionesFlujo({
  requisiciones,
  recargar,
  guardarLocal,
}: UseRequisicionesFlujoOptions) {

  async function handleCrearRequisicion(payload: NuevaRequisicionFlujoPayload) {
    try {
      const nueva = await crearRequisicionFlujo(payload)
      guardarLocal(nueva)
      return nueva
    } catch (err) {
      console.error("Error al crear requisición:", err)
      throw new Error("No se pudo crear la requisición")
    }
  }

  async function handleSeleccionarGanador(
    requisicionId: string,
    cotizacionId: string,
    motivoSeleccion: string,
    usuario: string = "Compras SMV"
  ) {
    try {
      await seleccionarProveedorGanador(requisicionId, cotizacionId, motivoSeleccion, usuario)
      await recargar()
    } catch (err) {
      console.error("Error al seleccionar ganador:", err)
      throw err
    }
  }

  async function handleGenerarOC(
    requisicion: Requisicion,
    cotizacionGanadora: CotizacionRequisicion,
    condicionesPago?: string,
    fechaEntregaEstimada?: string,
    notasInternas?: string
  ) {
    try {
      const res = await generarOrdenCompraDesdeRequisicion(
        requisicion,
        cotizacionGanadora,
        condicionesPago,
        fechaEntregaEstimada,
        notasInternas
      )
      await recargar()
      return res
    } catch (err) {
      console.error("Error al generar Orden de Compra:", err)
      throw err
    }
  }

  async function handleAgregarCotizacion(
    payload: Omit<CotizacionRequisicion, "id" | "creadoEn">
  ) {
    const cotizacion = await agregarCotizacionRequisicion(payload)
    await recargar()
    return cotizacion
  }

  return {
    todasRequisiciones: requisiciones,
    crearRequisicion: handleCrearRequisicion,
    seleccionarGanador: handleSeleccionarGanador,
    generarOC: handleGenerarOC,
    obtenerCotizaciones: obtenerCotizacionesRequisicion,
    agregarCotizacion: handleAgregarCotizacion,
  }
}
