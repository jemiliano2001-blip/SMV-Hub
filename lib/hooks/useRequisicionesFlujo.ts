import { useState, useEffect, useCallback } from "react"
import {
  obtenerRequisicionesFlujo,
  crearRequisicionFlujo,
  obtenerCotizacionesRequisicion,
  agregarCotizacionRequisicion,
  seleccionarProveedorGanador,
  generarOrdenCompraDesdeRequisicion,
  type NuevaRequisicionFlujoPayload,
} from "@/lib/requisiciones-flujo"
import type { Requisicion, CotizacionRequisicion } from "@/lib/schemas"

export function useRequisicionesFlujo() {
  const [requisiciones, setRequisiciones] = useState<Requisicion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filtros
  const [busqueda, setBusqueda] = useState("")
  const [filtroEstatus, setFiltroEstatus] = useState<string>("todos")
  const [filtroPrioridad, setFiltroPrioridad] = useState<string>("todos")
  const [filtroDepartamento, setFiltroDepartamento] = useState<string>("todos")

  const cargarRequisiciones = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const data = await obtenerRequisicionesFlujo()
      setRequisiciones(data)
    } catch (err) {
      console.error("Error al cargar requisiciones:", err)
      setError("No se pudieron cargar las requisiciones.")
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    // Carga inicial: falso positivo (en montaje cargando ya es true, sin cascada).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarRequisiciones()
  }, [cargarRequisiciones])

  const requisicionesFiltradas = requisiciones.filter((r) => {
    const q = busqueda.toLowerCase().trim()
    const descMatch = r.descripcion?.toLowerCase().includes(q)
    const folioMatch = r.folio?.toLowerCase().includes(q)
    const solMatch = r.solicitante?.toLowerCase().includes(q)
    const matchesBusqueda = !q || descMatch || folioMatch || solMatch

    const matchesEstatus = filtroEstatus === "todos" || r.estatusFlujo === filtroEstatus || r.estado === filtroEstatus
    const matchesPrioridad = filtroPrioridad === "todos" || r.prioridadFlujo === filtroPrioridad || r.prioridad === filtroPrioridad
    const matchesDepto = filtroDepartamento === "todos" || r.departamento === filtroDepartamento || r.empresa === filtroDepartamento

    return matchesBusqueda && matchesEstatus && matchesPrioridad && matchesDepto
  })

  async function handleCrearRequisicion(payload: NuevaRequisicionFlujoPayload) {
    try {
      const nueva = await crearRequisicionFlujo(payload)
      setRequisiciones((prev) => [nueva, ...prev])
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
      await cargarRequisiciones()
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
      await cargarRequisiciones()
      return res
    } catch (err) {
      console.error("Error al generar Orden de Compra:", err)
      throw err
    }
  }

  return {
    requisiciones: requisicionesFiltradas,
    todasRequisiciones: requisiciones,
    cargando,
    error,
    busqueda,
    setBusqueda,
    filtroEstatus,
    setFiltroEstatus,
    filtroPrioridad,
    setFiltroPrioridad,
    filtroDepartamento,
    setFiltroDepartamento,
    recargar: cargarRequisiciones,
    crearRequisicion: handleCrearRequisicion,
    seleccionarGanador: handleSeleccionarGanador,
    generarOC: handleGenerarOC,
    obtenerCotizaciones: obtenerCotizacionesRequisicion,
    agregarCotizacion: agregarCotizacionRequisicion,
  }
}
